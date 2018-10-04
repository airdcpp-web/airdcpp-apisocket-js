import * as API from './api';


export interface SocketRequestMethods {
  put: <ResponseT extends object | void>(path: string, data?: object) => Promise<ResponseT>;
  patch: <ResponseT extends object | void>(path: string, data?: object) => Promise<ResponseT>;
  post: <ResponseT extends object | void>(path: string, data?: object) => Promise<ResponseT>;
  delete: <ResponseT extends object | void>(path: string) => Promise<ResponseT>;
  get: <ResponseT extends object | void>(path: string) => Promise<ResponseT>;
  getPendingRequestCount: () => number;
}

export interface ErrorResponse {
  message: string;
  code: number;
  json: API.FieldError | API.ErrorBase;
}