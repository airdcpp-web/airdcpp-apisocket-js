import APISocket from '../NodeSocket';

//@ts-ignore
import { WebSocket, Server } from 'mock-socket';

import { OutgoingRequest, RequestSuccessResponse, RequestErrorResponse } from '../types/api_internal';
import * as Options from '../types/options';



const mockConsole = {
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
};

const defaultSocketOptions: Options.APISocketOptions = {
  username: 'test',
  password: 'test',
  url: 'ws://localhost:7171/api/v1/',
  logOutput: mockConsole,
  logLevel: 'warn',
};

const authResponse = {
  cid: 'AHLUODI2YZ2U7FDWMHFNJU65ERGKUN4MH7GW5LY',
  permissions: [ 'admin' ],
  run_wizard: false,
  hostname: 'ubuntu-htpc',
  network_type: 'private',
  path_separator: '/',
  platform: 'other',
  auth_token: 'b823187f-4aab-4b71-9764-e63e88401a26',
  user: 'test',
};


declare type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;

export type MockSocketOptions = Omit<Options.APISocketOptions, 'username' | 'password' | 'url'> & {
  username?: string;
  password?: string;
  url?: string;
};

const getSocket = (options: MockSocketOptions = {}) => {
  const socket = APISocket(
    {
      ...defaultSocketOptions,
      ...options,
    }, 
    WebSocket
  );
  
  return socket;
};

type Callback = (requestData: object) => void;

const getMockServer = () => {
  const mockServer = new Server(defaultSocketOptions.url);

  const addServerHandler = (
    method: string, 
    path: string, 
    responseData: Omit<RequestSuccessResponse, 'callback_id'> | Omit<RequestErrorResponse, 'callback_id'>, 
    callback: Callback
  ) => {
    const handler = (jsonRequest: string) => {
      const requestObj: OutgoingRequest = JSON.parse(jsonRequest);

      if (requestObj.path !== path || requestObj.method !== method) {
        //console.log(requestObj, requestObj.path, path);
        return;
      }

      if (callback) {
        callback(requestObj);
      }

      const response: RequestSuccessResponse | RequestErrorResponse = {
        callback_id: requestObj.callback_id,
        ...responseData,
      };

      mockServer.send(JSON.stringify(response));
    };

    mockServer.addEventListener('message', handler);
  };

  mockServer.addErrorHandler = (
    method: string, 
    path: string, 
    errorStr: string, 
    errorCode: number, 
    callback: Callback
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
      callback
    );
  };

  mockServer.addDataHandler = (method: string, path: string, data: object, callback: Callback) => {
    addServerHandler(
      method, 
      path, 
      {
        data,
        code: 200,
      },
      callback
    );
  };

  return mockServer;
};

export { authResponse, defaultSocketOptions, getMockServer, getSocket, mockConsole };