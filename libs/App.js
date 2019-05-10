'use strict'

var	path = require('path')

const App =  process.env.NODE_ENV === 'production'
      ? require(path.join(process.cwd(), '/config/prod.conf'))
      : require(path.join(process.cwd(), '/config/dev.conf'))

const ETC =  process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), '/etc/')
      : path.join(process.cwd(), '/devel/etc/')

const jscaching = require('js-caching')
const Pipeline = require('js-pipeline')

let debug = require('debug')('mngr-ui-admin:libs:App'),
    debug_internals = require('debug')('mngr-ui-admin:libs:App:Internals');

module.exports = new Class({
  Extends: App,

  /**
  * desde 'hosts', mover a global
  **/
  ID: 'ea77ccca-4aa1-448d-a766-b23efef9c12b',

  cache: undefined,

  // _arguments: function(args, defined_params){
  _arguments: function(args){
		let req, resp, next, socket = undefined

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
      // // ////console.log('socket', args)
      // let isObject = (args[2] !== null && typeof args[2] === 'object' && isNaN(args[2]) && !Array.isArray(args[2])) ? true: false
      // //console.log('isObject',isObject)
      //
      // if(defined_params && isObject == false){
      //   Array.each(defined_params, function(name, index){
      //     params[name] = args[index + 2]
      //   })
      // }
      // else{
	     params = args[2]
      // }
		}



		return {req, resp, socket, next, params}
	},
  /**
  * desde 'hosts', mover a global
  **/
  __process_session: function(){
    debug_internals('__process_session store')
    let {req, resp, socket, next, params} = this._arguments(arguments)


    let session = (socket) ? socket.handshake.session : req.session
    // let id = (socket) ? socket.id : req.session.id
    // debug_internals('__process_session store', (socket) ? socket.handshake.sessionStore : req.sessionStore)

    // if(!this.session_store)
    //   this.session_store = (socket) ? socket.handshake.sessionStore : req.sessionStore

    this.__update_sessions({id: session.id, type: (socket) ? 'socket' : 'http'})

    // if(!session.events)
    //   session.events = []
    //
    // if(!session.hosts_events)
    //   session.hosts_events= {}

    if(socket){
      if(!session.sockets) session.sockets = []

      session.sockets.include(socket.id)
    }

    // return session
    next()
  },
  /**
  * desde 'hosts', mover a global
  **/
  __update_sessions: function(session, remove){
    remove = remove || false
    this.cache.get(this.ID+'.sessions', function(err, sessions){
      if(!sessions || sessions == null) sessions = {}

      session = [session]
      if(remove === false){
        Array.each(session, function(_session){
          if(!sessions[_session.type]) sessions[_session.type] = []
          sessions[_session.type] = sessions[_session.type].include(_session.id)
        })

      }
      else{
        Array.each(session, function(_session){
          if(sessions[_session.type])
            sessions[_session.type] = sessions[_session.type].erase(_session.id)
        })
      }

      this.cache.set(this.ID+'.sessions', sessions, this.SESSIONS_TTL)
    }.bind(this))
  },
  initialize: function(options){
    if(this.options.api && this.options.api.routes)
    	Object.each(this.options.api.routes, function(routes, verb){

  			if(verb != 'all'){
  				Array.each(routes, function(route){
  					//debug('route: ' + verb);
            route.callbacks.unshift('__process_pipeline')
  					route.callbacks.unshift('__process_session')
            // route.callbacks.push('test');
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
            route.callbacks.unshift('__process_pipeline')
  					route.callbacks.unshift('__process_session');
            //
  					// if(verb == 'get')//users can "read" info
  					// 	route.roles = ['user']
  				});
  			}

  		});

    this.parent(options)

    debug_internals('initialize %O', this.options.api.routes)

		this.profile('mngr-ui-admin-app_init');//start profiling

    this.cache = new jscaching(this.options.cache_store)

    // if(this.options.on_demand)
    //   this.ui_rest_client = new ui_rest(ui_rest_client_conf)
    //
    // this.pipeline.hosts.inputs[0].conn_pollers[0].addEvent('onConnect', function(){
    //   // debug_internals('connected')
    //   // this.pipeline.hosts.suspended = false
    //   // this.pipeline.hosts.fireEvent('onResume')
    //   this.pipeline.hosts.fireEvent('onOnce')
    // }.bind(this))






    this.profile('hosts_init');//end profiling

		this.log('mngr-ui-admin-app', 'info', 'mngr-ui-admin-app started');
  },
  get_pipeline: function(id, cb){
    if(id){
      if(this.__pipeline.inputs.length != this.__pipeline_cnf.connected.length){
          this.__after_connect_inputs(
            this.__resume_pipeline.pass([this.__pipeline, this.__pipeline_cnf, id, cb.pass(this.__pipeline)], this)
          )
      }
      else{
        this.__resume_pipeline(this.__pipeline, this.__pipeline_cnf, id, cb.pass(this.__pipeline))
      }
    }
    else{
      cb(this.__pipeline)
    }
  },
  __process_pipeline: function(){
    let {req, resp, socket, next, params} = this._arguments(arguments)
    let id = (socket) ? socket.id : undefined

    debug_internals('__process_pipeline', id)
    // let { id, cb } = (
    //   arguments[0]
    //   && typeof arguments[0] === 'function'
    // ) ? {id: undefined, cb: arguments[0]} : {id: arguments[0], cb: arguments[1]}

    if(!this.__pipeline){

      // const HostsPipeline = require('./pipelines/index')({
      //   conn: require(ETC+'ui.conn.js')(),
      //   host: this.options.host,
      //   cache: this.options.cache_store,
      //   ui: (this.options.on_demand !== true) ? undefined : Object.merge(
      //     ui_rest_client_conf,
      //     {
      //       load: 'apps/hosts/clients'
      //     }
      //   )
      // })

      this.__pipeline = new Pipeline(this.options.pipeline)

      this.__pipeline_cnf = {
        ids: [],
        connected: [],
        suspended: this.__pipeline.inputs.every(function(input){ return input.options.suspended }, this)
      }

      this.__after_connect_inputs(
        this.__resume_pipeline.pass([this.__pipeline, this.__pipeline_cnf, id, next], this)
      )

    }
    // else if(!id){
    //   cb(this.pipeline)
    // }
    else if(id){
      if(this.__pipeline.inputs.length != this.__pipeline_cnf.connected.length){
          this.__after_connect_inputs(
            this.__resume_pipeline.pass([this.__pipeline, this.__pipeline_cnf, id, next], this)
          )
      }
      else{
        this.__resume_pipeline(this.__pipeline, this.__pipeline_cnf, id, next)
      }
    }

  },
  __after_connect_inputs: function(cb){

    let _client_connect = function(index){
      debug_internals('__after_connect_inputs %d', index)

      this.__pipeline_cnf.connected.push(true)
      if(this.__pipeline.inputs.length === this.__pipeline_cnf.connected.length){
        cb()
      }


      this.__pipeline.inputs[index].removeEvent('onClientConnect', _client_connect)
    }.bind(this)

    Array.each(this.__pipeline.inputs, function(input, index){
      input.addEvent('onClientConnect', _client_connect.pass(index));
    }.bind(this))
  },
  __resume_pipeline: function(pipeline, cfg, id, cb){
    debug_internals('__resume_pipeline', pipeline, cfg, id)

    if(id){
      if(!cfg.ids.contains(id))
        cfg.ids.push(id)

      if(cfg.suspended === true){
        debug_internals('__resume_pipeline this.pipeline.connected', cfg.connected)

        if(cfg.connected.every(function(item){ return item === true}.bind(this))){
          cfg.suspended = false
          pipeline.fireEvent('onResume')
        }
        else{
          let __resume = []
          Array.each(pipeline.inputs, function(input, index){
            if(cfg.connected[index] !== true){
              __resume[index] = function(){
                __resume_pipeline(pipeline, id)
                input.conn_pollers[0].removeEvent('onConnect', __resume[index])
              }.bind(this)
              input.conn_pollers[0].addEvent('onConnect', () => __resume[index])
            }

          }.bind(this))

        }

      }
    }

    if(cb)
      cb()

  },
  // test: function(){
  //   debug_internals('test', arguments)
  // }
})
