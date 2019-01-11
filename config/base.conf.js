'use strict'

let App = require('node-express-app')

App = require('node-express-app/io')(App)

var	os = require('os'),
		path = require('path'),
		bodyParser = require('body-parser'),
		//multer = require('multer'), // v1.0.5
		//upload = multer(), // for parsing multipart/form-data
		cors = require('cors');

// let session = require('express-session')
// let MemoryStore = require('memorystore')(session)
// let serialize = require('serialize-to-js').serialize
// let deserialize = require('serialize-to-js').deserialize
// // let MemoryStore = require('express-session/session/memory')
//
// let debug = require('debug')('apps:os:Base:Conf'),
//     debug_internals = require('debug')('apps:os:Base:Conf');

module.exports = new Class({
  Extends: App,

	app: null,
  logger: null,
  authorization:null,
  authentication: null,

	options: {
		// session: {
		// 	store: new MemoryStore({
		// 		serializer: {
		// 			stringify: serialize,
		// 			// stringify: function(sess){
		// 			// 	return JSON.stringify(sess, function(key, value) {
		// 			// 	    if (typeof(value) === 'function') {
		// 			// 				// console.log(value.toString())
		// 			// 	        return value.toString();
		// 			// 	    }
		// 			// 			else if (value instanceof RegExp){
    // 			// 				return "__REGEXP " + value.toString()
		// 			// 			}
		// 			// 			else{
		// 			// 	    	return value;
		// 			// 			}
		// 			// 	})
		// 			// },
		// 			parse: function(sess){ return deserialize(sess,{debug: debug, debug_internals:debug_internals}) },
		// 			// parse: function(sess){
		// 			// 	// return JSON.parse(sess, function(key, value) {
		// 			// 	//     if (key === "") return value;
    //       //   //
		// 			// 	//     if (typeof value === 'string') {
		// 			// 	//         var rfunc = /function[^\(]*\(([^\)]*)\)[^\{]*{([^\}]*)\}/,
		// 			// 	//             match = value.match(rfunc);
    //       //   //
		// 			// 	//         if (match) {
		// 			// 	//             var args = match[1].split(',').map(function(arg) { return arg.replace(/\s+/, ''); });
		// 			// 	// 						console.log(args)
		// 			// 	// 						console.log(match[2])
		// 			// 	//             return new Function(args, match[2]);
		// 			// 	//         }
		// 			// 	//     }
		// 			// 	//     return value;
		// 			// 	// })
		// 			// 	return JSON.parse(sess, function(key, value){
		// 			// 		let fn = /function/
		// 			// 		let rg = /__REGEXP/
		// 			// 	  // if (typeof value === 'string' && value.indexOf('function') === 0) {
		// 			// 		if (typeof value === 'string' && fn.test(value)) {
		// 			// 	    // let functionTemplate = `(${value})`;
		// 			// 			return Function.from(value)
		// 			// 			// console.log(functionTemplate)
		// 			// 			// let native = /native/
		// 			// 			// if(native.test(functionTemplate)){
		// 			// 			// 	return null
		// 			// 			// }
		// 			// 			// else{
		// 			// 	    // 	return eval(functionTemplate);
		// 			// 			// }
		// 			// 	  }
		// 			// 		if (typeof value === 'string' && rg.test(value)) {
		// 			// 	    var m = value.split("__REGEXP ")[1].match(/\/(.*)\/(.*)?/);
		// 			// 	    return new RegExp(m[1], m[2] || "");
		// 			// 	  }
		// 			// 		else{
		// 			// 	  	return value
		// 			// 		}
		// 			// 	})
		// 			// }
		// 		},
	  //   }),
		// 	//proxy: true,
		// 	//cookie: { path: '/', httpOnly: true, maxAge: null },
		// 	//cookie : { secure : false, maxAge : (4 * 60 * 60 * 1000) }, // 4 hours
		// 	//session: {store: null, proxy: true, cookie: { path: '/', httpOnly: true, maxAge: null }, secret: 'keyboard cat'},
		// 	cookie: { path: '/', httpOnly: true, maxAge: null, secure: false },
		// 	secret: 'keyboard cat',
		// 	resave: true,
		// 	saveUninitialized: true
    //
		// },

	  middlewares: [
			bodyParser.json(),
			bodyParser.urlencoded({ extended: true }),
			cors({
				'exposedHeaders': ['Link', 'Content-Range']
			})
	  ],

		path: '/',

		logs: undefined,

		authentication: {
			users : [
					{ id: 1, username: 'anonymous' , role: 'anonymous', password: ''}
			],
		},

		authorization: {
			config: path.join(__dirname,'./rbac.json'),
		},

		routes: {
			// get: [
			// 	{
			// 		path: '',
			// 		callbacks: ['get'],
			// 		version: '',
			// 	},
			// ],
			all: [
				{
					path: '',
					callbacks: ['404'],
					version: '',
				},
			]
		},

	// 	api: {
  //
	// 		version: '1.0.0',
  //
	// 		routes: {
	// 			get: [
	// 				{
	// 					path: '',
	// 					callbacks: ['get'],
	// 					version: '',
	// 				},
	// 			],
	// 			all: [
	// 				{
	// 					path: '',
	// 					callbacks: ['404'],
	// 					version: '',
	// 				},
	// 			]
	// 		},
  //
	// 	},
  },

});
