import { Socket } from '../../NodeSocket.js';
import { WebSocket } from 'mock-socket';

import * as Options from '../../types/options.js';
import ApiConstants from '../../ApiConstants.js';

import { getMockServer } from './mock-server.js';
import { DEFAULT_AUTH_RESPONSE, DEFAULT_CONNECT_PARAMS } from './mock-data.js';

const getDefaultSocketOptions = (): Options.APISocketOptions => ({
  ...DEFAULT_CONNECT_PARAMS,
  logOutput: console,
  logLevel: 'warn',
});

export type MockSocketConnectOptions = Omit<Options.APISocketOptions, 'username' | 'password' | 'url'> & {
  username?: string;
  password?: string;
  url?: string;
};


type RequestCallback = (requestData: object) => void;

interface MockSocketOptions {
  console: Options.LogOutput;
  socketOptions?: MockSocketConnectOptions;
}

interface MockConnectedSocketOptions extends MockSocketOptions {
  authCallback?: RequestCallback;
  authResponse: object;
}


export const getSocket = (socketOptions: MockSocketConnectOptions = {}) => {
  const socket = Socket(
    {
      ...getDefaultSocketOptions(),
      ...socketOptions,
    },
    WebSocket as any
  );
  
  return { socket };
};

const getDefaultConnectOptions = () => ({
  console,
  authResponse: DEFAULT_AUTH_RESPONSE,
});

export const getConnectedSocket = async (
  server: ReturnType<typeof getMockServer>, 
  userOptions?: Partial<MockConnectedSocketOptions>,
) => {
  const options: MockConnectedSocketOptions = {
    ...getDefaultConnectOptions(),
    ...userOptions,
  };

  server.addRequestHandler('POST', ApiConstants.LOGIN_URL, options.authResponse, options.authCallback);

  const { socket } = getSocket(options.socketOptions);
  await socket.connect();

  return { socket };
};
