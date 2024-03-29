import { AuthTokenType, LogoutResponse, AuthenticationResponse } from './api.js';
import { Logger } from './logger.js';
import { SocketRequestMethods } from './requests.js';
import { SocketSubscriptions } from './subscriptions.js';


export type ConnectedCallback = (data: AuthenticationResponse) => void;
export type SessionResetCallback = () => void;
export type DisconnectedCallback = (reason: string, code: number, wasClean: boolean) => void;

export interface APISocket extends SocketRequestMethods, SocketSubscriptions {
  connect: (username?: string, password?: string, reconnectOnFailure?: boolean) => Promise<AuthenticationResponse>; 
  connectRefreshToken: (refreshToken: string, reconnectOnFailure?: boolean) => Promise<AuthenticationResponse>; 
  disconnect: (autoConnect?: boolean, reason?: string) => void;
  waitDisconnected: (timeoutMs?: number) => Promise<void>; 
  reconnect: (token?: AuthTokenType, reconnectOnFailure?: boolean) => Promise<AuthenticationResponse>;
  logout: () => Promise<LogoutResponse>;

  isConnecting: () => boolean;
  isConnected: () => boolean;
  isActive: () => boolean;
  
  logger: Logger;

  onConnected: ConnectedCallback | null;
  onSessionReset: SessionResetCallback | null;
  onDisconnected: DisconnectedCallback | null;
  readonly nativeSocket: WebSocket | null;
}