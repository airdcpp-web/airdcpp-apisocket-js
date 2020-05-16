import { Socket } from '../NodeSocket';
import { WebSocket, Server } from 'mock-socket';

import { OutgoingRequest, RequestSuccessResponse, RequestErrorResponse } from '../types/api_internal';
import * as Options from '../types/options';
import ApiConstants from '../ApiConstants';
import { EventEmitter } from 'events';



const getMockConsole = () => ({
  log: jest.fn((a1: any, a2: any, a3: any, a4: any) => {
    //console.log(a1, a2, a3, a4);
  }),
  info: jest.fn((a1: any, a2: any, a3: any, a4: any) => {
    //console.info(a1, a2, a3, a4);
  }),
  warn: jest.fn((a1: any, a2: any, a3: any, a4: any) => {
    console.warn(a1, a2, a3, a4);
  }),
  error: jest.fn((a1: any, a2: any, a3: any, a4: any) => {
    console.error(a1, a2, a3, a4);
  }),
});

const CONNECT_PARAMS = {
  username: 'test',
  password: 'test',
  url: 'ws://localhost:7171/api/v1/',
};

const getDefaultSocketOptions = (mockConsole: Options.LogOutput): Options.APISocketOptions => ({
  ...CONNECT_PARAMS,
  logOutput: mockConsole,
  logLevel: 'warn',
});

const AUTH_RESPONSE = {
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

const getSocket = (options: MockSocketOptions = {}) => {
  const mockConsole = getMockConsole();
  const socket = Socket(
    {
      ...getDefaultSocketOptions(mockConsole),
      ...options,
    }, 
    WebSocket as any
  );
  
  return { socket, mockConsole };
};


const getConnectedSocket = async (server: ReturnType<typeof getMockServer>, options?: MockSocketOptions) => {
  server.addDataHandler('POST', ApiConstants.LOGIN_URL, AUTH_RESPONSE);

  const { socket, mockConsole } = getSocket(options);
  await socket.connect();

  return { socket, mockConsole };
};

type Callback = (requestData: object) => void;

const toEmitId = (path: string, method: string) => {
  return `${path}_${method}`;
};

const getMockServer = () => {
  const mockServer = new Server(CONNECT_PARAMS.url);
  let socket: WebSocket;
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

    socket.on('message', (messageObj: string) => {
      const request: OutgoingRequest = JSON.parse(messageObj);
      emitter.emit(toEmitId(request.path, request.method), request, s);
    });
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
      errorStr: string, 
      errorCode: number, 
      subscriptionCallback?: Callback
    ) => {
      addServerHandler(
        method, 
        path, 
        {
          error: {
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
  };
};

export { getMockServer, getSocket, getConnectedSocket, CONNECT_PARAMS, AUTH_RESPONSE };