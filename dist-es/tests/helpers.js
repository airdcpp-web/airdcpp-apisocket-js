var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Socket } from '../NodeSocket.js';
import { Server, WebSocket } from 'mock-socket';
import { jest } from '@jest/globals';
import ApiConstants from '../ApiConstants.js';
import { EventEmitter } from 'events';
const VERBOSE = false;
const getMockConsole = () => ({
    log: jest.fn((a1, a2, a3, a4) => {
        if (VERBOSE) {
            console.log(a1, a2, a3, a4);
        }
    }),
    info: jest.fn((a1, a2, a3, a4) => {
        if (VERBOSE) {
            console.info(a1, a2, a3, a4);
        }
    }),
    warn: jest.fn((a1, a2, a3, a4) => {
        console.warn(a1, a2, a3, a4);
    }),
    error: jest.fn((a1, a2, a3, a4) => {
        console.error(a1, a2, a3, a4);
    }),
});
const CONNECT_PARAMS = {
    username: 'test',
    password: 'test',
    url: 'ws://localhost:7171/api/v1/',
};
const getDefaultSocketOptions = (mockConsole) => (Object.assign(Object.assign({}, CONNECT_PARAMS), { logOutput: mockConsole, logLevel: VERBOSE ? 'verbose' : 'warn' }));
const AUTH_RESPONSE = {
    auth_token: 'b823187f-4aab-4b71-9764-e63e88401a26',
    refresh_token: '5124faasf-4aab-4b71-9764-e63e88401a26',
    user: {
        permissions: ['admin'],
        username: 'test',
        active_sessions: 1,
        last_login: 0,
    },
    system: {
        cid: 'AHLUODI2YZ2U7FDWMHFNJU65ERGKUN4MH7GW5LY',
        hostname: 'ubuntu-htpc',
        network_type: 'private',
        path_separator: '/',
        platform: 'other',
        language: 'fi',
    },
    wizard_pending: false,
};
const getSocket = (options = {}) => {
    const mockConsole = getMockConsole();
    const socket = Socket(Object.assign(Object.assign({}, getDefaultSocketOptions(mockConsole)), options), WebSocket);
    return { socket, mockConsole };
};
const getConnectedSocket = (server, options, authCallback) => __awaiter(void 0, void 0, void 0, function* () {
    server.addDataHandler('POST', ApiConstants.LOGIN_URL, AUTH_RESPONSE, authCallback);
    const { socket, mockConsole } = getSocket(options);
    yield socket.connect();
    return { socket, mockConsole };
});
const toEmitId = (path, method) => {
    return `${path}_${method}`;
};
const getMockServer = () => {
    const mockServer = new Server(CONNECT_PARAMS.url);
    let socket;
    const emitter = new EventEmitter();
    const addServerHandler = (method, path, responseData, subscriptionCallback) => {
        emitter.addListener(toEmitId(path, method), (request, s) => {
            if (subscriptionCallback) {
                subscriptionCallback(request);
            }
            const response = Object.assign({ callback_id: request.callback_id }, responseData);
            s.send(JSON.stringify(response));
        });
    };
    mockServer.on('connection', s => {
        socket = s;
        socket.on('message', (messageObj) => {
            const request = JSON.parse(messageObj);
            emitter.emit(toEmitId(request.path, request.method), request, s);
        });
    });
    mockServer.on('close', () => {
        emitter.removeAllListeners();
    });
    return {
        addDataHandler: (method, path, data, subscriptionCallback) => {
            addServerHandler(method, path, {
                data,
                code: 200,
            }, subscriptionCallback);
        },
        addErrorHandler: (method, path, errorStr, errorCode, subscriptionCallback) => {
            addServerHandler(method, path, {
                error: !errorStr ? null : {
                    message: errorStr,
                },
                code: errorCode,
            }, subscriptionCallback);
        },
        stop: () => {
            mockServer.stop(() => {
                // ...
            });
        },
        send: (data) => {
            socket.send(JSON.stringify(data));
        },
    };
};
export { getMockServer, getSocket, getConnectedSocket, CONNECT_PARAMS, AUTH_RESPONSE };
//# sourceMappingURL=helpers.js.map