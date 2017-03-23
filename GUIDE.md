

## Settings



## Connect state

Generic methods for viewing and changing the socket connect state. These methods should not be used by (managed) extensions as the connect state is managed automatically.

### `connect(username, password, reconnectOnFailure = true)`

**Arguments**

`username`, `password` (string)

Custom user name and password that will override the possible globally set values.

`reconnectOnFailure` (boolean)

Attempt to reconnect automatically if the socket can't be connected due to connectivity issue (API errors will always fail the action). 
This won't have effect if the socket gets disconnected after a successful connect attempt (the global auto reconnect option is used there instead).

**Return value**

Promise that will be resolved with response of the [POST /sessions/authorize](http://docs.airdcpp.apiary.io/#reference/sessions/authentication/authorize) API method

### `disconnect()`

Disconnect the socket while keeping the session token cached. `reconnect` can be used to re-establish the connection.

### `reconnect(authToken)`

Reconnect a disconnected session or connect with an existing session token. This method can't be used for currently connected sockets.

**Arguments**

`authToken` (string, optional)

Possible session token to use for reconnecting. If no token is specified, the cached token will be used. If there is no cached token available, the method will throw.

**Return value**

Promise that will be resolved with response of the [POST /sessions/socket](http://docs.airdcpp.apiary.io/#reference/sessions/authentication/socket) API method.

### `isConnected()`

Returns true if the socket is currently connected (but not possibly authenticated).

### `isReady()`

Returns true if the socket is connected and authenticated.

### `destroy()`

Invalidate the current API session and disconnect the socket.

**Return value**

Promise that will be resolved with response of the [DELETE /sessions](http://docs.airdcpp.apiary.io/#reference/sessions/current-session/remove-current-session) API method.

## Requests

### `post(path, data), put(path, data), patch(path, data), get(path), delete(path)`

**Arguments**

`path` (string)

API request path

`data` (object, optional)

Method-specific data object. No data is allowed for `get` and `delete methods`

**Return value**

Promise that will be resolved with the possible request response

**Example**

```js

socket.post('events', {
  text: 'Testing',
  severity: 'info'
})
  .then(data => console.log('Message was sent'))
  .catch(error => console.error('Failed to send the message: ' + error.message));

```

## Subscriptions

### `addListener(path, listenerName, callback, entityId)`

**Arguments**

`path` (string)

API path without the `listener/name` part.

`listenerName` (string)

Name of the listener

`callback` (function)

Function to call on received event messages. The callback function signature is `handler(data, entityId)` where `data` is the 
subscription-specific data object (if available) and `entityId` is set only for entity type subscriptions.

`entityId` (optional, string|number)

Possible ID when using per-entity subscriptions (filelist, hub, extension...). Events from all entities will be sent if no entity ID is specified.

**Return value**

Function that will remove the listener when being called.

**Example**

```js

const onMessageReceived = (message, hubId) => {
  console.log(`${message.text} (hub ID: ${hubId})`);
}

socket.addListener('hubs', 'hub_chat_message', onMessageReceived);

```

### `addHook(path, hookName, callback)`

**Arguments**

`path` (string)

API path without the `hook/name` part.

`hookName` (string)

Name of the hook

`callback` (function)

Function to call on received event messages. The callback function signature is `handler(data, accept, reject)` where `data` is the 
hook-specific data object.

**Return value**

Function that will remove the listener when being called.

**Example**

```js

const handleIncomingMessage = (message, accept, reject) => {
  if (message.text.indexOf('spam') !== -1) {
    reject('spam_filtered', 'Message was spam');
  } else {
    accept();
  }
}

socket.addHook('hubs', 'hub_incoming_message_hook', handleIncomingMessage);

```

## Logger

Similar to `console` object but the output is emitted only if allowed by the `logLevel` setting.

### `verbose(args...), info(args...), warn(args...), error(args...)`
