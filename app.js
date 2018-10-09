#!/usr/bin/env node
'use strict'

/**
 * NODE_ENV=production
 * LOG_ENV=debug
 * PROFILING_ENV=true
 * */
var	path = require('path'),
		debug = require('debug')(process.env.npm_package_name || 'Server'),
		http = require('http'),
		express = require('express');

let express_app = express()
/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || process.env.npm_package_config_port || '3000');
express_app.set('port', port);

/**
 * Create HTTP server.
 */
var server = http.createServer(express_app)

/**
* socket.io && session
**/
let sharedsession = require("express-socket.io-session");
// io = require("socket.io")(server);


const App =  process.env.NODE_ENV === 'production'
      ? require('./config/prod.conf')
      : require('./config/dev.conf');

const ETC =  process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), '/etc/')
      : path.join(process.cwd(), '/devel/etc/')

let Pipeline = require('js-pipeline')


var MyApp = new Class({
  Extends: App,

	docs : {},
	// docs_types: ['count', 'hosts', 'paths'],


	pipeline: undefined,

	options: {
		path: '/_app',

		params: {
			type: /count|hosts|paths/,
		},

		api: {
			path: '/_app',

			routes: {
				get: [
					{
						path: ':type?',
						callbacks: ['get'],
						version: '',
					},
				],
			},
		},

		io: {
			// middlewares: [], //namespace.use(fn)
			// rooms: ['root'], //atomatically join connected sockets to this rooms
			routes: {
				get: [{
			// 		// path: ':param',
			// 		once: true, //socket.once
					callbacks: ['get'],
			// 		middlewares: [], //socket.use(fn)
				}],
			}

		}
	},
	_arguments: function(args, defined_params){
		let req, resp, next, socket = undefined
    // console.log(typeof args[0])
		if(args[0]._readableState){//express
			req = args[0]
			resp = args[1]
			next = args[2]
		}
		else{//socket.io
			socket = args[0]
			next = args[1]
		}

		let params = {}
		if(typeof(req) != 'undefined'){
			params = req.params
		}
		else{
      // console.log('socket', args)
      if(defined_params){
        Array.each(defined_params, function(name, index){
          params[name] = args[index + 2]
        })
      }
      else{
		     params = args[2]
      }
		}



		return {req:req, resp:resp, socket:socket, next:next, params: params}
	},
	get: function(){
		// console.log(arguments)
		// console.log(this._arguments(arguments))
		let {req, resp, socket, next, params} = this._arguments(arguments, ['type'])



		console.log('get', params)

		// if(req.params.type && )
 // && this.docs.length == this.docs_type.length

		let send_docs = function(){
			console.log('send_docs', this.docs)
			if(params.type === null){
				if(resp){
					resp.status(500).json({error: 'wrong type param', status: 500})
				}
				else{
					console.log('emiting')
					socket.emit('app.doc', {error: 'wrong type param', status: 500})
				}
			}
			else if(params.type === undefined){
				if(resp){
					resp.json(Object.values(this.docs))
				}
				else{
					console.log('emiting')
					socket.emit('app.doc', Object.values(this.docs))
				}
			}
			else{

				// let found = false
				// Array.each(this.docs, function(doc, index){
				// 	if(this.options.params.type.test(doc.type))
				// 		found = index
				// }.bind(this))

				if(!this.docs[params.type]){
					if(resp){
						resp.status(404).json({error: 'not found', type: params.type, status: 404})
					}
					else{
						socket.emit('app.doc', {error: 'not found', type: params.type, status: 404})
					}
				}
				else{
					if(resp){
						resp.json(this.docs[params.type])
					}
					else{
						socket.emit('app.doc', this.docs[params.type])
					}
				}

			}

			this.removeEvent('docsComplete', send_docs)
		}.bind(this)
		/**
		* check if this.docs is complete
		**/
		let complete = true
		Array.each(this.docs, function(doc, index){
			if(!this.options.params.type.test(doc.type))
				complete = false
		}.bind(this))

		if(complete == true){
			send_docs()
		}
		else{
			this.addEvent('docsComplete', send_docs.bind(this))
			this.pipeline.fireEvent('onOnce')

		}
    // let send_docs = function(docs){
    //   //console.log('statsProcessed')
    // 	resp.json({status: 'ok'})
    //   this.removeEvent('onSaveDoc', send_docs)
    // }
    // this.addEvent('onSaveDoc', send_docs.bind(this))
    //



	},

  initialize: function(options){


		this.parent(options);//override default options

		let io = require("socket.io")(server, {
			transports: ['websocket', 'polling']
		})
		io.use(sharedsession(this.session))//move to middlewares?

		this.add_io(io)

		this.profile('root_init');//start profiling

		const AppPipeline = require('./libs/pipelines/app')(
			require(ETC+'default.conn.js')(this.options.redis),
			this.io
		)

		this.pipeline = new Pipeline(AppPipeline)

		this.pipeline.addEvent('onSaveDoc', function(doc){
			// console.log('onSaveDoc', doc)

			if(doc.type && this.options.params.type.test(doc.type)){
				this.docs[doc.type] = doc
			}

			/**
			* check if this.docs is complete
			**/
			let complete = true
			Array.each(this.docs, function(doc, index){
				if(!this.options.params.type.test(doc.type))
					complete = false
			}.bind(this))

			if(complete == true)
				this.fireEvent('docsComplete')


		}.bind(this))

		this.express().set('authentication',this.authentication);

		// //console.log('PATH', this.options.path)
		this.profile('root_init');//end profiling

		this.log('root', 'info', 'root started');
  },
	socket: function(socket){
		console.log('connected')
		this.parent(socket)

		// //console.log('suspended', this.pipeline.inputs[0].options.suspended)

		if(this.pipeline.inputs[0].options.suspended === true)
			this.pipeline.fireEvent('onResume')

    //
		// //console.log('this.io.namespace.connected', Object.keys(this.io.connected))
    //
		socket.on('disconnect', function () {
			if(!this.io.connected || Object.keys(this.io.connected).length == 0)
				this.pipeline.fireEvent('onSuspend')

			//console.log('disconnect this.io.namespace.connected', this.io.connected)
		}.bind(this));
	},


});

var root = new MyApp({
	app: express_app
})

root.addEvent(root.ON_INIT, root.load(path.join(__dirname, '/apps')));



/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);

  if(process.env.npm_package_config_groups)
		process.setgroups(process.env.npm_package_config_groups);

	if(process.env.npm_package_config_gid)
		process.setgid(process.env.npm_package_config_gid);

  if(process.env.npm_package_config_uid)
		process.setuid(process.env.npm_package_config_uid);

}
