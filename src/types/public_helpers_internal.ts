import { ContextMenuIcon, ContextMenuItem } from './public_helpers.js';


export interface SelectedMenuItemListenerData<IdT, EntityIdT> {
  hook_id: string;
  menu_id: string;
  menuitem_id: string;
  selected_ids: IdT[];
  entity_id: EntityIdT;
  permissions: string[];
  supports: string[];
  form_values: object;
}

export interface MenuItemListHookData<IdT, EntityIdT> {
  selected_ids: IdT[];
  entity_id: EntityIdT;
  permissions: string[];
  supports: string[];
}

export interface ResponseMenuItemCallbackFields {
  urls?: string[];
  form_definitions?: object[];
}

export type ResponseMenuItem<IdT, EntityIdT> = Omit<ContextMenuItem<IdT, EntityIdT>, 'onClick' | 'filter' | 'urls' | 'form_definitions'> & ResponseMenuItemCallbackFields;

export interface MenuItemListHookAcceptData<IdT, EntityIdT> {
  menuitems: ResponseMenuItem<IdT, EntityIdT>[];
  icon?: ContextMenuIcon;
  title?: string;
}
