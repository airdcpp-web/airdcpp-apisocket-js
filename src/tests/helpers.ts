import { Socket } from '../NodeSocket.js';
import { Client, Server, WebSocket } from 'mock-socket';
import { jest } from '@jest/globals';

import { OutgoingRequest, RequestSuccessResponse, RequestErrorResponse } from '../types/api_internal.js';
import * as Options from '../types/options.js';
import ApiConstants from '../ApiConstants.js';
import { EventEmitter } from 'events';

import waitForExpectOriginal from 'wait-for-expect';

const EXCEPT_TIMEOUT = 1000;
//@ts-ignore
export const waitForExpect = (func: () => void | Promise<void>) => waitForExpectOriginal.default(func, EXCEPT_TIMEOUT);

const VERBOSE = false;

const getMockConsole = () => ({
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

  server.addDataHandler('POST', ApiConstants.LOGIN_URL, options.authResponse, options.authCallback);

  const { socket, mockConsole } = getSocket(options.socketOptions, options.console);
  await socket.connect();

  return { socket, mockConsole };
};

const toEmitId = (path: string, method: string) => {
  return `${path}_${method}`;
};

const getMockServer = (url = DEFAULT_CONNECT_PARAMS.url) => {
  const mockServer = new Server(url);
  let socket: Client;
  const emitter = new EventEmitter();

  const addServerHandler = <DataT extends object | undefined>(
    method: string, 
    path: string, 
    responseData: Omit<RequestSuccessResponse<DataT>, 'callback_id'> | Omit<RequestErrorResponse, 'callback_id'>, 
    subscriptionCallback?: Callback
  ) => {
    emitter.addListener(
      toEmitId(path, method), 
      (request: OutgoingRequest, s: WebSocket) => {
        if (subscriptionCallback) {
          subscriptionCallback(request);
        }

        const response: RequestSuccessResponse | RequestErrorResponse = {
          callback_id: request.callback_id,
          ...responseData,
        };

        s.send(JSON.stringify(response));
      }
    );
  };

  mockServer.on('connection', s => {
    socket = s;

    socket.on('message', (messageObj) => {
      const request: OutgoingRequest = JSON.parse(messageObj as string);
      emitter.emit(toEmitId(request.path, request.method), request, s);
    });
  });

  mockServer.on('close', () => {
    emitter.removeAllListeners();
  });

  return {
    addDataHandler: <DataT extends object | undefined>(
      method: string, 
      path: string, 
      data?: DataT, 
      subscriptionCallback?: Callback
    ) => {
      addServerHandler<DataT>(
        method, 
        path, {
          data,
          code: 200,
        }, 
        subscriptionCallback
      );
    },
    addErrorHandler: (
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
    },
    stop: () => {
      mockServer.stop(() => {
        // ...
      });
    },
    send: (data: object) => {
      socket.send(JSON.stringify(data));
    },
    url,
  };
};

export { getMockServer, getSocket, getConnectedSocket, DEFAULT_CONNECT_PARAMS, DEFAULT_AUTH_RESPONSE };