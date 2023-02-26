import * as Options from '../types/options.js';
declare const CONNECT_PARAMS: {
    username: string;
    password: string;
    url: string;
};
declare const AUTH_RESPONSE: {
    auth_token: string;
    refresh_token: string;
    user: {
        permissions: string[];
        username: string;
        active_sessions: number;
        last_login: number;
    };
    system: {
        cid: string;
        hostname: string;
        network_type: string;
        path_separator: string;
        platform: string;
        language: string;
    };
    wizard_pending: boolean;
};
export type MockSocketOptions = Omit<Options.APISocketOptions, 'username' | 'password' | 'url'> & {
    username?: string;
    password?: string;
    url?: string;
};
declare const getSocket: (options?: MockSocketOptions) => {
    socket: import("../NodeSocket.js").APISocket;
    mockConsole: {
        log: import("jest-mock").Mock<(a1: any, a2: any, a3: any, a4: any) => void>;
        info: import("jest-mock").Mock<(a1: any, a2: any, a3: any, a4: any) => void>;
        warn: import("jest-mock").Mock<(a1: any, a2: any, a3: any, a4: any) => void>;
        error: import("jest-mock").Mock<(a1: any, a2: any, a3: any, a4: any) => void>;
    };
};
type Callback = (requestData: object) => void;
declare const getConnectedSocket: (server: ReturnType<typeof getMockServer>, options?: MockSocketOptions, authCallback?: Callback) => Promise<{
    socket: import("../NodeSocket.js").APISocket;
    mockConsole: {
        log: import("jest-mock").Mock<(a1: any, a2: any, a3: any, a4: any) => void>;
        info: import("jest-mock").Mock<(a1: any, a2: any, a3: any, a4: any) => void>;
        warn: import("jest-mock").Mock<(a1: any, a2: any, a3: any, a4: any) => void>;
        error: import("jest-mock").Mock<(a1: any, a2: any, a3: any, a4: any) => void>;
    };
}>;
declare const getMockServer: () => {
    addDataHandler: <DataT extends object | undefined>(method: string, path: string, data?: DataT | undefined, subscriptionCallback?: Callback) => void;
    addErrorHandler: (method: string, path: string, errorStr: string | null, errorCode: number, subscriptionCallback?: Callback) => void;
    stop: () => void;
    send: (data: object) => void;
};
export { getMockServer, getSocket, getConnectedSocket, CONNECT_PARAMS, AUTH_RESPONSE };
