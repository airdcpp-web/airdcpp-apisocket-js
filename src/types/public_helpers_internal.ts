import { ContextMenuItem } from './public_helpers';


export interface SelectedMenuItemListenerData<IdT, EntityIdT> {
  hook_id: string;
  menu_id: string;
  menuitem_id: string;
  selected_ids: IdT[];
  entity_id: EntityIdT | null;
  permissions: string[];
  supports: string[];
}

export interface MenuItemListHookData<IdT, EntityIdT> {
  selected_ids: IdT[];
  entity_id: EntityIdT | null;
  permissions: string[];
  supports: string[];
}

export type ResponseMenuItem<IdT, EntityIdT> = Omit<ContextMenuItem<IdT, EntityIdT>, 'onClick' | 'filter' | 'urls'> & {
  urls?: string[] | undefined;
};

export interface MenuItemListHookAcceptData<IdT, EntityIdT> {
  menuitems: ResponseMenuItem<IdT, EntityIdT>[];
}
