### 2.3.1 (2020-07-12)

- Typescript: add missing entity ID argument for the listener callback

### 2.3.0 (2020-07-11)

- Add new helper method [`addContextMenuItems`](https://github.com/airdcpp-web/airdcpp-apisocket-js/blob/master/GUIDE.md#addContextMenuItems)
- Supply `wasClean` as a third argument to the `onSocketDisconnected` callback
- Use code 1000 when disconnecting the socket, allow specifying the disconnect reason when calling `disconnect`
- Update dependencies
- Improve documentation