import ApiConstants from './ApiConstants.js';
import SocketLogger from './SocketLogger.js';
import SocketSubscriptionHandler from './SocketSubscriptionHandler.js';
import SocketRequestHandler from './SocketRequestHandler.js';
import invariant from 'invariant';
import Promise from './Promise.js';
// CONSTANTS
const defaultOptions = {
    autoReconnect: true,
    reconnectInterval: 10,
    userSession: false,
};
const ApiSocket = (userOptions, WebSocketImpl) => {
    const options = Object.assign(Object.assign({}, defaultOptions), userOptions);
    let ws = null;
    let authToken = null;
    let socket = null;
    let reconnectTimer;
    let forceNoAutoConnect = true;
    let connectedCallback = null;
    let sessionResetCallback = null;
    let disconnectedCallback = null;
    const logger = SocketLogger(options);
    const subscriptions = SocketSubscriptionHandler(() => socket, logger, options);
    const requests = SocketRequestHandler(() => socket, logger, options);
    invariant(userOptions.url, '"url" must be defined in settings object');
    const resetSession = () => {
        if (authToken) {
            if (sessionResetCallback) {
                sessionResetCallback();
            }
            authToken = null;
        }
    };
    const onClosed = (event) => {
        if (event.wasClean) {
            logger.info('Websocket was closed normally');
        }
        else {
            logger.error(`Websocket failed: ${event.reason} (code: ${event.code})`);
        }
        requests.onSocketDisconnected();
        subscriptions.onSocketDisconnected();
        ws = null;
        if (disconnectedCallback) {
            disconnectedCallback(event.reason, event.code, event.wasClean);
        }
        if (authToken && options.autoReconnect && !forceNoAutoConnect) {
            setTimeout(() => {
                if (forceNoAutoConnect) {
                    return;
                }
                socket.reconnect()
                    .catch((error) => {
                    logger.error('Reconnect failed for a closed socket', error.message);
                });
            });
        }
    };
    const onMessage = (event) => {
        const messageObj = JSON.parse(event.data);
        if (messageObj.callback_id) {
            // Callback
            requests.handleMessage(messageObj);
        }
        else {
            // Listener message
            subscriptions.handleMessage(messageObj);
        }
    };
    const setSocketHandlers = () => {
        ws.onerror = (event) => {
            logger.error(`Websocket failed: ${event.reason}`);
        };
        ws.onclose = onClosed;
        ws.onmessage = onMessage;
    };
    // Connect handler for creation of new session
    const handlePasswordLogin = (username = options.username, password = options.password) => {
        if (!username) {
            throw '"username" option was not supplied for authentication';
        }
        if (!password) {
            throw '"password" option was not supplied for authentication';
        }
        const data = {
            username,
            password,
            grant_type: 'password',
        };
        return requests.postAuthenticate(ApiConstants.LOGIN_URL, data);
    };
    const handleRefreshTokenLogin = (refreshToken) => {
        if (!refreshToken) {
            throw '"refreshToken" option was not supplied for authentication';
        }
        const data = {
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        };
        return requests.postAuthenticate(ApiConstants.LOGIN_URL, data);
    };
    // Connect handler for associating socket with an existing session token
    const handleAuthorizeToken = () => {
        const data = {
            auth_token: authToken,
        };
        return requests.postAuthenticate(ApiConstants.CONNECT_URL, data);
    };
    // Called after a successful authentication request
    const onSocketAuthenticated = (data) => {
        if (!authToken) {
            // New session
            logger.info('Login succeed');
            authToken = data.auth_token;
        }
        else {
            // Existing session
            logger.info('Socket associated with an existing session');
        }
        if (connectedCallback) {
            // Catch separately as we don't want an infinite reconnect loop
            try {
                connectedCallback(data);
            }
            catch (e) {
                console.error('Error in socket connect handler', e.message);
            }
            requests.onSocketConnected();
        }
    };
    // Send API authentication and handle the result
    // Authentication handler should send the actual authentication request
    const authenticate = (resolve, reject, authenticationHandler, reconnectHandler) => {
        authenticationHandler()
            .then((data) => {
            onSocketAuthenticated(data);
            resolve(data);
        })
            .catch((error) => {
            if (error.code) {
                if (authToken && error.code === 400 && options.autoReconnect) {
                    // The session was lost (most likely the client was restarted)
                    logger.info('Session lost, re-sending credentials');
                    resetSession();
                    authenticate(resolve, reject, handlePasswordLogin, reconnectHandler);
                    return;
                }
                else if (error.code === 401) {
                    // Invalid credentials, reset the token if we were reconnecting to avoid an infinite loop
                    resetSession();
                }
                // Authentication was rejected
                socket.disconnect(undefined, 'Authentication failed');
            }
            else {
                // Socket was disconnected during the authentication
                logger.info('Socket disconnected during authentication, reconnecting');
                reconnectHandler();
                return;
            }
            reject(error);
        });
    };
    // Authentication handler should send the actual authentication request
    const connectInternal = (resolve, reject, authenticationHandler, reconnectOnFailure = true) => {
        ws = new WebSocketImpl(options.url);
        const scheduleReconnect = () => {
            ws = null;
            if (!reconnectOnFailure) {
                reject('Cannot connect to the server');
                return;
            }
            reconnectTimer = setTimeout(() => {
                logger.info('Socket reconnecting');
                connectInternal(resolve, reject, authenticationHandler, reconnectOnFailure);
            }, options.reconnectInterval * 1000);
        };
        ws.onopen = () => {
            logger.info('Socket connected');
            setSocketHandlers();
            authenticate(resolve, reject, authenticationHandler, scheduleReconnect);
        };
        ws.onerror = (event) => {
            logger.error('Connecting socket failed');
            scheduleReconnect();
        };
    };
    // Authentication handler should send the actual authentication request
    const startConnect = (authenticationHandler, reconnectOnFailure) => {
        forceNoAutoConnect = false;
        return new Promise((resolve, reject) => {
            logger.info('Starting socket connect');
            connectInternal(resolve, reject, authenticationHandler, reconnectOnFailure);
        });
    };
    // Is the socket connected and authorized?
    const isConnected = () => {
        return !!(ws && ws.readyState === (ws.OPEN || 1) && authToken);
    };
    // Is the socket connected but not possibly authorized?
    const isConnecting = () => {
        return !!(ws && !isConnected());
    };
    // Socket exists
    const isActive = () => {
        return !!ws;
    };
    const disableReconnect = () => {
        clearTimeout(reconnectTimer);
        forceNoAutoConnect = true;
    };
    const waitDisconnected = (timeoutMs = 2000) => {
        const checkInterval = 50;
        const maxAttempts = timeoutMs > 0 ? timeoutMs / checkInterval : 0;
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const wait = () => {
                if (isActive()) {
                    if (attempts >= maxAttempts) {
                        logger.error(`Socket disconnect timed out after ${timeoutMs} ms`);
                        reject('Socket disconnect timed out');
                    }
                    else {
                        setTimeout(wait, checkInterval);
                        attempts++;
                    }
                }
                else {
                    resolve();
                }
            };
            wait();
        });
    };
    // Disconnects the socket but keeps the session token
    const disconnect = (autoConnect = false, reason = 'Manually disconnected by the client') => {
        if (!ws) {
            if (!forceNoAutoConnect) {
                if (!autoConnect) {
                    logger.verbose('Disconnecting a closed socket with auto reconnect enabled (cancel reconnect)');
                    disableReconnect();
                }
                else {
                    logger.verbose('Attempting to disconnect a closed socket with auto reconnect enabled (continue connecting)');
                }
            }
            else {
                logger.warn('Attempting to disconnect a closed socket (ignore)');
                //throw 'Attempting to disconnect a closed socket';
            }
            return;
        }
        logger.info('Disconnecting socket');
        if (!autoConnect) {
            disableReconnect();
        }
        ws.close(1000, reason);
    };
    socket = Object.assign(Object.assign({ 
        // Start connect
        // Username and password are not required if those are available in socket options
        connect: (username, password, reconnectOnFailure = true) => {
            if (isActive()) {
                throw 'Connect may only be used for a closed socket';
            }
            resetSession();
            return startConnect(() => handlePasswordLogin(username, password), reconnectOnFailure);
        }, connectRefreshToken: (refreshToken, reconnectOnFailure = true) => {
            if (isActive()) {
                throw 'Connect may only be used for a closed socket';
            }
            resetSession();
            return startConnect(() => handleRefreshTokenLogin(refreshToken), reconnectOnFailure);
        }, 
        // Connect and attempt to associate the socket with an existing session
        reconnect: (token = undefined, reconnectOnFailure = true) => {
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
            socket.delete(ApiConstants.LOGOUT_URL)
                .then((data) => {
                logger.info('Logout succeed');
                resetSession();
                resolver.resolve(data);
                // Don't fire the disconnected event before resolver actions are handled
                disconnect(undefined, 'Logged out');
            })
                .catch((error) => {
                logger.error('Logout failed', error);
                resolver.reject(error);
            });
            return resolver.promise;
        }, disconnect,
        isConnecting,
        isConnected,
        isActive,
        logger,
        waitDisconnected,
        // Function to call each time the socket has been connected (and authorized)
        set onConnected(handler) {
            connectedCallback = handler;
        },
        // Function to call each time the stored session token was reset (manual logout/rejected reconnect)
        set onSessionReset(handler) {
            sessionResetCallback = handler;
        },
        // Function to call each time the socket has been disconnected
        set onDisconnected(handler) {
            disconnectedCallback = handler;
        },
        get onConnected() {
            return connectedCallback;
        },
        get onSessionReset() {
            return sessionResetCallback;
        },
        get onDisconnected() {
            return disconnectedCallback;
        },
        get nativeSocket() {
            return ws;
        } }, subscriptions.socket), requests.socket);
    return socket;
};
export default ApiSocket;
//# sourceMappingURL=SocketBase.js.map