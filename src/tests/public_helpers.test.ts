import { 
  getMockServer,
  getConnectedSocket,
} from './mocks';
import { waitForExpect } from './test-utils.js';

import { jest } from '@jest/globals';

import { addContextMenuItems } from '../PublicHelpers.js';
import { SelectedMenuItemListenerData, MenuItemListHookData, MenuItemListHookAcceptData } from '../types/public_helpers_internal.js';
import { HookSubscriberInfo, MenuCallbackProperties, MenuClickHandlerProperties } from '../types/index.js';


let server: ReturnType<typeof getMockServer>;

// tslint:disable:no-empty
describe('public helpers', () => {

  beforeEach(() => {
    server = getMockServer({
      mockF: jest,
    });
  });

  afterEach(() => {
    server.stop();
  });


  // Data
  const MENU_ID = 'extensions';
  const MENU_ITEM1_ID = 'mock_id_1';
  const MENU_ITEM2_ID = 'mock_id_2';
  const MENU_ITEM3_ID = 'mock_id_3';

  const MENU_ITEM4_LEVEL1_ID = 'mock_id_4_level1';
  const MENU_ITEM4_LEVEL2_ID = 'mock_id_4_level2';
  const MENU_ITEM4_LEVEL2_DUMMY_ID = 'mock_id_4_level2_dummy';
  const MENU_ITEM4_LEVEL3_ID = 'mock_id_4_level3';

  const SUBSCRIBER_INFO: HookSubscriberInfo = {
    id: 'mock-id',
    name: 'mock-hook'
  };
  const HOOK_COMPLETION_ID = 1;

  const URLS = [ 'mock_url1', 'mock_url2' ];
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

  const MENU_ITEM4_LEVEL2 = {
    id: MENU_ITEM4_LEVEL2_ID,
    title: 'Mock item 4 level 2',
    icon: {
      semantic: 'mock_semantic_icon_child1',
    },
  }
  
  const MENU_ITEM4_LEVEL2_DUMMY = {
    id: MENU_ITEM4_LEVEL2_DUMMY_ID,
    title: 'Mock item 4 level 2 dummy',
    icon: {
      semantic: 'mock_semantic_icon_child2',
    },
  }

  const MENU_ITEM4_LEVEL3 = {
    id: MENU_ITEM4_LEVEL3_ID,
    title: 'Mock item 4 level 3',
    icon: {
      semantic: 'mock_semantic_icon_child1_1',
    },
  };

  const MENU_ITEM4 = {
    id: MENU_ITEM4_LEVEL1_ID,
    title: 'Mock item 4 level 1',
    icon: {
      semantic: 'mock_semantic_icon4',
    },
    children: [
      {
        ...MENU_ITEM4_LEVEL2,
        children: [
          MENU_ITEM4_LEVEL3,
        ]
      },
      MENU_ITEM4_LEVEL2_DUMMY,
    ]
  };


  const VALID_ACCESS = 'valid_access';

  const PERMISSIONS = [ VALID_ACCESS ];
  const SUPPORTS = [ 'urls', 'form' ];
  const FORM_VALUES = {
    formValue1: true,
  };

  const menuItemListData: MenuItemListHookAcceptData<string, null> = {
    menuitems: [
      MENU_ITEM1,
      MENU_ITEM2,
      MENU_ITEM3,
      MENU_ITEM4
    ]
  };
      

  describe('context menu items', () => {

    const openMenu = async () => {
      // Socket handlers
      const { socket } = await getConnectedSocket(server);

      const itemSelectedListener = server.addSubscriptionHandler('menus', `${MENU_ID}_menuitem_selected`);

      const listItemsHook = server.addHookHandler('menus', `${MENU_ID}_list_menuitems`);
      const listItemsResolver = listItemsHook.addResolver(HOOK_COMPLETION_ID);

      // Add menu items
      const mockClickHandlers = {
        onClickItem1: jest.fn(),
        onClickItem2: jest.fn(),
        onGetUrlsItem3: jest.fn(),
        onClickItemIgnored: jest.fn(),
        onClickLevel3: jest.fn(),
        onClickLevel2Dummy: jest.fn(),
      };


      const removeMenuItems = await addContextMenuItems<string>(
        socket,
        [
          {
            ...MENU_ITEM1,
            filter: async () => {
              return true;
            },
            access: VALID_ACCESS,
            onClick: (props) => {
              mockClickHandlers.onClickItem1(props);
            },
            formDefinitions: () => {
              return FORM_DEFINITIONS;
            },
          }, {
            ...MENU_ITEM2,
            onClick: (props) => {
              mockClickHandlers.onClickItem2(props);
            }
          }, {
            ...MENU_ITEM3,
            urls: (props) => {
              mockClickHandlers.onGetUrlsItem3(props);
              return URLS;
            }
          }, 
          {
            ...MENU_ITEM4,
            children: [
              {
                ...MENU_ITEM4_LEVEL2,
                children: [
                  {
                    ...MENU_ITEM4_LEVEL3,
                    onClick: (props) => {
                      mockClickHandlers.onClickLevel3(props);
                    }
                  }
                ]
              }, {
                ...MENU_ITEM4_LEVEL2_DUMMY,
                onClick: (props) => {
                  mockClickHandlers.onClickLevel2Dummy(props);
                }
              }
            ]
          },
          {
            id: 'ignored_filter_id',
            title: 'Mock item ignored by filter',
            filter: () => {
              return false;
            },
            onClick: (props) => {
              mockClickHandlers.onClickItemIgnored(props);
            }
          }, {
            id: 'ignored_access_id',
            title: 'Mock item ignored by access',
            access: 'invalid_access',
            onClick: (props) => {
              mockClickHandlers.onClickItemIgnored(props);
            }
          }
        ],
        MENU_ID,
        SUBSCRIBER_INFO,
      );
      
      expect(itemSelectedListener.subscribeFn).toHaveBeenCalledTimes(1);
      expect(listItemsHook.subscribeFn).toHaveBeenCalledTimes(1);


      // List items hook
      {
        const menuItemListData: MenuItemListHookData<string, null> = {
          selected_ids: selectedMenuIds,
          entity_id: null,
          permissions: PERMISSIONS,
          supports: SUPPORTS,
        };

        listItemsResolver.fire(menuItemListData);
      }

      // Validate list items results
      {
        await waitForExpect(() => {
          expect(listItemsResolver.resolveFn).toHaveBeenCalledTimes(1);
        });

        expect(listItemsResolver.resolveFn).toHaveBeenCalledWith(
          expect.objectContaining({
            data: menuItemListData
          }),
        );

        await waitForExpect(() => {
          expect(mockClickHandlers.onGetUrlsItem3).toHaveBeenCalledTimes(1);
        });

        const urlCallbackProps: MenuCallbackProperties<string, null> = {
          selectedIds: selectedMenuIds, 
          entityId: null, 
          permissions: PERMISSIONS, 
          supports: SUPPORTS
        }

        expect(mockClickHandlers.onGetUrlsItem3).toHaveBeenCalledWith(urlCallbackProps);
      }

      return {
        mockClickHandlers,
        itemSelectedListener,
        listItemsHook,
        listItemsResolver,

        socket,
        removeMenuItems,
      }
    };

    test('should add context menu items', async () => {
      const { mockClickHandlers, itemSelectedListener, removeMenuItems, socket } = await openMenu();

      const { onClickItem1, onClickItem2, onClickItemIgnored } = mockClickHandlers;

      // Select event listener
      {
        const selectData: SelectedMenuItemListenerData<string, null> = {
          menuitem_id: MENU_ITEM1_ID,
          hook_id: SUBSCRIBER_INFO.id,
          menu_id: MENU_ID,
          entity_id: null,
          selected_ids: selectedMenuIds,
          permissions: PERMISSIONS,
          supports: SUPPORTS,
          form_values: FORM_VALUES
        };

        itemSelectedListener.fire(selectData);
      }

      // Validate select event results
      {
        await waitForExpect(() => {
          expect(onClickItem1).toHaveBeenCalledTimes(1);
        });

        const clickHandlerProps: MenuClickHandlerProperties<string, null> = {
          selectedIds: selectedMenuIds, 
          entityId: null, 
          permissions: PERMISSIONS, 
          supports: SUPPORTS, 
          formValues: FORM_VALUES
        }

        expect(onClickItem1).toHaveBeenCalledWith(clickHandlerProps);
        expect(onClickItem2).not.toHaveBeenCalled();
        expect(onClickItemIgnored).not.toHaveBeenCalled();
      }

      // Remove items
      await removeMenuItems();
      expect(socket.hasListeners()).toBe(false);
    });


    test('should handle nested menu items', async () => {
      const { mockClickHandlers, itemSelectedListener, removeMenuItems, socket } = await openMenu();

      const { onClickLevel3 } = mockClickHandlers;

      // Select event listener
      {
        const selectData: SelectedMenuItemListenerData<string, number> = {
          menuitem_id: MENU_ITEM4_LEVEL3_ID,
          hook_id: SUBSCRIBER_INFO.id,
          menu_id: MENU_ID,
          entity_id: 5,
          selected_ids: selectedMenuIds,
          permissions: PERMISSIONS,
          supports: SUPPORTS,
          form_values: {},
        };

        itemSelectedListener.fire(selectData);
      }

      // Validate select event results
      {
        await waitForExpect(() => {
          expect(onClickLevel3).toHaveBeenCalledTimes(1);
        });

        const clickHandlerProps: MenuClickHandlerProperties<string, number> = {
          selectedIds: selectedMenuIds, 
          entityId: 5, 
          permissions: PERMISSIONS, 
          supports: SUPPORTS, 
          formValues: {}
        }

        expect(onClickLevel3).toHaveBeenCalledWith(clickHandlerProps);
      }

      // Remove items
      await removeMenuItems();
      expect(socket.hasListeners()).toBe(false);
    });
  });
});