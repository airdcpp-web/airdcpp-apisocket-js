'use strict';

// This script will search for a list of forbidden items directly from each connecting user
// Forbidden items will be reported privately to the user and also locally as status message

// CONFIG START

const searchItems = [
	{
		query: {
			pattern: 'System32',
			file_type: 'directory'
		},
		description: 'Windows directory'
	}, {
		query: {
			extensions: [ 'rar' ],
			min_size: 500*1024*1024
		}, 
		description: 'ISO file(s) over 500 MB'
	}, {
		query: {
			pattern: 'Photoshop',
			file_type: 'directory'
		}, 
		description: 'Photoshop'
	}
];

// CONFIG END


const ApiSocket = require('../').default;

const socket = ApiSocket(require('./settings'));


const onResultsReceived = (user, item, results) => {
	if (results.length === 0) {
		return;
	}

	// Only report for a single result
	const result = results[0];

	// Notify the user
	// Forbidden item(s) found from share: ISO file(s) over 500 MB (example: /Linux/Ubuntu 15.04.iso)
	socket.post('private_chat/v0/message', {
		user: user,
		text: 'Forbidden item(s) found from share: ' + item.description + ' (example: ' + result.path + ')'
	});

	// Show a status message in that particular hub
	// [100]MrFastSpeed: ISO file(s) over 500 MB (/Linux/Ubuntu 15.04.iso)
	socket.post('hubs/v0/status', {
		hub_urls: [ user.hub_url ],
		text: user.nick + ': ' + item.description + ' (' + result.path + ')',
		severity: 'info',
	});
};

const onUserConnected = (user) => {
	// Direct search is only support in ADC hubs
	if (user.flags.indexOf('nmdc') !== -1) {
		return;
	}

	// Perform searches
	searchItems.forEach((item) => {
		socket.post('search/v0/query/user', {
			user: user,
			query: item.query
		})
			.then(onResultsReceived.bind(this, user, item));
	});
};

socket.onConnected = () => {
	socket.addListener('hubs/v0', 'hub_user_connected', onUserConnected);
};

socket.connect();