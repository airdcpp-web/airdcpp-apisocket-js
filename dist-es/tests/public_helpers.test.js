var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { getMockServer, getConnectedSocket, } from './helpers.js';
import waitForExpect from 'wait-for-expect';
import { jest } from '@jest/globals';
import { addContextMenuItems } from '../PublicHelpers.js';
let server;
// tslint:disable:no-empty
describe('public helpers', () => {
    beforeEach(() => {
        server = getMockServer();
    });
    afterEach(() => {
        server.stop();
    });
    // Data
    const MENU_ID = 'extensions';
    const MENU_ITEM1_ID = 'mock_id_1';
    const MENU_ITEM2_ID = 'mock_id_2';
    const MENU_ITEM3_ID = 'mock_id_3';
    const SUBSCRIBER_INFO = {
        id: 'mock-id',
        name: 'mock-hook'
    };
    const HOOK_COMPLETION_ID = 1;
    const URLS = ['mock_url1', 'mock_url2'];
    const FORM_DEFINITIONS = [
        {
            dummyDefinition1: 'dummy',
        }
    ];
    const selectedMenuIds = [
        MENU_ID,
        'random_id'
    ];
    const MENU_ITEM1 = {
        id: MENU_ITEM1_ID,
        title: 'Mock item 1',
        icon: {
            semantic: 'mock_semantic_icon1',
        },
        form_definitions: FORM_DEFINITIONS,
    };
    const MENU_ITEM2 = {
        id: MENU_ITEM2_ID,
        title: 'Mock item 2',
        icon: {
            semantic: 'mock_semantic_icon2',
        },
    };
    const MENU_ITEM3 = {
        id: MENU_ITEM3_ID,
        title: 'Mock item 3',
        icon: {
            semantic: 'mock_semantic_icon3',
        },
        urls: URLS,
    };
    const VALID_ACCESS = 'valid_access';
    const PERMISSIONS = [VALID_ACCESS];
    const SUPPORTS = ['urls', 'form'];
    const FORM_VALUES = {
        formValue1: true,
    };
    const menuItemListData = {
        menuitems: [
            MENU_ITEM1,
            MENU_ITEM2,
            MENU_ITEM3
        ]
    };
    describe('context menu items', () => {
        test('should add context menu items', () => __awaiter(void 0, void 0, void 0, function* () {
            // Socket handlers
            const { socket } = yield getConnectedSocket(server);
            const listenerAddCallback = jest.fn();
            server.addDataHandler('POST', `menus/listeners/${MENU_ID}_menuitem_selected`, undefined, listenerAddCallback);
            const hookAddCallback = jest.fn();
            const hookResolveCallback = jest.fn();
            server.addDataHandler('POST', `menus/hooks/${MENU_ID}_list_menuitems`, undefined, hookAddCallback);
            server.addDataHandler('POST', `menus/hooks/${MENU_ID}_list_menuitems/${HOOK_COMPLETION_ID}/resolve`, menuItemListData, hookResolveCallback);
            // Add menu items
            const onClickItem1Mock = jest.fn();
            const onClickItem2Mock = jest.fn();
            const onGetUrlsItem3Mock = jest.fn();
            const onClickItemIgnoredMock = jest.fn();
            const removeMenuItems = yield addContextMenuItems(socket, [
                Object.assign(Object.assign({}, MENU_ITEM1), { filter: (ids, entityId) => __awaiter(void 0, void 0, void 0, function* () {
                        return true;
                    }), access: VALID_ACCESS, onClick: (ids, entityId, permissions, supports, formValues) => {
                        onClickItem1Mock(ids, entityId, permissions, supports, formValues);
                    }, formDefinitions: (ids, entityId, permissions, supports) => {
                        return FORM_DEFINITIONS;
                    } }),
                Object.assign(Object.assign({}, MENU_ITEM2), { onClick: (ids, entityId) => {
                        onClickItem2Mock(ids, entityId);
                    } }),
                Object.assign(Object.assign({}, MENU_ITEM3), { urls: (ids, entityId, permissions, supports) => {
                        onGetUrlsItem3Mock(ids, entityId, permissions, supports);
                        return URLS;
                    } }),
                {
                    id: 'ignored_filter_id',
                    title: 'Mock item ignored by filter',
                    filter: (ids, entityId, permissions, supports) => {
                        return false;
                    },
                    onClick: (ids, entityId, permissions, supports, formValues) => {
                        onClickItemIgnoredMock(ids, entityId, permissions, supports, formValues);
                    }
                }, {
                    id: 'ignored_access_id',
                    title: 'Mock item ignored by access',
                    access: 'invalid_access',
                    onClick: (ids, entityId, permissions, supports, formValues) => {
                        onClickItemIgnoredMock(ids, entityId, permissions, supports, formValues);
                    }
                }
            ], MENU_ID, SUBSCRIBER_INFO);
            expect(listenerAddCallback).toBeCalledTimes(1);
            expect(hookAddCallback).toBeCalledTimes(1);
            // List items hook
            {
                const hookEventData = {
                    event: `${MENU_ID}_list_menuitems`,
                    data: {
                        selected_ids: selectedMenuIds,
                        entity_id: null,
                        permissions: PERMISSIONS,
                        supports: SUPPORTS,
                    },
                    completion_id: 1,
                };
                server.send(hookEventData);
            }
            // Validate list items results
            {
                yield waitForExpect.default(() => {
                    expect(hookResolveCallback).toHaveBeenCalledTimes(1);
                });
                expect(hookResolveCallback).toBeCalledWith(expect.objectContaining({
                    data: menuItemListData
                }));
                yield waitForExpect.default(() => {
                    expect(onGetUrlsItem3Mock).toHaveBeenCalledTimes(1);
                });
                expect(onGetUrlsItem3Mock).toHaveBeenCalledWith(selectedMenuIds, null, PERMISSIONS, SUPPORTS);
            }
            // Select event listener
            {
                const selectEventData = {
                    event: `${MENU_ID}_menuitem_selected`,
                    data: {
                        menuitem_id: MENU_ITEM1_ID,
                        hook_id: SUBSCRIBER_INFO.id,
                        menu_id: MENU_ID,
                        entity_id: null,
                        selected_ids: selectedMenuIds,
                        permissions: PERMISSIONS,
                        supports: SUPPORTS,
                        form_values: FORM_VALUES
                    },
                    completion_id: HOOK_COMPLETION_ID,
                };
                server.send(selectEventData);
            }
            // Validate select event results
            {
                yield waitForExpect.default(() => {
                    expect(onClickItem1Mock).toHaveBeenCalledTimes(1);
                });
                expect(onClickItem1Mock).toHaveBeenCalledWith(selectedMenuIds, null, PERMISSIONS, SUPPORTS, FORM_VALUES);
                expect(onClickItem2Mock).not.toBeCalled();
                expect(onClickItemIgnoredMock).not.toBeCalled();
            }
            // Remove items
            removeMenuItems();
            expect(socket.hasListeners()).toBe(false);
        }));
    });
});
//# sourceMappingURL=public_helpers.test.js.map