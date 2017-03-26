
- [Constructor](#constructor)
- [Settings](#settings)
- [Connect state methods](#connect-state-methods)
  - [connect](#connect)
  - [disconnect](#disconnect)
  - [reconnect](#reconnect)
  - [isConnected](#isconnected)
  - [destroy](#destroy)
- [Connect state events](#connect-state-events)
  - [onSocketConnected](#onsocketconnected)
  - [onSocketDisconnected](#onsocketdisconnected)
  - [onSessionReset](#onsessionreset)
- [Logger](#logger)
- [API requests](#api-requests)
- [API event handlers](#api-event-handlers)
  - [addListener](#addlistener)
  - [addHook](#addhook)



## Constructor

```
ApiSocket(settings, websocketImplementation)
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

import ApiSocket from 'airdcpp-apisocket';
import { w3cwebsocket } from 'websocket';

const settings = {
  url: 'ws://localhost:5600/api/v1/',
  username: 'testuser',
  password: 'testpassword',
  reconnectInterval: 5
};

const socket = ApiSocket(settings, w3cwebsocket);

```



## Settings

| Name | Type | Default | Description
| :--- | :--- | :---: | :--- |
| **url** | string |  | Fully qualified API URL (**required**). Example: ws://localhost:5600/api/v1/ |
| **username, password** | string |  | Username and password to use when connecting to the API. Alternatively you may provide the credentials when calling [`connect`](#connect). |
| **autoReconnect** | boolean | true | Reconnect automatically if the socket gets disconnected |
| **reconnectInterval** | number | 10 | Interval of automatic reconnection (seconds) |
| **requestTimeout** | number | 30 | Notify about about API requests that have taken longer than this to complete (seconds). This is mainly used for detecting possible issues (deadlocks) with the backend as messages sent via WebSocket should always be delivered (pending request will be aborted automatically when the socket is disconnected). |
| **reconnectInterval** | number | 10 | Interval of automatic reconnection (seconds) |
| **logLevel** | enum[string] | verbose | Logging level. Available values: `none`, `error`, `warn`, `info`, `verbose` |
| **ignoredRequestPaths** | array[string] | [] | Request paths that should never be displayed in logs/console. This option is mainly targeted for debugging purposes in order to prevent spammy requests from filling the console window. |
| **ignoredListenerEvents** | array[string] | [] | Listener/hook event names that should never be displayed in logs/console. This option is mainly targeted for debugging purposes in order to prevent spammy events from filling the console window. |



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

Disconnect the socket while keeping the session token cached. `reconnect` can be used to re-establish the connection.

### `reconnect`

`reconnect(authToken)`

Reconnect a disconnected session or connect with an existing session token. This method can't be used for currently connected sockets.

**Arguments**

**`authToken`** (string, optional)

Possible session token to use for reconnecting. If no token is specified, the cached token will be used. If there is no cached token available, the method will throw.

**Return value**

Promise that will be resolved with response of the [POST /sessions/socket](http://docs.airdcpp.apiary.io/#reference/sessions/authentication/socket) API method.

### `isConnected`

Returns true if the socket is currently connected (but not possibly authenticated).

### `isReady`

Returns true if the socket is connected and authenticated.

### `destroy`

Invalidate the current API session and disconnect the socket.

**Return value**

Promise that will be resolved with response of the [DELETE /sessions](http://docs.airdcpp.apiary.io/#reference/sessions/current-session/remove-current-session) API method.



## Connect state events

### `onSocketConnected`

`onSocketConnected(data)`

Fired after the socket was connected and authenticated. `data` is the data received from the API authentication request ([`connect`](#connect)/[`reconnect`](#reconnect)).

### `onSocketDisconnected`

Fired after the socket was disconnected.

### `onSessionReset`

Fired when the session was reset (either after [`destroy`](#destroy) was called or due to a rejected reconnect attempt).



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



## API event handlers

### `addListener`

`addListener(path, listenerName, callback, entityId)`

**Arguments**

**`path`** (string, required)

API path without the `listener/name` part.

**`listenerName`** (string, required)

Name of the API event

**`callback`** (function, required)

Function to call on received event messages. The callback function signature is `handler(data, entityId)` where `data` is the 
subscription-specific data object (if available) and `entityId` is set only for entity type subscriptions.

**`entityId`** (string|number, optional)

Possible ID when using per-entity subscriptions (filelist, hub, extension...). Events from all entities will be sent if no entity ID is specified.

**Return value**

Promise returning a function that will remove the listener when being called. Note that all listeners will be removed automatically when the socket is disconnected.

**Example**

```js

const onMessageReceived = (message, hubId) => {
  console.log(`${message.text} (hub ID: ${hubId})`);
}

const removeListener = await socket.addListener('hubs', 'hub_chat_message', onMessageReceived);

// ... other code


// Remove the listener
removeListener();

```

### `addHook`

`addHook(path, hookName, callback)`

**Arguments**

**`path`** (string, required)

API path without the `hook/name` part.

**`hookName`** (string, required)

Name of the hook

**`callback`** (function, required)

Function to call on received event messages. The callback function signature is `handler(data, accept, reject)` where `data` is the 
hook-specific data object.

**Return value**

Promise returning a function that will remove the hook when being called. Note that all hooks will be removed automatically when the socket is disconnected.

**Example**

```js

const handleIncomingMessage = (message, accept, reject) => {
  if (message.text.indexOf('spam') !== -1) {
    reject('spam_filtered', 'Message was spam');
  } else {
    accept();
  }
}

const removeHook = await socket.addHook('hubs', 'hub_incoming_message_hook', handleIncomingMessage);

// ... other code


// Remove the hook
removeHook();

```
