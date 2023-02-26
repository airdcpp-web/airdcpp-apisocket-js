import { Logger } from './types/logger.js';
import * as APIInternal from './types/api_internal.js';
import * as Options from './types/options.js';
import * as Socket from './types/socket.js';
import * as Subscriptions from './types/subscriptions.js';
declare const SocketSubscriptionHandler: (socket: () => Socket.APISocket, logger: Logger, { ignoredListenerEvents }: Options.SocketSubscriptionOptions) => {
    socket: Subscriptions.SocketSubscriptions;
    onSocketDisconnected(): void;
    handleMessage(message: APIInternal.IncomingSubscriptionEvent): void;
};
export default SocketSubscriptionHandler;
