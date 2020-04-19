import { HookSubscriberInfo, APISocket } from './types';
import { ContextMenuItem } from 'types/public_helpers';
import { SelectedMenuItemListenerData, MenuItemListHookData, MenuItemListHookAcceptData } from 'types/public_helpers_internal';


export const addContextMenuItems = async <IdT, EntityIdT = unknown>(
  socket: APISocket,
  menuItems: ContextMenuItem<IdT, EntityIdT>[], 
  menuId: string, 
  subscriberInfo: HookSubscriberInfo
) => {
  const removeListener = await socket.addListener<SelectedMenuItemListenerData<IdT, EntityIdT>>(
    'menus', 
    `${menuId}_menuitem_selected`, 
    data => {
      if (data.hook_id === subscriberInfo.id) {
        const menuItem = menuItems.find(i => data.menuitem_id === i.id);
        if (menuItem) {
          menuItem.onClick(data.selected_ids, data.entity_id);
        }
      }
    }
  );
  
  const removeHook = await socket.addHook<
    MenuItemListHookData<IdT, EntityIdT>, 
    MenuItemListHookAcceptData<IdT, EntityIdT> | undefined
  >(
    'menus', 
    `${menuId}_list_menuitems`, 
    async (data, accept, reject) => {
      const validItems = [];
      for (const item of menuItems) {
        if (!item.filter || (await item.filter(data.selected_ids, data.entity_id))) {
          const { onClick, filter, ...apiItem } = item;
          validItems.push(apiItem);
        }
      }

      accept({
        menuitems: validItems
      });
    }, 
    subscriberInfo
  );

  return () => {
    removeHook();
    removeListener();
  };
};