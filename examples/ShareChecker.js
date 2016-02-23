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
			extensions: [ 'iso' ],
			min_size: 500*1024*1024
		}, 
		description: 'ISO file(s) over 500 MB'
	}
];

const checkOwnShare = true;
const checkConnectingUsers = true;

// CONFIG END


const ApiSocket = require('../');

const socket = ApiSocket(require('./settings'));


const formatResultPaths = (results) => {
	const paths = results.reduce((reduced, result) => {
		reduced.push(result.path);
		return reduced;
	}, []);

	return paths.join(', ');
};

const onUserResultsReceived = (user, item, results) => {
	if (results.length === 0) {
		return;
	}

	// Notify the user
	// Forbidden item(s) found from share: ISO file(s) over 500 MB (example: /Linux/Ubuntu 15.04.iso)
	socket.post('private_chat/v0/message', {
		user: user,
		text: 'Forbidden item(s) found from share: ' + item.description + ' (' + formatResultPaths(results) + ')'
	});

	// Show a status message in that particular hub
	// [100]MrFastSpeed: ISO file(s) over 500 MB (/Linux/Ubuntu 15.04.iso)
	socket.post('hubs/v0/status', {
		hub_urls: [ user.hub_url ],
		text: user.nick + ': ' + item.description + ' (' + formatResultPaths(results) + ')',
		severity: 'info',
	});
};

const onUserSearchFailed = (user, item, error) => {
	// Most likely the search timed out
	socket.post('hubs/v0/status', {
		hub_urls: [ user.hub_url ],
		text: user.nick + ': ' + error.message,
		severity: 'warning',
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
			.then(onUserResultsReceived.bind(this, user, item))
			.catch(onUserSearchFailed.bind(this, user, item));
	});
};

const onShareResultsReceived = (item, results) => {
	if (results.length === 0) {
		return;
	}

	// Show an event message
	// Forbidden item found from own share: ISO file(s) over 500 MB (/Linux/Ubuntu 15.04.iso)
	socket.post('events/v0/message', {
		text: 'Forbidden item found from own share' + ': ' + item.description + ' (' + formatResultPaths(results) + ')',
		severity: 'warning',
	});
};

const searchOwnShare = () => {
	// This will only search from the default profile
	searchItems.forEach((item) => {
		socket.post('search/v0/query/share', {
			query: item.query
		})
			.then(onShareResultsReceived.bind(this, item));
	});
};

socket.onConnected = () => {
	if (checkConnectingUsers) {
		socket.addListener('hubs/v0', 'hub_user_connected', onUserConnected);
	}

	if (checkOwnShare) {
		// Check own share on every connect
		searchOwnShare();
	}
};

socket.connect();