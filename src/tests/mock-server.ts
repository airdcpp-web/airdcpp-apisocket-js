import { Socket } from '../NodeSocket.js';
import { Client, Server, WebSocket } from 'mock-socket';
import { jest } from '@jest/globals';

import { OutgoingRequest, RequestSuccessResponse, RequestErrorResponse } from '../types/api_internal.js';
import * as Options from '../types/options.js';
import ApiConstants from '../ApiConstants.js';
import { EventEmitter } from 'events';

const VERBOSE = false;

export const getMockConsole = () => ({
  log: jest.fn((a1: any, a2: any, a3: any, a4: any) => {
    if (VERBOSE) {
      console.log(a1, a2, a3, a4);
    }
  }),
  info: jest.fn((a1: any, a2: any, a3: any, a4: any) => {
    if (VERBOSE) {
      console.info(a1, a2, a3, a4);
    }
  }),
  warn: jest.fn((a1: any, a2: any, a3: any, a4: any) => {
    console.warn(a1, a2, a3, a4);
  }),
  error: jest.fn((a1: any, a2: any, a3: any, a4: any) => {
    console.error(a1, a2, a3, a4);
  }),
});

const DEFAULT_CONNECT_PARAMS = {
  username: 'test',
  password: 'test',
  url: 'ws://localhost:7171/api/v1/',
};

const getDefaultSocketOptions = (mockConsole: Options.LogOutput): Options.APISocketOptions => ({
  ...DEFAULT_CONNECT_PARAMS,
  logOutput: mockConsole,
  logLevel: VERBOSE ? 'verbose' : 'warn',
});

const DEFAULT_AUTH_RESPONSE = {
  auth_token: 'b823187f-4aab-4b71-9764-e63e88401a26',
  refresh_token: '5124faasf-4aab-4b71-9764-e63e88401a26',
  user: {
    permissions: [ 'admin' ],
    username: 'test',
    active_sessions: 1,
    last_login: 0,
  },
  system: {
    cid: 'AHLUODI2YZ2U7FDWMHFNJU65ERGKUN4MH7GW5LY',
    hostname: 'ubuntu-htpc',
    network_type: 'private',
    path_separator: '/',
    platform: 'other',
    language: 'fi',
  },
  wizard_pending: false,
};

export type MockSocketOptions = Omit<Options.APISocketOptions, 'username' | 'password' | 'url'> & {
  username?: string;
  password?: string;
  url?: string;
};

const getSocket = (socketOptions: MockSocketOptions = {}, mockConsole = getMockConsole()) => {
  const socket = Socket(
    {
      ...getDefaultSocketOptions(mockConsole),
      ...socketOptions,
    }, 
    WebSocket as any
  );
  
  return { socket, mockConsole };
};


type Callback = (requestData: object) => void;

interface ConnectOptions {
  socketOptions?: MockSocketOptions;
  authCallback?: Callback;
  authResponse?: object;
  console?: ReturnType<typeof getMockConsole>;
}

const getDefaultConnectOptions = () => ({
  console: getMockConsole(),
  authResponse: DEFAULT_AUTH_RESPONSE,
});

const getConnectedSocket = async (
  server: ReturnType<typeof getMockServer>, 
  userOptions?: ConnectOptions,
) => {
  const options = {
    ...getDefaultConnectOptions(),
    ...userOptions,
  };

  server.addRequestHandler('POST', ApiConstants.LOGIN_URL, options.authResponse, options.authCallback);

  const { socket, mockConsole } = getSocket(options.socketOptions, options.console);
  await socket.connect();

  return { socket, mockConsole };
};

const toEmitId = (path: string, method: string) => {
  return `${path}_${method}`;
};

interface MockServerOptions {
  url: string;
  reportMissingListeners?: boolean;
}

const DEFAULT_MOCK_SERVER_OPTIONS: MockServerOptions = {
  url: DEFAULT_CONNECT_PARAMS.url,
  reportMissingListeners: true,
}

type MockRequestResponseDataObject<DataT extends object | undefined> = Omit<RequestSuccessResponse<DataT>, 'callback_id'> | Omit<RequestErrorResponse, 'callback_id'>;
type MockRequestResponseDataHandler<DataT extends object | undefined> = (request: OutgoingRequest, s: WebSocket) => MockRequestResponseDataObject<DataT>;
type MockRequestResponseData<DataT extends object | undefined> = MockRequestResponseDataObject<DataT> | MockRequestResponseDataHandler<DataT>;

const getMockServer = (initialOptions: Partial<MockServerOptions> = {}) => {
  const { url, reportMissingListeners }: MockServerOptions = {
    ...DEFAULT_MOCK_SERVER_OPTIONS,
    ...initialOptions,
  };

  const mockServer = new Server(url);
  let socket: Client;
  const emitter = new EventEmitter();

  const send = (data: object) => {
    socket.send(JSON.stringify(data));
  };

  const addServerHandler = <DataT extends object | undefined>(
    method: string, 
    path: string, 
    responseData: MockRequestResponseData<DataT>,
    subscriptionCallback?: Callback
  ) => {
    emitter.addListener(
      toEmitId(path, method), 
      (request: OutgoingRequest, s: WebSocket) => {
        if (subscriptionCallback) {
          subscriptionCallback(request);
        }

        const data = typeof responseData === 'function' ? responseData(request, s) : responseData;
        const response: RequestSuccessResponse | RequestErrorResponse = {
          callback_id: request.callback_id,
          ...data,
        };

        s.send(JSON.stringify(response));
      }
    );
  };

  const addDummyDataHandler = (method: string, path: string) => {
    emitter.addListener(
      toEmitId(path, method), 
      (request: OutgoingRequest, s: WebSocket) => {
        // Do nothing
      }
    );
  }

  const addRequestHandler = <DataT extends object | undefined>(
    method: string, 
    path: string, 
    data?: DataT | MockRequestResponseDataHandler<DataT>, 
    subscriptionCallback?: Callback
  ) => {
    const handlerData = typeof data === 'function' ? data : {
      data,
      code: data ? 200 : 204,
    }

    addServerHandler<DataT>(
      method, 
      path, 
      handlerData, 
      subscriptionCallback
    );
  }

  const addErrorHandler = (
    method: string, 
    path: string, 
    errorStr: string | null, 
    errorCode: number, 
    subscriptionCallback?: Callback
  ) => {
    addServerHandler(
      method, 
      path, 
      {
        error: !errorStr ? null as any : {
          message: errorStr,
        },
        code: errorCode,
      }, 
      subscriptionCallback
    );
  }

  const addSubscriptionHandlerImpl = (
    moduleName: string,
    type: string,
    listenerName: string,
    entityId?: string | number,
  ) => {
    const subscribeFn = jest.fn();
    const unsubscribeFn = jest.fn();

    const path = entityId ? `${moduleName}/${entityId}/${type}/${listenerName}` : `${moduleName}/${type}/${listenerName}`;

    addRequestHandler('POST', path, undefined, subscribeFn);
    addRequestHandler('DELETE', path, undefined, unsubscribeFn);

    const fire = (data: object, entityId?: string | number) => {
      send({
        event: listenerName,
        data,
        id: entityId,
      });
    }

    return {
      fire,

      subscribeFn,
      unsubscribeFn,

      path,
    }
  }
  

  const addSubscriptionHandler = (
    moduleName: string,
    listenerName: string,
    entityId?: string | number,
  ) => {
    return addSubscriptionHandlerImpl(moduleName, 'listeners', listenerName, entityId);
  }

  const addHookHandler = (
    moduleName: string,
    listenerName: string,
  ) => {
    const subscriber = addSubscriptionHandlerImpl(moduleName, 'hooks', listenerName);

    const addResolver = (completionId: number) => {
      const resolveFn = jest.fn();
      const rejectFn = jest.fn();

      addRequestHandler(
        'POST', 
        `${subscriber.path}/${completionId}/resolve`, 
        undefined, 
        resolveFn
      );

      addRequestHandler(
        'POST', 
        `${subscriber.path}/${completionId}/reject`, 
        undefined, 
        rejectFn
      );

      const fire = (data: object) => {
        send({
          event: listenerName,
          data,
          completion_id: completionId,
        });
      }

      return { fire, resolveFn, rejectFn };
    };

    return {
      addResolver,

      ...subscriber,
    }
  }


  mockServer.on('connection', s => {
    socket = s;

    socket.on('message', (messageObj) => {
      const request: OutgoingRequest = JSON.parse(messageObj as string);
      const emitId = toEmitId(request.path, request.method);
      const processed = emitter.emit(emitId, request, s);
      if (reportMissingListeners && !processed) {
        console.warn(`Mock server: no listeners for event ${request.method} ${request.path}`);
      }
    });
  });

  mockServer.on('close', () => {
    emitter.removeAllListeners();
  });

  return {
    addRequestHandler,
    addErrorHandler,

    addSubscriptionHandler,
    addHookHandler,

    ignoreMissingHandler: addDummyDataHandler,
    stop: () => {
      mockServer.stop(() => {
        // ...
      });
    },
    send,
    url,
  };
};

export { getMockServer, getSocket, getConnectedSocket, DEFAULT_CONNECT_PARAMS, DEFAULT_AUTH_RESPONSE };