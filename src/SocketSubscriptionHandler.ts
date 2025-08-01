import invariant from 'invariant';
import { EventEmitter } from 'events';

import { eventIgnored } from './utils.js';
import Promise, { PendingResult } from './Promise.js';

import { Logger } from './types/logger.js';
import * as API from './types/api.js';
import * as APIInternal from './types/api_internal.js';
import * as Options from './types/options.js';
import * as Requests from './types/requests.js';
import * as Socket from './types/socket.js';
import * as Subscriptions from './types/subscriptions.js';


interface PendingSubscription { 
  resolver: PendingResult;
  removeHandler: Subscriptions.SubscriptionRemoveHandler; 
}

const SocketSubscriptionHandler = (
  socket: () => Socket.APISocket, 
  logger: Logger, 
  { ignoredListenerEvents = [] }: Options.SocketSubscriptionOptions
) => {
  // Internal
  const getEmitId = (event: string, id?: API.EntityId) => {
    invariant(id !== 0, 'Entity ID "0" is not allowed');
    return id ? (event + id) : event;
  };

  const getSubscriptionUrl = (moduleUrl: string, id: API.EntityId | undefined, event: string) => {
    if (id) {
      return `${moduleUrl}/${id}/listeners/${event}`;
    }

    return `${moduleUrl}/listeners/${event}`;
  };

  let subscriptions: { [key: string]: number } = {};
  const emitter = new EventEmitter();

  // Subscriptions pending to be added in the API
  const pendingSubscriptions: { [key: string]: PendingSubscription[] } = {};

  const removeSocketListener = async (
    subscriptionUrl: string, 
    subscriptionId: string, 
    callback: Subscriptions.HookCallback<any, any> | Subscriptions.SubscriptionCallback<any>, 
    sendApi: boolean
  ) => {
    if (!socket().isConnected()) {
      return;
    }

    subscriptions[subscriptionId]--;
    emitter.removeListener(subscriptionId, callback);

    if (subscriptions[subscriptionId] === 0) {
      if (sendApi && socket().isConnected()) {
        try {
          await socket().delete(subscriptionUrl);
        } catch (error) {
          const e: Requests.ErrorResponse = error;
          logger.error('Failed to remove socket listener', subscriptionUrl, e);
        };
      }

      delete subscriptions[subscriptionId];
    }
  };

  const removeLocalListener = (
    subscriptionId: string, 
    callback: Subscriptions.HookCallback<any, any> | Subscriptions.SubscriptionCallback<any>
  ) => {
    emitter.removeListener(subscriptionId, callback);
  };

  const handleHookAction = <DataT extends object, CompletionDataT extends object>(
    subscriptionUrl: string, 
    callback: Subscriptions.HookCallback<DataT, CompletionDataT>, 
    data: DataT, 
    completionId: APIInternal.CompletionIdType
  ) => {
    callback(
      data, 
      completionData => {
        socket().post(`${subscriptionUrl}/${completionId}/resolve`, completionData)
          .catch((error) => logger.error('Failed to complete hook action', subscriptionUrl, error));
      }, 
      (rejectId, rejectMessage) => {
        socket().post(`${subscriptionUrl}/${completionId}/reject`, {
          reject_id: rejectId,
          message: rejectMessage,
        }).catch(error => logger.error('Failed to complete failed hook action', subscriptionUrl, error));
      }
    );
  };

  const onSubscriptionAddSucceeded = (subscriptionId: string) => {
    const pending = pendingSubscriptions[subscriptionId];
    pending.forEach(pendingItem => pendingItem.resolver.resolve(pendingItem.removeHandler));

    subscriptions[subscriptionId] = pending.length;
    delete pendingSubscriptions[subscriptionId];
  };

  const onSubscriptionAddFailed = (subscriptionId: string, error: Requests.ErrorResponse) => {
    const pending = pendingSubscriptions[subscriptionId];
    pending.forEach(pendingItem => pendingItem.resolver.reject(error));

    delete pendingSubscriptions[subscriptionId];
  };

  const addPendingEntry = <DataT extends object>(
    subscriptionUrl: string, 
    subscriptionId: string, 
    callback: Subscriptions.HookCallback<any, any> | Subscriptions.SubscriptionCallback<any>, 
    data?: DataT
  ): Promise<Subscriptions.SubscriptionRemoveHandler> => {
    const removeHandler = (sendApi = true) => removeSocketListener(subscriptionUrl, subscriptionId, callback, sendApi);

    if (!subscriptions[subscriptionId]) {
      if (!pendingSubscriptions[subscriptionId]) {
        pendingSubscriptions[subscriptionId] = [];
        socket()
          .post(subscriptionUrl, data)
          .then(
            onSubscriptionAddSucceeded.bind(SocketSubscriptionHandler, subscriptionId), 
            onSubscriptionAddFailed.bind(SocketSubscriptionHandler, subscriptionId)
          );
      }

      const resolver = Promise.pending();
      pendingSubscriptions[subscriptionId].push({ 
        resolver, 
        removeHandler 
      });

      return resolver.promise;
    }

    subscriptions[subscriptionId]++;
    return Promise.resolve(removeHandler);
  };

  const getTotalEmitterSubscriptionCount = (): number => {
    return Object.keys(subscriptions)
      .reduce((reduced, name) => emitter.listenerCount(name) + reduced, 0);
  };

  // Public

  // Listen to a specific event without sending subscription to the server
  const SocketSubscriptionsPublic: Subscriptions.SocketSubscriptions = {
    addViewUpdateListener: (viewName, callback, entityId) => {
      const subscriptionId = getEmitId(`${viewName}_updated`, entityId);
      emitter.on(subscriptionId, callback);
      return () => removeLocalListener(subscriptionId, callback); 
    },
  
    // Listen to a specific event and manage the API subscription automatically
    addListener: (apiModule, event, callback, entityId) => {
      if (!socket().isConnected()) {
        throw 'Listeners can be added only for a connected socket';
      }
    
      invariant(
        apiModule.indexOf('/') === -1, 
        'The first argument should only contain the API section without any path tokens (entity ID should be supplied separately)'
      );
  
      const subscriptionId = getEmitId(event, entityId);
      const subscriptionUrl = getSubscriptionUrl(apiModule, entityId, event);
  
      emitter.on(subscriptionId, callback);
      return addPendingEntry(subscriptionUrl, subscriptionId, callback);
    },
  
    hasListeners: () => {
      return Object.keys(subscriptions).length > 0 || getTotalEmitterSubscriptionCount() > 0;
    },
  
    addHook: <DataT extends object, CompletionDataT extends object | undefined>(
      apiModule: string, 
      event: string, 
      callback: Subscriptions.HookCallback<DataT, CompletionDataT>, 
      subscriberInfo: Subscriptions.HookSubscriberInfo
    ) => {
      if (!socket().isConnected()) {
        throw 'Hooks can be added only for a connected socket';
      }
    
      invariant(
        apiModule.indexOf('/') === -1, 
        'The first argument should only contain the API section without any path tokens'
      );
  
      const subscriptionId = event;
      if (subscriptions[subscriptionId] || pendingSubscriptions[subscriptionId]) {
        throw 'Hook exists';
      }
  
      const subscriptionUrl = `${apiModule}/hooks/${event}`;
  
      callback = handleHookAction.bind(SocketSubscriptionHandler, subscriptionUrl, callback);
      emitter.on(subscriptionId, callback);
  
      return addPendingEntry(subscriptionUrl, subscriptionId, callback, subscriberInfo);
    },
  
    getPendingSubscriptionCount: () => {
      return Object.keys(pendingSubscriptions).length;
    },
  };

  // For the socket
  const SocketSubscriptionsInternal = {
    onSocketDisconnected() {
      emitter.removeAllListeners();
      subscriptions = {};
    },

    handleMessage(message: APIInternal.IncomingSubscriptionEvent) {
      const ignored = eventIgnored(message.event, ignoredListenerEvents);
      if (message.completion_id) {
        if (!ignored) {
          logger.verbose(message.event, `(completion id ${message.completion_id})`, message.data);
        }

        emitter.emit(message.event, message.data, message.completion_id);
      } else {
        if (!ignored) {
          logger.verbose(message.event, message.id ? `(entity ${message.id})` : '(no entity)', message.data);
        }

        if (message.id) {
          // There can be subscribers for a single entity or for all events of this type... emit for both
          emitter.emit(getEmitId(message.event, message.id), message.data, message.id);
        }

        emitter.emit(message.event, message.data, message.id);
      }
    },
  };

  return {
    ...SocketSubscriptionsInternal,
    socket: SocketSubscriptionsPublic,
  };
};

export default SocketSubscriptionHandler;