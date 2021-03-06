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