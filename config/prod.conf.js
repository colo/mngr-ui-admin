'use strict'

const Moo = require("mootools"),
		path = require("path"),
		BaseApp = require ('./base.conf');

const ETC =  process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), '/etc/')
      : path.join(process.cwd(), '/devel/etc/')


let session = require('express-session')
let RedisStore = require('connect-redis')(session)
let helmet = require('helmet')

// var session = require('express-session'),
// 		MemoryStore = require('memorystore')(session), //https://www.npmjs.com/package/memorystore
// 		helmet = require('helmet');

		// winston = require('winston');

/**
 * Requiring `winston-logstash` will expose
 * `winston.transports.Logstash`
 * */
// require('winston-logstash');
//
// var common = require('winston/lib/winston/common');
//
//
// var transform = function (level, msg, meta, self) {
//     return common.log({
//         level: level,
//         message: msg,
//         node_name: self.node_name,
//         meta: meta,
//         timestamp: self.timestamp,
//         json: true,
//         label: self.label,
//     });
// };

let Authentication = require('node-express-authentication')
// let MemoryStoreAuth = require('node-authentication').MemoryStore
let RethinkDBStore = require('node-authentication').RethinkDBStore
// let MemoryAuth = require('node-authentication').MemoryAuth
let ImapAuth = require('node-authentication').ImapAuth

module.exports = new Class({
  Extends: BaseApp,

  options: {

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

		authentication: {
			store: { module: RethinkDBStore, options: require(ETC+'default.conn.js')()},// MemoryStoreAuth,
			auth: { module: ImapAuth, options: require(ETC+'imap.conn.js')()} // MemoryAuth
		},

	},
	initialize: function(options){

		//this.options.middlewares.unshift(helmet.hidePoweredBy({ setTo: 'PHP 4.2.0' }));
		this.options.middlewares.unshift(helmet());

		// this.options.session = session({
		// 		store: new MemoryStore({
		// 			checkPeriod: 3600000 // prune expired entries every hour
		// 		}),
		// 		cookie: { path: '/', httpOnly: true, maxAge: null, secure: false },
		// 		secret: '19qX9cZ3yvjsMWRiZqOn',
		// 		resave: true,
		// 		saveUninitialized: false,
		// 		name: 'mngr.api',
		// 		unset: 'destroy'
		// });
		this.options.session = session({
				store: new RedisStore(
					Object.clone(require(ETC+'default.redis.js'))
				),
				cookie: { path: '/', httpOnly: true, maxAge: null, secure: false },
				secret: '19qX9cZ3yvjsMWRiZqOn',
				resave: true,
				saveUninitialized: false,
				name: 'SID',
				unset: 'destroy'
		});


		/**
		 * add 'check_authentication' & 'check_authorization' to each route
		 * */
		 if(this.options.api && this.options.api.routes)
			Object.each(this.options.api.routes, function(routes, verb){

				if(verb != 'all'){
					Array.each(routes, function(route){
						//debug('route: ' + verb);
						route.callbacks.unshift('check_authorization');
						// route.callbacks.unshift('check_authentication');

						// if(verb == 'get')//users can "read" info
							route.roles = ['admin']
					});
				}

			});

		if(this.options.io && this.options.io.routes)
      Object.each(this.options.io.routes, function(routes, verb){

  			if(verb != 'all'){
					Array.each(routes, function(route){
						//debug('route: ' + verb);
						route.callbacks.unshift('check_authorization');
						// route.callbacks.unshift('check_authentication');

						// if(verb == 'get')//users can "read" info
							route.roles = ['admin']
					});
  			}

  		});

		this.parent(options);//override default options


	}

});
