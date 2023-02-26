import { HookSubscriberInfo, APISocket, ContextMenuItem, EntityId } from './types/index.js';
export declare const addContextMenuItems: <IdT, EntityIdT extends EntityId | undefined = undefined>(socket: APISocket, menuItems: ContextMenuItem<IdT, EntityIdT>[], menuId: string, subscriberInfo: HookSubscriberInfo) => Promise<() => void>;
