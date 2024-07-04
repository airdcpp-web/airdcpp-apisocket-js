import { HookSubscriberInfo } from './subscriptions.js';

export interface MenuCallbackProperties<IdT, EntityIdT> {
  selectedIds: IdT[], 
  entityId: EntityIdT | null, 
  permissions: string[], 
  supports: string[]
}

export interface MenuClickHandlerProperties<IdT, EntityIdT, FormValueT extends object = object> extends MenuCallbackProperties<IdT, EntityIdT> {
  formValues: FormValueT
}

type AsyncCallbackProperty<IdT, EntityIdT, ReturnT> = (props: MenuCallbackProperties<IdT, EntityIdT>) => ReturnT | Promise<ReturnT>;

export type ContextMenuIcon = { [key in string]: string };

export interface ContextMenu extends HookSubscriberInfo {
  icon?: ContextMenuIcon;
}
export interface ContextMenuItem<IdT, EntityIdT, FormValueT extends object = object> {
  id: string;
  title: string;
  icon?: ContextMenuIcon;
  urls?: string[] | AsyncCallbackProperty<IdT, EntityIdT, string[] | undefined>;
  onClick?: (props: MenuClickHandlerProperties<IdT, EntityIdT, FormValueT>) => void;
  filter?: AsyncCallbackProperty<IdT, EntityIdT, boolean>;
  access?: string;
  formDefinitions?: object[] | AsyncCallbackProperty<IdT, EntityIdT, object[]>;
}