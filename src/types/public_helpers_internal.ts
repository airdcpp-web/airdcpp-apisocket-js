import { ContextMenuItem } from './public_helpers';


export interface SelectedMenuItemListenerData<IdT, EntityIdT> {
  hook_id: string;
  menu_id: string;
  menuitem_id: string;
  selected_ids: IdT[];
  entity_id: EntityIdT | null;
}

export interface MenuItemListHookData<IdT, EntityIdT> {
  selected_ids: IdT[];
  entity_id: EntityIdT | null;
}

export interface MenuItemListHookAcceptData<IdT, EntityIdT> {
  menuitems: Omit<ContextMenuItem<IdT, EntityIdT>, 'onClick' | 'filter'>[];
}
