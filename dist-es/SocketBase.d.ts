import * as Options from './types/options.js';
import * as Socket from './types/socket.js';
declare const ApiSocket: (userOptions: Options.APISocketOptions, WebSocketImpl: WebSocket) => Socket.APISocket;
export default ApiSocket;
