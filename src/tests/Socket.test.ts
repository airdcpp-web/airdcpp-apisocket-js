import { 
  DEFAULT_AUTH_RESPONSE, DEFAULT_CONNECT_PARAMS, 
  getConnectedSocket as getOriginalConnectedSocket, getMockServer as getOriginalMockServer, getSocket as getOriginalSocket
} from './mocks';

import ApiConstants from '../ApiConstants.js';

import { HookCallback, HookSubscriberInfo, SubscriptionRemoveHandler } from '../types/subscriptions.js';
import { IncomingSubscriptionEvent } from '../types/api_internal.js';

import { jest } from '@jest/globals';
import { defusedPromise, getMockConsole, waitForExpect } from './test-utils.js';

const dummyfn = () => {
  // ..
};


// tslint:disable:no-empty
describe('socket', () => {
  let server: ReturnType<typeof getOriginalMockServer>;
  let mockConsole: ReturnType<typeof getMockConsole>;
  
  beforeEach(() => {
    mockConsole = getMockConsole();
    server = getOriginalMockServer({
      mockF: jest,
    });
  });

  afterEach(() => {
    server.stop();
    jest.useRealTimers();
  });

  const getDefaultSocketOptions = () => ({
    logOutput: mockConsole,
  });

  const getMockSocket = () => {
    return getOriginalSocket(getDefaultSocketOptions());
  }

  
  const getConnectedMockSocket = () => {
    return getOriginalConnectedSocket(server, {
      socketOptions: getDefaultSocketOptions(),
    });
  }

  describe('auth', () => {
    test('should handle valid credentials', async () => {
      server.addRequestHandler('POST', ApiConstants.LOGIN_URL, DEFAULT_AUTH_RESPONSE);
      const connectedCallback = jest.fn();

      const { socket } = getMockSocket();
      socket.onConnected = connectedCallback;
      const response = await socket.connect();

      expect(connectedCallback).toHaveBeenCalledWith(DEFAULT_AUTH_RESPONSE);
      expect(response).toEqual(DEFAULT_AUTH_RESPONSE);
      expect(socket.isConnected()).toEqual(true);

      expect(mockConsole.warn.mock.calls.length).toBe(0);
      expect(socket.getPendingRequestCount()).toBe(0);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should handle valid refresh token', async () => {
      server.addRequestHandler('POST', ApiConstants.LOGIN_URL, DEFAULT_AUTH_RESPONSE);
      const connectedCallback = jest.fn();

      const { socket } = getMockSocket();
      socket.onConnected = connectedCallback;
      const response = await socket.connectRefreshToken('refresh token');

      expect(connectedCallback).toHaveBeenCalledWith(DEFAULT_AUTH_RESPONSE);
      expect(response).toEqual(DEFAULT_AUTH_RESPONSE);
      expect(socket.isConnected()).toEqual(true);

      expect(mockConsole.warn.mock.calls.length).toBe(0);
      expect(socket.getPendingRequestCount()).toBe(0);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should handle invalid credentials', async () => {
      server.addErrorHandler('POST', ApiConstants.LOGIN_URL, 'Invalid username or password', 401);

      const { socket } = getMockSocket();
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
      const { socket } = getOriginalSocket({
        username: 'dummy',
        password: 'dummy',
        ...getDefaultSocketOptions(),
      });

      // Fail without a server handler with auto reconnect disabled
      let error;
      try {
        await socket.connect(DEFAULT_CONNECT_PARAMS.username, DEFAULT_CONNECT_PARAMS.password, false);
      } catch (e) {
        error = e;
      }

      expect(error).toEqual('Cannot connect to the server');
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));

      // Valid connect attempt
      server = getOriginalMockServer();
      server.addRequestHandler('POST', ApiConstants.LOGIN_URL, DEFAULT_AUTH_RESPONSE);

      await socket.connect(DEFAULT_CONNECT_PARAMS.username, DEFAULT_CONNECT_PARAMS.password, false);

      expect(socket.isConnected()).toEqual(true);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should handle logout', async () => {
      const sessionResetCallback = jest.fn();
      const disconnectedCallback = jest.fn();

      const { socket } = await getConnectedMockSocket();
      socket.onSessionReset = sessionResetCallback;
      socket.onDisconnected = disconnectedCallback;

      // Dummy listener
      server.addRequestHandler('POST', 'hubs/listeners/hub_updated', undefined);
      await socket.addListener('hubs', 'hub_updated', dummyfn);

      // Dummy pending request
      server.ignoreMissingHandler('DELETE', 'dummyLogoutDelete');

      const pendingRequestPromise = defusedPromise(socket.delete('dummyLogoutDelete'));

      // Logout
      server.addRequestHandler('DELETE', ApiConstants.LOGOUT_URL);
      await socket.logout();

      expect(sessionResetCallback.mock.calls.length).toBe(1);
      await waitForExpect(() => expect(disconnectedCallback.mock.calls.length).toBe(1));

      await expect(pendingRequestPromise).rejects.toMatchInlineSnapshot(`"Socket disconnected"`);

      expect(socket.isActive()).toEqual(false);
      expect(socket.hasListeners()).toEqual(false);
      expect(socket.getPendingRequestCount()).toEqual(0);

      expect(mockConsole.warn.mock.calls.length).toBe(0);
      expect(socket.getPendingRequestCount()).toBe(0);
    });
  });

  describe('disconnect', () => {
    test('should handle disconnect', async () => {
      const { socket } = await getConnectedMockSocket();

      socket.disconnect();

      await socket.waitDisconnected();

      expect(mockConsole.error.mock.calls.length).toBe(0);
      expect(mockConsole.warn.mock.calls.length).toBe(0);
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should handle wait disconnected timeout', async () => {
      const { socket } = await getConnectedMockSocket();

      let error: Error | null = null;
      try {
        await socket.waitDisconnected(50);
      } catch (e) {
        error = e;
      }

      expect(error?.message).toEqual('Socket disconnect timed out');

      expect(mockConsole.error.mock.calls.length).toBe(1);
      expect(mockConsole.warn.mock.calls.length).toBe(0);
      
      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });
  });

  describe('reconnect', () => {
    test('should handle auto reconnect', async () => {
      const { socket } = await getConnectedMockSocket();

      jest.useFakeTimers();

      socket.disconnect(true);
      jest.runOnlyPendingTimers();
      
      expect(socket.isActive()).toEqual(false);

      // Let it fail once
      server.stop();
      jest.runOnlyPendingTimers();
      jest.runOnlyPendingTimers();
      expect(mockConsole.error.mock.calls.length).toBe(1);

      server = getOriginalMockServer();
      server.addRequestHandler('POST', ApiConstants.CONNECT_URL, undefined);
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
        await waitForExpectTask;
      }
    });

    test('should cancel auto reconnect', async () => {
      const { socket } = await getConnectedMockSocket();

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
      await waitForExpectTask;
    });

    test('should handle manual reconnect', async () => {
      const { socket } = await getConnectedMockSocket();

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));

      server.addRequestHandler('POST', ApiConstants.CONNECT_URL, undefined);
      await socket.reconnect();
      expect(socket.isConnected()).toEqual(true);

      expect(mockConsole.warn.mock.calls.length).toBe(0);
      expect(socket.getPendingRequestCount()).toBe(0);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should re-authenticate on lost session', async () => {
      const ErrorResponse = 'Invalid session token';
      const authCallback = jest.fn();
      const connectErrorCallback = jest.fn();

      // Connect and disconnect
      const { socket } = await getConnectedMockSocket();

      jest.useFakeTimers();
      socket.disconnect();
      jest.runOnlyPendingTimers();
      expect(socket.isActive()).toEqual(false);

      // Fail the initial reconnect attempt with 'Invalid session token'
      // and connect with credentials afterwards
      server.addErrorHandler('POST', ApiConstants.CONNECT_URL, ErrorResponse, 400, connectErrorCallback);
      
      server.addRequestHandler('POST', ApiConstants.LOGIN_URL, DEFAULT_AUTH_RESPONSE, authCallback);

      jest.runOnlyPendingTimers();
      socket.reconnect();

      await jest.advanceTimersByTimeAsync(1000);
      expect(authCallback.mock.calls.length).toBe(1);
      expect(connectErrorCallback.mock.calls.length).toBe(1);

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
        await waitForExpectTask;
      }
    });
  });

  describe('requests', () => {
    test('should report request timeouts', async () => {
      const { socket } = await getConnectedMockSocket();

      server.ignoreMissingHandler('POST', 'hubs/listeners/hub_updated');
      server.ignoreMissingHandler('POST', 'hubs/listeners/hub_added');

      jest.useFakeTimers();
      socket.addListener('hubs', 'hub_updated', dummyfn)
        .catch(() => {});
      socket.addListener('hubs', 'hub_added', dummyfn)
        .catch(() => {});

      jest.advanceTimersByTime(35000);

      jest.setSystemTime(new Date(Date.now() + 35000));
      (socket as any).reportRequestTimeouts();

      expect(mockConsole.warn.mock.calls.length).toBe(2);
      
      expect(socket.getPendingRequestCount()).toBe(2);

      socket.disconnect();
      jest.runOnlyPendingTimers();
      expect(socket.getPendingRequestCount()).toBe(0);

      const waitForExpectTask = waitForExpect(() => expect(socket.isActive()).toEqual(false));
      jest.advanceTimersByTime(1000);
      await waitForExpectTask;
    });

    test('should handle missing error messages', async () => {
      const { socket } = await getConnectedMockSocket();

      server.addErrorHandler('POST', 'test/test', null, 401);

      let error;
      try {
        await socket.post('test/test', { test: 'test' });
      } catch (e) {
        error = e;
      }
      
      expect(error.code).toEqual(401);
      expect(error.message).toEqual('(no error description)');

      socket.disconnect();
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
      const { socket } = await getConnectedMockSocket();
      server.addSubscriptionHandler('hubs', 'hub_updated');
      server.addSubscriptionHandler('hubs', 'hub_updated', entityId);

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
      const { socket } = await getConnectedMockSocket();

      const hubUpdatedListener = server.addSubscriptionHandler('hubs', 'hub_updated');

      // Add two simultaneous pending add events
      const p1 = socket.addListener('hubs', 'hub_updated', dummyfn);
      const p2 = socket.addListener('hubs', 'hub_updated', dummyfn);

      expect(socket.hasListeners()).toBe(false);
      expect(socket.getPendingSubscriptionCount()).toBe(1);

      const removeListener1 = await p1;
      const removeListener2 = await p2;

      expect(hubUpdatedListener.subscribeFn.mock.calls.length).toBe(1);
      expect(socket.getPendingSubscriptionCount()).toBe(0);

      removeListener1();
      expect(hubUpdatedListener.unsubscribeFn.mock.calls.length).toBe(0); // Shouldn't call API yet, still one left

      removeListener2();
      await waitForExpect(() => expect(hubUpdatedListener.unsubscribeFn.mock.calls.length).toBe(1));

      expect(socket.hasListeners()).toBe(false);

      expect(mockConsole.warn.mock.calls.length).toBe(0);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });

    test('should handle view updates', async () => {
      const { socket } = await getConnectedMockSocket();
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
    const HOOK_MODULE = 'queue';
    const HOOK_NAME = 'queue_bundle_finished_hook';
    const HOOK_COMPLETION_ID = 1;

    const hookSubscriberInfo: HookSubscriberInfo = {
      id: 'sfv_checker', 
      name: 'SFV checker'
    };

    const rejectCallback: HookCallback = (data, accept, reject) => {
      reject('crc_failed', 'CRC mismatch');
    };

    test('should handle hook actions', async () => {
      const { socket } = await getConnectedMockSocket();
      let removeListener: SubscriptionRemoveHandler | null = null;

      // Add hook
      {
        const hook = server.addHookHandler(HOOK_MODULE, HOOK_NAME);

        removeListener = await socket.addHook(
          HOOK_MODULE, 
          HOOK_NAME, 
          rejectCallback, 
          hookSubscriberInfo
        );

        expect((hook.subscribeFn.mock.calls[0][0] as any).data).toEqual(hookSubscriberInfo);
        expect(hook.subscribeFn.mock.calls.length).toBe(1);

        // Simulate action
        const hookResolver = hook.addResolver(HOOK_COMPLETION_ID);
        hookResolver.fire({});
        await waitForExpect(() => expect(hookResolver.rejectFn.mock.calls.length).toBe(1));
      }

      // Clean up
      removeListener();
      expect(socket.hasListeners()).toBe(false);

      expect(mockConsole.warn.mock.calls.length).toBe(0);

      socket.disconnect();
      await waitForExpect(() => expect(socket.isActive()).toEqual(false));
    });
  });

  describe('logging', () => {
    const connect = async (logLevel: string) => {
      const { socket } = await getOriginalConnectedSocket(server, {
        socketOptions: {
          logLevel,
          ...getDefaultSocketOptions(),
        },
      });

      socket.disconnect(true);
      await socket.delete('dummyLogDeleteWarning').catch((error: Error) => {
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