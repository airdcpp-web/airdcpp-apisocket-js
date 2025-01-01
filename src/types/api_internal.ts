// HELPERS
export type CompletionIdType = number;


// REQUESTS

import { ErrorBase, FieldError, EntityId } from './api.js';

export interface RequestResponseBase {
  code: number;
  callback_id: number;
}

export interface RequestSuccessResponse<
  DataT extends object | undefined = object | undefined
> extends RequestResponseBase {
  data?: DataT;
}

export interface RequestErrorResponse extends RequestResponseBase {
  error: ErrorBase | FieldError;
}

export interface OutgoingRequest<DataT extends object | undefined = object | undefined> {
  path: string;
  method: string;
  data: DataT;
  callback_id: number;
}


// SUBSCRIPTIONS

export interface IncomingSubscriptionEvent<DataT extends object | undefined = object | undefined> {
  event: string;
  data: DataT;
  completion_id?: CompletionIdType;
  id?: EntityId;
}
