"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH_RESPONSE = exports.CONNECT_PARAMS = exports.getConnectedSocket = exports.getSocket = exports.getMockServer = void 0;
const NodeSocket_js_1 = require("../NodeSocket.js");
const mock_socket_1 = require("mock-socket");
const globals_1 = require("@jest/globals");
const ApiConstants_js_1 = __importDefault(require("../ApiConstants.js"));
const events_1 = require("events");
const VERBOSE = false;
const getMockConsole = () => ({
    log: globals_1.jest.fn((a1, a2, a3, a4) => {
        if (VERBOSE) {
            console.log(a1, a2, a3, a4);
        }
    }),
    info: globals_1.jest.fn((a1, a2, a3, a4) => {
        if (VERBOSE) {
            console.info(a1, a2, a3, a4);
        }
    }),
    warn: globals_1.jest.fn((a1, a2, a3, a4) => {
        console.warn(a1, a2, a3, a4);
    }),
    error: globals_1.jest.fn((a1, a2, a3, a4) => {
        console.error(a1, a2, a3, a4);
    }),
});
const CONNECT_PARAMS = {
    username: 'test',
    password: 'test',
    url: 'ws://localhost:7171/api/v1/',
};
exports.CONNECT_PARAMS = CONNECT_PARAMS;
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
exports.AUTH_RESPONSE = AUTH_RESPONSE;
const getSocket = (options = {}) => {
    const mockConsole = getMockConsole();
    const socket = (0, NodeSocket_js_1.Socket)(Object.assign(Object.assign({}, getDefaultSocketOptions(mockConsole)), options), mock_socket_1.WebSocket);
    return { socket, mockConsole };
};
exports.getSocket = getSocket;
const getConnectedSocket = (server, options, authCallback) => __awaiter(void 0, void 0, void 0, function* () {
    server.addDataHandler('POST', ApiConstants_js_1.default.LOGIN_URL, AUTH_RESPONSE, authCallback);
    const { socket, mockConsole } = getSocket(options);
    yield socket.connect();
    return { socket, mockConsole };
});
exports.getConnectedSocket = getConnectedSocket;
const toEmitId = (path, method) => {
    return `${path}_${method}`;
};
const getMockServer = () => {
    const mockServer = new mock_socket_1.Server(CONNECT_PARAMS.url);
    let socket;
    const emitter = new events_1.EventEmitter();
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
exports.getMockServer = getMockServer;
//# sourceMappingURL=helpers.js.map