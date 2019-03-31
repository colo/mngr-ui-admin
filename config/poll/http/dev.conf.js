'use strict'

const mootools = require("mootools"),
			base = require ('./base.conf');

module.exports = Object.merge(base, {
		
	authentication: {
		username: 'test',
		password: '123',
		sendImmediately: false,
	},
	
	logs: {
		loggers: {
			error: null,
			access: null,
			profiling: null
		},
		
		path: './logs',
		
		//default: [
			//{ transport: winston.transports.Console, options: { colorize: 'true', level: 'warning' } },
			//{ transport: winston.transports.File, options: {level: 'info', filename: null } }
		//]
	},
	
	
	
});

