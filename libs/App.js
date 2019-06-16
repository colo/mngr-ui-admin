'use strict'

var	path = require('path')

const App =  process.env.NODE_ENV === 'production'
      ? require(path.join(process.cwd(), '/config/prod.conf'))
      : require(path.join(process.cwd(), '/config/dev.conf'))

const ETC =  process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), '/etc/')
      : path.join(process.cwd(), '/devel/etc/')

const jscaching = require('js-caching')
// let RethinkDBStoreIn = require('js-caching/libs/stores/rethinkdb').input
// let RethinkDBStoreOut = require('js-caching/libs/stores/rethinkdb').output

let RedisStoreIn = require('js-caching/libs/stores/redis').input
let RedisStoreOut = require('js-caching/libs/stores/redis').output

const Pipeline = require('js-pipeline')

let debug = require('debug')('mngr-ui-admin:libs:App'),
    debug_internals = require('debug')('mngr-ui-admin:libs:App:Internals');

module.exports = new Class({
  Extends: App,
  // Implements: Chain,

  ON_PIPELINE_READY: 'onPipelineReady',
  ID: 'ea77ccca-4aa1-448d-a766-b23efef9c12b',
  SESSIONS_TTL: 60000,


  cache: undefined,
  session_store: undefined,

  __responses: {},

  options: {
    /**
    * desde 'hosts', mover a global
    **/
    cache_store: {
      NS: 'a22cf722-6ea9-4396-b2b3-9440dd677dd0',
      id: 'ui.cache',
      suspended: false,
      ttl: 1999,
      stores: [
        // {
        //   id: 'rethinkdb',
        //   conn: [
        //     {
        //       host: 'elk',
        //       port: 28015,
        //       // port: 28016,
        //       db: 'servers',
        //       table: 'cache',
        //       module: RethinkDBStoreIn,
        //     },
        //   ],
        //   module: RethinkDBStoreOut,
        // }
        {
          NS: 'a22cf722-6ea9-4396-b2b3-9440dd677dd0',
          id: 'ui.cache',
          conn: [
            Object.merge(
              Object.clone(require(ETC+'default.redis')),
              {
                module: RedisStoreIn,
              },
            )
          ],
          module: RedisStoreOut,
          buffer:{
            size: -1,
            // expire: 0 //ms
            expire: 999 //ms
          }
        }
      ],
    },
  },
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
  register_response(socket_or_req, cb){
    debug_internals('register_response', socket_or_req.session)
    let id = (socket_or_req.id) ? socket_or_req.id : socket_or_req.session.id
    let session = (socket_or_req.session) ? socket_or_req.session : socket_or_req.handshake.session

    session._resp = session._resp+1 || 0
    let resp_id = id +'.'+session._resp
    if(resp_id){
      let _chain = new Chain()
      _chain.chain(
        cb,
        function(){ delete this.__responses[resp_id] }.bind(this)
      )
      this.__responses[resp_id] = _chain
      return {id: resp_id, chain: _chain}
    }

    throw new Error('Couldn\'t register response, no ID')
  },
  response: function (id, err, resp){
    // let id = (socket_or_req.id) ? socket_or_req.id : socket_or_req.session.id
    if(this.__responses[id]){
      let _chain = this.__responses[id]
      while (_chain.callChain(err, resp) !== false) {}
    }
  },
  get_from_input: function(payload){
    let {response, from, next, req, input, params, key, range} = payload
    from = from || 'periodical'
    let cache_key = (key) ? input+'.'+from+'.'+key : input+'.'+from
    cache_key = (params.prop && params.value) ? cache_key+'.'+params.prop+'.'+params.value : cache_key

    // let joined_params = (params) ? '.'+Object.values(params).join('.') : ''
    // debug_internals('get_from_input', payload, joined_params)

    // this.cache.get(input+'.'+from+joined_params, function(err, result){
    this.cache.get(cache_key, function(err, result){
      debug_internals('__get cache %o %o %s', err, result)

      if(!result || range !== undefined){//even on result ranges search are not used from cache
        this.get_pipeline(req, function(pipe){
            debug_internals('__get get_pipeline', pipe)

            let _get_resp = {}
            _get_resp[response] = function(err, resp){
              debug_internals('_get_resp %s %o %s', err, resp,  response, params)

              if(resp.id == response){

                if(!range){//don't cache ranges searchs
                  let cache_resp = Object.clone(resp)

                  this.cache.set(cache_key, cache_resp[input], this[input.toUpperCase()+'_TTL'])
                }

                // if(!err && Object.every(params, function(value, key){ return value === undefined || key === 'path' })){//only cache full responses
                // //   // this.cache.set(input+'.'+from+joined_params, resp[input], this[input.toUpperCase()+'_TTL'])
                //   this.cache.set(cache_key, resp[input], this[input.toUpperCase()+'_TTL'])
                // }
                if(params.prop && !params.value){
                  let _arr_resp = resp[input]
                  if(!Array.isArray(_arr_resp))
                    _arr_resp = [_arr_resp]

                  Array.each(_arr_resp, function(data, index){
                    if(data)
                      Object.each(data, function(value, key){
                        debug_internals('_get_resp delete key %s %s', key, params.prop)
                        if( key !== params.prop)
                          delete data[key]
                      })
                  })

                  if(!Array.isArray(resp[input])){
                    resp[input] = _arr_resp[0]
                  }
                  else{
                    resp[input] = _arr_resp
                  }

                }
                // send_resp[req_id](resp)
                resp.from = from
                resp.input = input

                next(response, err, resp)

                this.removeEvent(response, _get_resp[response])
                delete _get_resp[response]
              }
            }.bind(this)

            this.addEvent(response, _get_resp[response])

            // debug_internals('inputs', pipe.inputs[0].options.id)
            // debug_internals('inputs', pipe.get_input_by_id('domains'))
            if(range){
              pipe.get_input_by_id(input).fireEvent('onRange', {
                from,
                id: response,
                Range:range,
                params
              })
            }
            else{
              pipe.get_input_by_id(input).fireEvent('onOnce', {
                from,
                id: response,
                params
              })
            }

            // pipe.inputs[0].fireEvent('onOnce', {from: from, id: response})//fire only the 'hosts' input

          }.bind(this))
      }
      else{
        // this.response(response, {from: from, input: 'domains', domains: result})
        debug_internals('from cache %o', params, result)
        let resp = {id: response, from, input}
        if(Object.every(params, function(value, key){ return value === undefined || key === 'path' }) || params.value){
          resp[input] = result
        }
        else{

          // resp[input] = {}
          let _arr_resp = result
          if(!Array.isArray(_arr_resp))
            _arr_resp = [_arr_resp]

          Array.each(_arr_resp, function(data, index){
            Object.each(data, function(value, key){
              debug_internals('_get_resp delete key %s %s', key, params.prop)
              if( key !== params.prop)
                delete data[key]
            })
          })

          if(!Array.isArray(resp[input])){
            resp[input] = _arr_resp[0]
          }
          else{
            resp[input] = _arr_resp
          }

          // Object.each(params, function(value, key){//key may be anything, value is usually what we search for
          //   if(result[value] && key !== 'path')
          //     resp[input][value] = result[value]
          // })
          // Array.each(_arr_resp, function(data, index){
          //   Object.each(params, function(value, key){//key may be anything, value is usually what we search for
          //     if(data[value] && key !== 'path')
          //       resp[input][value] = result[value]
          //   })
          // })

        }
        next(response, undefined, resp)
      }

    }.bind(this))
  },
  /**
  * desde 'hosts', mover a global
  **/
  socket: function(socket){
    debug_internals('socket.io connect', socket.id)

		this.parent(socket)

    socket.compress(true)

		socket.on('disconnect', function () {
      debug_internals('socket.io disconnect', socket.id)

      this.__get_session_id_by_socket(socket.id, function(err, sid){
        debug_internals('disconnect __get_session_by_socket', err, sid)
        if(sid)
          this.__update_sessions({id: sid, type: 'socket'}, true)//true == remove
      }.bind(this))

      if(this.__pipeline_cfg.ids.contains(socket.id)){
        this.__pipeline_cfg.ids.erase(socket.id)
        this.__pipeline_cfg.ids = this.__pipeline_cfg.ids.clean()
      }

      if(this.__pipeline){
        debug_internals('TO UNREGISTER', socket.id)
        // if(this.options.on_demand){
        //   ui_rest_client.api.get({
        //     uri: "events/once",
        //     qs: {
        //       type: 'unregister',
        //       id: socket.id,
        //       // hosts: [host],
        //       pipeline_id: 'ui',
        //     }
        //   })
        //
        //   ui_rest_client.api.get({
        //     uri: 'events/suspend',
        //     qs: {
        //       pipeline_id: 'ui',
        //     },
        //   })
        //
        //   this.__pipeline.inputs[4].conn_pollers[0].clients['ui.rest'].ids = this.pipeline.ids
        // }

        this.__pipeline.fireEvent('onOnce', {
          type: 'unregister',
          id: socket.id,
        })//fire only the 'host' input


      }





      if(this.__pipeline_cfg.ids.length === 0 && this.__pipeline_cfg){ // && this.pipeline.suspended == false
        this.__pipeline_cfg.suspended = true
        this.__pipeline.fireEvent('onSuspend')
      }


		}.bind(this));
	},
  /**
  * Pipeline
  **/
  get_pipeline: function(req, cb){
    let id = (req && req.id) ? req.id : undefined
    // if(id){
      if(this.__pipeline.inputs.length != this.__pipeline_cfg.connected.length){
          this.__after_connect_inputs(
            this.__resume_pipeline.pass([this.__pipeline, this.__pipeline_cfg, id, cb.pass(this.__pipeline), false], this)
          )
      }
      else{
        this.__resume_pipeline(this.__pipeline, this.__pipeline_cfg, id, cb.pass(this.__pipeline), false)
      }
    // }
    // else{
    //   cb(this.__pipeline)
    // }
  },
  /**
  * middleware callback (injected on initialize)
  **/
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

      this.__pipeline.addEvent(this.__pipeline.ON_SAVE_DOC, function(doc){
        let {id, type} = doc

        debug_internals('onSaveDoc %o', doc)
        if(id)
          this.fireEvent(id, [undefined, doc])

        if(type)
          this.fireEvent(type, [undefined, doc])

        // // this.__emit_stats(host, stats)
      }.bind(this))

      this.__pipeline.addEvent(this.__pipeline.ON_DOC_ERROR, function(err, resp){
        let {id, type} = resp

        debug_internals('onDocError %o', err, resp)
        if(id)
          this.fireEvent(id, [err, resp])

        if(type)
          this.fireEvent(type, [err, resp])

        // // this.__emit_stats(host, stats)
      }.bind(this))

      // this.__pipeline.addEvent(this.__pipeline.ON_SAVE_MULTIPLE_DOCS, function(doc){
      //   // let {from, type, range} = doc
      //   // from = from || 'periodical'
      //   // // this[type] = {
      //   // //   value: doc[type],
      //   // //   timestamp: Date.now()
      //   // // }
      //
      //   debug_internals('onSaveMultipleDocs %o', doc)
      //   //
      //   // if(!range){
      //   //   debug_internals('onSaveDoc %o', type, doc)
      //   //   if(type == 'data' || type == 'data_range' || type == 'instances' || type == 'paths')
      //   //     this.fireEvent(this['ON_HOST_'+type.toUpperCase()+'_'+from.toUpperCase()+'_UPDATED'], doc)
      //   //     // this.fireEvent(this.ON_HOST_DATA_UPDATED, doc)
      //   //   else
      //   //     this.fireEvent(this['ON_'+type.toUpperCase()+'_'+from.toUpperCase()+'_UPDATED'], doc)
      //   // }
      //   // else{
      //   //   this.fireEvent(this['ON_'+type.toUpperCase()+'_RANGE'+'_'+from.toUpperCase()], doc)
      //   // }
      //   //
      //   // // this.fireEvent(this['ON_'+type.toUpperCase()+'_UPDATED'], [this[type].value])
      //   // // this.__emit_stats(host, stats)
      // }.bind(this))

      this.__pipeline_cfg = {
        ids: [],
        connected: [],
        suspended: this.__pipeline.inputs.every(function(input){ return input.options.suspended }, this)
      }

      this.__after_connect_inputs(
        this.__resume_pipeline.pass([this.__pipeline, this.__pipeline_cfg, id, next], this)
      )

    }
    // else if(!id){
    //   cb(this.pipeline)
    // }
    // else if(id){
    else{
      if(this.__pipeline.inputs.length != this.__pipeline_cfg.connected.length){
          this.__after_connect_inputs(
            this.__resume_pipeline.pass([this.__pipeline, this.__pipeline_cfg, id, next], this)
          )
      }
      else{
        this.__resume_pipeline(this.__pipeline, this.__pipeline_cfg, id, next)
      }
    }


  },
  __after_connect_inputs: function(cb){

    let _client_connect = function(index){
      debug_internals('__after_connect_inputs %d', index)

      this.__pipeline_cfg.connected.push(true)
      if(this.__pipeline.inputs.length === this.__pipeline_cfg.connected.length){
        cb()
      }


      this.__pipeline.inputs[index].removeEvent('onClientConnect', _client_connect)
    }.bind(this)

    Array.each(this.__pipeline.inputs, function(input, index){
      input.addEvent('onClientConnect', _client_connect.pass(index));
    }.bind(this))
  },
  /**
  * use event === false on get_pipeline, so it won't fire the event
  **/
  __resume_pipeline: function(pipeline, cfg, id, cb, event){
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

    // this.chain(cb, this.fireEvent('ON_PIPELINE_READY', pipeline));


    if(cb){
      if(event === false){
        cb()
      }
      else{
        let _chain = new Chain();
        _chain.chain(
          cb,
          this.fireEvent.pass([this.ON_PIPELINE_READY, pipeline], this)
        );

        while (_chain.callChain() !== false) {}
      }
    }
    else{
      this.fireEvent(this.ON_PIPELINE_READY, pipeline)
    }

  },
  /**
  * @end Pipeline
  **/

  /**
  * @start - session
  **/

  /**
  * middleware callback (injected on initialize)
  **/
  __process_session: function(){
    debug_internals('__process_session')
    let {req, resp, socket, next, params} = this._arguments(arguments)


    let session = (socket) ? socket.handshake.session : req.session
    // let id = (socket) ? socket.id : req.session.id
    // debug_internals('__process_session store', (socket) ? socket.handshake.sessionStore : req.sessionStore)

    if(!this.session_store)
      this.session_store = (socket) ? socket.handshake.sessionStore : req.sessionStore

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

  /**
  * desde 'hosts', mover a global
  **/
  __get_session_by_id: function(id, cb){

    if(this.session_store && typeof this.session_store.get == 'function'){
      try{
        this.session_store.get(id, cb)
      }
      catch(e){
        debug_internals('this.session_store.get error', e)
      }
    }
    else if(this.session_store && this.session_store.sessions[id]){//MemoryStore
      cb(undefined, this.session_store.sessions[id])
    }
    else{
      cb({status: 404, message: 'session not found'}, undefined)
    }


  },
  /**
  * desde 'hosts', mover a global
  **/
  __get_session_id_by_socket: function(socketId, cb){
    debug_internals('__get_session_id_by_socket', socketId)

    if(this.session_store && typeof this.session_store.all == 'function'){
      try{
        this.session_store.all(function(err, sessions){
          if(err) cb(err, sessions)

          debug_internals('__get_session_id_by_socket this.session_store.all', sessions)

          let found = false
          Object.each(sessions, function(session, sid){
            if(session && session.sockets && session.sockets.contains(socketId)){
              cb(undefined, sid)
              found = true
            }
          }.bind(this))

          if(found === false) cb({status: 404, message: 'session not found'}, undefined)

        })
      }
      catch(e){
        debug_internals('this.session_store.get error', e)
      }
    }
    else if(this.session_store && this.session_store.sessions){//MemoryStore
      debug_internals('__get_session_id_by_socket this.session_store.sessions', this.session_store.sessions)
      let found = false
      Object.each(this.session_store.sessions, function(session, sid){
        if(session && session.sockets && session.sockets.contains(socketId)){
          cb(undefined, sid)
          found = true
        }
      }.bind(this))

      if(found === false) cb({status: 404, message: 'session not found'}, undefined)
    }
    else{//last resort, search by IDs using cache
      // cb({status: 404, message: 'session not found'}, undefined)
      this.cache.get(this.ID+'.sessions', function(err, sessions){

        if(sessions && sessions['socket'] && sessions['socket'].length > 0){
          let found = false
          Array.each(sessions['socket'], function(sid){
            this.__get_session_by_id(sid, function(err, session){
              if(session){
                found = true
                cb(undefined, sid)
              }
            })
          }.bind(this))

          if(found === false) cb({status: 404, message: 'session not found'}, undefined)
        }
        else{
          cb({status: 404, message: 'session not found'}, undefined)
        }
      }.bind(this))
    }

  },
  /**
  * @end - session
  **/

})
