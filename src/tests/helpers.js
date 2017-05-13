import Socket from '../NodeSocket';
import { WebSocket, Server } from 'mock-socket';

const mockConsole = {
	log: jest.fn((a1, a2, a3, a4) => {
		//console.log(a1, a2, a3, a4);
	}),
	info: jest.fn((a1, a2, a3, a4) => {
		//console.info(a1, a2, a3, a4);
	}),
	warn: jest.fn((a1, a2, a3, a4) => {
		console.warn(a1, a2, a3, a4);
	}),
	error: jest.fn((a1, a2, a3, a4) => {
		console.error(a1, a2, a3, a4);
	}),
};

const defaultOptions = {
	username: 'test',
	password: 'test',
	url: 'ws://localhost:7171/api/v1/',
	logOutput: mockConsole,
};

const authData = {
	cid: 'AHLUODI2YZ2U7FDWMHFNJU65ERGKUN4MH7GW5LY',
	permissions: [ 'admin' ],
	run_wizard: false,
	hostname: 'ubuntu-htpc',
	network_type: 'private',
	path_separator: '/',
	platform: 'other',
	auth_token: 'b823187f-4aab-4b71-9764-e63e88401a26',
	user: 'test',
};

const getSocket = (options = {}) => {
	const socket = Socket({
		...defaultOptions,
		...options,
	}, WebSocket);
	return socket;
};

const getMockServer = () => {
	const mockServer = new Server(defaultOptions.url);

	const addServerHandler = (method, path, responseData, callback) => {
		const handler = (jsonRequest) => {
			const requestObj = JSON.parse(jsonRequest);

			if (requestObj.path !== path || requestObj.method !== method) {
				//console.log(requestObj, requestObj.path, path);
				return;
			}

			if (callback) {
				callback(requestObj);
			}

			const response = {
				callback_id: requestObj.callback_id,
				...responseData,
			};

			mockServer.send(JSON.stringify(response));
		};

		mockServer.addEventListener('message', handler);
	};

	mockServer.addErrorHandler = (method, path, errorStr, errorCode, callback) => {
		addServerHandler(method, path, {
			error: {
				message: errorStr,
			},
			code: errorCode,
		}, callback);
	};

	mockServer.addDataHandler = (method, path, data, callback) => {
		addServerHandler(method, path, {
			data,
			code: 200,
		}, callback);
	};

	return mockServer;
};

export { authData, getMockServer, getSocket, mockConsole };