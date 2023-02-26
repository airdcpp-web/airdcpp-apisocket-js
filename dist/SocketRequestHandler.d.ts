import * as API from './types/api.js';
import * as APIInternal from './types/api_internal.js';
import * as Options from './types/options.js';
import * as Socket from './types/socket.js';
import { Logger } from './types/logger.js';
import { SocketRequestMethods } from './types/requests.js';
declare const SocketRequestHandler: (socket: () => Socket.APISocket, logger: Logger, { requestTimeout, ignoredRequestPaths }: Options.SocketRequestOptions) => {
    socket: SocketRequestMethods;
    onSocketConnected(): void;
    onSocketDisconnected(): void;
    handleMessage(messageObj: APIInternal.RequestSuccessResponse | APIInternal.RequestErrorResponse): void;
    postAuthenticate(path: string, data: API.TokenAuthenticationData | API.CredentialsAuthenticationData | API.RefreshTokenAuthenticationData): Promise<any>;
};
export default SocketRequestHandler;
