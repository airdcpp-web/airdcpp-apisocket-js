import SocketBase from '../SocketBase';
import { WebSocket, Server } from 'mock-socket';


const defaultOptions = {
	username: 'test',
	password: 'test',
	url: 'localhost:7171/api/v1/',
};

const authData = {
	cid: 'AHLUODI2YZ2U7FDWMHFNJU65ERGKUN4MH7GW5LY',
	permissions: [ 'admin' ],
	run_wizard: false,
	hostname: 'ubuntu-htpc',
	network_type: 'private',
	path_separator: '/',
	platform: 'other',
	token: 'b823187f-4aab-4b71-9764-e63e88401a26',
	user: 'test',
};

const authPath = 'session/auth';

const getSocket = (options = {}) => {
	const socket = SocketBase({
		...defaultOptions,
		...options,
	}, WebSocket);
	return socket;
};

const getMockServer = () => {
	const mockServer = new Server('ws://' + defaultOptions.url);

	const addServerHandler = (path, responseData, callback) => {
		const handler = (jsonRequest) => {
			const requestObj = JSON.parse(jsonRequest);

			if (requestObj.path !== path) {
				console.log(requestObj, requestObj.path, path);
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

	mockServer.addErrorHandler = (path, errorStr, errorCode, callback) => {
		addServerHandler(path, {
			error: {
				message: errorStr,
			},
			code: errorCode,
		}, callback);
	};

	mockServer.addDataHandler = (path, data, callback) => {
		addServerHandler(path, {
			data,
			code: 200,
		}, callback);
	};

	return mockServer;
};

export { authPath, authData, getMockServer, getSocket };