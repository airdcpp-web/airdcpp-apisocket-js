### 2.4.4 (2021-08-27)

- Throw when attempting to add listeners for individual entities incorrectly

### 2.4.3 (2021-08-21)

- Handle cases when an error code is returned by the API without an accompanying error message (this may have previously crashed the process e.g. when attempting to remove hooks: https://github.com/airdcpp/airdcpp-windows/commit/596b31a9c8c4e72f6c9279972a40ea30f10798c4).

### 2.4.2 (2021-08-15)

- Fix "Uncaught ReferenceError: process is not defined" in browser ([#17](https://github.com/airdcpp-web/airdcpp-apisocket-js/issues/17))

### 2.4.1 (2020-10-27)

- Fix re-authenticating with credentials if reconnect fails

### 2.4.0 (2020-10-20)

- Allow context menu items to define forms and URLs to open (supported in API feature level 5, https://airdcpp.docs.apiary.io/#reference/menus/hooks/list-menu-items)

### 2.3.1 (2020-07-12)

- Typescript: add missing entity ID argument for the listener callback

### 2.3.0 (2020-07-11)

- Add new helper method [`addContextMenuItems`](https://github.com/airdcpp-web/airdcpp-apisocket-js/blob/master/GUIDE.md#addContextMenuItems)
- Supply `wasClean` as a third argument to the `onSocketDisconnected` callback
- Use code 1000 when disconnecting the socket, allow specifying the disconnect reason when calling `disconnect`
- Update dependencies
- Improve documentation