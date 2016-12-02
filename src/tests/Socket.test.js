import { authData, authPath, getMockServer, getSocket } from './helpers';

let server;

const getConnectedSocket = async () => {
	server.addDataHandler(authPath, authData);

	const socket = getSocket();
	await socket.connect();

	return socket;
};

describe('socket', () => {
	beforeEach(() => {
		server = getMockServer();
		console.warn = jest.fn((a1, a2, a3, a4) => {
			console.log(a1, a2, a3, a4);
		});
	});

	afterEach(() => {
		server.stop();
		jest.useRealTimers();
	});

	describe('auth', () => {
		test('should handle valid credentials', async () => {
			server.addDataHandler(authPath, authData);

			const socket = getSocket();
			const response = await socket.connect();

			expect(response).toEqual(authData);
			expect(socket.isReady()).toEqual(true);

			expect(console.warn.mock.calls.length).toBe(0);
		});

		test('should handle invalid credentials', async () => {
			server.addErrorHandler(authPath, 'Invalid username or password', 401);

			const socket = getSocket();
			let error;

			try {
				await socket.connect();
			} catch (e) {
				error = e;
			}

			expect(error.code).toEqual(401);
			expect(error.message).toEqual('Invalid username or password');
			expect(socket.isConnected()).toEqual(false);

			expect(console.warn.mock.calls.length).toBe(1);
		});

		test('should handle logout', async () => {
			const socket = await getConnectedSocket();

			// Dummy listener
			server.addDataHandler('hubs/v0/listener/hub_updated', null);
			await socket.addSocketListener('hubs/v0', 'hub_updated', _ => {});

			// Dummy pending request
			socket.delete('dummy').catch(error => {
				expect(error.message).toEqual('Socket disconnected');
			});

			server.addDataHandler('dummy', null);
			await socket.destroy();

			expect(socket.isConnected()).toEqual(false);
			expect(socket.hasListeners()).toEqual(false);
			expect(socket.getPendingRequestCount()).toEqual(0);

			expect(console.warn.mock.calls.length).toBe(0);
		});
	});

	describe('reconnect', () => {
		test('should handle auto reconnect', async () => {
			const socket = await getConnectedSocket();

			jest.useFakeTimers();

			socket.disconnect(true);
			expect(socket.isConnected()).toEqual(false);
			server.addDataHandler('session/v0/socket', null);

			jest.runAllTimers();

			expect(socket.isReady()).toEqual(true);
			expect(console.warn.mock.calls.length).toBe(0);
		});

		test('should handle manual reconnect', async () => {
			const socket = await getConnectedSocket();

			socket.disconnect();
			expect(socket.isConnected()).toEqual(false);

			server.addDataHandler('session/v0/socket', null);
			await socket.reconnect();
			expect(socket.isReady()).toEqual(true);

			expect(console.warn.mock.calls.length).toBe(0);
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
		const entityData = {
			...commonData,
			id: entityId,
		};

		test('should handle listener messages', async () => {
			const socket = await getConnectedSocket();
			server.addDataHandler('hubs/v0/listener/hub_updated', null);

			const commonSubscriptionCallback = jest.fn();
			const entitySubscriptionCallback = jest.fn();

			await socket.addSocketListener('hubs/v0', 'hub_updated', commonSubscriptionCallback);
			await socket.addSocketListener('hubs/v0', 'hub_updated', entitySubscriptionCallback, entityId);

			server.send(JSON.stringify(commonData));
			server.send(JSON.stringify(entityData));

			expect(commonSubscriptionCallback).toHaveBeenCalledWith(commonData.data);
			expect(entitySubscriptionCallback).toHaveBeenCalledWith(commonData.data, entityId);

			expect(commonSubscriptionCallback.mock.calls.length).toBe(2);
			expect(entitySubscriptionCallback.mock.calls.length).toBe(1);

			expect(console.warn.mock.calls.length).toBe(0);
		});

		test('should handle event listeners with duplicate IDs', async () => {
			const socket = await getConnectedSocket();
			server.addDataHandler('hubs/v0/listener/hub_updated', null);

			const commonSubscriptionCallback = jest.fn();
			await socket.addSocketListener('hubs/v0', 'hub_updated', commonSubscriptionCallback);

			const dupeMockCallback = jest.fn(); 
			const removeDupeListener = await socket.addSocketListener('hubs/v0', 'hub_updated', dupeMockCallback);

			server.send(JSON.stringify(commonData));
			removeDupeListener();
			server.send(JSON.stringify(commonData));

			expect(commonSubscriptionCallback.mock.calls.length).toBe(2);
			expect(dupeMockCallback.mock.calls.length).toBe(1);

			expect(console.warn.mock.calls.length).toBe(0);
		});
	});
});