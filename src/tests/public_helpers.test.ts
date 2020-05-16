import { 
  getMockServer,
  getConnectedSocket,
} from './helpers';

import waitForExpect from 'wait-for-expect';

import { addContextMenuItems } from '../PublicHelpers';
import { SelectedMenuItemListenerData, MenuItemListHookData, MenuItemListHookAcceptData } from 'types/public_helpers_internal';
import { HookSubscriberInfo } from 'types';
import { IncomingSubscriptionEvent } from 'types/api_internal';


let server: ReturnType<typeof getMockServer>;

// tslint:disable:no-empty
describe('public helpers', () => {

  beforeEach(() => {
    server = getMockServer();
  });

  afterEach(() => {
    server.stop();
  });

  describe('context menu items', () => {
    test('should add context menu items', async () => {
      // Data
      const MENU_ID = 'extensions';
      const MENU_ITEM_ID = 'mock_id_1';
      const SUBSCRIBER_INFO: HookSubscriberInfo = {
        id: 'mock-id',
        name: 'mock-hook'
      };
      const HOOK_COMPLETION_ID = 1;

      const selectedMenuIds = [
        MENU_ID,
        'random_id'
      ];

      const MENU_ITEM1 = {
        id: MENU_ITEM_ID,
        title: 'Mock item 1',
        icon: {
          semantic: 'mock_semantic_icon',
        },
      };

      const menuItemListData: MenuItemListHookAcceptData<string, null> = {
        menuitems: [
          MENU_ITEM1,
        ]
      };
      
      // Socket handlers
      const { socket } = await getConnectedSocket(server);

      const listenerAddCallback = jest.fn();
      server.addDataHandler('POST', `menus/listeners/${MENU_ID}_menuitem_selected`, undefined, listenerAddCallback);

      const hookAddCallback = jest.fn();
      const hookResolveCallback = jest.fn();
      server.addDataHandler('POST', `menus/hooks/${MENU_ID}_list_menuitems`, undefined, hookAddCallback);
      server.addDataHandler(
        'POST', 
        `menus/hooks/${MENU_ID}_list_menuitems/${HOOK_COMPLETION_ID}/resolve`, 
        menuItemListData, 
        hookResolveCallback
      );


      // Add menu items
      const onClickItem1Mock = jest.fn();
      const onClickItem2Mock = jest.fn();


      const removeMenuItems = await addContextMenuItems<string>(
        socket,
        [
          {
            ...MENU_ITEM1,
            filter: async (ids, entityId) => {
              return true;
            },
            onClick: (ids, entityId) => {
              onClickItem1Mock(ids, entityId);
            }
          }, {
            id: 'ignored_id',
            title: 'Mock item ignored',
            filter: (ids, entityId) => {
              return false;
            },
            onClick: (ids, entityId) => {
              onClickItem2Mock(ids, entityId);
            }
          }
        ],
        MENU_ID,
        SUBSCRIBER_INFO,
      );
      
      expect(listenerAddCallback).toBeCalledTimes(1);
      expect(hookAddCallback).toBeCalledTimes(1);


      // List items hook
      const hookEventData: IncomingSubscriptionEvent<MenuItemListHookData<string, null>> = {
        event: `${MENU_ID}_list_menuitems`,
        data: {
          selected_ids: selectedMenuIds,
          entity_id: null
        },
        completion_id: 1,
      };

      server.send(hookEventData);

      await waitForExpect(() => {
        expect(hookResolveCallback).toHaveBeenCalledTimes(1);
      });

      expect(hookResolveCallback).toBeCalledWith(
        expect.objectContaining({
          data: menuItemListData
        }),
      );


      // Select event listener
      const selectEventData: IncomingSubscriptionEvent<SelectedMenuItemListenerData<string, null>> = {
        event: `${MENU_ID}_menuitem_selected`,
        data: {
          menuitem_id: MENU_ITEM_ID,
          hook_id: SUBSCRIBER_INFO.id,
          menu_id: MENU_ID,
          entity_id: null,
          selected_ids: selectedMenuIds,
        },
        completion_id: HOOK_COMPLETION_ID,
      };

      server.send(selectEventData);
      expect(onClickItem1Mock).toHaveBeenCalledWith(selectedMenuIds, null);
      expect(onClickItem2Mock).not.toBeCalled();

      // Remove items
      removeMenuItems();
      expect(socket.hasListeners()).toBe(false);
    });
  });
});