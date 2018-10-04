import * as API from './api';


// SUBSCRIPTIONS
export type SubscriptionRemoveHandler = (sendApi?: boolean) => void;

export type SubscriptionCallback<DataT extends object | void = object> = (data: DataT) => void;


// HOOKS
export interface HookSubscriberInfo {
  id: string;
  name: string;
}

export type HookRejectHandler = (rejectId: string, rejectMessage: string) => void;
export type HookAcceptHandler<DataT extends object | undefined> = (data: DataT) => void;

export type HookCallback<
  DataT extends object = object, 
  CompletionDataT extends object | undefined = object | undefined
> = (
  data: DataT,
  accept: HookAcceptHandler<CompletionDataT>,
  reject: HookRejectHandler,
) => void;


// GENERIC
export interface SocketSubscriptions {
  addHook: <DataT extends object, CompletionDataT extends object | undefined>(
    apiModuleUrl: string, 
    event: string, 
    callback: HookCallback<DataT, CompletionDataT>, 
    subscriberInfo: HookSubscriberInfo
  ) => Promise<SubscriptionRemoveHandler>;

  addListener: <DataT extends object | void>(
    apiModuleUrl: string, 
    event: string, 
    callback: SubscriptionCallback<DataT>, 
    entityId?: API.EntityId
  ) => Promise<SubscriptionRemoveHandler>;

  addViewUpdateListener: <DataT extends object | void>(
    viewName: string, 
    callback: SubscriptionCallback<DataT>, 
    entityId?: API.EntityId
  ) => () => void;

  hasListeners: () => boolean;
  getPendingSubscriptionCount: () => number;
}

export type AddHook = SocketSubscriptions['addHook'];
export type AddListener = SocketSubscriptions['addListener'];
export type AddViewUpdateListener = SocketSubscriptions['addViewUpdateListener'];