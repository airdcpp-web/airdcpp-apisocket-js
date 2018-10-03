import { authResponse, 
  defaultSocketOptions, 
  getMockServer, getSocket, mockConsole, 
  MockSocketOptions,
} from './helpers';

import ApiConstants from '../ApiConstants';
import { 
  HookCallback, 
  SubscriptionEvent, 
  HookSubscriberInfo 
} from '../SocketSubscriptionHandler';

import * as MockDate from 'mockdate';


let server: any;

const getConnectedSocket = async (options?: MockSocketOptions) => {
  server.addDataHandler('POST', ApiConstants.LOGIN_URL, authResponse);

  const socket = getSocket(options);
  await socket.connect();

  return socket;
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

    mockConsole.log.mockClear();
    mockConsole.info.mockClear();
    mockConsole.warn.mockClear();
    mockConsole.error.mockClear();
  });

  describe('auth', () => {
    test('should handle valid credentials', async () => {
      server.addDataHandler('POST', ApiConstants.LOGIN_URL, authResponse);
      const connectedCallback = jest.fn();

      const socket = getSocket();
      socket.onConnected = connectedCallback;
      const response = await socket.connect();

      expect(connectedCallback).toHaveBeenCalledWith(authResponse);
      expect(response).toEqual(authResponse);
      expect(socket.isConnected()).toEqual(true);

      expect(mockConsole.warn.mock.calls.length).toBe(0);
      expect(socket.getPendingRequestCount()).toBe(0);

      socket.disconnect();
    });

    test('should handle invalid credentials', async () => {
      server.addErrorHandler('POST', ApiConstants.LOGIN_URL, 'Invalid username or password', 401);

      const socket = getSocket();
      let error;

      try {
        await socket.connect();
      } catch (e) {
        error = e;
      }

      expect(error.code).toEqual(401);
      expect(error.message).toEqual('Invalid username or password');
      expect(socket.isActive()).toEqual(false);

      expect(mockConsole.warn.mock.calls.length).toBe(1);
      expect(socket.getPendingRequestCount()).toBe(0);
    });

    test('should handle connect with custom credentials', async () => {
      server.stop();
      const socket = getSocket({
        username: 'dummy',
        password: 'dummy',
      });

      // Fail without a server handler with auto reconnect disabled
      let error;
      try {
        await socket.connect(defaultSocketOptions.username, defaultSocketOptions.password, false);
      } catch (e) {
        error = e;
      }

      expect(error).toEqual('Cannot connect to the server');
      expect(socket.isActive()).toEqual(false);

      // Valid connect attempt
      server = getMockServer();
      server.addDataHandler('POST', ApiConstants.LOGIN_URL, authResponse);

      await socket.connect(defaultSocketOptions.username, defaultSocketOptions.password, false);

      expect(socket.isConnected()).toEqual(true);

      socket.disconnect();
    });

    test('should handle logout', async () => {
      const sessionResetCallback = jest.fn();
      const disconnectedCallback = jest.fn();

      const socket = await getConnectedSocket();
      socket.onSessionReset = sessionResetCallback;
      socket.onDisconnected = disconnectedCallback;

      // Dummy listener
      server.addDataHandler('POST', 'hubs/listeners/hub_updated', null);
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
      expect(disconnectedCallback.mock.calls.length).toBe(1);

      expect(socket.isActive()).toEqual(false);
      expect(socket.hasListeners()).toEqual(false);
      expect(socket.getPendingRequestCount()).toEqual(0);

      expect(mockConsole.warn.mock.calls.length).toBe(0);
      expect(socket.getPendingRequestCount()).toBe(0);
    });
  });

  describe('reconnect', () => {
    test('should handle auto reconnect', async () => {
      const socket = await getConnectedSocket();

      jest.useFakeTimers();

      socket.disconnect(true);
      expect(socket.isActive()).toEqual(false);

      // Let it fail once
      server.stop();
      jest.runOnlyPendingTimers();
      jest.runOnlyPendingTimers();
      expect(mockConsole.error.mock.calls.length).toBe(1);

      server = getMockServer();
      server.addDataHandler('POST', ApiConstants.CONNECT_URL, null);
      jest.runOnlyPendingTimers();
      jest.runOnlyPendingTimers();

      expect(socket.isConnected()).toEqual(true);
      expect(mockConsole.warn.mock.calls.length).toBe(0);
      expect(socket.getPendingRequestCount()).toBe(0);

      socket.disconnect();
    });

    test('should cancel autoreconnect', async () => {
      const socket = await getConnectedSocket();

      jest.useFakeTimers();

      // Disconnect with auto reconnect
      socket.disconnect(true);
      expect(socket.isActive()).toEqual(false);

      server.stop();

      // Cancel autoreconnect
      socket.disconnect();

      // Ensure that nothing happens
      jest.runOnlyPendingTimers();
      jest.runOnlyPendingTimers();

      expect(mockConsole.error.mock.calls.length).toBe(0);
    });

    test('should handle manual reconnect', async () => {
      const socket = await getConnectedSocket();

      socket.disconnect();
      expect(socket.isConnected()).toEqual(false);

      server.addDataHandler('POST', ApiConstants.CONNECT_URL, null);
      await socket.reconnect();
      expect(socket.isConnected()).toEqual(true);

      expect(mockConsole.warn.mock.calls.length).toBe(0);
      expect(socket.getPendingRequestCount()).toBe(0);

      socket.disconnect();
    });

    test('should re-authenticate on lost session', async () => {
      const socket = await getConnectedSocket();

      jest.useFakeTimers();
      socket.disconnect();
      expect(socket.isActive()).toEqual(false);

      // Fail the initial reconnect attempt
      server.addErrorHandler('POST', ApiConstants.CONNECT_URL, 'Invalid session token', 400);
      jest.runOnlyPendingTimers();
      socket.reconnect();

      // Re-send credentials
      jest.runOnlyPendingTimers();

      expect(socket.isConnected()).toEqual(true);

      expect(mockConsole.error.mock.calls.length).toBe(0);

      expect(mockConsole.warn.mock.calls.length).toBe(1);
      expect(mockConsole.warn.mock.calls[0].indexOf('\u001b[33m\u001b[1m400\u001b[22m\u001b[39m')).toBe(2);

      expect(socket.getPendingRequestCount()).toBe(0);

      socket.disconnect();
    });
  });

  describe('requests', () => {
    test('should report request timeouts', async () => {
      const socket = await getConnectedSocket();

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
      expect(socket.getPendingRequestCount()).toBe(0);
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
    const entityData: SubscriptionEvent = {
      ...commonData,
      id: entityId,
    };

    test('should handle listener messages', async () => {
      const socket = await getConnectedSocket();
      server.addDataHandler('POST', 'hubs/listeners/hub_updated', null);
      server.addDataHandler('POST', `hubs/${entityId}/listeners/hub_updated`, null);

      const commonSubscriptionCallback = jest.fn();
      const entitySubscriptionCallback = jest.fn();

      await socket.addListener('hubs', 'hub_updated', commonSubscriptionCallback, undefined);
      await socket.addListener('hubs', 'hub_updated', entitySubscriptionCallback, entityId);

      server.send(JSON.stringify(commonData));
      server.send(JSON.stringify(entityData));

      expect(commonSubscriptionCallback).toHaveBeenCalledWith(commonData.data, undefined);
      expect(entitySubscriptionCallback).toHaveBeenCalledWith(commonData.data, entityId);

      expect(commonSubscriptionCallback.mock.calls.length).toBe(2);
      expect(entitySubscriptionCallback.mock.calls.length).toBe(1);

      expect(mockConsole.warn.mock.calls.length).toBe(0);

      socket.disconnect();
    });

    test('should handle listener removal', async () => {
      const socket = await getConnectedSocket();

      const subscribeCallback = jest.fn();
      server.addDataHandler('POST', 'hubs/listeners/hub_updated', null, subscribeCallback);

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
      server.addDataHandler('DELETE', 'hubs/listeners/hub_updated', null, deleteCallback);

      removeListener1();
      expect(deleteCallback.mock.calls.length).toBe(0);

      removeListener2();
      expect(deleteCallback.mock.calls.length).toBe(1);

      expect(socket.hasListeners()).toBe(false);

      expect(mockConsole.warn.mock.calls.length).toBe(0);

      socket.disconnect();
    });

    test('should handle view updates', async () => {
      const socket = await getConnectedSocket();
      const viewUpdateCallback = jest.fn();

      const removeListener = socket.addViewUpdateListener('hub_user_view', viewUpdateCallback, entityId);
      server.send(JSON.stringify({}));

      removeListener();

      expect(socket.hasListeners()).toBe(false);
      expect(mockConsole.warn.mock.calls.length).toBe(0);

      socket.disconnect();
    });
  });

  describe('hooks', () => {
    const hookEventData: SubscriptionEvent = {
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
      const socket = await getConnectedSocket();
      let removeListener = null;

      // Add hook
      {
        const hookAddCallback = jest.fn();
        server.addDataHandler('POST', 'queue/hooks/queue_bundle_finished_hook', null, hookAddCallback);

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
        server.addDataHandler('POST', 'queue/hooks/queue_bundle_finished_hook/1/reject', null, hookEventCallback);
        server.send(JSON.stringify(hookEventData));
        expect(hookEventCallback.mock.calls.length).toBe(1);
      }

      // Clean up
      {
        removeListener();
        expect(socket.hasListeners()).toBe(false);
      }

      expect(mockConsole.warn.mock.calls.length).toBe(0);

      socket.disconnect();
    });
  });

  describe('logging', () => {
    const connect = async (logLevel: string) => {
      const socket = await getConnectedSocket({
        logLevel,
      });

      socket.disconnect(true);
      await socket.delete('dummyLogDeleteWarning').catch(error => {
        //...
      });

      return socket;
    };

    test('should respect error log level', async () => {
      const socket = await connect('error');

      expect(mockConsole.error.mock.calls.length).toBe(0);
      expect(mockConsole.warn.mock.calls.length).toBe(0);
      expect(mockConsole.info.mock.calls.length).toBe(0);
      expect(mockConsole.log.mock.calls.length).toBe(0);

      socket.disconnect();
    });
    
    test('should respect warn log level', async () => {
      const socket = await connect('warn');

      expect(mockConsole.error.mock.calls.length).toBe(0);
      expect(mockConsole.warn.mock.calls.length).toBe(1);
      expect(mockConsole.info.mock.calls.length).toBe(0);
      expect(mockConsole.log.mock.calls.length).toBe(0);

      socket.disconnect();
    });

    test('should respect info log level', async () => {
      const socket = await connect('info');

      expect(mockConsole.error.mock.calls.length).toBe(0);
      expect(mockConsole.warn.mock.calls.length).toBe(1);
      expect(mockConsole.info.mock.calls.length).toBe(5);
      expect(mockConsole.log.mock.calls.length).toBe(0);

      socket.disconnect();
    });

    test('should respect verbose log level', async () => {
      const socket = await connect('verbose');

      expect(mockConsole.error.mock.calls.length).toBe(0);
      expect(mockConsole.warn.mock.calls.length).toBe(1);
      expect(mockConsole.info.mock.calls.length).toBe(5);
      expect(mockConsole.log.mock.calls.length).toBe(2);

      socket.disconnect();
    });
  });
});