import { 
  AUTH_RESPONSE, CONNECT_PARAMS, 
  getConnectedSocket, getMockServer, getSocket
} from './helpers';

import ApiConstants from '../ApiConstants';

import { HookCallback, HookSubscriberInfo } from '../types/subscriptions';
import { IncomingSubscriptionEvent } from '../types/api_internal';

import * as MockDate from 'mockdate';
import waitForExpect from 'wait-for-expect';


let server: ReturnType<typeof getMockServer>;


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
    test('should handle valid credentials', async () => {
      server.addDataHandler('POST', ApiConstants.LOGIN_URL, AUTH_RESPONSE);
      const connectedCallback = jest.fn();

      const { socket, mockConsole } = getSocket();
      socket.onConnected = connectedCallback;
      const response = await socket.connect();

      expect(connectedCallback).toHaveBeenCalledWith(AUTH_RESPONSE);
      expect(response).toEqual(AUTH_RESPONSE);
      expect(socket.isConnected()).toEqual(true);

      expect(mockConsole.warn.mock.calls.length).toBe(0);
      expect(socket.getPendingRequestCount()).toBe(0);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should handle valid refresh token', async () => {
      server.addDataHandler('POST', ApiConstants.LOGIN_URL, AUTH_RESPONSE);
      const connectedCallback = jest.fn();

      const { socket, mockConsole } = getSocket();
      socket.onConnected = connectedCallback;
      const response = await socket.connectRefreshToken('refresh token');

      expect(connectedCallback).toHaveBeenCalledWith(AUTH_RESPONSE);
      expect(response).toEqual(AUTH_RESPONSE);
      expect(socket.isConnected()).toEqual(true);

      expect(mockConsole.warn.mock.calls.length).toBe(0);
      expect(socket.getPendingRequestCount()).toBe(0);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should handle invalid credentials', async () => {
      server.addErrorHandler('POST', ApiConstants.LOGIN_URL, 'Invalid username or password', 401);

      const { socket, mockConsole } = getSocket();
      let error;

      try {
        await socket.connect();
      } catch (e) {
        error = e;
      }

      expect(error.code).toEqual(401);
      expect(error.message).toEqual('Invalid username or password');
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));

      expect(mockConsole.warn.mock.calls.length).toBe(1);
      expect(socket.getPendingRequestCount()).toBe(0);
    });

    test('should handle connect with custom credentials', async () => {
      server.stop();
      const { socket } = getSocket({
        username: 'dummy',
        password: 'dummy',
      });

      // Fail without a server handler with auto reconnect disabled
      let error;
      try {
        await socket.connect(CONNECT_PARAMS.username, CONNECT_PARAMS.password, false);
      } catch (e) {
        error = e;
      }

      expect(error).toEqual('Cannot connect to the server');
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));

      // Valid connect attempt
      server = getMockServer();
      server.addDataHandler('POST', ApiConstants.LOGIN_URL, AUTH_RESPONSE);

      await socket.connect(CONNECT_PARAMS.username, CONNECT_PARAMS.password, false);

      expect(socket.isConnected()).toEqual(true);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should handle logout', async () => {
      const sessionResetCallback = jest.fn();
      const disconnectedCallback = jest.fn();

      const { socket, mockConsole } = await getConnectedSocket(server);
      socket.onSessionReset = sessionResetCallback;
      socket.onDisconnected = disconnectedCallback;

      // Dummy listener
      server.addDataHandler('POST', 'hubs/listeners/hub_updated', undefined);
      await socket.addListener('hubs', 'hub_updated', _ => {});

      // Dummy pending request
      socket.delete('dummyLogoutDelete').catch(error => {
        // TODO: fix, too unreliable at the moment (depends on the timings)
        //expect(error.message).toEqual('Socket disconnected');
      });

      // Logout
      server.addDataHandler('DELETE', ApiConstants.LOGOUT_URL);
      await socket.logout();

      expect(sessionResetCallback.mock.calls.length).toBe(1);
      await waitForExpect(() => expect(disconnectedCallback.mock.calls.length).toBe(1));

      expect(socket.isActive()).toEqual(false);
      expect(socket.hasListeners()).toEqual(false);
      expect(socket.getPendingRequestCount()).toEqual(0);

      expect(mockConsole.warn.mock.calls.length).toBe(0);
      expect(socket.getPendingRequestCount()).toBe(0);
    });
  });

  describe('disconnect', () => {
    test('should handle disconnect', async () => {
      const { socket, mockConsole } = await getConnectedSocket(server);

      socket.disconnect();

      await socket.waitDisconnected();

      expect(mockConsole.error.mock.calls.length).toBe(0);
      expect(mockConsole.warn.mock.calls.length).toBe(0);
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should handle wait disconnected timeout', async () => {
      const { socket, mockConsole } = await getConnectedSocket(server);

      let error;
      try {
        await socket.waitDisconnected(50);
      } catch (e) {
        error = e;
      }

      expect(error).toEqual('Socket disconnect timed out');

      expect(mockConsole.error.mock.calls.length).toBe(1);
      expect(mockConsole.warn.mock.calls.length).toBe(0);
      
      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });
  });

  describe('reconnect', () => {
    test('should handle auto reconnect', async () => {
      const { socket, mockConsole } = await getConnectedSocket(server);

      jest.useFakeTimers();

      socket.disconnect(true);
      jest.runOnlyPendingTimers();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));

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
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should cancel auto reconnect', async () => {
      const { socket, mockConsole } = await getConnectedSocket(server);

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
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should handle manual reconnect', async () => {
      const { socket, mockConsole } = await getConnectedSocket(server);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));

      server.addDataHandler('POST', ApiConstants.CONNECT_URL, undefined);
      await socket.reconnect();
      expect(socket.isConnected()).toEqual(true);

      expect(mockConsole.warn.mock.calls.length).toBe(0);
      expect(socket.getPendingRequestCount()).toBe(0);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should re-authenticate on lost session', async () => {
      const ErrorResponse = 'Invalid session token';

      // Connect and disconnect
      const { socket, mockConsole } = await getConnectedSocket(server);

      jest.useFakeTimers();
      socket.disconnect();
      jest.runOnlyPendingTimers();
      expect(socket.isActive()).toEqual(false);

      // Fail the initial reconnect attempt with 'Invalid session token'
      server.addErrorHandler('POST', ApiConstants.CONNECT_URL, ErrorResponse, 400);
      jest.runOnlyPendingTimers();
      socket.reconnect();

      // Let the socket reconnect and re-send the initial credentials
      jest.runOnlyPendingTimers();
      jest.runOnlyPendingTimers();
      expect(socket.isConnected()).toEqual(true);
      expect(mockConsole.error.mock.calls.length).toBe(0);
      expect(socket.getPendingRequestCount()).toBe(0);

      // Ensure that we received the "invalid token" error
      expect(mockConsole.warn.mock.calls.length).toBe(1);
      const loggedWarningIndex = mockConsole.warn.mock.calls[0].find(str => str.indexOf(ErrorResponse) !== -1);
      expect(loggedWarningIndex).toBeDefined();

      socket.disconnect();
      jest.runOnlyPendingTimers();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });
  });

  describe('requests', () => {
    test('should report request timeouts', async () => {
      const { socket, mockConsole } = await getConnectedSocket(server);

      jest.useFakeTimers();
      socket.addListener('hubs', 'hub_updated', _ => {})
        .catch(() => {});
      socket.addListener('hubs', 'hub_added', _ => {})
        .catch(() => {});

      jest.runTimersToTime(35000);

      MockDate.set(Date.now() + 35000);
      (socket as any).reportRequestTimeouts();

      expect(mockConsole.warn.mock.calls.length).toBe(2);
      
      expect(socket.getPendingRequestCount()).toBe(2);

      socket.disconnect();
      jest.runOnlyPendingTimers();
      expect(socket.getPendingRequestCount()).toBe(0);
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });
  });

  describe('subscriptions', () => {
    const commonData = {
      event: 'hub_updated',
      data: {
        total_messages: 63,
      },
    };

    const entityId = 1;
    const entityData: IncomingSubscriptionEvent = {
      ...commonData,
      id: entityId,
    };

    test('should handle listener messages', async () => {
      const { socket, mockConsole } = await getConnectedSocket(server);
      server.addDataHandler('POST', 'hubs/listeners/hub_updated', undefined);
      server.addDataHandler('POST', `hubs/${entityId}/listeners/hub_updated`, undefined);

      const commonSubscriptionCallback = jest.fn();
      const entitySubscriptionCallback = jest.fn();

      await socket.addListener('hubs', 'hub_updated', commonSubscriptionCallback, undefined);
      await socket.addListener('hubs', 'hub_updated', entitySubscriptionCallback, entityId);

      server.send(commonData);
      server.send(entityData);

      expect(commonSubscriptionCallback).toHaveBeenCalledWith(commonData.data, undefined);
      expect(entitySubscriptionCallback).toHaveBeenCalledWith(commonData.data, entityId);

      expect(commonSubscriptionCallback.mock.calls.length).toBe(2);
      expect(entitySubscriptionCallback.mock.calls.length).toBe(1);

      expect(mockConsole.warn.mock.calls.length).toBe(0);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should handle listener removal', async () => {
      const { socket, mockConsole } = await getConnectedSocket(server);

      const subscribeCallback = jest.fn();
      server.addDataHandler('POST', 'hubs/listeners/hub_updated', undefined, subscribeCallback);

      // Add two simultaneous pending add events
      const p1 = socket.addListener('hubs', 'hub_updated', _ => {});
      const p2 = socket.addListener('hubs', 'hub_updated', _ => {});

      expect(socket.hasListeners()).toBe(false);
      expect(socket.getPendingSubscriptionCount()).toBe(1);

      const removeListener1 = await p1;
      const removeListener2 = await p2;

      expect(subscribeCallback.mock.calls.length).toBe(1);
      expect(socket.getPendingSubscriptionCount()).toBe(0);

      const deleteCallback = jest.fn();
      server.addDataHandler('DELETE', 'hubs/listeners/hub_updated', undefined, deleteCallback);

      removeListener1();
      expect(deleteCallback.mock.calls.length).toBe(0); // Shouldn't call API yet, still one left

      removeListener2();
      await waitForExpect(() => expect(deleteCallback.mock.calls.length).toBe(1));

      expect(socket.hasListeners()).toBe(false);

      expect(mockConsole.warn.mock.calls.length).toBe(0);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should handle view updates', async () => {
      const { socket, mockConsole } = await getConnectedSocket(server);
      const viewUpdateCallback = jest.fn();

      const removeListener = socket.addViewUpdateListener('hub_user_view', viewUpdateCallback, entityId);
      server.send({});

      removeListener();

      expect(socket.hasListeners()).toBe(false);
      expect(mockConsole.warn.mock.calls.length).toBe(0);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });
  });

  describe('hooks', () => {
    const hookEventData: IncomingSubscriptionEvent = {
      event: 'queue_bundle_finished_hook',
      data: {},
      completion_id: 1,
    };

    const hookSubscriberInfo: HookSubscriberInfo = {
      id: 'sfv_checker', 
      name: 'SFV checker'
    };

    const rejectCallback: HookCallback = (data, accept, reject) => {
      reject('crc_failed', 'CRC mismatch');
    };

    test('should handle hook actions', async () => {
      const { socket, mockConsole } = await getConnectedSocket(server);
      let removeListener = null;

      // Add hook
      {
        const hookAddCallback = jest.fn();
        server.addDataHandler('POST', 'queue/hooks/queue_bundle_finished_hook', undefined, hookAddCallback);

        removeListener = await socket.addHook(
          'queue', 
          'queue_bundle_finished_hook', 
          rejectCallback, 
          hookSubscriberInfo
        );

        expect(hookAddCallback.mock.calls[0][0].data).toEqual(hookSubscriberInfo);
        expect(hookAddCallback.mock.calls.length).toBe(1);
      }

      // Simulate action
      {
        const hookEventCallback = jest.fn();
        server.addDataHandler('POST', 'queue/hooks/queue_bundle_finished_hook/1/reject', undefined, hookEventCallback);
        server.send(hookEventData);
        await waitForExpect(() => expect(hookEventCallback.mock.calls.length).toBe(1));
      }

      // Clean up
      {
        removeListener();
        expect(socket.hasListeners()).toBe(false);
      }

      expect(mockConsole.warn.mock.calls.length).toBe(0);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });
  });

  describe('logging', () => {
    const connect = async (logLevel: string) => {
      const { socket, mockConsole } = await getConnectedSocket(server, {
        logLevel,
      });

      socket.disconnect(true);
      await socket.delete('dummyLogDeleteWarning').catch(error => {
        //...
      });

      return { socket, mockConsole };
    };

    test('should respect error log level', async () => {
      const { socket, mockConsole } = await connect('error');

      expect(mockConsole.error.mock.calls.length).toBe(0);
      expect(mockConsole.warn.mock.calls.length).toBe(0);
      expect(mockConsole.info.mock.calls.length).toBe(0);
      expect(mockConsole.log.mock.calls.length).toBe(0);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });
    
    test('should respect warn log level', async () => {
      const { socket, mockConsole } = await connect('warn');

      expect(mockConsole.error.mock.calls.length).toBe(0);
      expect(mockConsole.warn.mock.calls.length).toBe(1);
      expect(mockConsole.info.mock.calls.length).toBe(0);
      expect(mockConsole.log.mock.calls.length).toBe(0);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should respect info log level', async () => {
      const { socket, mockConsole } = await connect('info');

      expect(mockConsole.error.mock.calls.length).toBe(0);
      expect(mockConsole.warn.mock.calls.length).toBe(1);
      expect(mockConsole.info.mock.calls.length).toBe(4);
      expect(mockConsole.log.mock.calls.length).toBe(0);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should respect verbose log level', async () => {
      const { socket, mockConsole } = await connect('verbose');

      expect(mockConsole.error.mock.calls.length).toBe(0);
      expect(mockConsole.warn.mock.calls.length).toBe(1);
      expect(mockConsole.info.mock.calls.length).toBe(4);
      expect(mockConsole.log.mock.calls.length).toBe(2);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });
  });
});