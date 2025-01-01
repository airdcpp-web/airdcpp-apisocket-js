import chalk from 'chalk';
import invariant from 'invariant';
import Promise, { PendingResult } from './Promise.js';

import { eventIgnored } from './utils.js';

import * as API from './types/api.js';
import * as APIInternal from './types/api_internal.js';
import * as Options from './types/options.js';
import * as Socket from './types/socket.js';
import { Logger } from './types/logger.js';
import { SocketRequestMethods, ErrorResponse } from './types/requests.js';


interface Callback {
  time: number;
  resolver: PendingResult;
  ignored: boolean;
}


const SocketRequestHandler = (
  socket: () => Socket.APISocket,
  logger: Logger, 
  { requestTimeout = 30, ignoredRequestPaths }: Options.SocketRequestOptions
) => {

  let callbacks: Record<string, Callback> = {};
  let currentCallbackId = 0;
  
  let timeoutReportInterval: any;

  // Internal

  // This creates a new callback ID for a request
  const getCallbackId = () => {
    if (currentCallbackId > 100000) {
      currentCallbackId = 0;
    }

    currentCallbackId += 1;
    return currentCallbackId;
  };

  const filterPassword = (data: object | undefined): object | undefined => {
    if (!data || !data.hasOwnProperty('password')) {
      return data;
    }

    return {
      ...data,
      password: '(hidden)',
    };
  };

  const sendRequest = <DataT extends object | undefined>(
    method: string, path: string, data?: DataT, authenticating: boolean = false
  ) => {
    // Pre-checks
    if (!authenticating && !socket().isConnected()) {
      logger.warn(`Attempting to send request on a non-authenticated socket: ${path}`);
      return Promise.reject(new Error('Not authorized'));
    }

    if (!socket().nativeSocket) {
      logger.warn(`Attempting to send request without a socket: ${path}`);
      return Promise.reject(new Error('No socket'));
    }

    const callbackId = getCallbackId();

    // Reporting
    invariant(path, 'Attempting socket request without a path');

    const ignored = eventIgnored(path, ignoredRequestPaths);
    if (!ignored) {
      logger.verbose(
        chalk.white.bold(callbackId.toString()), 
        method, 
        path, 
        data ? filterPassword(data) : '(no data)'
      );
    }

    // Callback
    const resolver = Promise.pending();

    callbacks[callbackId.toString()] = {
      time: Date.now(),
      resolver,
      ignored,
    };

    // Actual request
    const request = {
      path,
      method,
      data,
      callback_id: callbackId,
    } as APIInternal.OutgoingRequest;

    socket().nativeSocket!.send(JSON.stringify(request));
    return resolver.promise;
  };

  // Report timed out requests
  // This is more about spotting backend issues, such as frozen threads and dropped responses
  // The socket itself should handle actual connection issues
  const reportTimeouts = () => {
    const now = Date.now();
    Object.keys(callbacks).forEach(callbackId => {
      const request = callbacks[callbackId];
      if (request.time + (requestTimeout * 1000) < now) {
        logger.warn(`Request ${callbackId} timed out`);
      }
    });
  };

  const cancelPendingRequests = (message: string = 'Request cancelled') => {
    Object.keys(callbacks)
      .forEach(id => {
        logger.verbose(`Canceling a pending request ${id} (${message})`);

        const cb: Callback = callbacks[id];
        cb.resolver.reject(message);
      });

    callbacks = {};
  };

  // Public
  const RequestsPublic: SocketRequestMethods = {
    put: (path, data) => {
      return sendRequest('PUT', path, data, );
    },
  
    patch: (path, data) => {
      return sendRequest('PATCH', path, data, );
    },
  
    post: (path, data) => {
      return sendRequest('POST', path, data);
    },
  
    delete: (path) => {
      return sendRequest('DELETE', path);
    },
  
    get: (path) => {
      return sendRequest('GET', path);
    },
  
    getPendingRequestCount: () => {
      return Object.keys(callbacks).length;
    },
  };

  Object.assign(RequestsPublic, {
    reportRequestTimeouts: reportTimeouts, // internal method for testing
  });

  const formatFieldError = (error: API.FieldError) => {
    return error.field && error.code ? `${error.field} (${error.code})` : '';
  };

  // Shared for the socket
  const RequestsInternal = {
    onSocketConnected() {
      timeoutReportInterval = setInterval(reportTimeouts, 30000);
    },

    onSocketDisconnected() {
      // Clear callbacks
      cancelPendingRequests('Socket disconnected');

      clearTimeout(timeoutReportInterval);
    },

    handleMessage(messageObj: APIInternal.RequestSuccessResponse | APIInternal.RequestErrorResponse) {
      const id = messageObj.callback_id;
      if (!callbacks.hasOwnProperty(id)) {
        logger.warn('No pending request for an API response', id, messageObj);
        return;
      }

      if (messageObj.code >= 200 && messageObj.code <= 204) {
        const { data } = messageObj as APIInternal.RequestSuccessResponse;
        if (!callbacks[id].ignored) {
          logger.verbose(chalk.green(id.toString()), 'SUCCEEDED', data ?? '(no data)');
        }

        callbacks[id].resolver.resolve(data);
      } else {
        const errorMessageObj = messageObj as APIInternal.RequestErrorResponse;

        if (!errorMessageObj.error) {
          // API should always return an error message but this isn't always the case
          // (e.g. https://github.com/airdcpp/airdcpp-windows/commit/596b31a9c8c4e72f6c9279972a40ea30f10798c4)
          logger.warn(
            'Error message missing from the response (this is an API bug that should be reported)', 
            id, 
            messageObj
          );
        }

        const { code } = errorMessageObj;
        const error = errorMessageObj.error || { 
          message: '(no error description)'
        };

        logger.warn(id, code, error.message, formatFieldError(error as API.FieldError));
        callbacks[id].resolver.reject({ 
          message: error.message, 
          code, 
          json: error 
        } as ErrorResponse);
      }

      delete callbacks[id];
    },

    postAuthenticate(
      path: string, 
      data: API.TokenAuthenticationData | API.CredentialsAuthenticationData | API.RefreshTokenAuthenticationData
    ) {
      return sendRequest('POST', path, data, true);
    },
  };

  return {
    ...RequestsInternal,
    socket: RequestsPublic,
  };
};

export default SocketRequestHandler;