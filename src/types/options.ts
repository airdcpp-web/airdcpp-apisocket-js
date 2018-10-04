// HELPERS

export type PrintHandler = (...optionalParams: any[]) => void;

export interface LogOutput {
  log: PrintHandler;
  info: PrintHandler;
  warn: PrintHandler;
  error: PrintHandler;
}

export type IgnoreMatcher = string[] | RegExp;

// REQUESTS
export interface SocketRequestOptions {
  ignoredRequestPaths?: IgnoreMatcher;
  requestTimeout?: number;
}

// SUBSCRIPTIONS
export interface SocketSubscriptionOptions {
  ignoredListenerEvents?: IgnoreMatcher;
}

// GENERIC
export interface RequiredSocketOptions {
  url: string;
  username?: string;
  password?: string;
} 

export interface AdvancedSocketOptions {
  autoReconnect: boolean;
  reconnectInterval: number;
  userSession: boolean;
}

export interface LoggerOptions {
  logLevel?: string;
  logOutput?: LogOutput;
}

type UserOptions = RequiredSocketOptions & Partial<AdvancedSocketOptions> & 
  LoggerOptions & SocketSubscriptionOptions & SocketRequestOptions;

export { UserOptions as APISocketOptions };