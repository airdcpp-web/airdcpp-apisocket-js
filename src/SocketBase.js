import ApiConstants from './ApiConstants';

import SocketLogger from './SocketLogger';
import SocketSubscriptionHandler from './SocketSubscriptionHandler';
import SocketRequestHandler from './SocketRequestHandler';

import invariant from 'invariant';
import Promise from './Promise';


const defaultOptions = {
	autoReconnect: true,
	reconnectInterval: 10,
	userSession: false,
	requestTimeout: 30,
};

const ApiSocket = (userOptions, WebSocketImpl) => {
	const options = Object.assign({}, defaultOptions, userOptions);

	let subscriptions = null;
	let requests = null;

	let ws = null;
	let authToken = null;

	let socket = null;
	let reconnectTimer = null;
	let disconnected = true;

	let connectedCallback = null;
	let sessionResetCallback = null;
	let disconnectedCallback = null;

	const logger = SocketLogger(options);

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
		logger.info(event.reason ? 'Websocket was closed: ' + event.reason : 'Websocket was closed');

		requests.onSocketDisconnected();
		subscriptions.onSocketDisconnected();
		ws = null;
		
		if (disconnectedCallback) {
			disconnectedCallback(event.reason, event.code);
		}

		if (authToken && options.autoReconnect && !disconnected) {
			setTimeout(_ => {
				socket.reconnect()
					.catch(error => logger.error('Reconnect failed for a closed socket', error.message));
			});
		}
	};

	const onMessage = (event) => {
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
		subscriptions = SocketSubscriptionHandler(socket, logger, options);
		requests = SocketRequestHandler(socket, logger, options);

		ws.onerror = (event) => {
			logger.error('Websocket failed: ' + event.reason);
		};

		ws.onclose = onClosed;
		ws.onmessage = onMessage;
	};

	// Connect handler for creation of new session
	const handleLogin = (username = options.username, password = options.password) => {
		return requests.postAuthenticate(ApiConstants.LOGIN_URL, { 
			username, 
			password,
			user_session: options.userSession,
		}, true);
	};

	// Connect handler for associating socket with an existing session token
	const handleAuthorizeToken = () => {
		return requests.postAuthenticate(ApiConstants.CONNECT_URL, { 
			auth_token: authToken,
		}, true);
	};

	const authenticate = (resolve, reject, authenticationHandler, reconnectHandler) => {
		authenticationHandler()
			.then((data) => {
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
				}

				resolve(data);
			})
			.catch((error) => {
				if (error.code) {
					if (authToken && error.code === 400 && options.autoReconnect) {
						// The session was lost (most likely the client was restarted)
						logger.info('Session lost, re-sending credentials');
						resetSession();

						authenticate(resolve, reject, handleLogin);
						return;
					} else if (error.code === 401) {
						// Invalid credentials, reset the token if we were reconnecting to avoid an infinite loop
						resetSession();
					}

					// Authentication was rejected
					socket.disconnect();
				} else {
					// Socket was disconnected during the authentication
					logger.info('Socket disconnected during authentication, reconnecting');
					reconnectHandler();
					return;
				}

				reject(error);
			});
	};

	const connectInternal = (resolve, reject, authenticationHandler, reconnectOnFailure = true) => {
		ws = new WebSocketImpl(options.url);

		const scheduleReconnect = () => {
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

	const startConnect = (authenticationHandler, reconnectOnFailure) => {
		disconnected = false;
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

	// Disconnects the socket but keeps the session token
	const disconnect = (autoConnect = false) => {
		if (!ws) {
			return;
		}

		disconnected = !autoConnect;
		logger.info('Disconnecting socket');
		clearTimeout(reconnectTimer);

		ws.close();
	};

	socket = {
		get nativeSocket() {
			return ws;
		},

		connect(username, password, reconnectOnFailure = true) {
			if (ws) {
				throw 'Connect may only be used for a closed socket';
			}

			resetSession();

			return startConnect(() => handleLogin(username, password), reconnectOnFailure);
		},

		// Connect and attempt to associate the socket with an existing session
		reconnect(token, reconnectOnFailure = true) {
			if (ws) {
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
		logout() {
			const resolver = Promise.pending();
			socket.delete(ApiConstants.LOGOUT_URL)
				.then((data) => {
					logger.info('Logout succeed');
					resetSession();

					resolver.resolve(data);

					// Don't fire the disconnected event before resolver actions are handled
					disconnect();
				})
				.catch((error) => {
					logger.error('Logout failed', error);
					resolver.reject(error);
				});

			return resolver.promise;
		},

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

		disconnect,
		isConnecting,
		isConnected,
		logger,
	};

	return socket;
};

export default ApiSocket;
