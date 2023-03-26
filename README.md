# airdcpp-apisocket-js [![Travis][build-badge]][build] [![npm package][npm-badge]][npm] [![Coverage][coverage-badge]][coverage] [![Code climate][climate-badge]][climate]

JavaScript connector for [AirDC++ Web API](https://github.com/airdcpp/airdcpp-webapi) for [Node.js](https://nodejs.org) and web browsers. 

When communicating with the API locally, it's recommended to write an extension that is managed by the application itself instead of using this library directly. See the [airdcpp-create-extension starter project](https://github.com/airdcpp-web/airdcpp-create-extension) for more information.

## Features

- Handles authentication with the API and reconnects in case of failures or when the client is restarted
- Provides a promise-based interface for making API requests
- Manages subscriptions for all socket listener events
- Provides configurable console logging capabilities

## Usage

- [GUIDE.md](https://github.com/airdcpp-web/airdcpp-apisocket-js/blob/master/GUIDE.md)
- [AirDC++ Web API reference](http://apidocs.airdcpp.net)

## Minimal example

The example displays a status message in main chat every time a new user joins a hub.

```javascript
const API = require('airdcpp-apisocket');
const w3cwebsocket = require('websocket').w3cwebsocket;

const settings = {
	url: 'ws://localhost:5600/api/v1/',
	username: 'exampleuser',
	password: 'examplepass'
};

const socket = API.Socket(settings, w3cwebsocket);

const onUserConnected = function(user) {
	// Show a status message in that particular hub
	socket.post('hubs/status_message', {
		hub_urls: [ user.hub_url ],
		text: user.nick + ' joined the hub',
		severity: 'info'
	});
};

socket.onConnected = function() {
	socket.addListener('hubs', 'hub_user_connected', onUserConnected);
};

socket.connect();
```

## Table of contents

 * [Getting started](#getting-started)
 * [Development tips](#development-tips)
 * [Running the examples](#running-the-examples)
 
Please post any bugs or questions you may have on the issue tracker.


## Prerequisites

You must have [Node.js](https://nodejs.org) installed for using the API connector.

If you are going to use the connector in browser environment, see [AirDC++ Web UI](https://github.com/airdcpp-web/airdcpp-webui/blob/master/src/services/SocketService.js) for example usage.


## Getting started

Add the connector as dependency to an existing Node project by running 

``npm install airdcpp-apisocket --save``

If you are unfamiliar with writing code for [Node.js](https://nodejs.org), you can check out [this beginners tutorial](http://blog.modulus.io/absolute-beginners-guide-to-nodejs).


## Development tips

### Hubsofts

The client is recommended to be used with ADC hubsofts as all API calls (or some of their options) can't be used with NMDC hubs.

Certain ADC hubsofts, such as Flexhub and Luadch don't follow the ADC protocol specs, which may cause unexplained issues when communicating with other clients.


**Recommended hubsofts for development:**

- Windows: [ADCH++](http://adchpp.sourceforge.net/)
- Linux: [uhub](https://www.uhub.org/)


### Debugging protocol commands

As many of the features require communicating with other clients, sometimes it's useful to check that the actual commands have been sent and those are received by the other party. Hubsofts (or their scripts) may block certain commands or impose rate limits for them.

If you are using AirDC++ Web Client, you can start the client with ``--cdm-client`` and ``--cdm-hub`` to display all protocol communication in the console. The Windows version has a separate CDM debug tab from where you can enable wanted message displaying options.

The ADC protocol specifications can be found from http://adc.sourceforge.net/ADC.html



[build-badge]: https://github.com/airdcpp-web/airdcpp-apisocket-js/actions/workflows/node.js.yml/badge.svg
[build]: https://github.com/airdcpp-web/airdcpp-apisocket-js/actions/workflows/node.js.yml

[npm-badge]: https://img.shields.io/npm/v/airdcpp-apisocket.svg?style=flat-square
[npm]: https://www.npmjs.org/package/airdcpp-apisocket

[climate-badge]: https://codeclimate.com/github/airdcpp-web/airdcpp-apisocket-js/badges/gpa.svg
[climate]: https://codeclimate.com/github/airdcpp-web/airdcpp-apisocket-js

[coverage-badge]: https://codecov.io/gh/airdcpp-web/airdcpp-apisocket-js/branch/master/graph/badge.svg
[coverage]: https://codecov.io/gh/airdcpp-web/airdcpp-apisocket-js
