import ApiConstants from './ApiConstants';

import SocketLogger from './SocketLogger';
import SocketSubscriptionHandler from './SocketSubscriptionHandler';
import SocketRequestHandler from './SocketRequestHandler';

//import invariant from 'invariant';
import Promise from './Promise';


const defaultOptions = {
	url: 'localhost:5600',
	secure: false,
	autoReconnect: true,
	reconnectInterval: 10,
	userSession: false,
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

	let connectedHandler = null;
	let disconnectedHandler = null;

	const logger = SocketLogger(options);


	const onClosed = (event) => {
		logger.info(event.reason ? 'Websocket was closed: ' + event.reason : 'Websocket was closed');

		requests.onSocketDisconnected();
		subscriptions.onSocketDisconnected();
		ws = null;
		
		if (disconnectedHandler) {
			disconnectedHandler(event.reason, event.code);
		}

		if (authToken && options.autoReconnect && !disconnected) {
			socket.reconnect()
				.catch((error) => console.error('Reconnect failed for a closed socket', error.message));
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

	const handleLogin = (username = options.username, password = options.password) => {
		return socket.post(ApiConstants.LOGIN_URL, { 
			username, 
			password,
			user_session: options.userSession,
		}, true);
	};

	const handleAuthorize = () => {
		return socket.post(ApiConstants.CONNECT_URL, { 
			authorization: authToken,
		}, true);
	};

	const authenticate = (resolve, reject, authenticationHandler, reconnectHandler) => {
		authenticationHandler()
			.then((data) => {
				// Authentication succeed

				if (data) {
					logger.info('Login succeed');
					authToken = data.token;
				} else {
					logger.info('Socket associated with an existing session');
				}

				if (connectedHandler) {
					// Catch separately as we don't want an infinite reconnect loop
					try {
						connectedHandler(data);
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

						authToken = null;
						authenticate(resolve, reject, handleLogin);
						return;
					} else if (error.code === 401) {
						// Invalid credentials, reset the token if we were reconnecting to avoid an infinite loop
						authToken = null;
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
		ws = new WebSocketImpl((options.secure ? 'wss://' : 'ws://') + options.url);

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
			logger.info('Connecting socket failed');
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

	// Is the socket connected but not possibly authorized?
	const isConnected = () => {
		return ws && ws.readyState === ws.OPEN;
	};

	// Is the socket connected and authorized?
	const isReady = () => {
		return isConnected() && !!authToken;
	};

	// Disconnects the socket but keeps the session token
	const disconnect = () => {
		if (!ws) {
			return;
		}

		disconnected = true;
		logger.info('Disconnecting socket');
		clearTimeout(reconnectTimer);

		ws.close();
	};

	socket = {
		get nativeSocket() {
			return ws;
		},

		connect(username, password, reconnectOnFailure) {
			return startConnect(() => handleLogin(username, password), reconnectOnFailure);
		},

		// Connect and attempt to associate the socket with an existing session
		reconnect(token) {
			if (isConnected()) {
				throw 'Reconnect may only be used for a closed socket';
			}

			if (token) {
				authToken = token;
			}

			if (!authToken) {
				throw 'No session token available for reconnecting';
			}

			logger.info('Reconnecting socket');

			return startConnect(handleAuthorize);
		},

		// Remove the associated API session and close the socket
		destroy() {
			const resolver = Promise.pending();
			socket.delete(ApiConstants.LOGOUT_URL)
				.then((data) => {
					logger.info('Logout succeed');
					authToken = null;

					// Try to avoid cases when the disconnected event is fired before
					// resolver actions are completed
					setTimeout(disconnect);

					resolver.resolve(data);
				})
				.catch((error) => {
					logger.error('Logout failed', error);
					resolver.reject(error);
				});

			return resolver.promise;
		},

		// Function to call each time the socket has been connected
		set onConnected(handler) {
			connectedHandler = handler;
		},

		// Function to call each time the socket has been disconnected
		set onDisconnected(handler) {
			disconnectedHandler = handler;
		},

		disconnect,
		isConnected,
		isReady,
	};

	return socket;
};

export default ApiSocket;
