import invariant from 'invariant';
import { EventEmitter } from 'events';


const SocketSubscriptionHandler = (socket, logger, { ignoredListenerEvents = [] }) => {
	// Internal
	const getEmitId = (event, id) => {
		invariant(id !== 0, 'Entity ID "0" is not allowed');
		return id ? (event + id) : event;
	};

	const getSubscriptionUrl = (moduleUrl, id, event) => {
		if (id) {
			return moduleUrl + '/' + id + '/listeners/' + event;
		}

		return moduleUrl + '/listeners/' + event;
	};

	let subscriptions = {};
	const emitter = new EventEmitter();

	const removeSocketListener = (subscriptionUrl, subscriptionId, callback, sendApi) => {
		if (!socket.isReady()) {
			return;
		}

		subscriptions[subscriptionId]--;
		emitter.removeListener(subscriptionId, callback);

		if (subscriptions[subscriptionId] === 0) {
			if (sendApi && socket.isReady()) {
				socket.delete(subscriptionUrl)
					.catch(error => logger.error('Failed to remove socket listener', subscriptionUrl, error));
			}

			delete subscriptions[subscriptionId];
		}
	};

	const removeLocalListener = (subscriptionId, callback) => {
		emitter.removeListener(subscriptionId, callback);
	};

	const handleHookAction = (apiModuleUrl, callback, data, completionId) => {
		//const completionUrl = apiModuleUrl + '/' + completionId;
		callback(data, completionData => {
			socket.post(apiModuleUrl + '/' + completionId + '/resolve', completionData)
				.catch(error => logger.error('Failed to complete hook action', apiModuleUrl, error));
		}, (rejectId, rejectMessage) => {
			socket.post(apiModuleUrl + '/' + completionId + '/reject', {
				reject_id: rejectId,
				message: rejectMessage,
			}).catch(error => logger.error('Failed to complete failed hook action', apiModuleUrl, error));
		});
	};

	// Public

	// Listen to a specific event without sending subscription to the server
	socket.addViewUpdateListener = (viewName, callback, id) => {
		const subscriptionId = getEmitId(viewName + '_updated', id);
		emitter.on(subscriptionId, callback);
		return () => removeLocalListener(subscriptionId, callback); 
	};

	// Listen to a specific event and manage the API subscription automatically
	socket.addListener = (apiModuleUrl, event, callback, entityId) => {
		if (!socket.isReady()) {
			throw 'Listeners can be added only for a connected socket';
		}

		const subscriptionId = getEmitId(event, entityId);
		const subscriptionUrl = getSubscriptionUrl(apiModuleUrl, entityId, event);

		emitter.on(subscriptionId, callback);

		const listeners = subscriptions[subscriptionId];
		if (!listeners) {
			subscriptions[subscriptionId] = 0;

			socket.post(subscriptionUrl)
				.catch(error => logger.error('Failed to add socket listener', subscriptionUrl, entityId ? entityId : '', error.message));
		}

		subscriptions[subscriptionId]++;

		return (sendApi = true) => removeSocketListener(subscriptionUrl, subscriptionId, callback, sendApi);
	};

	socket.hasListeners = () => {
		return emitter.listenerCount > 0 || Object.keys(subscriptions).length > 0;
	};

	socket.addHook = (apiModuleUrl, event, callback, subscriberInfo) => {
		if (!socket.isReady()) {
			throw 'Hooks can be added only for a connected socket';
		}

		const subscriptionId = event;
		const subscriptionUrl = apiModuleUrl + '/hooks/' + event;

		callback = handleHookAction.bind(this, subscriptionUrl, callback);
	
		const listeners = subscriptions[subscriptionId];
		if (listeners) {
			throw 'Hook exists';
		}
		
		emitter.on(subscriptionId, callback);
		subscriptions[subscriptionId] = 1;

		socket.post(subscriptionUrl, subscriberInfo)
			.catch(error => logger.error('Failed to add socket hook', subscriptionUrl, error.message));

		return (sendApi = true) => removeSocketListener(subscriptionUrl, subscriptionId, callback, sendApi);
	};

	// For the socket
	const Handler = {
		onSocketDisconnected() {
			emitter.removeAllListeners();
			subscriptions = {};
		},

		handleMessage(message) {
			if (!ignoredListenerEvents || ignoredListenerEvents.indexOf(message.event) === -1) {
				logger.verbose(message.event, message.id ? message.id : '-', message.data);
			}

			if (message.completion_id) {
				emitter.emit(message.event, message.data, message.completion_id);
			} else {
				if (message.id) {
					// There can be subscribers for a single entity or for all events of this type... emit for both
					emitter.emit(getEmitId(message.event, message.id), message.data, message.id);
				}

				emitter.emit(message.event, message.data, message.id);
			}
		},
	};

	return Handler;
};

export default SocketSubscriptionHandler;