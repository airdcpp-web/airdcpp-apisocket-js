import ApiConstants from './ApiConstants';

import SocketLogger, { LoggerOptions, Logger } from './SocketLogger';
import SocketSubscriptionHandler, { SocketSubscriptionOptions, SocketSubscriptions } from './SocketSubscriptionHandler';
import SocketRequestHandler, { 
  SocketRequestMethods, SocketRequestOptions, 
  TokenAuthenticationData, CredentialsAuthenticationData 
} from './SocketRequestHandler';

import invariant from 'invariant';
import Promise from './Promise';


export interface RequiredSocketOptions {
  url: string;
  username?: string;
  password?: string;
} 

export interface AdvancedSocketOptions {
  autoReconnect: boolean;
  reconnectInterval: number;
  userSession: boolean;
}

type UserOptions = RequiredSocketOptions & Partial<AdvancedSocketOptions> & 
  LoggerOptions & SocketSubscriptionOptions & SocketRequestOptions;
type FullOptions = RequiredSocketOptions & AdvancedSocketOptions & 
  LoggerOptions & SocketSubscriptionOptions & SocketRequestOptions;

export { UserOptions as APISocketOptions };

type AuthToken = string;

interface AuthenticationResponse {
  auth_token: AuthToken;
}

type ErrorHandler = (error: ErrorBase | string) => void;

interface LogoutResponse {

}

type ErrorType = 'missing_field' | 'invalid' | 'already_exists';

export interface ErrorFull {
  message: string;
  field: string;
  code: ErrorType;
}

export interface ErrorBase {
  code: number;
  message: string;
}

export interface ErrorResponse extends ErrorBase {
  json: ErrorFull;
}


type ConnectedCallback = (data: AuthenticationResponse) => void;
type SessionResetCallback = () => void;
type DisconnectedCallback = (reason: string, code: number) => void;

export interface APISocket extends SocketRequestMethods, SocketSubscriptions {
  connect: (username?: string, password?: string, reconnectOnFailure?: boolean) => Promise<AuthenticationResponse>; 
  disconnect: (autoConnect?: boolean) => void;
  reconnect: (token?: AuthToken, reconnectOnFailure?: boolean) => Promise<AuthenticationResponse>;
  logout: () => Promise<LogoutResponse>;

  isConnecting: () => boolean;
  isConnected: () => boolean;
  isActive: () => boolean;
  
  logger: Logger;

  onConnected: ConnectedCallback | null;
  onSessionReset: SessionResetCallback | null;
  onDisconnected: DisconnectedCallback | null;
  readonly nativeSocket: WebSocket | null;
}

type AuthenticationResolver = (response: AuthenticationResponse) => void;
type AuthenticationHandler = () => Promise<AuthenticationResponse>;
type ReconnectHandler = () => void;

const defaultOptions: AdvancedSocketOptions = {
  autoReconnect: true,
  reconnectInterval: 10,
  userSession: false,
};

const ApiSocket = (userOptions: UserOptions, WebSocketImpl: WebSocket) => {
  const options: FullOptions = {
    ...defaultOptions, 
    ...userOptions
  };

  let ws: WebSocket | null = null;
  let authToken: AuthToken | null = null;

  let socket: APISocket | null = null;
  let reconnectTimer: NodeJS.Timer;
  let disconnected = true;

  let connectedCallback: ConnectedCallback | null = null;
  let sessionResetCallback: SessionResetCallback | null = null;
  let disconnectedCallback: DisconnectedCallback | null = null;

  const logger = SocketLogger(options);

  const subscriptions: ReturnType<typeof SocketSubscriptionHandler> = SocketSubscriptionHandler(
    () => socket!, 
    logger, 
    options
  );

  const requests: ReturnType<typeof SocketRequestHandler> = SocketRequestHandler(() => socket!, logger, options);

  invariant(userOptions.url, '"url" must be defined in settings object');

  const resetSession = () => {
    if (authToken) {
      if (sessionResetCallback) {
        sessionResetCallback();
      }

      authToken = null;
    }
  };

  const onClosed = (event: CloseEvent) => {
    logger.info(event.reason ? `Websocket was closed: ${event.reason}` : 'Websocket was closed');

    requests.onSocketDisconnected();
    subscriptions.onSocketDisconnected();
    ws = null;
    
    if (disconnectedCallback) {
      disconnectedCallback(event.reason, event.code);
    }

    if (authToken && options.autoReconnect && !disconnected) {
      setTimeout(() => {
        socket!.reconnect()
          .catch((error: ErrorBase) => {
            logger.error('Reconnect failed for a closed socket', error.message);
          });
      });
    }
  };

  const onMessage = (event: MessageEvent) => {
    const messageObj = JSON.parse(event.data);
    if (messageObj.callback_id) {
      // Callback
      requests.handleMessage(messageObj);
    } else {
      // Listener message
      subscriptions.handleMessage(messageObj);
    }
  };

  const setSocketHandlers = () => {
    ws!.onerror = (event) => {
      logger.error(`Websocket failed: ${(event as any).reason}`);
    };

    ws!.onclose = onClosed;
    ws!.onmessage = onMessage;
  };

  // Connect handler for creation of new session
  const handleLogin = (username = options.username, password = options.password) => {
    if (!username) {
      throw '"username" option was not supplied for authentication';
    }

    if (!password) {
      throw '"password" option was not supplied for authentication';
    }

    const data: CredentialsAuthenticationData = {
      username, 
      password,
    };

    return requests.postAuthenticate(
      ApiConstants.LOGIN_URL, 
      data
    );
  };

  // Connect handler for associating socket with an existing session token
  const handleAuthorizeToken = () => {
    const data: TokenAuthenticationData = {
      auth_token: authToken!,
    };
    
    return requests.postAuthenticate(
      ApiConstants.CONNECT_URL, 
      data
    );
  };

  const authenticate = (
    resolve: AuthenticationResolver, 
    reject: ErrorHandler, 
    authenticationHandler: AuthenticationHandler, 
    reconnectHandler: ReconnectHandler
  ) => {
    authenticationHandler()
      .then((data: AuthenticationResponse) => {
        // Authentication succeed

        if (!authToken) {
          // New session
          logger.info('Login succeed');
          authToken = data.auth_token;
        } else {
          // Existing session
          logger.info('Socket associated with an existing session');
        }

        if (connectedCallback) {
          // Catch separately as we don't want an infinite reconnect loop
          try {
            connectedCallback(data);
          } catch (e) {
            console.error('Error in socket connect handler', e.message);
          }

          requests.onSocketConnected();
        }

        resolve(data);
      })
      .catch((error: ErrorBase) => {
        if (error.code) {
          if (authToken && error.code === 400 && options.autoReconnect) {
            // The session was lost (most likely the client was restarted)
            logger.info('Session lost, re-sending credentials');
            resetSession();

            authenticate(resolve, reject, handleLogin, reconnectHandler);
            return;
          } else if (error.code === 401) {
            // Invalid credentials, reset the token if we were reconnecting to avoid an infinite loop
            resetSession();
          }

          // Authentication was rejected
          socket!.disconnect();
        } else {
          // Socket was disconnected during the authentication
          logger.info('Socket disconnected during authentication, reconnecting');
          reconnectHandler();
          return;
        }

        reject(error);
      });
  };

  const connectInternal = (
    resolve: AuthenticationResolver, 
    reject: ErrorHandler, 
    authenticationHandler: AuthenticationHandler, 
    reconnectOnFailure = true
  ) => {
    ws = new (WebSocketImpl as any)(options.url);

    const scheduleReconnect = () => {
      ws = null;
      if (!reconnectOnFailure) {
        reject('Cannot connect to the server');
        return;
      }

      reconnectTimer = setTimeout(
        () => {
          logger.info('Socket reconnecting');
          connectInternal(resolve, reject, authenticationHandler, reconnectOnFailure);
        }, 
        options.reconnectInterval * 1000
      );
    };

    ws!.onopen = () => {
      logger.info('Socket connected');

      setSocketHandlers();
      authenticate(resolve, reject, authenticationHandler, scheduleReconnect);
    };

    ws!.onerror = (event) => {
      logger.error('Connecting socket failed');
      scheduleReconnect();
    };
  };

  const startConnect = (
    authenticationHandler: AuthenticationHandler, 
    reconnectOnFailure: boolean
  ): Promise<AuthenticationResponse> => {
    disconnected = false;
    return new Promise(
      (resolve, reject) => {
        logger.info('Starting socket connect');
        connectInternal(resolve, reject, authenticationHandler, reconnectOnFailure);
      }
    );
  };

  // Is the socket connected and authorized?
  const isConnected = () => {
    return !!(ws && ws.readyState === (ws.OPEN || 1) && authToken);
  };

  // Is the socket connected but not possibly authorized?
  const isConnecting = () => {
    return !!(ws && !isConnected());
  };

  const isActive = () => {
    return !!ws;
  };

  const cancelReconnect = () => {
    clearTimeout(reconnectTimer);
    disconnected = true;
  };

  // Disconnects the socket but keeps the session token
  const disconnect = (autoConnect = false) => {
    if (!ws) {
      if (!disconnected) {
        if (!autoConnect) {
          logger.warn('Disconnecting a closed socket with auto reconnect');
          cancelReconnect();
        }
      } else {
        logger.warn('Attempting to disconnect a closed socket');
        throw 'Attempting to disconnect a closed socket';
      }

      return;
    }

    logger.info('Disconnecting socket');

    if (!autoConnect) {
      cancelReconnect();
    }

    ws.close();
  };

  socket = {	
    connect: (username?: string, password?: string, reconnectOnFailure = true) => {
      if (isActive()) {
        throw 'Connect may only be used for a closed socket';
      }

      resetSession();

      return startConnect(() => handleLogin(username, password), reconnectOnFailure);
    },

    // Connect and attempt to associate the socket with an existing session
    reconnect: (token: AuthToken | undefined = undefined, reconnectOnFailure = true) => {
      if (isActive()) {
        throw 'Reconnect may only be used for a closed socket';
      }

      if (token) {
        authToken = token;
      }

      if (!authToken) {
        throw 'No session token available for reconnecting';
      }

      logger.info('Reconnecting socket');

      return startConnect(handleAuthorizeToken, reconnectOnFailure);
    },

    // Remove the associated API session and close the socket
    logout: () => {
      const resolver = Promise.pending();
      socket!.delete(ApiConstants.LOGOUT_URL)
        .then((data: LogoutResponse) => {
          logger.info('Logout succeed');
          resetSession();

          resolver.resolve(data);

          // Don't fire the disconnected event before resolver actions are handled
          disconnect();
        })
        .catch((error: ErrorBase) => {
          logger.error('Logout failed', error);
          resolver.reject(error);
        });

      return resolver.promise;
    },

    disconnect,
    isConnecting,
    isConnected,
    isActive,
    logger,

    // Function to call each time the socket has been connected (and authorized)
    set onConnected(handler: ConnectedCallback) {
      connectedCallback = handler;
    },

    // Function to call each time the stored session token was reset (manual logout/rejected reconnect)
    set onSessionReset(handler: SessionResetCallback) {
      sessionResetCallback = handler;
    },

    // Function to call each time the socket has been disconnected
    set onDisconnected(handler: DisconnectedCallback) {
      disconnectedCallback = handler;
    },

    get onConnected() {
      return connectedCallback!;
    },

    get onSessionReset() {
      return sessionResetCallback!;
    },

    get onDisconnected() {
      return disconnectedCallback!;
    },
    
    get nativeSocket() {
      return ws;
    },

    ...subscriptions.socket,
    ...requests.socket,
  };

  return socket!;
};

export default ApiSocket;
