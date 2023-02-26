var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const checkAccess = (menuItem, permissions) => {
    if (!menuItem.access) {
        return true;
    }
    return permissions.indexOf('admin') !== -1 || permissions.indexOf(menuItem.access) !== -1;
};
const URLS_SUPPORT = 'urls';
const FORM_SUPPORT = 'form';
const hasSupport = (support, supports) => {
    return !!supports && supports.indexOf(support) !== -1;
};
// Check whether the item passes the access and filter checks
const validateItem = (menuItem, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { selected_ids, entity_id, permissions, supports } = data;
    if (!!menuItem.urls && !hasSupport(URLS_SUPPORT, supports)) {
        return false;
    }
    if (!!menuItem.filter && !(yield menuItem.filter(selected_ids, entity_id, permissions, supports))) {
        return false;
    }
    return checkAccess(menuItem, data.permissions);
});
const parseCallbackData = (item, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { selected_ids, entity_id, permissions, supports } = data;
    if (!!item.urls && !!item.urls.length) {
        let urls;
        if (typeof item.urls === 'function') {
            urls = yield item.urls(selected_ids, entity_id, permissions, supports);
        }
        else {
            urls = item.urls;
        }
        return {
            urls,
        };
    }
    else if (!!item.formDefinitions && hasSupport(FORM_SUPPORT, supports)) {
        let formDefinitions;
        if (typeof item.formDefinitions === 'function') {
            formDefinitions = yield item.formDefinitions(selected_ids, entity_id, permissions, supports);
        }
        else {
            formDefinitions = item.formDefinitions;
        }
        return {
            form_definitions: formDefinitions,
        };
    }
    return {};
});
export const addContextMenuItems = (socket, menuItems, menuId, subscriberInfo) => __awaiter(void 0, void 0, void 0, function* () {
    const removeListener = yield socket.addListener('menus', `${menuId}_menuitem_selected`, (data) => __awaiter(void 0, void 0, void 0, function* () {
        if (data.hook_id === subscriberInfo.id) {
            const menuItem = menuItems.find(i => data.menuitem_id === i.id);
            if (!!menuItem) {
                const isValid = yield validateItem(menuItem, data);
                if (isValid && !!menuItem.onClick) {
                    const { selected_ids, entity_id, permissions, supports, form_values } = data;
                    menuItem.onClick(selected_ids, entity_id, permissions, supports, form_values);
                }
            }
        }
    }));
    const removeHook = yield socket.addHook('menus', `${menuId}_list_menuitems`, (data, accept, reject) => __awaiter(void 0, void 0, void 0, function* () {
        const validItems = [];
        for (const item of menuItems) {
            const isValid = yield validateItem(item, data);
            if (isValid) {
                const parsedCallbackData = yield parseCallbackData(item, data);
                const { onClick, id, title, icon } = item;
                if (!!onClick || (!!parsedCallbackData.urls && parsedCallbackData.urls.length)) {
                    validItems.push(Object.assign({ id,
                        title,
                        icon }, parsedCallbackData));
                }
            }
        }
        accept({
            menuitems: validItems
        });
    }), subscriberInfo);
    return () => {
        removeHook();
        removeListener();
    };
});
//# sourceMappingURL=PublicHelpers.js.map