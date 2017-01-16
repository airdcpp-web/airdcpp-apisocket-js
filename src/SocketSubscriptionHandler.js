//import invariant from 'invariant';
import { EventEmitter } from 'events';


const SocketSubscriptionHandler = (socket, logger, { ignoredListenerEvents = [] }) => {
	// Internal
	const getSubscriptionId = (event, id) => {
		return id ? (event + id) : event;
	};

	const getSubscriptionUrl = (moduleUrl, id, event) => {
		if (id) {
			return moduleUrl + '/' + id + '/listener/' + event;
		}

		return moduleUrl + '/listener/' + event;
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

	// Public

	// Listen to a specific event without sending subscription to the server
	socket.addViewUpdateListener = (viewName, callback, id) => {
		const subscriptionId = getSubscriptionId(viewName + '_updated', id);
		emitter.on(subscriptionId, callback);
		return () => removeLocalListener(subscriptionId, callback); 
	};

	// Listen to a specific event and manage the API subscription automatically
	socket.addSocketListener = (apiModuleUrl, event, callback, entityId) => {
		if (!socket.isReady()) {
			throw 'Listeners can be only for a connected socket';
		}

		const subscriptionId = getSubscriptionId(event, entityId);
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

	// For the socket
	const Handler = {
		onSocketDisconnected() {
			emitter.removeAllListeners();
			subscriptions = {};
		},

		handleMessage(message) {
			if (!ignoredListenerEvents || ignoredListenerEvents.indexOf(message.event) == -1) {
				logger.verbose(message.event, message.id ? message.id : '-', message.data);
			}

			if (message.id) {
				// There can be subscribers for a single entity or for all events of this type... emit for both
				emitter.emit(message.event + message.id, message.data, message.id);
			}

			emitter.emit(message.event, message.data, message.id);
		},
	};

	return Handler;
};

export default SocketSubscriptionHandler;