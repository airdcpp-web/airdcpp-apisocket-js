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

	// Subscriptions pending to be added in the API
	const pendingSubscriptions = {};

	const removeSocketListener = (subscriptionUrl, subscriptionId, callback, sendApi) => {
		if (!socket.isConnected()) {
			return;
		}

		subscriptions[subscriptionId]--;
		emitter.removeListener(subscriptionId, callback);

		if (subscriptions[subscriptionId] === 0) {
			if (sendApi && socket.isConnected()) {
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

	const onSubscriptionAddSucceeded = (subscriptionId) => {
		const pending = pendingSubscriptions[subscriptionId];
		pending.forEach(pendingItem => pendingItem.resolver.resolve(pendingItem.removeHandler));

		subscriptions[subscriptionId] = pending.length;
		delete pendingSubscriptions[subscriptionId];
	};

	const onSubscriptionAddFailed = (subscriptionId, error) => {
		const pending = pendingSubscriptions[subscriptionId];
		pending.forEach(pendingItem => pendingItem.resolver.reject(error));

		delete pendingSubscriptions[subscriptionId];
	};

	const addPendingEntry = (subscriptionUrl, subscriptionId, callback, data) => {
		const removeHandler = (sendApi = true) => removeSocketListener(subscriptionUrl, subscriptionId, callback, sendApi);

		if (!subscriptions[subscriptionId]) {
			if (!pendingSubscriptions[subscriptionId]) {
				pendingSubscriptions[subscriptionId] = [];
				socket.post(subscriptionUrl, data).then(onSubscriptionAddSucceeded.bind(this, subscriptionId), onSubscriptionAddFailed.bind(this, subscriptionId));
			}

			const resolver = Promise.pending();
			pendingSubscriptions[subscriptionId].push({ 
				resolver, 
				removeHandler 
			});

			return resolver.promise;
		}

		subscriptions[subscriptionId]++;
		return Promise.resolve(removeHandler);
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
		if (!socket.isConnected()) {
			throw 'Listeners can be added only for a connected socket';
		}

		const subscriptionId = getEmitId(event, entityId);
		const subscriptionUrl = getSubscriptionUrl(apiModuleUrl, entityId, event);

		emitter.on(subscriptionId, callback);
		return addPendingEntry(subscriptionUrl, subscriptionId, callback);
	};

	socket.hasListeners = () => {
		return emitter.listenerCount > 0 || Object.keys(subscriptions).length > 0;
	};

	socket.addHook = (apiModuleUrl, event, callback, subscriberInfo) => {
		if (!socket.isConnected()) {
			throw 'Hooks can be added only for a connected socket';
		}

		const subscriptionId = event;
		if (subscriptions[subscriptionId] || pendingSubscriptions[subscriptionId]) {
			throw 'Hook exists';
		}

		const subscriptionUrl = apiModuleUrl + '/hooks/' + event;

		callback = handleHookAction.bind(this, subscriptionUrl, callback);
		emitter.on(subscriptionId, callback);

		return addPendingEntry(subscriptionUrl, subscriptionId, callback, subscriberInfo);
	};

	socket.getPendingSubscriptionCount = () => {
		return Object.keys(pendingSubscriptions).length;
	};

	// For the socket
	const Handler = {
		onSocketDisconnected() {
			emitter.removeAllListeners();
			subscriptions = {};
		},

		handleMessage(message) {
			if (message.completion_id) {
				if (!ignoredListenerEvents || ignoredListenerEvents.indexOf(message.event) === -1) {
					logger.verbose(message.event, `(completion id ${message.completion_id})`, message.data);
				}

				emitter.emit(message.event, message.data, message.completion_id);
			} else {
				if (!ignoredListenerEvents || ignoredListenerEvents.indexOf(message.event) === -1) {
					logger.verbose(message.event, message.id ? `(entity ${message.id})` : '(no entity)', message.data);
				}

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