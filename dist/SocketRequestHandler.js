"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = __importDefault(require("chalk"));
const invariant_1 = __importDefault(require("invariant"));
const Promise_js_1 = __importDefault(require("./Promise.js"));
const utils_js_1 = require("./utils.js");
const SocketRequestHandler = (socket, logger, { requestTimeout = 30, ignoredRequestPaths }) => {
    let callbacks = {};
    let currentCallbackId = 0;
    let timeoutReportInterval;
    // Internal
    // This creates a new callback ID for a request
    const getCallbackId = () => {
        if (currentCallbackId > 100000) {
            currentCallbackId = 0;
        }
        currentCallbackId += 1;
        return currentCallbackId;
    };
    const filterPassword = (data) => {
        if (!data || !data.hasOwnProperty('password')) {
            return data;
        }
        return Object.assign(Object.assign({}, data), { password: '(hidden)' });
    };
    const sendRequest = (method, path, data, authenticating = false) => {
        // Pre-checks
        if (!authenticating && !socket().isConnected()) {
            logger.warn(`Attempting to send request on a non-authenticated socket: ${path}`);
            return Promise_js_1.default.reject('Not authorized');
        }
        if (!socket().nativeSocket) {
            logger.warn(`Attempting to send request without a socket: ${path}`);
            return Promise_js_1.default.reject('No socket');
        }
        const callbackId = getCallbackId();
        // Reporting
        (0, invariant_1.default)(path, 'Attempting socket request without a path');
        const ignored = (0, utils_js_1.eventIgnored)(path, ignoredRequestPaths);
        if (!ignored) {
            logger.verbose(chalk_1.default.white.bold(callbackId.toString()), method, path, data ? filterPassword(data) : '(no data)');
        }
        // Callback
        const resolver = Promise_js_1.default.pending();
        callbacks[callbackId] = {
            time: Date.now(),
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
        socket().nativeSocket.send(JSON.stringify(request));
        return resolver.promise;
    };
    // Report timed out requests
    // This is more about spotting backend issues, such as frozen threads and dropped responses
    // The socket itself should handle actual connection issues
    const reportTimeouts = () => {
        const now = Date.now();
        Object.keys(callbacks).forEach(callbackId => {
            const request = callbacks[callbackId];
            if (request.time + (requestTimeout * 1000) < now) {
                logger.warn(`Request ${callbackId} timed out`);
            }
        });
    };
    const cancelPendingRequests = (message = 'Request cancelled') => {
        Object.keys(callbacks)
            .forEach(id => {
            logger.verbose(`Canceling a pending request ${id} (${message})`);
            const cb = callbacks[id];
            cb.resolver.reject(message);
        });
        callbacks = {};
    };
    // Public
    const RequestsPublic = {
        put: (path, data) => {
            return sendRequest('PUT', path, data);
        },
        patch: (path, data) => {
            return sendRequest('PATCH', path, data);
        },
        post: (path, data) => {
            return sendRequest('POST', path, data);
        },
        delete: (path) => {
            //invariant(!data, 'No data is allowed for delete command');
            return sendRequest('DELETE', path);
        },
        get: (path) => {
            //invariant(!data, 'No data is allowed for get command');
            return sendRequest('GET', path);
        },
        getPendingRequestCount: () => {
            return Object.keys(callbacks).length;
        },
    };
    Object.assign(RequestsPublic, {
        reportRequestTimeouts: reportTimeouts, // internal method for testing
    });
    const formatFieldError = (error) => {
        return error.field && error.code ? `${error.field} (${error.code})` : '';
    };
    // Shared for the socket
    const RequestsInternal = {
        onSocketConnected() {
            timeoutReportInterval = setInterval(reportTimeouts, 30000);
        },
        onSocketDisconnected() {
            // Clear callbacks
            cancelPendingRequests('Socket disconnected');
            clearTimeout(timeoutReportInterval);
        },
        handleMessage(messageObj) {
            const id = messageObj.callback_id;
            if (!callbacks.hasOwnProperty(id)) {
                logger.warn('No pending request for an API response', id, messageObj);
                return;
            }
            if (messageObj.code >= 200 && messageObj.code <= 204) {
                const { data } = messageObj;
                if (!callbacks[id].ignored) {
                    logger.verbose(chalk_1.default.green(id.toString()), 'SUCCEEDED', data ? data : '(no data)');
                }
                callbacks[id].resolver.resolve(data);
            }
            else {
                const errorMessageObj = messageObj;
                if (!errorMessageObj.error) {
                    // API should always return an error message but this isn't always the case
                    // (e.g. https://github.com/airdcpp/airdcpp-windows/commit/596b31a9c8c4e72f6c9279972a40ea30f10798c4)
                    logger.warn('Error message missing from the response (this is an API bug that should be reported)', id, messageObj);
                }
                const { code } = errorMessageObj;
                const error = errorMessageObj.error || {
                    message: '(no error description)'
                };
                logger.warn(id, code, error.message, formatFieldError(error));
                callbacks[id].resolver.reject({
                    message: error.message,
                    code,
                    json: error
                });
            }
            delete callbacks[id];
        },
        postAuthenticate(path, data) {
            return sendRequest('POST', path, data, true);
        },
    };
    return Object.assign(Object.assign({}, RequestsInternal), { socket: RequestsPublic });
};
exports.default = SocketRequestHandler;
//# sourceMappingURL=SocketRequestHandler.js.map