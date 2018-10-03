import invariant from 'invariant';
import { EventEmitter } from 'events';

import { eventIgnored, IgnoreMatcher } from './utils';
import { APISocket, ErrorResponse } from './SocketBase';
import { Logger } from './SocketLogger';
import Promise, { PendingResult } from './Promise';


type CompletionIdType = number;
type SubscriptionIdType = string;
type EntityId = string | number;

export interface SubscriptionEvent<DataT = any> {
  event: string;
  data: DataT;
  completion_id?: CompletionIdType;
  id?: EntityId;
}

interface PendingSubscription { 
  resolver: PendingResult;
  removeHandler: SubscriptionRemoveHandler; 
}


// OPTIONS
export interface SocketSubscriptionOptions {
  ignoredListenerEvents?: IgnoreMatcher;
}


// SUBSCRIPTIONS
export type SubscriptionRemoveHandler = (sendApi?: boolean) => void;

export type SubscriptionCallback<DataT extends object | void = object> = (data: DataT) => void;


// HOOKS
export interface HookSubscriberInfo {
  id: string;
  name: string;
}

export type HookRejectHandler = (rejectId: string, rejectMessage: string) => void;
export type HookAcceptHandler<DataT extends object> = (data: DataT) => void;

export type HookCallback<DataT extends object = object, CompletionDataT extends object = object> = (
  data: DataT,
  accept: HookAcceptHandler<CompletionDataT>,
  reject: HookRejectHandler,
) => void;


// SOCKET METHODS
/*export type AddViewUpdateListener<DataT extends object = any> = (
  viewName: string, callback: SubscriptionCallback<DataT>, entityId?: EntityId
) => () => void;
export type AddListener<DataT extends object | void = any> = (
  apiModuleUrl: string, event: string, callback: SubscriptionCallback<DataT>, entityId?: EntityId
) => Promise<SubscriptionRemoveHandler>;
export type AddHook<DataT extends object = any> = (
  apiModuleUrl: string, 
  event: SubscriptionIdType, 
  callback: HookCallback<DataT>, 
  subscriberInfo: HookSubscriberInfo
) => Promise<SubscriptionRemoveHandler>;*/


export interface SocketSubscriptions {
  //addViewUpdateListener: AddViewUpdateListener;
  //addListener: AddListener;
  //addHook: AddHook;
  addHook: <DataT extends object, CompletionDataT extends object>(
    apiModuleUrl: string, 
    event: SubscriptionIdType, 
    callback: HookCallback<DataT, CompletionDataT>, 
    subscriberInfo: HookSubscriberInfo
  ) => Promise<SubscriptionRemoveHandler>;

  addListener: <DataT extends object | void>(
    apiModuleUrl: string, 
    event: string, 
    callback: SubscriptionCallback<DataT>, 
    entityId?: EntityId
  ) => Promise<SubscriptionRemoveHandler>;

  addViewUpdateListener: <DataT extends object | void>(
    viewName: string, 
    callback: SubscriptionCallback<DataT>, 
    entityId?: EntityId
  ) => () => void;

  hasListeners: () => boolean;
  getPendingSubscriptionCount: () => number;
}

export type AddHook = SocketSubscriptions['addHook'];
export type AddListener = SocketSubscriptions['addListener'];
export type AddViewUpdateListener = SocketSubscriptions['addViewUpdateListener'];



const SocketSubscriptionHandler = (
  socket: () => APISocket, 
  logger: Logger, 
  { ignoredListenerEvents = [] }: SocketSubscriptionOptions
) => {
  // Internal
  const getEmitId = (event: string, id?: EntityId) => {
    invariant(id !== 0, 'Entity ID "0" is not allowed');
    return id ? (event + id) : event;
  };

  const getSubscriptionUrl = (moduleUrl: string, id: EntityId | undefined, event: string) => {
    if (id) {
      return `${moduleUrl}/${id}/listeners/${event}`;
    }

    return `${moduleUrl}/listeners/${event}`;
  };

  let subscriptions: { [key: string]: number } = {};
  const emitter = new EventEmitter();

  // Subscriptions pending to be added in the API
  const pendingSubscriptions: { [key: string]: PendingSubscription[] } = {};

  const removeSocketListener = (
    subscriptionUrl: string, 
    subscriptionId: SubscriptionIdType, 
    callback: HookCallback<any, any> | SubscriptionCallback<any>, 
    sendApi: boolean
  ) => {
    if (!socket().isConnected()) {
      return;
    }

    subscriptions[subscriptionId]--;
    emitter.removeListener(subscriptionId, callback);

    if (subscriptions[subscriptionId] === 0) {
      if (sendApi && socket().isConnected()) {
        socket().delete(subscriptionUrl)
          .catch((error: ErrorResponse) => logger.error('Failed to remove socket listener', subscriptionUrl, error));
      }

      delete subscriptions[subscriptionId];
    }
  };

  const removeLocalListener = (
    subscriptionId: SubscriptionIdType, 
    callback: HookCallback<any, any> | SubscriptionCallback<any>
  ) => {
    emitter.removeListener(subscriptionId, callback);
  };

  const handleHookAction = <DataT extends object, CompletionDataT extends object>(
    apiModuleUrl: string, callback: HookCallback<DataT, CompletionDataT>, data: DataT, completionId: CompletionIdType
  ) => {
    callback(
      data, 
      completionData => {
        socket().post(`${apiModuleUrl}/${completionId}/resolve`, completionData)
          .catch((error) => logger.error('Failed to complete hook action', apiModuleUrl, error));
      }, 
      (rejectId, rejectMessage) => {
        socket().post(`${apiModuleUrl}/${completionId}/reject`, {
          reject_id: rejectId,
          message: rejectMessage,
        }).catch(error => logger.error('Failed to complete failed hook action', apiModuleUrl, error));
      }
    );
  };

  const onSubscriptionAddSucceeded = (subscriptionId: SubscriptionIdType) => {
    const pending = pendingSubscriptions[subscriptionId];
    pending.forEach(pendingItem => pendingItem.resolver.resolve(pendingItem.removeHandler));

    subscriptions[subscriptionId] = pending.length;
    delete pendingSubscriptions[subscriptionId];
  };

  const onSubscriptionAddFailed = (subscriptionId: SubscriptionIdType, error: ErrorResponse) => {
    const pending = pendingSubscriptions[subscriptionId];
    pending.forEach(pendingItem => pendingItem.resolver.reject(error));

    delete pendingSubscriptions[subscriptionId];
  };

  const addPendingEntry = <DataT extends object>(
    subscriptionUrl: string, 
    subscriptionId: SubscriptionIdType, 
    callback: HookCallback<any, any> | SubscriptionCallback<any>, 
    data?: DataT
  ): Promise<SubscriptionRemoveHandler> => {
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
      .reduce((reduced, name) => emitter.listenerCount(name), 0);
  };

  // Public

  // Listen to a specific event without sending subscription to the server
  const SocketSubscriptionsPublic: SocketSubscriptions = {
    addViewUpdateListener: (viewName, callback, entityId) => {
      const subscriptionId = getEmitId(`${viewName}_updated`, entityId);
      emitter.on(subscriptionId, callback);
      return () => removeLocalListener(subscriptionId, callback); 
    },
  
    // Listen to a specific event and manage the API subscription automatically
    addListener: (apiModuleUrl, event, callback, entityId) => {
      if (!socket().isConnected()) {
        throw 'Listeners can be added only for a connected socket';
      }
  
      const subscriptionId = getEmitId(event, entityId);
      const subscriptionUrl = getSubscriptionUrl(apiModuleUrl, entityId, event);
  
      emitter.on(subscriptionId, callback);
      return addPendingEntry(subscriptionUrl, subscriptionId, callback);
    },
  
    hasListeners: () => {
      return Object.keys(subscriptions).length > 0 || getTotalEmitterSubscriptionCount() > 0;
    },
  
    addHook: <DataT extends object, CompletionDataT extends object>(
      apiModuleUrl: string, 
      event: SubscriptionIdType, 
      callback: HookCallback<DataT, CompletionDataT>, 
      subscriberInfo: HookSubscriberInfo
    ) => {
      if (!socket().isConnected()) {
        throw 'Hooks can be added only for a connected socket';
      }
  
      const subscriptionId = event;
      if (subscriptions[subscriptionId] || pendingSubscriptions[subscriptionId]) {
        throw 'Hook exists';
      }
  
      const subscriptionUrl = `${apiModuleUrl}/hooks/${event}`;
  
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

    handleMessage(message: SubscriptionEvent) {
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