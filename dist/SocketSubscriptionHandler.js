"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const invariant_1 = __importDefault(require("invariant"));
const events_1 = require("events");
const utils_js_1 = require("./utils.js");
const Promise_js_1 = __importDefault(require("./Promise.js"));
const SocketSubscriptionHandler = (socket, logger, { ignoredListenerEvents = [] }) => {
    // Internal
    const getEmitId = (event, id) => {
        (0, invariant_1.default)(id !== 0, 'Entity ID "0" is not allowed');
        return id ? (event + id) : event;
    };
    const getSubscriptionUrl = (moduleUrl, id, event) => {
        if (id) {
            return `${moduleUrl}/${id}/listeners/${event}`;
        }
        return `${moduleUrl}/listeners/${event}`;
    };
    let subscriptions = {};
    const emitter = new events_1.EventEmitter();
    // Subscriptions pending to be added in the API
    const pendingSubscriptions = {};
    const removeSocketListener = (subscriptionUrl, subscriptionId, callback, sendApi) => {
        if (!socket().isConnected()) {
            return;
        }
        subscriptions[subscriptionId]--;
        emitter.removeListener(subscriptionId, callback);
        if (subscriptions[subscriptionId] === 0) {
            if (sendApi && socket().isConnected()) {
                socket().delete(subscriptionUrl)
                    .catch((error) => {
                    logger.error('Failed to remove socket listener', subscriptionUrl, error);
                });
            }
            delete subscriptions[subscriptionId];
        }
    };
    const removeLocalListener = (subscriptionId, callback) => {
        emitter.removeListener(subscriptionId, callback);
    };
    const handleHookAction = (subscriptionUrl, callback, data, completionId) => {
        callback(data, completionData => {
            socket().post(`${subscriptionUrl}/${completionId}/resolve`, completionData)
                .catch((error) => logger.error('Failed to complete hook action', subscriptionUrl, error));
        }, (rejectId, rejectMessage) => {
            socket().post(`${subscriptionUrl}/${completionId}/reject`, {
                reject_id: rejectId,
                message: rejectMessage,
            }).catch(error => logger.error('Failed to complete failed hook action', subscriptionUrl, error));
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
                socket()
                    .post(subscriptionUrl, data)
                    .then(onSubscriptionAddSucceeded.bind(SocketSubscriptionHandler, subscriptionId), onSubscriptionAddFailed.bind(SocketSubscriptionHandler, subscriptionId));
            }
            const resolver = Promise_js_1.default.pending();
            pendingSubscriptions[subscriptionId].push({
                resolver,
                removeHandler
            });
            return resolver.promise;
        }
        subscriptions[subscriptionId]++;
        return Promise_js_1.default.resolve(removeHandler);
    };
    const getTotalEmitterSubscriptionCount = () => {
        return Object.keys(subscriptions)
            .reduce((reduced, name) => emitter.listenerCount(name) + reduced, 0);
    };
    // Public
    // Listen to a specific event without sending subscription to the server
    const SocketSubscriptionsPublic = {
        addViewUpdateListener: (viewName, callback, entityId) => {
            const subscriptionId = getEmitId(`${viewName}_updated`, entityId);
            emitter.on(subscriptionId, callback);
            return () => removeLocalListener(subscriptionId, callback);
        },
        // Listen to a specific event and manage the API subscription automatically
        addListener: (apiModule, event, callback, entityId) => {
            if (!socket().isConnected()) {
                throw 'Listeners can be added only for a connected socket';
            }
            (0, invariant_1.default)(apiModule.indexOf('/') === -1, 'The first argument should only contain the API section without any path tokens (entity ID should be supplied separately)');
            const subscriptionId = getEmitId(event, entityId);
            const subscriptionUrl = getSubscriptionUrl(apiModule, entityId, event);
            emitter.on(subscriptionId, callback);
            return addPendingEntry(subscriptionUrl, subscriptionId, callback);
        },
        hasListeners: () => {
            return Object.keys(subscriptions).length > 0 || getTotalEmitterSubscriptionCount() > 0;
        },
        addHook: (apiModule, event, callback, subscriberInfo) => {
            if (!socket().isConnected()) {
                throw 'Hooks can be added only for a connected socket';
            }
            (0, invariant_1.default)(apiModule.indexOf('/') === -1, 'The first argument should only contain the API section without any path tokens');
            const subscriptionId = event;
            if (subscriptions[subscriptionId] || pendingSubscriptions[subscriptionId]) {
                throw 'Hook exists';
            }
            const subscriptionUrl = `${apiModule}/hooks/${event}`;
            callback = handleHookAction.bind(SocketSubscriptionHandler, subscriptionUrl, callback);
            emitter.on(subscriptionId, callback);
            return addPendingEntry(subscriptionUrl, subscriptionId, callback, subscriberInfo);
        },
        getPendingSubscriptionCount: () => {
            return Object.keys(pendingSubscriptions).length;
        },
    };
    // For the socket
    const SocketSubscriptionsInternal = {
        onSocketDisconnected() {
            emitter.removeAllListeners();
            subscriptions = {};
        },
        handleMessage(message) {
            const ignored = (0, utils_js_1.eventIgnored)(message.event, ignoredListenerEvents);
            if (message.completion_id) {
                if (!ignored) {
                    logger.verbose(message.event, `(completion id ${message.completion_id})`, message.data);
                }
                emitter.emit(message.event, message.data, message.completion_id);
            }
            else {
                if (!ignored) {
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
    return Object.assign(Object.assign({}, SocketSubscriptionsInternal), { socket: SocketSubscriptionsPublic });
};
exports.default = SocketSubscriptionHandler;
//# sourceMappingURL=SocketSubscriptionHandler.js.map