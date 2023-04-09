import { APISocket, ContextMenuItem, EntityId, ContextMenu } from './types/index.js';
import { 
  SelectedMenuItemListenerData, MenuItemListHookData, 
  MenuItemListHookAcceptData, ResponseMenuItemCallbackFields 
} from './types/public_helpers_internal.js';


const checkAccess = <IdT, EntityIdT>(menuItem: ContextMenuItem<IdT, EntityIdT>, permissions: string[]): boolean => {
  if (!menuItem.access) {
    return true;
  }

  return permissions.indexOf('admin') !== -1 || permissions.indexOf(menuItem.access) !== -1;
};

const URLS_SUPPORT = 'urls';
const FORM_SUPPORT = 'form';

const hasSupport = (support: string, supports: string[]) => {
  return !!supports && supports.indexOf(support) !== -1;
};

// Check whether the item passes the access and filter checks
const validateItem = async <IdT, EntityIdT>(
  menuItem: ContextMenuItem<IdT, EntityIdT>, 
  data: MenuItemListHookData<IdT, EntityIdT>
): Promise<boolean> => {
  const { selected_ids, entity_id, permissions, supports } = data;
  if (!!menuItem.urls && !hasSupport(URLS_SUPPORT, supports)) {
    return false;
  }

  if (!!menuItem.filter && !(await menuItem.filter(selected_ids, entity_id, permissions, supports))) {
    return false;
  }

  return checkAccess(menuItem, data.permissions);
};

const parseCallbackData = async <IdT, EntityIdT extends EntityId | undefined = undefined>(
  item: ContextMenuItem<IdT, EntityIdT>,
  data: MenuItemListHookData<IdT, EntityIdT>
): Promise<ResponseMenuItemCallbackFields> => {
  const { selected_ids, entity_id, permissions, supports } = data;
  if (!!item.urls && !!item.urls.length) {
    let urls: string[] | undefined;
    if (typeof item.urls === 'function') {
      urls = await item.urls(selected_ids, entity_id, permissions, supports);
    } else {
      urls = item.urls;
    }

    return {
      urls,
    };
  } else if (!!item.formDefinitions && hasSupport(FORM_SUPPORT, supports)) {
    let formDefinitions: object[] | undefined;
    if (typeof item.formDefinitions === 'function') {
      formDefinitions = await item.formDefinitions(selected_ids, entity_id, permissions, supports);
    } else {
      formDefinitions = item.formDefinitions;
    }

    return {
      form_definitions: formDefinitions,
    };
  }

  return {};
};

export const addContextMenuItems = async <IdT, EntityIdT extends EntityId | undefined = undefined>(
  socket: APISocket,
  menuItems: ContextMenuItem<IdT, EntityIdT>[],
  menuTypeId: string,
  menu: ContextMenu
) => {
  const removeListener = await socket.addListener<SelectedMenuItemListenerData<IdT, EntityIdT>, EntityIdT>(
    'menus', 
    `${menuTypeId}_menuitem_selected`, 
    async (data) => {
      if (data.hook_id === menu.id) {
        const menuItem = menuItems.find(i => data.menuitem_id === i.id);
        if (!!menuItem) {
          const isValid = await validateItem(menuItem, data);
          if (isValid && !!menuItem.onClick) {
            const { selected_ids, entity_id, permissions, supports, form_values } = data;
            menuItem.onClick(selected_ids, entity_id, permissions, supports, form_values);
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
    `${menuTypeId}_list_menuitems`, 
    async (data, accept, reject) => {
      const validItems = [];
      for (const item of menuItems) {
        const isValid = await validateItem(item, data);
        if (isValid) {
          const parsedCallbackData = await parseCallbackData(item, data);

          const { onClick, id, title, icon } = item;
          if (!!onClick || (!!parsedCallbackData.urls && parsedCallbackData.urls.length)) {
            validItems.push({
              id, 
              title, 
              icon,
              ...parsedCallbackData,
            });
          }
        }
      }

      accept({
        menuitems: validItems,
        icon: menu.icon,
      });
    }, 
    menu
  );

  return () => {
    removeHook();
    removeListener();
  };
};