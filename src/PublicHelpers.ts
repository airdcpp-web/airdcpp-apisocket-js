import { HookSubscriberInfo, APISocket, ContextMenuItem } from './types';
import { SelectedMenuItemListenerData, MenuItemListHookData, MenuItemListHookAcceptData } from './types/public_helpers_internal';


const checkAccess = <IdT, EntityIdT>(menuItem: ContextMenuItem<IdT, EntityIdT>, permissions: string[]): boolean => {
  if (!menuItem.access) {
    return true;
  }

  return permissions.indexOf('admin') !== -1 || permissions.indexOf(menuItem.access) !== -1;
};

// Check whether the item passes the access and filter checks
const validateItem = async <IdT, EntityIdT>(
  menuItem: ContextMenuItem<IdT, EntityIdT>, 
  data: MenuItemListHookData<IdT, EntityIdT>
): Promise<boolean> => {
  if (!!menuItem.filter && !(await menuItem.filter(data.selected_ids, data.entity_id, data.permissions))) {
    return false;
  }

  return checkAccess(menuItem, data.permissions);
};

export const addContextMenuItems = async <IdT, EntityIdT = unknown>(
  socket: APISocket,
  menuItems: ContextMenuItem<IdT, EntityIdT>[], 
  menuId: string, 
  subscriberInfo: HookSubscriberInfo
) => {
  const removeListener = await socket.addListener<SelectedMenuItemListenerData<IdT, EntityIdT>>(
    'menus', 
    `${menuId}_menuitem_selected`, 
    async (data) => {
      if (data.hook_id === subscriberInfo.id) {
        const menuItem = menuItems.find(i => data.menuitem_id === i.id);
        if (!!menuItem) {
          const isValid = await validateItem(menuItem, data);
          if (isValid) {
            menuItem.onClick(data.selected_ids, data.entity_id, data.permissions);
          }
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
        const isValid = await validateItem(item, data);
        if (isValid) {
          const { onClick, filter, access, ...apiItem } = item;
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