'use strict'

var	path = require('path')

const App =  process.env.NODE_ENV === 'production'
      ? require(path.join(process.cwd(), '/config/prod.conf'))
      : require(path.join(process.cwd(), '/config/dev.conf'))

const ETC =  process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), '/etc/')
      : path.join(process.cwd(), '/devel/etc/')

let debug = require('debug')('mngr-ui-admin:libs:App'),
    debug_internals = require('debug')('mngr-ui-admin:libs:App:Internals');

module.exports = new Class({
  Extends: App,

  /**
  * desde 'hosts', mover a global
  **/
  ID: 'ea77ccca-4aa1-448d-a766-b23efef9c12b',

  _arguments: function(){
		let req, resp, next, socket = undefined

    // debug_internals('_arguments', arguments[2], arguments[0]._readableState)

		if(arguments[0]._readableState){//express
			req = arguments[0]
			resp = arguments[1]
			next = arguments[2]
		}
		else{//socket.io
			socket = arguments[0]
			next = arguments[1]
		}

		let params = {}
		if(typeof(req) != 'undefined'){
			params = req.params
		}
		else{
      // // ////console.log('socket', arguments)
      // let isObject = (
      //   arguments[2] !== null
      //   && typeof arguments[2] === 'object'
      //   && isNaN(arguments[2])
      //   && !Array.isArray(arguments[2])
      // ) ? true: false
      //
      //
      // if(defined_params && isObject == false){
      //   Array.each(defined_params, function(name, index){
      //     params[name] = arguments[index + 2]
      //   })
      // }
      // else{
		     params = arguments[2]
      // }
		}


    debug_internals('_arguments', next)

		// return {req:req, resp:resp, socket:socket, next:next, params: params}

    /**
    * https://stackoverflow.com/questions/18875292/passing-variables-to-the-next-middleware-using-next-in-express-js
    **/

    // next = next.pass({req, resp, socket, params: 'hola'})
    // next()
	},
  initialize: function(options){
    if(this.options.api && this.options.api.routes)
    	Object.each(this.options.api.routes, function(routes, verb){

  			if(verb != 'all'){
  				Array.each(routes, function(route){
  					//debug('route: ' + verb);
  					route.callbacks.unshift('_arguments');
            route.callbacks.push('test');
            //
  					// if(verb == 'get')//users can "read" info
  					// 	route.roles = ['user']
  				});
  			}

  		});



    if(this.options.io && this.options.io.routes)
      Object.each(this.options.io.routes, function(routes, verb){

  			if(verb != 'all'){
  				Array.each(routes, function(route){
  					//debug('route: ' + verb);
  					route.callbacks.unshift('_arguments');
            //
  					// if(verb == 'get')//users can "read" info
  					// 	route.roles = ['user']
  				});
  			}

  		});

    this.parent(options)

    debug_internals('initialize %O', this.options.api.routes)

		this.profile('mngr-ui-admin-app_init');//start profiling

    // this.cache = new jscaching(this.options.cache_store)
    //
    // if(this.options.on_demand)
    //   this.ui_rest_client = new ui_rest(ui_rest_client_conf)
    //
    // // this.pipeline.hosts.inputs[0].conn_pollers[0].addEvent('onConnect', function(){
    // //   // debug_internals('connected')
    // //   // this.pipeline.hosts.suspended = false
    // //   // this.pipeline.hosts.fireEvent('onResume')
    // //   this.pipeline.hosts.fireEvent('onOnce')
    // // }.bind(this))






    this.profile('hosts_init');//end profiling

		this.log('mngr-ui-admin-app', 'info', 'mngr-ui-admin-app started');
  },
  test: function(){
    debug_internals('test', arguments)
  }
})
