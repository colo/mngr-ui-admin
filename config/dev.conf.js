'use strict'

const Moo = require("mootools"),
		BaseApp = require ('./base.conf');

//var winston = require('winston');
const limit = require('node-limit/rate/request');
// var req_limit = new limit({
// 									limit: 5,
// 									interval: 1000,
// 									response: function(e, req, res, next){ res.json({error: e.message+'[5/1000]'}) }
// 								});
//
// var req_max = new limit({
// 									limit: 2,
// 									interval: 5000,
// 									response: function(e, req, res, next){ res.json({error: e.message+'[2/5000]'}) }
// 								});

module.exports = new Class({
  Extends: BaseApp,

  options: {
		redis: false,
		//middlewares: [req_limit.ip(), req_limit.user()],
		//middlewares: [req_limit.ip(), req_max.ip()],
		//middlewares: [req_limit.user()],

		// authentication: {
		// 	users: [
		// 		{ id: 1, username: 'anonymous' , role: 'anonymous', password: ''},
		// 		//{ id: 1, username: 'lbueno' , role: 'admin', password: '40bd001563085fc35165329ea1ff5c5ecbdbbeef'}, //sha-1 hash
		// 		/**
		// 		 * *curl -H "Content-Type:application/json" -H "Accept:application/json" -H "Authorization: Basic bGJ1ZW5vOjEyMw==" http://localhost:8081/
		// 		 * */
		// 		{ id: 'xxxxx@example.com', username: 'xxxxx@example.com' , role: 'admin', password: '123'}, //sha-1 hash
		// 		{ id: 3, username: 'test' , role: 'user', password: '123'}
		// 	],
		// 	store: { module: RethinkDBStore, options: require(ETC+'default.conn.js')()},// MemoryStoreAuth,
		// 	auth: { module: ImapAuth, options: { host: 'imap.example.com', port: 143, secure: false}} // MemoryAuth
		// },

		authentication: {
			users : [
					{ id: 1, username: 'anonymous' , role: 'anonymous', password: ''},
					{ id: 2,
						username: 'test' ,
						role: 'user',
						password: '123',
						token: {
							uuid: '39F6DD61942A4459BC6271F7EC4C87F5',
							expire: false
						}
					}
			],
		},

		logs: {
			loggers: {
				error: null,
				access: null,
				profiling: null
			},

			path: './logs',

			//default: [
				//{ transport: 'console', options: { colorize: 'true', level: 'warning' } },
				//{ transport: 'logstash', options: {level: 'info', port: 28777, node_name: 'mngr-api', host: '192.168.0.40' } }
			//]
			//default: [
				//{ transport: winston.transports.Console, options: { colorize: 'true', level: 'warning' } },
				//{ transport: winston.transports.Logstash, options: {transform: transform, level: 'info', port: 28777, node_name: 'mngr-api', host: '192.168.0.40' } }
			//]
		},

		// api: {
    //
		// 	version: '1.0.0',
    //
		// 	routes: {
		// 		get: [
		// 			{
		// 				path: '',
		// 				//callbacks: ['check_authentication', req_limit.user(), req_max.ip(), 'get'],
		// 				callbacks: ['get'],
		// 				version: '',
		// 			},
		// 		],
		// 		all: [
		// 			{
		// 				path: '',
		// 				callbacks: ['404'],
		// 				version: '',
		// 			},
		// 		]
		// 	},
		// }
	},
	initialize: function(options){

		this.parent(options);//override default options


	}

});
