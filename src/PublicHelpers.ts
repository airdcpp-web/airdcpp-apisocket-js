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

  if (!!menuItem.filter && !(await menuItem.filter({
    selectedIds: selected_ids, 
    entityId: entity_id, 
    permissions, 
    supports
  }))) {
    return false;
  }

  return checkAccess(menuItem, data.permissions);
};

const parseCallbackData = async <IdT, EntityIdT extends EntityId | undefined = undefined>(
  item: ContextMenuItem<IdT, EntityIdT>,
  data: MenuItemListHookData<IdT, EntityIdT>
): Promise<ResponseMenuItemCallbackFields> => {
  const { selected_ids, entity_id, permissions, supports } = data;
  const callbackProps = {
    selectedIds: selected_ids, 
    entityId: entity_id, 
    permissions, 
    supports
  }

  if (!!item.urls && !!item.urls.length) {
    let urls: string[] | undefined;
    if (typeof item.urls === 'function') {
      urls = await item.urls(callbackProps);
    } else {
      urls = item.urls;
    }

    return {
      urls,
    };
  } else if (!!item.formDefinitions && hasSupport(FORM_SUPPORT, supports)) {
    let formDefinitions: object[] | undefined;
    if (typeof item.formDefinitions === 'function') {
      formDefinitions = await item.formDefinitions(callbackProps);
    } else {
      formDefinitions = item.formDefinitions;
    }

    return {
      form_definitions: formDefinitions,
    };
  }

  return {};
};

const findMenuItemById = <IdT, EntityIdT extends EntityId | undefined = undefined>(
  id: string,
  menuItems: ContextMenuItem<IdT, EntityIdT>[]
): ContextMenuItem<IdT, EntityIdT> | undefined => {
  for (const item of menuItems) {
    if (item.id === id) {
      return item;
    }

    if (item.children) {
      const found = findMenuItemById(id, item.children);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
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
        const menuItem = findMenuItemById(data.menuitem_id, menuItems);
        if (!!menuItem) {
          const isValid = await validateItem(menuItem, data);
          if (isValid && !!menuItem.onClick) {
            const { selected_ids, entity_id, permissions, supports, form_values } = data;
            menuItem.onClick({
              selectedIds: selected_ids, 
              entityId: entity_id, 
              permissions, 
              supports, 
              formValues: form_values
            });
          }
        }
      }
    }
  );

  type ParsedItem = Omit<ContextMenuItem<IdT, EntityIdT>, 'onClick' | 'filter' | 'urls' | 'formDefinitions' | 'children'> &
    { urls?: string[]; form_definitions?: object[]; children?: ParsedItem[] };

  const parseMenuItem = async (item: ContextMenuItem<IdT, EntityIdT>, data: MenuItemListHookData<IdT, EntityIdT>) => {
    const isValid = await validateItem(item, data);
    if (isValid) {
      const parsedCallbackData = await parseCallbackData(item, data);

      const { onClick, id, title, icon, children } = item;

      const isValid = !!onClick || (!!parsedCallbackData.urls && parsedCallbackData.urls.length) || !!children;
      if (isValid) {
        const validChildren: ParsedItem[] = [];
        if (children) {
          for (const child of children) {
            const validChild = await parseMenuItem(child, data);
            if (validChild) {
              validChildren.push(validChild);
            }
          }
        }

        const validItem: ParsedItem = {
          id, 
          title, 
          icon,
          ...parsedCallbackData,
        };

        if (validChildren.length > 0) {
          validItem.children = validChildren;
        }

        return validItem;
      } else {
        socket.logger.warn(`Context menu item ${id} does not have a valid action, children or URLs, skipping`, item);
      }
    }

    return null;
  }
  
  const removeHook = await socket.addHook<
    MenuItemListHookData<IdT, EntityIdT>, 
    MenuItemListHookAcceptData<IdT, EntityIdT> | undefined
  >(
    'menus', 
    `${menuTypeId}_list_menuitems`, 
    async (data, accept, reject) => {
      const validItems = [];
      for (const item of menuItems) {
        const validItem = await parseMenuItem(item, data);
        if (validItem) {
          validItems.push(validItem);
        }
      }

      accept({
        menuitems: validItems,
        icon: menu.icon,
      });
    }, 
    menu
  );

  return async () => {
    await removeHook();
    await removeListener();
  };
};