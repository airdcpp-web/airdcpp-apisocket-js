import * as API from './api.js';
export type SubscriptionRemoveHandler = (sendApi?: boolean) => void;
export type SubscriptionCallback<DataT extends object | void = object, EntityIdT = API.EntityId | undefined> = (data: DataT, entityId: EntityIdT) => void;
export interface HookSubscriberInfo {
    id: string;
    name: string;
}
export type HookRejectHandler = (rejectId: string, rejectMessage: string) => void;
export type HookAcceptHandler<DataT extends object | undefined> = (data: DataT) => void;
export type HookCallback<DataT extends object = object, CompletionDataT extends object | undefined = object | undefined> = (data: DataT, accept: HookAcceptHandler<CompletionDataT>, reject: HookRejectHandler) => void;
export interface SocketSubscriptions {
    addHook: <DataT extends object, CompletionDataT extends object | undefined>(apiModule: string, event: string, callback: HookCallback<DataT, CompletionDataT>, subscriberInfo: HookSubscriberInfo) => Promise<SubscriptionRemoveHandler>;
    addListener: <DataT extends object | void, EntityIdT extends API.EntityId | undefined = undefined>(apiModule: string, event: string, callback: SubscriptionCallback<DataT, EntityIdT>, entityId?: API.EntityId) => Promise<SubscriptionRemoveHandler>;
    addViewUpdateListener: <DataT extends object | void, EntityIdT extends API.EntityId | undefined = undefined>(viewName: string, callback: SubscriptionCallback<DataT, EntityIdT>, entityId?: API.EntityId) => () => void;
    hasListeners: () => boolean;
    getPendingSubscriptionCount: () => number;
}
export type AddHook = SocketSubscriptions['addHook'];
export type AddListener = SocketSubscriptions['addListener'];
export type AddViewUpdateListener = SocketSubscriptions['addViewUpdateListener'];
