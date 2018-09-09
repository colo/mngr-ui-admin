'use strict'

const App =  process.env.NODE_ENV === 'production'
      ? require('../../config/prod.conf')
      : require('../../config/dev.conf');



module.exports = new Class({
  Extends: App,

	options: {
    id: 'index',
    path: '/',

    authorization: undefined,

		io: {
			middlewares: [], //namespace.use(fn)
			rooms: ['root'], //atomatically join connected sockets to this rooms
			routes: {
				message: [{
					// path: ':param',
					once: true, //socket.once
					callbacks: ['check', 'message'],
					middlewares: [], //socket.use(fn)
				}],
				// '*': [{// catch all
				// 	path: '',
				// 	callbacks: ['not_found_message'],
				// 	middlewares: [], //socket.use(fn)
				// }]
			}
		}
	},

	check: function(socket, next){
		console.log('checking...', arguments[2])
		// arguments[1]()
		this.io.to('root').emit('response', 'a new user has joined the room saying '+arguments[2]);
		next(socket)
	},
	message: function(socket, next){
		console.log('message')
		socket.emit('response', 'some response')

		// console.log(this.authorization)
	},
	not_found_message(socket, next){
		console.log('not_found_message')
		socket.emit('response', 'not found')
	},
	get: function(req, resp){
		resp.send(
			'<!doctype html><html><head><title>socket.io client test</title></head>'
			+'<body><script src="/socket.io/socket.io.js"></script>'
			+'<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.4.4/jquery.min.js"></script>'
			+'<script>'
			+'var chat = io.connect("http://localhost:8080/");'
		  +'chat.on("connect", function () {'
		  +'  chat.emit("message", "hi!");'
			+'	chat.on("response", function(message){ '
			+'		$("body").append(message);'
			+'	});'
			+'  chat.emit("message");'//test
		  +'});'
			+'</script>'
			+'</body></html>'
		)
	},

  initialize: function(options){
    this.parent(options)

		this.profile('index_init');//start profiling

		this.profile('index_init');//end profiling

		this.log('index', 'info', 'index started');
  },


});
