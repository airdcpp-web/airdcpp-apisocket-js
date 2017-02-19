'use strict';

// This example script will reject incoming chat messages containing unwanted words
// Additionally it provides handling for outgoing chat commands that can also be used to
// add/remove ignored words (note that changes are not persisted when reloading the script)


const ApiSocket = require('../');

const socket = ApiSocket(require('./settings'));


// CONFIG START

// List of words to match
const ignoredWords = [
	'ignoretest',
	'http://'
];

// Don't filter messages sent by operators?
const skipOp = false;

// CONFIG END


socket.onConnected = () => {
	const subscriberInfo = {
		id: 'example_chat_filter',
		name: 'Chat filter',
	};

	socket.addHook('hubs', 'hub_incoming_message_hook', onIncomingMessage, subscriberInfo);
	socket.addHook('private_chat', 'private_chat_incoming_message_hook', onIncomingMessage, subscriberInfo);

	socket.addHook('hubs', 'hub_outgoing_message_hook', onOutgoingHubMessage, subscriberInfo);
	socket.addHook('private_chat', 'private_chat_outgoing_message_hook', onOutgoingPrivateMessage, subscriberInfo);
};

const onOutgoingHubMessage = (message, accept, reject) => {
	const statusMessage = checkChatCommand(message.text);
	if (statusMessage) {
		socket.post('hubs/status_message', {
			hub_urls: [ message.hub_url ],
			text: status,
			severity: 'info',
		});
	}

	accept();
};

const onOutgoingPrivateMessage = (message, accept, reject) => {
	const statusMessage = checkChatCommand(message.text);
	if (statusMessage) {
		socket.post(`private_chat/sessions/${message.user.cid}/status_message`, {
			text: statusMessage,
			severity: 'info',
		});
	}

	accept();
};

const onIncomingMessage = (message, accept, reject) => {
	if (
		allowFilterUser(message.from) && // actual sender of the message
		(!message.replyTo || allowFilterUser(message.replyTo)) // possible chatroom
	) {
		const matchingWord = ignoredWords.find(word => message.text.indexOf(word) !== -1);
		if (matchingWord) {
			reject('filtered', `Filter due to message matching the word "${matchingWord}"`);
			return;
		}

		console.log(ignoredWords.join(', '));
	}

	accept();
};

// Returns whether messages from this user can be filtered
const allowFilterUser = (user) => {
	if (user.flags.indexOf('self') !== -1) {
		// Don't filter own messages...
		return false;
	}

	if (skipOp && user.flags.indexOf('op') !== -1) {
		return false;
	}

	return true;
};

// Basic chat command handling, returns possible status message to post
const checkChatCommand = (text) => {
	if (text.length === 0 || text[0] !== '') {
		return null;
	}

	if (text.indexOf('/help') === 0) {
		return `

Chat filter commands

/chatfilter add <word>
/chatfilter remove <word>
/chatfilter list

		`;
	} else if (text.indexOf('/chatfilter') === 0) {
		const params = text.split(' ');
		if (params.length < 2) {
			return 'Chat filter: not enough parameters';
		}

		if (params[1] === 'add') {
			if (params.length < 3) {
				return 'Chat filter: not enough parameters';
			}

			if (ignoredWords.indexOf(params[2]) !== -1) {
				return 'Chat filter: word is filtered already';
			}

			ignoredWords.push(params[2]);
			return `Chat filter: word ${params[2]} was added`;
		} else if (params[1] == 'remove') {
			if (params.length < 3) {
				return 'Chat filter: not enough parameters';
			}

			const wordIndex = ignoredWords.indexOf(params[2]);
			if (wordIndex === -1) {
				return 'Chat filter: ignored word not found';
			}

			ignoredWords.splice(wordIndex, 1);
			return `Chat filter: word ${params[2]} was removed`;
		} else if (params[1] == 'list') {
			return `Chat filter: ${ignoredWords.join(', ')}`;
		} else {
			return 'Chat filter: unknown command';
		}
	}

	return null;
};

socket.connect();