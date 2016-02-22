import SocketBase from './SocketBase';
import { w3cwebsocket } from 'websocket';

export default function(options) {
	return SocketBase(options, w3cwebsocket);
}