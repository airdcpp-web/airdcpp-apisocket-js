var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { AUTH_RESPONSE, CONNECT_PARAMS, getConnectedSocket, getMockServer, getSocket } from './helpers.js';
import ApiConstants from '../ApiConstants.js';
import * as MockDate from 'mockdate';
import waitForExpectOriginal from 'wait-for-expect';
import { jest } from '@jest/globals';
let server;
const EXCEPT_TIMEOUT = 1000;
const waitForExpect = (func) => waitForExpectOriginal.default(func, EXCEPT_TIMEOUT);
const dummyfn = () => {
    // ..
};
// tslint:disable:no-empty
describe('socket', () => {
    beforeEach(() => {
        server = getMockServer();
    });
    afterEach(() => {
        server.stop();
        jest.useRealTimers();
        MockDate.reset();
    });
    describe('auth', () => {
        test('should handle valid credentials', () => __awaiter(void 0, void 0, void 0, function* () {
            server.addDataHandler('POST', ApiConstants.LOGIN_URL, AUTH_RESPONSE);
            const connectedCallback = jest.fn();
            const { socket, mockConsole } = getSocket();
            socket.onConnected = connectedCallback;
            const response = yield socket.connect();
            expect(connectedCallback).toHaveBeenCalledWith(AUTH_RESPONSE);
            expect(response).toEqual(AUTH_RESPONSE);
            expect(socket.isConnected()).toEqual(true);
            expect(mockConsole.warn.mock.calls.length).toBe(0);
            expect(socket.getPendingRequestCount()).toBe(0);
            socket.disconnect();
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
        }));
        test('should handle valid refresh token', () => __awaiter(void 0, void 0, void 0, function* () {
            server.addDataHandler('POST', ApiConstants.LOGIN_URL, AUTH_RESPONSE);
            const connectedCallback = jest.fn();
            const { socket, mockConsole } = getSocket();
            socket.onConnected = connectedCallback;
            const response = yield socket.connectRefreshToken('refresh token');
            expect(connectedCallback).toHaveBeenCalledWith(AUTH_RESPONSE);
            expect(response).toEqual(AUTH_RESPONSE);
            expect(socket.isConnected()).toEqual(true);
            expect(mockConsole.warn.mock.calls.length).toBe(0);
            expect(socket.getPendingRequestCount()).toBe(0);
            socket.disconnect();
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
        }));
        test('should handle invalid credentials', () => __awaiter(void 0, void 0, void 0, function* () {
            server.addErrorHandler('POST', ApiConstants.LOGIN_URL, 'Invalid username or password', 401);
            const { socket, mockConsole } = getSocket();
            let error;
            try {
                yield socket.connect();
            }
            catch (e) {
                error = e;
            }
            expect(error.code).toEqual(401);
            expect(error.message).toEqual('Invalid username or password');
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
            expect(mockConsole.warn.mock.calls.length).toBe(1);
            expect(socket.getPendingRequestCount()).toBe(0);
        }));
        test('should handle connect with custom credentials', () => __awaiter(void 0, void 0, void 0, function* () {
            server.stop();
            const { socket } = getSocket({
                username: 'dummy',
                password: 'dummy',
            });
            // Fail without a server handler with auto reconnect disabled
            let error;
            try {
                yield socket.connect(CONNECT_PARAMS.username, CONNECT_PARAMS.password, false);
            }
            catch (e) {
                error = e;
            }
            expect(error).toEqual('Cannot connect to the server');
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
            // Valid connect attempt
            server = getMockServer();
            server.addDataHandler('POST', ApiConstants.LOGIN_URL, AUTH_RESPONSE);
            yield socket.connect(CONNECT_PARAMS.username, CONNECT_PARAMS.password, false);
            expect(socket.isConnected()).toEqual(true);
            socket.disconnect();
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
        }));
        test('should handle logout', () => __awaiter(void 0, void 0, void 0, function* () {
            const sessionResetCallback = jest.fn();
            const disconnectedCallback = jest.fn();
            const { socket, mockConsole } = yield getConnectedSocket(server);
            socket.onSessionReset = sessionResetCallback;
            socket.onDisconnected = disconnectedCallback;
            // Dummy listener
            server.addDataHandler('POST', 'hubs/listeners/hub_updated', undefined);
            yield socket.addListener('hubs', 'hub_updated', dummyfn);
            // Dummy pending request
            socket.delete('dummyLogoutDelete').catch((error) => {
                // TODO: fix, too unreliable at the moment (depends on the timings)
                //expect(error.message).toEqual('Socket disconnected');
            });
            // Logout
            server.addDataHandler('DELETE', ApiConstants.LOGOUT_URL);
            yield socket.logout();
            expect(sessionResetCallback.mock.calls.length).toBe(1);
            yield waitForExpect(() => expect(disconnectedCallback.mock.calls.length).toBe(1));
            expect(socket.isActive()).toEqual(false);
            expect(socket.hasListeners()).toEqual(false);
            expect(socket.getPendingRequestCount()).toEqual(0);
            expect(mockConsole.warn.mock.calls.length).toBe(0);
            expect(socket.getPendingRequestCount()).toBe(0);
        }));
    });
    describe('disconnect', () => {
        test('should handle disconnect', () => __awaiter(void 0, void 0, void 0, function* () {
            const { socket, mockConsole } = yield getConnectedSocket(server);
            socket.disconnect();
            yield socket.waitDisconnected();
            expect(mockConsole.error.mock.calls.length).toBe(0);
            expect(mockConsole.warn.mock.calls.length).toBe(0);
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
        }));
        test('should handle wait disconnected timeout', () => __awaiter(void 0, void 0, void 0, function* () {
            const { socket, mockConsole } = yield getConnectedSocket(server);
            let error;
            try {
                yield socket.waitDisconnected(50);
            }
            catch (e) {
                error = e;
            }
            expect(error).toEqual('Socket disconnect timed out');
            expect(mockConsole.error.mock.calls.length).toBe(1);
            expect(mockConsole.warn.mock.calls.length).toBe(0);
            socket.disconnect();
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
        }));
    });
    describe('reconnect', () => {
        test('should handle auto reconnect', () => __awaiter(void 0, void 0, void 0, function* () {
            const { socket, mockConsole } = yield getConnectedSocket(server);
            jest.useFakeTimers();
            socket.disconnect(true);
            jest.runOnlyPendingTimers();
            // TODO: fix
            /*{
              const waitForExpectTask = await waitForExpect(() => expect(socket.isActive()).toEqual(false));
              jest.advanceTimersByTime(1000);
              await waitForExpectTask;
            }*/
            // Let it fail once
            server.stop();
            jest.runOnlyPendingTimers();
            jest.runOnlyPendingTimers();
            expect(mockConsole.error.mock.calls.length).toBe(1);
            server = getMockServer();
            server.addDataHandler('POST', ApiConstants.CONNECT_URL, undefined);
            jest.runOnlyPendingTimers();
            jest.runOnlyPendingTimers();
            jest.runOnlyPendingTimers();
            expect(socket.isConnected()).toEqual(true);
            expect(mockConsole.warn.mock.calls.length).toBe(0);
            expect(socket.getPendingRequestCount()).toBe(0);
            socket.disconnect();
            jest.runOnlyPendingTimers();
            {
                const waitForExpectTask = waitForExpect(() => expect(socket.isActive()).toEqual(false));
                jest.advanceTimersByTime(1000);
                yield waitForExpectTask;
            }
        }));
        test('should cancel auto reconnect', () => __awaiter(void 0, void 0, void 0, function* () {
            const { socket, mockConsole } = yield getConnectedSocket(server);
            jest.useFakeTimers();
            // Disconnect with auto reconnect
            socket.disconnect(true);
            jest.runOnlyPendingTimers();
            expect(socket.isActive()).toEqual(false);
            server.stop();
            // Cancel autoreconnect
            socket.disconnect();
            // Ensure that nothing happens
            jest.runOnlyPendingTimers();
            jest.runOnlyPendingTimers();
            expect(mockConsole.error.mock.calls.length).toBe(0);
            const waitForExpectTask = waitForExpect(() => expect(socket.isActive()).toEqual(false));
            jest.advanceTimersByTime(1000);
            yield waitForExpectTask;
        }));
        test('should handle manual reconnect', () => __awaiter(void 0, void 0, void 0, function* () {
            const { socket, mockConsole } = yield getConnectedSocket(server);
            socket.disconnect();
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
            server.addDataHandler('POST', ApiConstants.CONNECT_URL, undefined);
            yield socket.reconnect();
            expect(socket.isConnected()).toEqual(true);
            expect(mockConsole.warn.mock.calls.length).toBe(0);
            expect(socket.getPendingRequestCount()).toBe(0);
            socket.disconnect();
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
        }));
        // TODO: fix
        test.skip('should re-authenticate on lost session', () => __awaiter(void 0, void 0, void 0, function* () {
            const ErrorResponse = 'Invalid session token';
            // Connect and disconnect
            const { socket, mockConsole } = yield getConnectedSocket(server);
            jest.useFakeTimers();
            socket.disconnect();
            jest.runOnlyPendingTimers();
            expect(socket.isActive()).toEqual(false);
            // Fail the initial reconnect attempt with 'Invalid session token'
            // and connect with credentials afterwards
            server.addErrorHandler('POST', ApiConstants.CONNECT_URL, ErrorResponse, 400);
            const authCallback = jest.fn();
            server.addDataHandler('POST', ApiConstants.LOGIN_URL, AUTH_RESPONSE, authCallback);
            jest.runOnlyPendingTimers();
            socket.reconnect();
            {
                const waitForExpectTask = waitForExpectOriginal.default(() => {
                    jest.runOnlyPendingTimers();
                    expect(authCallback.mock.calls.length).toBe(1);
                });
                jest.advanceTimersByTime(1000);
                yield waitForExpectTask;
            }
            expect(socket.isConnected()).toEqual(true);
            expect(mockConsole.error.mock.calls.length).toBe(0);
            expect(mockConsole.warn.mock.calls.length).toBe(1);
            expect(socket.getPendingRequestCount()).toBe(0);
            // Ensure that we received the "invalid token" error
            expect(mockConsole.warn.mock.calls.length).toBe(1);
            const loggedWarningIndex = mockConsole.warn.mock.calls[0].find(str => str.indexOf(ErrorResponse) !== -1);
            expect(loggedWarningIndex).toBeDefined();
            socket.disconnect();
            jest.runOnlyPendingTimers();
            {
                const waitForExpectTask = waitForExpect(() => expect(socket.isActive()).toEqual(false));
                jest.advanceTimersByTime(1000);
                yield waitForExpectTask;
            }
        }));
    });
    describe('requests', () => {
        test('should report request timeouts', () => __awaiter(void 0, void 0, void 0, function* () {
            const { socket, mockConsole } = yield getConnectedSocket(server);
            jest.useFakeTimers();
            socket.addListener('hubs', 'hub_updated', dummyfn)
                .catch(() => { });
            socket.addListener('hubs', 'hub_added', dummyfn)
                .catch(() => { });
            jest.advanceTimersByTime(35000);
            MockDate.set(Date.now() + 35000);
            socket.reportRequestTimeouts();
            expect(mockConsole.warn.mock.calls.length).toBe(2);
            expect(socket.getPendingRequestCount()).toBe(2);
            socket.disconnect();
            jest.runOnlyPendingTimers();
            expect(socket.getPendingRequestCount()).toBe(0);
            const waitForExpectTask = waitForExpect(() => expect(socket.isActive()).toEqual(false));
            jest.advanceTimersByTime(1000);
            yield waitForExpectTask;
        }));
        test('should handle missing error messages', () => __awaiter(void 0, void 0, void 0, function* () {
            const { socket } = yield getConnectedSocket(server);
            server.addErrorHandler('POST', 'test/test', null, 401);
            let error;
            try {
                yield socket.post('test/test', { test: 'test' });
            }
            catch (e) {
                error = e;
            }
            expect(error.code).toEqual(401);
            expect(error.message).toEqual('(no error description)');
            socket.disconnect();
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
        }));
    });
    describe('subscriptions', () => {
        const commonData = {
            event: 'hub_updated',
            data: {
                total_messages: 63,
            },
        };
        const entityId = 1;
        const entityData = Object.assign(Object.assign({}, commonData), { id: entityId });
        test('should handle listener messages', () => __awaiter(void 0, void 0, void 0, function* () {
            const { socket, mockConsole } = yield getConnectedSocket(server);
            server.addDataHandler('POST', 'hubs/listeners/hub_updated', undefined);
            server.addDataHandler('POST', `hubs/${entityId}/listeners/hub_updated`, undefined);
            const commonSubscriptionCallback = jest.fn();
            const entitySubscriptionCallback = jest.fn();
            yield socket.addListener('hubs', 'hub_updated', commonSubscriptionCallback, undefined);
            yield socket.addListener('hubs', 'hub_updated', entitySubscriptionCallback, entityId);
            server.send(commonData);
            server.send(entityData);
            expect(commonSubscriptionCallback).toHaveBeenCalledWith(commonData.data, undefined);
            expect(entitySubscriptionCallback).toHaveBeenCalledWith(commonData.data, entityId);
            expect(commonSubscriptionCallback.mock.calls.length).toBe(2);
            expect(entitySubscriptionCallback.mock.calls.length).toBe(1);
            expect(mockConsole.warn.mock.calls.length).toBe(0);
            socket.disconnect();
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
        }));
        test('should handle listener removal', () => __awaiter(void 0, void 0, void 0, function* () {
            const { socket, mockConsole } = yield getConnectedSocket(server);
            const subscribeCallback = jest.fn();
            server.addDataHandler('POST', 'hubs/listeners/hub_updated', undefined, subscribeCallback);
            // Add two simultaneous pending add events
            const p1 = socket.addListener('hubs', 'hub_updated', dummyfn);
            const p2 = socket.addListener('hubs', 'hub_updated', dummyfn);
            expect(socket.hasListeners()).toBe(false);
            expect(socket.getPendingSubscriptionCount()).toBe(1);
            const removeListener1 = yield p1;
            const removeListener2 = yield p2;
            expect(subscribeCallback.mock.calls.length).toBe(1);
            expect(socket.getPendingSubscriptionCount()).toBe(0);
            const deleteCallback = jest.fn();
            server.addDataHandler('DELETE', 'hubs/listeners/hub_updated', undefined, deleteCallback);
            removeListener1();
            expect(deleteCallback.mock.calls.length).toBe(0); // Shouldn't call API yet, still one left
            removeListener2();
            yield waitForExpect(() => expect(deleteCallback.mock.calls.length).toBe(1));
            expect(socket.hasListeners()).toBe(false);
            expect(mockConsole.warn.mock.calls.length).toBe(0);
            socket.disconnect();
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
        }));
        test('should handle view updates', () => __awaiter(void 0, void 0, void 0, function* () {
            const { socket, mockConsole } = yield getConnectedSocket(server);
            const viewUpdateCallback = jest.fn();
            const removeListener = socket.addViewUpdateListener('hub_user_view', viewUpdateCallback, entityId);
            server.send({});
            removeListener();
            expect(socket.hasListeners()).toBe(false);
            expect(mockConsole.warn.mock.calls.length).toBe(0);
            socket.disconnect();
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
        }));
    });
    describe('hooks', () => {
        const hookEventData = {
            event: 'queue_bundle_finished_hook',
            data: {},
            completion_id: 1,
        };
        const hookSubscriberInfo = {
            id: 'sfv_checker',
            name: 'SFV checker'
        };
        const rejectCallback = (data, accept, reject) => {
            reject('crc_failed', 'CRC mismatch');
        };
        test('should handle hook actions', () => __awaiter(void 0, void 0, void 0, function* () {
            const { socket, mockConsole } = yield getConnectedSocket(server);
            let removeListener = null;
            // Add hook
            {
                const hookAddCallback = jest.fn();
                server.addDataHandler('POST', 'queue/hooks/queue_bundle_finished_hook', undefined, hookAddCallback);
                removeListener = yield socket.addHook('queue', 'queue_bundle_finished_hook', rejectCallback, hookSubscriberInfo);
                expect(hookAddCallback.mock.calls[0][0].data).toEqual(hookSubscriberInfo);
                expect(hookAddCallback.mock.calls.length).toBe(1);
            }
            // Simulate action
            {
                const hookEventCallback = jest.fn();
                server.addDataHandler('POST', 'queue/hooks/queue_bundle_finished_hook/1/reject', undefined, hookEventCallback);
                server.send(hookEventData);
                yield waitForExpect(() => expect(hookEventCallback.mock.calls.length).toBe(1));
            }
            // Clean up
            {
                removeListener();
                expect(socket.hasListeners()).toBe(false);
            }
            expect(mockConsole.warn.mock.calls.length).toBe(0);
            socket.disconnect();
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
        }));
    });
    describe('logging', () => {
        const connect = (logLevel) => __awaiter(void 0, void 0, void 0, function* () {
            const { socket, mockConsole } = yield getConnectedSocket(server, {
                logLevel,
            });
            socket.disconnect(true);
            yield socket.delete('dummyLogDeleteWarning').catch((error) => {
                //...
            });
            return { socket, mockConsole };
        });
        test('should respect error log level', () => __awaiter(void 0, void 0, void 0, function* () {
            const { socket, mockConsole } = yield connect('error');
            expect(mockConsole.error.mock.calls.length).toBe(0);
            expect(mockConsole.warn.mock.calls.length).toBe(0);
            expect(mockConsole.info.mock.calls.length).toBe(0);
            expect(mockConsole.log.mock.calls.length).toBe(0);
            socket.disconnect();
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
        }));
        test('should respect warn log level', () => __awaiter(void 0, void 0, void 0, function* () {
            const { socket, mockConsole } = yield connect('warn');
            expect(mockConsole.error.mock.calls.length).toBe(0);
            expect(mockConsole.warn.mock.calls.length).toBe(1);
            expect(mockConsole.info.mock.calls.length).toBe(0);
            expect(mockConsole.log.mock.calls.length).toBe(0);
            socket.disconnect();
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
        }));
        test('should respect info log level', () => __awaiter(void 0, void 0, void 0, function* () {
            const { socket, mockConsole } = yield connect('info');
            expect(mockConsole.error.mock.calls.length).toBe(0);
            expect(mockConsole.warn.mock.calls.length).toBe(1);
            expect(mockConsole.info.mock.calls.length).toBe(4);
            expect(mockConsole.log.mock.calls.length).toBe(0);
            socket.disconnect();
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
        }));
        test('should respect verbose log level', () => __awaiter(void 0, void 0, void 0, function* () {
            const { socket, mockConsole } = yield connect('verbose');
            expect(mockConsole.error.mock.calls.length).toBe(0);
            expect(mockConsole.warn.mock.calls.length).toBe(1);
            expect(mockConsole.info.mock.calls.length).toBe(4);
            expect(mockConsole.log.mock.calls.length).toBe(2);
            socket.disconnect();
            yield waitForExpect(() => expect(socket.isActive()).toEqual(false));
        }));
    });
});
//# sourceMappingURL=Socket.test.js.map