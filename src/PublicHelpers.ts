import { HookSubscriberInfo, APISocket, ContextMenuItem, EntityId } from './types';
import { SelectedMenuItemListenerData, MenuItemListHookData, MenuItemListHookAcceptData } from './types/public_helpers_internal';


const checkAccess = <IdT, EntityIdT>(menuItem: ContextMenuItem<IdT, EntityIdT>, permissions: string[]): boolean => {
  if (!menuItem.access) {
    return true;
  }

  return permissions.indexOf('admin') !== -1 || permissions.indexOf(menuItem.access) !== -1;
};

const URLS_SUPPORT = 'urls';

// Check whether the item passes the access and filter checks
const validateItem = async <IdT, EntityIdT>(
  menuItem: ContextMenuItem<IdT, EntityIdT>, 
  data: MenuItemListHookData<IdT, EntityIdT>
): Promise<boolean> => {
  const { selected_ids, entity_id, permissions, supports } = data;
  if (!!menuItem.urls && (!supports || supports.indexOf(URLS_SUPPORT) === -1)) {
    return false;
  }

  if (!!menuItem.filter && !(await menuItem.filter(selected_ids, entity_id, permissions, supports))) {
    return false;
  }

  return checkAccess(menuItem, data.permissions);
};

export const addContextMenuItems = async <IdT, EntityIdT extends EntityId | undefined = undefined>(
  socket: APISocket,
  menuItems: ContextMenuItem<IdT, EntityIdT>[], 
  menuId: string, 
  subscriberInfo: HookSubscriberInfo
) => {
  const removeListener = await socket.addListener<SelectedMenuItemListenerData<IdT, EntityIdT>, EntityIdT>(
    'menus', 
    `${menuId}_menuitem_selected`, 
    async (data) => {
      if (data.hook_id === subscriberInfo.id) {
        const menuItem = menuItems.find(i => data.menuitem_id === i.id);
        if (!!menuItem) {
          const isValid = await validateItem(menuItem, data);
          if (isValid && !!menuItem.onClick) {
            const { selected_ids, entity_id, permissions, supports } = data;
            menuItem.onClick(selected_ids, entity_id, permissions, supports);
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
          const { selected_ids, entity_id, permissions, supports } = data;
          const urls = !item.urls ? undefined : await item.urls(selected_ids, entity_id, permissions, supports);
          const { onClick, filter, access, ...apiItem } = item;
          validItems.push({
            ...apiItem,
            urls,
          });
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