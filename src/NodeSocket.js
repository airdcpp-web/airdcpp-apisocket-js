import SocketBase from './SocketBase';
import { w3cwebsocket } from 'websocket';

module.exports = function (options) {
	return SocketBase(options, w3cwebsocket);
};