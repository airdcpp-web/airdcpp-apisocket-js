# airdcpp-apisocket-js

Javascript connector for [AirDC++ Web API](https://github.com/airdcpp/airdcpp-webapi).

## Features

- Handles authentication with the API and reconnects in case of failures or when the client is restarted
- Provides a promise-based interface for making API requests
- Manages subscriptions for all socket listener events
- Provides configurable console logging capabilities

## Minimal example

The example displays a status message in main chat every time a new user joins a hub.

```javascript
var ApiSocket = require('airdcpp-apisocket');

var socket = ApiSocket({
	url: 'localhost:5600',
	username: 'exampleuser',
	password: 'examplepass'
});

var onUserConnected = function(user) {
	// Show a status message in that particular hub
	socket.post('hubs/v0/status', {
		hub_urls: [ user.hub_url ],
		text: user.nick + ' joined the hub',
		severity: 'info'
	});
};

socket.onConnected = function() {
	socket.addSocketListener('hubs/v0', 'hub_user_connected', onUserConnected);
};

socket.connect();
```

## Table of contents

 * [Getting started](#getting-started)
 * [Development tips](#development-tips)
 * [Running the examples](#running-the-examples)
 
Please post any bugs or questions you may have on the issue tracker.

## Getting started

Save the latest release by running 

``npm install airdcpp-apisocket --save``

You must have [Node.js](https://nodejs.org) installed first. If you are unfamiliar with writing code for Node.js, you can check out [this beginners tutorial](http://blog.modulus.io/absolute-beginners-guide-to-nodejs).

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

## Running the examples

There are a few examples demonstrating how to use the connector in real projects. The examples are simplified and generally not meant for regular use.

Examples require a recent version of nodejs and [AirDC++ Web Client](https://github.com/airdcpp-web/airdcpp-webclient) 1.0.0 or newer to work. Please note the [recommended hubsofts to use](#hubsofts) as the examples may not work with all hubsofts.

1. Clone the repository
2. Install dependencies and build the project by running the following commands in the main directory

    ```
    npm install
    npm run build
    ``` 
3. Create a copy of ``examples/settings.js.example`` and rename it to ``examples/settings.js``
4. Edit ``examples/settings.js`` to contain the correct API address and user credentials
5. Run the wanted example with ``node examples/replace_with_example_name.js``
