import SocketBase from './SocketBase';
import { w3cwebsocket } from 'websocket';

module.exports = {
	Socket: (options, socketImpl = w3cwebsocket) => {
		return SocketBase(options, socketImpl);
	}
};