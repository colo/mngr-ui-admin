'use strict'

const mootools = require("mootools"),
			base = require ('./base.conf');

module.exports = Object.merge(base, {
		
	logs: {
		loggers: {
			error: null,
			access: null,
			profiling: null
		},
		
		path: './logs',
		
	},
	
	authentication: {
		username: 'lbueno',
		password: '123',
		sendImmediately: true,
	},
	
});

