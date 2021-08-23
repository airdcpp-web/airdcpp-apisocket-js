
- [Constructor](#constructor)
- [Settings](#settings)
- [Connect state methods](#connect-state-methods)
  - [connect](#connect)
  - [disconnect](#disconnect)
  - [reconnect](#reconnect)
  - [isConnecting](#isconnecting)
  - [isConnected](#isconnected)
  - [logout](#logout)
- [Connect state events](#connect-state-events)
  - [onSocketConnected](#onsocketconnected)
  - [onSocketDisconnected](#onsocketdisconnected)
  - [onSessionReset](#onsessionreset)
- [Logger](#logger)
- [API requests](#api-requests)
- [Event listeners](#event-listeners)
  - [addListener](#addlistener)
- [Action hooks](#action-hooks)
  - [addHook](#addhook)
- [Helpers](#helpers)
  - [addContextMenuItems](#addContextMenuItems)


## Constructor

```
Socket(settings, websocketImplementation)
```

API connection won't be established until [`connect`](#connect) is called.

**Arguments**

`settings` (object, required)

Settings object that will override the default connector options (see the following section for information about available settings).

`socketImplementation` (object, required)

W3C-compatible WebSocket implementation to use for underlying API communication.

Example implementation for Node.js: w3cwebsocket from package https://github.com/theturtle32/WebSocket-Node

Web browsers: browser's native WebSocket implementation should be used (simply provide `WebSocket` or `window.WebSocket`)


**Example**

```js

import { Socket } from 'airdcpp-apisocket';
import { w3cwebsocket } from 'websocket';

const settings = {
  url: 'ws://localhost:5600/api/v1/',
  username: 'testuser',
  password: 'testpassword',
  reconnectInterval: 5
};

const socket = Socket(settings, w3cwebsocket);

```



## Settings

| Name | Type | Default | Description
| :--- | :--- | :---: | :--- |
| **url** | `string` |  | Fully qualified API URL (**required**). Example: ws://localhost:5600/api/v1/ |
| **username, password** | `string` |  | Username and password to use when connecting to the API. Alternatively you may provide the credentials when calling [`connect`](#connect). |
| **autoReconnect** | `boolean` | true | Reconnect automatically if the socket gets disconnected |
| **reconnectInterval** | `number` | 10 | Interval of automatic reconnection (seconds) |
| **requestTimeout** | `number` | 30 | Notify about about API requests that have taken longer than this to complete (seconds). This is mainly used for detecting possible issues (deadlocks) with the backend as messages sent via WebSocket should always be delivered (pending request will be aborted automatically when the socket is disconnected). |
| **reconnectInterval** | `number` | 10 | Interval of automatic reconnection (seconds) |
| **logLevel** | `enum[string]` | verbose | Logging level. Available values: `none`, `error`, `warn`, `info`, `verbose` |
| **logOutput** | `object` | console | Output for logged messages. The supplied object must have the following function properties taking a variable number of arguments: `log`, `info`, `warn`, `error` |
| **ignoredRequestPaths** | `array[string]` &#124; `RegExp` | | Request paths that should never be displayed in logs/console. Array of exact paths or a single regex pattern may be used. This option is mainly targeted for debugging purposes in order to prevent spammy requests from filling the console window. |
| **ignoredListenerEvents** | `array[string]` &#124; `RegExp` | | Listener/hook event names that should never be displayed in logs/console. Array of exact names or a single regex pattern may be used. This option is mainly targeted for debugging purposes in order to prevent spammy events from filling the console window. |



## Connect state methods

Generic methods for viewing and changing the socket connect state. These methods should not be used by (managed) extensions as the connect state is managed automatically.

### `connect`

`connect(username, password, reconnectOnFailure = true)`

**Arguments**

**`username`, `password`** (string, optional)

Custom user name and password that will override the possible globally set values.

**`reconnectOnFailure`** (boolean, optional)

Attempt to reconnect automatically if the socket can't be connected due to connectivity issue (API errors will always fail the action). 
This won't have effect if the socket gets disconnected after a successful connect attempt (the global auto reconnect option is used there instead).

**Return value**

Promise that will be resolved with response of the [POST /sessions/authorize](http://docs.airdcpp.apiary.io/#reference/sessions/authentication/authorize) API method

### `disconnect`

`disconnect(reconnect, reason)`

Disconnect the socket while keeping the session token cached. `reconnect` can be used to re-establish the connection.

**Arguments**

**`reconnect`** (boolean, optional)

**`reason`** (string, optional)

String describing the reason for the disconnect


### `reconnect`

`reconnect(authToken)`

Reconnect a disconnected session or connect with an existing session token. This method can't be used for currently connected sockets.

**Arguments**

**`authToken`** (string, optional)

Possible session token to use for reconnecting. If no token is specified, the cached token will be used. If there is no cached token available, the method will throw.

**Return value**

Promise that will be resolved with response of the [POST /sessions/socket](http://docs.airdcpp.apiary.io/#reference/sessions/authentication/socket) API method.

### `isConnecting`

Returns true if connection is currently being established.

### `isConnected`

Returns true if the socket is currently connected and authenticated.

### `isActive`

Returns true if the socket is currently connected or there is a connection attempt in progress.

### `logout`

Invalidate the current API session and disconnect the socket.

**Return value**

Promise that will be resolved with the possible response of the [DELETE /sessions](http://docs.airdcpp.apiary.io/#reference/sessions/current-session/remove-current-session) API method.



## Connect state events

### `onSocketConnected`

`onSocketConnected(data)`

Fired after the socket was connected and authenticated. `data` is the data received from the API authentication request ([`connect`](#connect)/[`reconnect`](#reconnect)).

### `onSocketDisconnected`

Fired after the socket was disconnected.

**Callback arguments**

Supplied arguments are properties from the websocket [CloseEvent](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent).

**`reason`** (string)

**`code`** (number)

**`wasClean`** (number)


### `onSessionReset`

Fired when the session was reset (either after [`logout`](#logout) was called or due to a rejected reconnect attempt).



## Logger

Similar to `console` object but the output is emitted only if allowed by the `logLevel` setting.

### `verbose(args...), info(args...), warn(args...), error(args...)`



## API requests

`post(path, data)`, `put(path, data)`, `patch(path, data)`, `get(path)`, `delete(path)`

**Arguments**

**`path`** (string, required)

API request path

**`data`** (object, optional)

Method-specific data object. No data is allowed for `get` and `delete` methods.

**Return value**

Promise that will be resolved with the possible response data (or is rejected with an error object).

**Example**

```js

socket.post('events', {
  text: 'Testing',
  severity: 'info'
})
  .then(data => console.log('Message was sent'))
  .catch(error => console.error('Failed to send the message: ' + error.message));

```



## Event listeners

### `addListener`

`addListener(path, listenerName, callback, entityId)`

**Arguments**

**`path`** (string, required)

API path without the `listeners/listener_name` part at the end.

**`listenerName`** (string, required)

Name of the API event (listener name)

**`callback`** (function, required)

Function to call on received event messages. The callback function signature is `handler(data, entityId)` where `data` is the 
subscription-specific data object (if available) and `entityId` is set only for entity type subscriptions.

**`entityId`** (string|number, optional)

Possible ID when using per-entity subscriptions (filelist, hub, extension...). Events from all entities will be sent if no entity ID is specified.


**Return value**

Promise returning a function that will remove the listener when being called. Note that all listeners will be removed automatically when the socket is disconnected.

Note that the function returns asynchronously after receiving confirmation from the application that the event listener has really been added. It's generally safer to wait for the function to return even if you don't need the removal callback before continuing with other actions that expect the listener to be functional and emitting events. As the API is multithreaded and requests may be processed in a different order that they were sent, this will avoid race conditions and events possibly being missed.


**Example**

```js

const onMessageReceived = (message, hubId) => {
  console.log(`${message.text} (hub ID: ${hubId})`);
}

// NOTE: async function
const removeListener = await socket.addListener('hubs', 'hub_chat_message', onMessageReceived);

// If you want to add the listener only for a single hub, add the session ID argument at the end:
// const removeListener = await socket.addListener('hubs', 'hub_chat_message', onMessageReceived, replace_with_the_wanted_session_id);

// ... other code


// Remove the listener
removeListener();

```

## Action hooks

Action hooks are meant to be used only if you are going to change the behavior how certain actions/events are being processed by the application (or whether the action/event is being processed at all). Please see the [API docs](https://github.com/airdcpp-web/airdcpp-apidocs/blob/master/communication-protocols.md#action-hooks) for more information about action hooks and how they compare with event listeners.

### `addHook`

`addHook(path, hookName, callback)`

**Arguments**

**`path`** (string, required)

API path without the `hook/name` part.

**`hookName`** (string, required)

Name of the hook

**`callback`** (function, required)

Function to call on received event messages. The callback function signature is `handler(data, accept, reject)` where `data` is the 
hook-specific data object. `accept` (`(data) => void`) function should be called in case of success, and it may also be called with a data argument, if supported by the hook. `reject` (signature `(rejectId: string, rejectMessage: string) => void`) should be called with the error information in case of errors.

**`subscriberInfo`** (object, required)

Information about the subscriber (an object with `id` and `name` properties).


**Return value**

Promise returning a function that will remove the hook when being called. Note that all hooks will be removed automatically when the socket is disconnected.

Note that the function returns asynchronously after receiving confirmation from the application that the hook has really been added. It's generally safer to wait for the function to return even if you don't need the removal callback before continuing with other actions that expect the listener to be functional and emitting events. As the API is multithreaded and requests may be processed in a different order that they were sent, this will avoid race conditions and events possibly being missed.

**Example**

```js

const handleIncomingMessage = (message, accept, reject) => {
  if (message.text.indexOf('spam') !== -1) {
    reject('spam_filtered', 'Message was spam');
  } else {
    accept();
  }
}

const subscriberInfo = {
  id: 'my-test-hook',
  name: 'Test hook'
};

// NOTE: async function
const removeHook = await socket.addHook('hubs', 'hub_incoming_message_hook', handleIncomingMessage, subscriberInfo);

// ... other code


// Remove the hook
removeHook();

```

**Logging tip**

With certain hooks, the console may quickly be filled with API communication messages when `verbose` logging level is used.

The following [socket options](#settings) will filter out all incoming `share_file_validation_hook` hook messages and their respective accept calls (rejected files are still being logged):

```js
ignoredListenerEvents: [
	'share_file_validation_hook'
],
ignoredRequestPaths: /^(share\/hooks\/share_file_validation_hook\/\d+\/resolve)$/
```


## Helpers

### `addContextMenuItems`

A helper function that can be used to add context menu items. See the (Menu API documentation)[https://airdcpp.docs.apiary.io/#reference/menus] for more information about the menu API.

**Arguments**

**`socket`** (object, required)

`airdcpp-apisocket` instance

**`menuItems`** (array[object], required)

List of menu items to be added

Each item should include `id` and `name` properties and optionally an `icon` property (see [`menuitems`](https://airdcpp.docs.apiary.io/#reference/menus/hooks/list-menu-items) for more information).

Additionally each item should have either of the following properties: 
- `onClick` function (signature `(selectedIds: any[], entityId: any | undefined, permissions: string[], supports: string[], formValues: object) => void`) property that will be called if the menu item is being clicked by the user.
`formValues` contains user input from the input form if `formDefinitions` was specified for the menu item.
- `urls` function/string array (signature `string[] | ((selectedIds: any[], entityId: any | undefined, permissions: string[], supports: string[]) => string[]) | undefined`) property that will return an array of URLs to be opened by the UI if the menu item is being clicked by the user (or `undefined` if no URLs should be added and the `onClick` hander should be called instead)

Optional properties for filtering:

`filter`: function (signature `(selectedIds: any[], entityId: any | undefined, permissions: string[], supports: string[]) => boolean | Promise<boolean>`) if you want to show the menu item conditionally. The filter function must return `true` if the specific menu item should be added.
`access`: Required access (`string`) for accessing the menu item. If you need to perform more complex permission checks, use the `filter` function to check the `permissions` argument. See the [`API documentation`](https://airdcpp.docs.apiary.io/#reference/menus/hooks/list-menu-items) for available access strings.

Optional form definitions:

- `formDefinitions` function/object array (signature `object[] | ((selectedIds: any[], entityId: any | undefined, permissions: string[], supports: string[]) => object[]) | undefined`) property that can used to define a form that will be shown to the user after the item has been clicked (the form user input will then be available in the `onClick` handler). See the [API documentation](https://airdcpp.docs.apiary.io/#reference/menus/menus/list-menu-items) for information about the form definition format.

**`menuType`** (string, required)

Menu type (see the (Menu API documentation)[https://airdcpp.docs.apiary.io/#reference/menus] for available types)

**`subscriberInfo`** (object, required)

Information about the subscriber (see the [`addHook`](#addHook) method).

**Return value**

Promise returning a function that will remove the menu items when being called.


**Example**

```js

import { addContextMenuItems } from 'airdcpp-apisocket';

const socket = // ...initialize the socket

socket.onConnected = (sessionInfo) => {
  if (sessionInfo.system_info.api_feature_level >= 4) {
    // ...remember to check the permissions if needed

    const subscriberInfo = {
      id: 'airdcpp-release-validator',
      name: 'Release validator extension'
    };

    addContextMenuItems(
      socket,
      [
        {
          id: 'scan_missing_extra',
          title: `Scan share for missing/extra files`,
          icon: {
            semantic: 'yellow broom'
          },
          access: 'settings_edit',
          onClick: async (selectedIds, entityId, permissions, supports, formValues) => {
            const ignoreExcluded = formValues.ignore_excluded; // User input from the displayed form
            await runners.scanShare(ignoreExcluded);
          },
          filter: selectedIds => selectedIds.indexOf(extension.name) !== -1,
          formDefinitions: (selectedIds, entityId, permissions, supports) => {
            // Show a dialog before the scan to allow the user to customize scanning options
            return {
              key: 'ignore_excluded',
              title: 'Ignore files/directories that are excluded from share',
              default_value: true,
              type: 'boolean'
            };
          },
        }, {
          id: 'google',
          title: `Google extension by ID`,
          icon: {
            semantic: 'external'
          },
          urls: async (selectedIds, entityId, permissions, supports) => {
            // Generate Google search URL for each selected extension
            return selectedIds
              .map(extensionId => {
                return `https://www.google.com/q=${encodeURIComponent(extensionId)}`
              );
          }
        }
      ],
      'extension', // Menu type
      subscriberInfo,
    );
  }
}
```
