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
      MENU_ITEM3
    ]
  };
      

  describe('context menu items', () => {
    test('should add context menu items', async () => {
      // Socket handlers
      const { socket } = await getConnectedSocket(server);

      const itemSelectedListener = server.addSubscriptionHandler('menus', `${MENU_ID}_menuitem_selected`);

      const listItemsHook = server.addHookHandler('menus', `${MENU_ID}_list_menuitems`);
      const listItemsResolver = listItemsHook.addResolver(HOOK_COMPLETION_ID);

      // Add menu items
      const onClickItem1Mock = jest.fn();
      const onClickItem2Mock = jest.fn();
      const onGetUrlsItem3Mock = jest.fn();
      const onClickItemIgnoredMock = jest.fn();


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
              onClickItem1Mock(props);
            },
            formDefinitions: () => {
              return FORM_DEFINITIONS;
            },
          }, {
            ...MENU_ITEM2,
            onClick: (props) => {
              onClickItem2Mock(props);
            }
          }, {
            ...MENU_ITEM3,
            urls: (props) => {
              onGetUrlsItem3Mock(props);
              return URLS;
            }
          }, {
            id: 'ignored_filter_id',
            title: 'Mock item ignored by filter',
            filter: () => {
              return false;
            },
            onClick: (props) => {
              onClickItemIgnoredMock(props);
            }
          }, {
            id: 'ignored_access_id',
            title: 'Mock item ignored by access',
            access: 'invalid_access',
            onClick: (props) => {
              onClickItemIgnoredMock(props);
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
          expect(onGetUrlsItem3Mock).toHaveBeenCalledTimes(1);
        });

        const urlCallbackProps: MenuCallbackProperties<string, null> = {
          selectedIds: selectedMenuIds, 
          entityId: null, 
          permissions: PERMISSIONS, 
          supports: SUPPORTS
        }

        expect(onGetUrlsItem3Mock).toHaveBeenCalledWith(urlCallbackProps);
      }

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
          expect(onClickItem1Mock).toHaveBeenCalledTimes(1);
        });

        const clickHandlerProps: MenuClickHandlerProperties<string, null> = {
          selectedIds: selectedMenuIds, 
          entityId: null, 
          permissions: PERMISSIONS, 
          supports: SUPPORTS, 
          formValues: FORM_VALUES
        }

        expect(onClickItem1Mock).toHaveBeenCalledWith(clickHandlerProps);
        expect(onClickItem2Mock).not.toHaveBeenCalled();
        expect(onClickItemIgnoredMock).not.toHaveBeenCalled();
      }

      // Remove items
      await removeMenuItems();
      expect(socket.hasListeners()).toBe(false);
    });
  });
});