import chalk from 'chalk';
import invariant from 'invariant';
import Promise, { PendingResult } from './Promise';

import { eventIgnored, IgnoreMatcher } from './utils';
import { APISocket, ErrorFull } from './SocketBase';
import { Logger } from './SocketLogger';


export interface SocketRequestMethods {
  put: <ResponseT extends object | void>(path: string, data?: object) => Promise<ResponseT>;
  patch: <ResponseT extends object | void>(path: string, data?: object) => Promise<ResponseT>;
  post: <ResponseT extends object | void>(path: string, data?: object) => Promise<ResponseT>;
  delete: <ResponseT extends object | void>(path: string) => Promise<ResponseT>;
  get: <ResponseT extends object | void>(path: string) => Promise<ResponseT>;
  getPendingRequestCount: () => number;
}

interface RequestResponse<DataT = any> {
  code: number;
  callback_id: number;
  data?: DataT;
  error: ErrorFull;
}

export interface Request {
  path: string;
  method: string;
  data: object | undefined;
  callback_id: number;
}

interface Callback {
  time: number;
  resolver: PendingResult;
  ignored: boolean;
}

export interface SocketRequestOptions {
  ignoredRequestPaths?: IgnoreMatcher;
  requestTimeout?: number;
}

export interface CredentialsAuthenticationData {
  username: string;
  password: string;
  max_inactivity?: number;
}

export interface TokenAuthenticationData {
  auth_token: string;
}

const SocketRequestHandler = (
  socket: () => APISocket, 
  logger: Logger, 
  { requestTimeout = 30, ignoredRequestPaths }: SocketRequestOptions
) => {

  let callbacks: { [key: number]: Callback } = {};
  let currentCallbackId = 0;
  
  let timeoutReportInterval: NodeJS.Timer;

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
      return Promise.reject('Not authorized');
    }

    if (!socket().nativeSocket) {
      logger.warn(`Attempting to send request without a socket: ${path}`);
      return Promise.reject('No socket');
    }

    const callbackId = getCallbackId();

    // Reporting
    invariant(path, 'Attempting socket request without a path');

    const ignored = eventIgnored(path, ignoredRequestPaths);
    if (!ignored) {
      logger.verbose(chalk.white.bold(callbackId.toString()), method, path, data ? filterPassword(data) : '(no data)');
    }

    // Callback
    const resolver = Promise.pending();

    callbacks[callbackId] = {
      time: new Date().getTime(),
      resolver,
      ignored,
    };

    // Actual request
    const request = {
      path,
      method,
      data,
      callback_id: callbackId,
    } as Request;

    socket().nativeSocket!.send(JSON.stringify(request));
    return resolver.promise;
  };

  // Report timed out requests
  // This is more about spotting backend issues, such as frozen threads and dropped responses
  // The socket itself should handle actual connection issues
  const reportTimeouts = () => {
    const now = new Date().getTime();
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
        logger.verbose(`Disconnecting a pending request ${id} (${message})`);

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
      //invariant(!data, 'No data is allowed for delete command');
      return sendRequest('DELETE', path);
    },
  
    get: (path) => {
      //invariant(!data, 'No data is allowed for get command');
      return sendRequest('GET', path);
    },
  
    getPendingRequestCount: () => {
      return Object.keys(callbacks).length;
    },
  };

  Object.assign(RequestsPublic, {
    reportRequestTimeouts: reportTimeouts, // internal method for testing
  });

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

    handleMessage(messageObj: RequestResponse) {
      const id = messageObj.callback_id;
      if (!callbacks.hasOwnProperty(id)) {
        logger.warn('No pending request for an API response', id, messageObj);
        return;
      }

      if (messageObj.code >= 200 && messageObj.code <= 204) {
        if (!callbacks[id].ignored) {
          logger.verbose(chalk.green(id.toString()), 'SUCCEEDED', messageObj.data ? messageObj.data : '(no data)');
        }

        callbacks[id].resolver.resolve(messageObj.data);
      } else {
        const { error, code } = messageObj;
        invariant(!!error, 'Invalid error response received from the API');
        logger.warn(id, code, error.message, error.field ? error.field : '');
        
        callbacks[id].resolver.reject({ 
          message: error.message, 
          code, 
          json: error 
        });
      }

      delete callbacks[id];
    },

    postAuthenticate(path: string, data: TokenAuthenticationData | CredentialsAuthenticationData) {
      return sendRequest('POST', path, data, true);
    },
  };

  return {
    ...RequestsInternal,
    socket: RequestsPublic,
  };
};

export default SocketRequestHandler;