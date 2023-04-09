import { HookSubscriberInfo } from './subscriptions.js';

type AsyncCallbackProperty<IdT, EntityIdT, ReturnT> = (
  selectedIds: IdT[], 
  entityId: EntityIdT | null, 
  permissions: string[], 
  supports: string[]
) => ReturnT | Promise<ReturnT>;

export type ContextMenuIcon = { [key in string]: string };

export interface ContextMenu extends HookSubscriberInfo {
  icon?: ContextMenuIcon;
}
export interface ContextMenuItem<IdT, EntityIdT> {
  id: string;
  title: string;
  icon?: ContextMenuIcon;
  urls?: string[] | AsyncCallbackProperty<IdT, EntityIdT, string[] | undefined>;
  onClick?: (
    selectedIds: IdT[], 
    entityId: EntityIdT | null, 
    permissions: string[], 
    supports: string[],
    formValues: object
  ) => void;
  filter?: AsyncCallbackProperty<IdT, EntityIdT, boolean>;
  access?: string;
  formDefinitions?: object[] | AsyncCallbackProperty<IdT, EntityIdT, object[]>;
}