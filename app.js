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

	pipeline: undefined,

	options: {
		io: {
			// middlewares: [], //namespace.use(fn)
			// rooms: ['root'], //atomatically join connected sockets to this rooms
			// routes: {
			// 	message: [{
			// 		// path: ':param',
			// 		once: true, //socket.once
			// 		callbacks: ['check', 'message'],
			// 		middlewares: [], //socket.use(fn)
			// 	}],
			// 	// '*': [{// catch all
			// 	// 	path: '',
			// 	// 	callbacks: ['not_found_message'],
			// 	// 	middlewares: [], //socket.use(fn)
			// 	// }]
			// }
		}
	},

	// get: function(req, resp){
	// 	resp.send(
	// 		'<!doctype html><html><head><title>socket.io client test</title></head>'
	// 		+'<body><script src="/socket.io/socket.io.js"></script>'
	// 		+'<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.4.4/jquery.min.js"></script>'
	// 		+'<script>'
	// 		+'var chat = io.connect("http://localhost:8080/");'
	// 	  +'chat.on("connect", function () {'
	// 	  +'  chat.emit("message", "hi!");'
	// 		+'	chat.on("response", function(message){ '
	// 		+'		$("body").append(message);'
	// 		+'	});'
	// 		+'  chat.emit("message");'//test
	// 	  +'});'
	// 		+'</script>'
	// 		+'</body></html>'
	// 	)
	// },

  initialize: function(options){


		this.parent(options);//override default options

		let io = require("socket.io")(server, {
			transports: ['websocket', 'polling']
		})
		io.use(sharedsession(this.session))//move to middlewares?

		this.add_io(io)

		this.profile('root_init');//start profiling

		const AppPipeline = require('./libs/pipelines/app')(require(ETC+'default.conn.js'), this.io)

		this.pipeline = new Pipeline(AppPipeline)


		this.express().set('authentication',this.authentication);

		// //console.log('PATH', this.options.path)
		this.profile('root_init');//end profiling

		this.log('root', 'info', 'root started');
  },
	socket: function(socket){
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