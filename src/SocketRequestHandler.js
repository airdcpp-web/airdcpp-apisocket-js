import chalk from 'chalk';
import invariant from 'invariant';
import Promise from './Promise';

import { eventIgnored } from './utils';


const SocketRequestHandler = (socket, logger, options) => {
	let callbacks = {};
	let currentCallbackId = 0;

	// Internal

	// This creates a new callback ID for a request
	const getCallbackId = () => {
		currentCallbackId += 1;
		if (currentCallbackId > 10000) {
			currentCallbackId = 0;
		}

		return currentCallbackId;
	};

	const filterPassword = (data) => {
		if (!data.hasOwnProperty('password')) {
			return data;
		}

		return {
			...data,
			password: '(hidden)',
		};
	};

	const sendRequest = (path, data, method, authenticating) => {
		// Pre-checks
		if (!authenticating && !socket.isConnected()) {
			logger.warn('Attempting to send request on a non-authenticated socket: ' + path);
			return Promise.reject('Not authorized');
		}

		const callbackId = getCallbackId();

		// Reporting
		invariant(path, 'Attempting socket request without a path');

		const ignored = eventIgnored(path, options.ignoredRequestPaths);
		if (!ignored) {
			logger.verbose(chalk.white.bold(callbackId), method, path, data ? filterPassword(data) : '(no data)');
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
		};

		socket.nativeSocket.send(JSON.stringify(request));
		return resolver.promise;
	};

	// Report timed out requests
	// This is more about spotting backend issues, such as frozen threads and dropped responses
	// The socket itself should handle actual connection issues
	const reportTimeouts = () => {
		const now = new Date().getTime();
		Object.keys(callbacks).forEach(callbackId => {
			const request = callbacks[callbackId];
			if (request.time + (options.requestTimeout * 1000) < now) {
				logger.warn(`Request ${callbackId} timed out`);
			}
		});
	};

	const timeoutReportInterval = setInterval(reportTimeouts, 30000);

	socket.reportRequestTimeouts = reportTimeouts; // for testing

	// Public
	socket.put = (path, data) => {
		return sendRequest(path, data, 'PUT');
	};

	socket.patch = (path, data) => {
		return sendRequest(path, data, 'PATCH');
	};

	socket.post = (path, data) => {
		return sendRequest(path, data, 'POST');
	};

	socket.delete = (path, data) => {
		invariant(!data, 'No data is allowed for delete command');
		return sendRequest(path, null, 'DELETE');
	};

	socket.get = (path, data) => {
		invariant(!data, 'No data is allowed for get command');
		return sendRequest(path, null, 'GET');
	};

	socket.getPendingRequestCount = () => {
		return Object.keys(callbacks).length;
	};

	// Shared for the socket
	return {
		onSocketDisconnected() {
			// Clear callbacks
			Object.keys(callbacks).forEach(id => callbacks[id].resolver.reject({ message: 'Socket disconnected' }));
			callbacks = {};
			clearTimeout(timeoutReportInterval);
		},

		handleMessage(messageObj) {
			const id = messageObj.callback_id;
			if (!callbacks.hasOwnProperty(id)) {
				logger.warn('No pending request for an API response', id, messageObj);
				return;
			}

			if (messageObj.code >= 200 && messageObj.code <= 204) {
				if (!callbacks[id].ignored) {
					logger.verbose(chalk.green(id), 'SUCCEEDED', messageObj.data ? messageObj.data : '(no data)');
				}

				callbacks[id].resolver.resolve(messageObj.data);
			} else {
				invariant(messageObj.error, 'Invalid error response received from the API');
				logger.warn(id, messageObj.code, messageObj.error.message, messageObj.error.field ? messageObj.error.field : '');
				
				callbacks[id].resolver.reject({ 
					message: messageObj.error.message, 
					code: messageObj.code, 
					json: messageObj.error 
				});
			}

			delete callbacks[id];
		},

		postAuthenticate(path, data) {
			return sendRequest(path, data, 'POST', true);
		},
	};
};

export default SocketRequestHandler;