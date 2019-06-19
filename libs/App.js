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

const uuidv5 = require('uuid/v5')

let data_to_stat = require('node-tabular-data').data_to_stat
let data_to_tabular = require('node-tabular-data').data_to_tabular

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
  generic_response: function(payload){
    debug_internals('generic_response', payload)
    let {err, result, resp, input, format} = payload

    let status = (err && err.status) ? err.status : ((err) ? 500 : 200)
    if(err)
      result = Object.merge(err, result)

    if(format && !err){
      let stat = {}
      stat[input] = result[input]
      this.__transform_data('stat',stat , this.ID, function(value){
        debug_internals(input+': __transform_data stat %O', value.stat) //result

        result[input] = value.stat[input]

        if( format == 'tabular' ){
          this.__transform_data('tabular', value.stat[input], this.id, function(value){
            debug_internals(input+': __transform_data tabular %O', value) //result

            result[input] = value

            if(resp){
              resp.status(status).json(result)
            }
            else{
              socket.emit(input, result)
            }

          }.bind(this))

        }
        else{
          if(resp){
            resp.status(status).json(result)
          }
          else{
            socket.emit(input, result)
          }
        }

      }.bind(this))
    }
    else{
      if(resp){
        resp.status(status).json(result)
      }
      else{
        socket.emit(input, result)
      }
    }





  },
  get_from_input: function(payload){
    let {response, from, next, req, input, params, key, range, query} = payload
    from = from || 'periodical'
    let cache_key = (key) ? input+'.'+from+'.'+key : input+'.'+from
    cache_key = (params.prop && params.value) ? cache_key+'.'+params.prop+'.'+params.value : cache_key
    cache_key = (query.q) ? cache_key+'.'+uuidv5(JSON.stringify(query.q), this.ID) : cache_key
    cache_key = (query.q && query.fields) ? cache_key+'.'+uuidv5(JSON.stringify(query.fields), this.ID) : cache_key



    // let joined_params = (params) ? '.'+Object.values(params).join('.') : ''
    // debug_internals('get_from_input', payload, joined_params)

    // this.cache.get(input+'.'+from+joined_params, function(err, result){
    debug_internals('__get cache key %s %s', cache_key, input.toUpperCase(), this[input.toUpperCase()+'_TTL'])

    this.cache.get(cache_key, function(err, result){
      debug_internals('__get cache ERR %o %d %s',  (err) ? true : false, (err) ? err.status : 200, (err) ? new Date(err.expired) : '')

      if(!result || range !== undefined || query.transformation){//even on result ranges search are not used from cache
        this.get_pipeline(req, function(pipe){
            debug_internals('__get get_pipeline', pipe)

            let _get_resp = {}
            _get_resp[response] = function(err, resp){
              debug_internals('_get_resp %s %o %s', err, response, params) //resp

              if(resp.id == response){

                if(!range && !query.transformation){//don't cache ranges searchs
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

                debug_internals('_get_resp %O', next) //resp

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
                params,
                query
              })
            }
            else{
              pipe.get_input_by_id(input).fireEvent('onOnce', {
                from,
                id: response,
                params,
                query
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

        // debug_internals('onSaveDoc %o', doc)
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

  /**
  * @start transform data
  **/
  __find_stat(stat, stats){
    let result = {}
    if(stat.indexOf('.') > -1){
      let key = stat.split('.')[0]
      let rest = stat.substring(stat.indexOf('.') + 1)
      // //console.log('REST', key, rest)
      result[key] = this.__find_stat(rest, stats[key])
    }
    else if(stats){
      result[stat] = stats[stat]
    }

    return result
  },
  __transform_data: function(type, data, cache_key, cb){
    debug_internals('__transform_data', type)
    let convert = (type == 'stat') ? this.data_to_stat : this.data_to_tabular

    let transformed = {}
    transformed[type] = {}

    let counter = 0 //counter for each path:stat in data
    // let instances = []
    let instances = {}

    if(!data || data == null && typeof cb == 'function')
      cb(transformed)

    /**
    * first count how many "transform" there are for this data set, so we can fire callback on last one
    **/
    let transform_result_length = 0
    Object.each(data, function(d, path){
      let transform = this.__traverse_path_require(type, path, d)

      if(transform && typeof transform == 'function'){
        transform_result_length += Object.getLength(transform(d))
      }
      // else if(transform){
        transform_result_length++
      // }
    }.bind(this))

    let transform_result_counter = 0

    Object.each(data, function(d, path){

      debug_internals('DATA', d, type, path)

      if(d && d !== null){
        if (d[0] && d[0].metadata && d[0].metadata.format && d[0].metadata.format == type){

          // if(!d[0].metadata.format[type]){
          let formated_data = []
          Array.each(d, function(_d){ formated_data.push(_d.data) })
          transformed[type] = this.__merge_transformed(this.__transform_name(path), formated_data, transformed[type])
          // }

          if(counter == Object.getLength(data) - 1 && typeof cb == 'function')
            cb(transformed)

        }
        else if (
          (d[0] && d[0].metadata && !d[0].metadata.format && type == 'stat')
          || (d[0] && !d[0].metadata && type == 'tabular')
        ){
          let transform = this.__traverse_path_require(type, path, d) //for each path find a transform or use "default"

          // debug_internals('__transform_data', d)
          if(transform){

            if(typeof transform == 'function'){
              let transform_result = transform(d, path)


              Object.each(transform_result, function(chart, path_key){

                /**
                * key may use "." to create more than one chart (per key), ex: cpus.times | cpus.percentage
                **/
                let sub_key = (path_key.indexOf('.') > -1) ? path_key.substring(0, path_key.indexOf('.')) : path_key


                if(type == 'tabular'){
                  // debug_internals('transform_result', transform_result)

                  this.cache.get(cache_key+'.'+type+'.'+this.__transform_name(path+'.'+path_key), function(err, chart_instance){
                    // chart_instance = (chart_instance) ? JSON.parse(chart_instance) : chart
                    chart_instance = (chart_instance) ? chart_instance : chart

                    chart_instance = Object.merge(chart, chart_instance)

                    // chart_instance = _transform(chart_instance)

                    convert(d[sub_key], chart_instance, path+'.'+path_key, function(name, stat){
                      transformed[type] = this.__merge_transformed(name, stat, transformed[type])
                      // name = name.replace(/\./g, '_')
                      // let to_merge = {}
                      // to_merge[name] = stat
                      //
                      // transformed = Object.merge(transformed, to_merge)
                      //
                      // debug_internals('chart_instance CACHE %o', name, transform_result_counter, transform_result_length)


                      // chart_instance = this.cache.clean(chart_instance)
                      // // debug_internals('transformed func', name, JSON.stringify(chart_instance))
                      // instances.push(this.__transform_name(path+'.'+path_key))
                      instances[this.__transform_name(path+'.'+path_key)] = chart_instance

                      /**
                      * race condition between this app && ui?
                      **/
                      // this.cache.set(cache_key+'.'+type+'.'+this.__transform_name(path+'.'+path_key), JSON.stringify(chart_instance), this.CHART_INSTANCE_TTL)

                      if(
                        transform_result_counter == transform_result_length - 1
                        && (counter >= Object.getLength(data) - 1 && typeof cb == 'function')
                      ){
                        /**
                        * race condition between this app && ui?
                        **/
                        // this.__save_instances(cache_key, instances, cb.pass(transformed[type]))
                        cb(transformed[type])
                      }

                      transform_result_counter++
                    }.bind(this))



                  }.bind(this))
                }
                else{
                  convert(d[sub_key], chart, path+'.'+path_key, function(name, stat){
                    transformed[type] = this.__merge_transformed(name, stat, transformed[type])
                    // name = name.replace(/\./g, '_')
                    // let to_merge = {}
                    // to_merge[name] = stat
                    //
                    // debug_internals('transformed func', name, stat)
                    //
                    // transformed = Object.merge(transformed, to_merge)

                    if(
                      transform_result_counter == transform_result_length - 1
                      && (counter >= Object.getLength(data) - 1 && typeof cb == 'function')
                    ){
                      cb(transformed)
                    }


                    transform_result_counter++
                  })

                }





              }.bind(this))
            }
            else{//not a function

              /**
              * @todo: 'tabular' not tested, also counter should consider this case (right now only considers functions type)
              **/
              if(type == 'tabular'){
                this.cache.get(cache_key+'.'+type+'.'+this.__transform_name(path), function(err, chart_instance){
                  // chart_instance = (chart_instance) ? JSON.parse(chart_instance) : transform
                  chart_instance = (chart_instance) ? chart_instance : transform

                  chart_instance = Object.merge(chart_instance, transform)
                  // debug_internals('chart_instance NOT FUNC %o', chart_instance)

                  // debug_internals('transformed custom CACHE', cache_key+'.'+type+'.'+path)

                  // throw new Error()
                  convert(d, chart_instance, path, function(name, stat){
                    transformed[type] = this.__merge_transformed(name, stat, transformed[type])
                    // name = name.replace(/\./g, '_')
                    // let to_merge = {}
                    // to_merge[name] = stat
                    //
                    // debug_internals('transformed custom CACHE', cache_key+'.'+type+'.'+path, transformed)

                    // transformed = Object.merge(transformed, to_merge)

                    // chart_instance = this.cache.clean(chart_instance)

                    // instances.push(this.__transform_name(path))


                    instances[this.__transform_name(path)] = chart_instance
                    /**
                    * race condition between this app && ui?
                    **/
                    // this.cache.set(cache_key+'.'+type+'.'+this.__transform_name(path), JSON.stringify(chart_instance), this.CHART_INSTANCE_TTL)


                    if(
                      transform_result_counter == transform_result_length - 1
                      && (counter >= Object.getLength(data) - 1 && typeof cb == 'function')
                    ){
                      /**
                      * race condition between this app && ui?
                      **/
                      // this.__save_instances(cache_key, instances, cb.pass(transformed[type]))
                      cb(transformed[type])
                    }

                    transform_result_counter++

                  }.bind(this))



                }.bind(this))
              }
              else{
                convert(d, transform, path, function(name, stat){
                  transformed[type] = this.__merge_transformed(name, stat, transformed[type])

                  // name = name.replace(/\./g, '_')
                  // let to_merge = {}
                  // to_merge[name] = stat
                  //
                  // debug_internals('transformed custom', type, to_merge)
                  //
                  // transformed = Object.merge(transformed, to_merge)

                  if(counter == Object.getLength(data) - 1 && typeof cb == 'function')
                    cb(transformed)

                }.bind(this))
              }

            }


          }
          else{//default
            if(type == 'tabular'){ //default transform for "tabular"

              // debug_internals('transform default tabular', path)

              let chart = Object.clone(require('./'+type)(d, path))

              this.cache.get(cache_key+'.'+type+'.'+this.__transform_name(path), function(err, chart_instance){
                // chart_instance = (chart_instance) ? JSON.parse(chart_instance) : chart
                chart_instance = (chart_instance) ? chart_instance : chart

                chart_instance = Object.merge(chart, chart_instance)

                // debug_internals('transform default tabular', d, path)


                convert(d, chart_instance, path, function(name, stat){

                  /**
                  * clean stats that couldn't be converted with "data_to_tabular"
                  **/
                  Array.each(stat, function(val, index){
                    Array.each(val, function(row, i_row){
                      if(isNaN(row) && typeof row !== 'string')
                        val[i_row] = undefined
                    })
                    stat[index] = val.clean()
                    if(stat[index].length <= 1)
                      stat[index] = undefined
                  })
                  stat = stat.clean()

                  // debug_internals('transform default tabular', name, stat)

                  if(stat.length > 0)
                    transformed[type] = this.__merge_transformed(name, stat, transformed[type])


                  // name = name.replace(/\./g, '_')
                  // let to_merge = {}
                  // to_merge[name] = stat
                  //
                  // transformed = Object.merge(transformed, to_merge)
                  // debug_internals('default chart_instance CACHE %o', name)

                  // debug_internals('default chart_instance CACHE %o', name, transform_result_counter, transform_result_length)
                  // chart_instance = this.cache.clean(chart_instance)
                  // // debug_internals('transformed func', name, JSON.stringify(chart_instance))
                  // instances.push(this.__transform_name(path))
                  instances[this.__transform_name(path)] = chart_instance

                  /**
                  * race condition between this app && ui?
                  **/
                  // this.cache.set(cache_key+'.'+type+'.'+this.__transform_name(path), JSON.stringify(chart_instance), this.CHART_INSTANCE_TTL)

                  debug_internals('transform default tabular %d', transform_result_counter, transform_result_length, counter, Object.getLength(data), typeof cb == 'function', (
                    transform_result_counter == transform_result_length - 1
                    && (counter >= Object.getLength(data) - 1 && typeof cb == 'function')
                  ))
                  if(
                    transform_result_counter == transform_result_length - 1
                    && (counter >= Object.getLength(data) - 1 && typeof cb == 'function')
                  ){

                    /**
                    * race condition between this app && ui?
                    **/
                    // this.__save_instances(cache_key, instances, cb.pass(transformed[type]))
                    cb(transformed[type])
                  }

                  transform_result_counter++
                }.bind(this))



              }.bind(this))
            }
            else{//default transform for "stat"
              require('./'+type)(d, path, function(name, stat){
                transformed[type] = this.__merge_transformed(name, stat, transformed[type])
                // name = name.replace(/\./g, '_')
                // let to_merge = {}
                // to_merge[name] = stat
                // debug_internals('transformed default', type, to_merge)
                // transformed = Object.merge(transformed, to_merge)

                // debug_internals('transform default', d, path)

                if(counter == Object.getLength(data) - 1 && typeof cb == 'function')
                  cb(transformed)

              }.bind(this))
            }


          }

          // if(counter == Object.getLength(data) - 1 && typeof cb == 'function')
          //   cb(transformed)

        }
        else if(counter == Object.getLength(data) - 1 && typeof cb == 'function'){
            cb(transformed)
        }

      }//end if(d && d !== null)
      else if(counter == Object.getLength(data) - 1 && typeof cb == 'function'){
          cb(transformed)
      }

      counter++
    }.bind(this))


  },
  __save_instances: function(cache_key, instances, cb){
    // debug_internals('__save_instances', instances)

    this.cache.get(cache_key+'.instances', function(err, result){
      if(result){
        // Array.each(instances, function(instance){
        Object.each(instances, function(data, instance){
          if(!result.contains(instance)) result.push(instance)
        })
      }
      else
        result = Object.keys(instances)

      this.cache.set(cache_key+'.instances', result, this.CHART_INSTANCE_TTL, function(err, result){
        debug_internals('__save_instances cache.set', err, result)

        if(!err || err === null)
          this.fireEvent(this.ON_HOST_INSTANCES_UPDATED, {type: 'instances', host: cache_key, instances: instances})

        if(typeof cb == 'function')
          cb()

      }.bind(this))
    }.bind(this))
  },
  __merge_transformed: function(name, stat, merge){
    name = this.__transform_name(name)

    let to_merge = {}
    to_merge[name] = stat
    return Object.merge(merge, to_merge)
  },
  __transform_name: function(name){
    name = name.replace(/\./g, '_')
    name = name.replace(/\%/g, 'percentage_')
    return name
  },
  __traverse_path_require: function(type, path, stat, original_path){
    original_path = original_path || path
    path = path.replace(/_/g, '.')
    original_path = original_path.replace(/_/g, '.')

    // debug_internals('__traverse_path_require %s', path, original_path)
    try{
      let chart = require('./'+type+'/'+path)(stat, original_path)

      return chart
    }
    catch(e){
      if(path.indexOf('.') > -1){
        let pre_path = path.substring(0, path.lastIndexOf('.'))
        return this.__traverse_path_require(type, pre_path, stat, original_path)
      }

      return undefined
    }


    // let path = path.split('.')
    // if(!Array.isArray(path))
    //   path = [path]
    //
    // Array.each()
  },
  // __transform_data: function(type, data, cache_key, cb){
  //   // debug_internals('__transform_data', type)
  //   let convert = (type == 'stat') ? this.data_to_stat : this.data_to_tabular
  //
  //   let transformed = {}
  //   transformed[type] = {}
  //
  //   let counter = 0 //counter for each path:stat in data
  //   // let instances = []
  //   let instances = {}
  //
  //   if(!data || data == null && typeof cb == 'function')
  //     cb(transformed)
  //
  //   /**
  //   * first count how many "transform" there are for this data set, so we can fire callback on last one
  //   **/
  //   let transform_result_length = 0
  //   Object.each(data, function(d, path){
  //     let transform = this.__traverse_path_require(type, path, d)
  //
  //       if(transform && typeof transform == 'function'){
  //         transform_result_length += Object.getLength(transform(d))
  //       }
  //       else if(transform){
  //         transform_result_length++
  //       }
  //   }.bind(this))
  //
  //   let transform_result_counter = 0
  //
  //   Object.each(data, function(d, d_path){
  //
  //     // debug_internals('DATA', d, type)
  //
  //     if(d && d !== null){
  //       if (d[0] && d[0].metadata && d[0].metadata.format && d[0].metadata.format == type){
  //
  //         // if(!d[0].metadata.format[type]){
  //         let formated_data = []
  //         Array.each(d, function(_d){ formated_data.push(_d.data) })
  //         transformed[type] = this.__merge_transformed(this.__transform_name(d_path), formated_data, transformed[type])
  //         // }
  //
  //         if(counter == Object.getLength(data) - 1 && typeof cb == 'function')
  //           cb(transformed)
  //
  //       }
  //       else if (
  //         (d[0] && d[0].metadata && !d[0].metadata.format && type == 'stat')
  //         || (d[0] && !d[0].metadata && type == 'tabular')
  //       ){
  //         let transform = this.__traverse_path_require(type, d_path, d) //for each path find a trasnform or use "default"
  //
  //         if(transform){
  //
  //           if(typeof transform == 'function'){
  //             let transform_result = transform(d, d_path)
  //
  //
  //             Object.each(transform_result, function(chart, path_key){
  //
  //               /**
  //               * key may use "." to create more than one chart (per key), ex: cpus.times | cpus.percentage
  //               **/
  //               let sub_key = (path_key.indexOf('.') > -1) ? path_key.substring(0, path_key.indexOf('.')) : path_key
  //
  //
  //               if(type == 'tabular'){
  //                 // debug_internals('transform_result', transform_result)
  //
  //                 this.cache.get(cache_key+'.'+type+'.'+this.__transform_name(path+'.'+path_key), function(err, chart_instance){
  //                   // chart_instance = (chart_instance) ? JSON.parse(chart_instance) : chart
  //                   chart_instance = (chart_instance) ? chart_instance : chart
  //
  //                   chart_instance = Object.merge(chart, chart_instance)
  //
  //                   // chart_instance = _transform(chart_instance)
  //
  //                   convert(d[sub_key], chart_instance, d_path+'.'+path_key, function(name, stat){
  //                     transformed[type] = this.__merge_transformed(name, stat, transformed[type])
  //                     // name = name.replace(/\./g, '_')
  //                     // let to_merge = {}
  //                     // to_merge[name] = stat
  //                     //
  //                     // transformed = Object.merge(transformed, to_merge)
  //                     //
  //                     // debug_internals('chart_instance CACHE %o', name, transform_result_counter, transform_result_length)
  //
  //
  //                     // chart_instance = this.cache.clean(chart_instance)
  //                     // // debug_internals('transformed func', name, JSON.stringify(chart_instance))
  //                     // instances.push(this.__transform_name(path+'.'+path_key))
  //                     instances[this.__transform_name(d_path+'.'+path_key)] = chart_instance
  //
  //                     /**
  //                     * race condition between this app && ui?
  //                     **/
  //                     // this.cache.set(cache_key+'.'+type+'.'+this.__transform_name(path+'.'+path_key), JSON.stringify(chart_instance), this.CHART_INSTANCE_TTL)
  //
  //                     if(
  //                       transform_result_counter == transform_result_length - 1
  //                       && (counter >= Object.getLength(data) - 1 && typeof cb == 'function')
  //                     ){
  //                       /**
  //                       * race condition between this app && ui?
  //                       **/
  //                       // this.__save_instances(cache_key, instances, cb.pass(transformed[type]))
  //                       cb(transformed[type])
  //                     }
  //
  //                     transform_result_counter++
  //                   }.bind(this))
  //
  //
  //
  //                 }.bind(this))
  //               }
  //               else{
  //                 convert(d[sub_key], chart, d_path+'.'+path_key, function(name, stat){
  //                   transformed[type] = this.__merge_transformed(name, stat, transformed[type])
  //                   // name = name.replace(/\./g, '_')
  //                   // let to_merge = {}
  //                   // to_merge[name] = stat
  //                   //
  //                   // debug_internals('transformed func', name, stat)
  //                   //
  //                   // transformed = Object.merge(transformed, to_merge)
  //
  //                   if(
  //                     transform_result_counter == transform_result_length - 1
  //                     && (counter >= Object.getLength(data) - 1 && typeof cb == 'function')
  //                   ){
  //                     cb(transformed)
  //                   }
  //
  //
  //                   transform_result_counter++
  //                 })
  //
  //               }
  //
  //
  //
  //
  //
  //             }.bind(this))
  //           }
  //           else{//not a function
  //
  //             /**
  //             * @todo: 'tabular' not tested, also counter should consider this case (right now only considers functions type)
  //             **/
  //             if(type == 'tabular'){
  //               this.cache.get(cache_key+'.'+type+'.'+this.__transform_name(d_path), function(err, chart_instance){
  //                 // chart_instance = (chart_instance) ? JSON.parse(chart_instance) : transform
  //                 chart_instance = (chart_instance) ? chart_instance : transform
  //
  //                 chart_instance = Object.merge(chart_instance, transform)
  //                 // debug_internals('chart_instance NOT FUNC %o', chart_instance)
  //
  //                 // debug_internals('transformed custom CACHE', cache_key+'.'+type+'.'+path)
  //
  //                 // throw new Error()
  //                 convert(d, chart_instance, d_path, function(name, stat){
  //                   transformed[type] = this.__merge_transformed(name, stat, transformed[type])
  //                   // name = name.replace(/\./g, '_')
  //                   // let to_merge = {}
  //                   // to_merge[name] = stat
  //                   //
  //                   // debug_internals('transformed custom CACHE', cache_key+'.'+type+'.'+path, transformed)
  //
  //                   // transformed = Object.merge(transformed, to_merge)
  //
  //                   // chart_instance = this.cache.clean(chart_instance)
  //
  //                   // instances.push(this.__transform_name(path))
  //
  //
  //                   instances[this.__transform_name(d_path)] = chart_instance
  //                   /**
  //                   * race condition between this app && ui?
  //                   **/
  //                   // this.cache.set(cache_key+'.'+type+'.'+this.__transform_name(path), JSON.stringify(chart_instance), this.CHART_INSTANCE_TTL)
  //
  //                   if(
  //                     transform_result_counter == transform_result_length - 1
  //                     && (counter >= Object.getLength(data) - 1 && typeof cb == 'function')
  //                   ){
  //                     /**
  //                     * race condition between this app && ui?
  //                     **/
  //                     // this.__save_instances(cache_key, instances, cb.pass(transformed[type]))
  //                     cb(transformed[type])
  //                   }
  //
  //                   transform_result_counter++
  //
  //                 }.bind(this))
  //
  //
  //
  //               }.bind(this))
  //             }
  //             else{
  //               convert(d, transform, d_path, function(name, stat){
  //                 transformed[type] = this.__merge_transformed(name, stat, transformed[type])
  //
  //                 // name = name.replace(/\./g, '_')
  //                 // let to_merge = {}
  //                 // to_merge[name] = stat
  //                 //
  //                 // debug_internals('transformed custom', type, to_merge)
  //                 //
  //                 // transformed = Object.merge(transformed, to_merge)
  //
  //                 if(counter == Object.getLength(data) - 1 && typeof cb == 'function')
  //                   cb(transformed)
  //
  //               }.bind(this))
  //             }
  //
  //           }
  //
  //
  //         }
  //         else{//default
  //           if(type == 'tabular'){ //default trasnform for "tabular"
  //
  //             debug_internals('transform default tabular', d_path)
  //
  //             // let chart = Object.clone(require('./libs/'+type)(d, path))
  //             let chart = Object.clone(require(path.join(process.cwd(), './libs/'+type))(d, d_path))
  //
  //
  //             this.cache.get(cache_key+'.'+type+'.'+this.__transform_name(d_path), function(err, chart_instance){
  //               // chart_instance = (chart_instance) ? JSON.parse(chart_instance) : chart
  //               chart_instance = (chart_instance) ? chart_instance : chart
  //
  //               chart_instance = Object.merge(chart, chart_instance)
  //
  //               // debug_internals('transform default', d, path)
  //
  //               convert(d, chart_instance, d_path, function(name, stat){
  //                 /**
  //                 * clean stats that couldn't be converted with "data_to_tabular"
  //                 **/
  //                 Array.each(stat, function(val, index){
  //                   Array.each(val, function(row, i_row){
  //                     if(isNaN(row))
  //                       val[i_row] = undefined
  //                   })
  //                   stat[index] = val.clean()
  //                   if(stat[index].length <= 1)
  //                     stat[index] = undefined
  //                 })
  //                 stat = stat.clean()
  //
  //                 if(stat.length > 0)
  //                   transformed[type] = this.__merge_transformed(name, stat, transformed[type])
  //
  //                 // name = name.replace(/\./g, '_')
  //                 // let to_merge = {}
  //                 // to_merge[name] = stat
  //                 //
  //                 // transformed = Object.merge(transformed, to_merge)
  //                 // debug_internals('default chart_instance CACHE %o', name)
  //
  //                 // debug_internals('default chart_instance CACHE %o', name, transform_result_counter, transform_result_length)
  //                 // chart_instance = this.cache.clean(chart_instance)
  //                 // // debug_internals('transformed func', name, JSON.stringify(chart_instance))
  //                 // instances.push(this.__transform_name(path))
  //                 instances[this.__transform_name(d_path)] = chart_instance
  //
  //                 /**
  //                 * race condition between this app && ui?
  //                 **/
  //                 // this.cache.set(cache_key+'.'+type+'.'+this.__transform_name(path), JSON.stringify(chart_instance), this.CHART_INSTANCE_TTL)
  //
  //                 if(
  //                   transform_result_counter == transform_result_length - 1
  //                   && (counter >= Object.getLength(data) - 1 && typeof cb == 'function')
  //                 ){
  //                   /**
  //                   * race condition between this app && ui?
  //                   **/
  //                   // this.__save_instances(cache_key, instances, cb.pass(transformed[type]))
  //                   cb(transformed[type])
  //                 }
  //
  //                 transform_result_counter++
  //               }.bind(this))
  //
  //
  //
  //             }.bind(this))
  //           }
  //           else{//default trasnform for "stat"
  //           // require('./libs/'+type)(d, path, function(name, stat){
  //             require(path.join(process.cwd(), './libs/'+type))(d, d_path, function(name, stat){
  //               transformed[type] = this.__merge_transformed(name, stat, transformed[type])
  //               // name = name.replace(/\./g, '_')
  //               // let to_merge = {}
  //               // to_merge[name] = stat
  //               // debug_internals('transformed default', type, to_merge)
  //               // transformed = Object.merge(transformed, to_merge)
  //               debug_internals('transform default', d, d_path)
  //
  //               if(counter == Object.getLength(data) - 1 && typeof cb == 'function')
  //                 cb(transformed)
  //
  //             }.bind(this))
  //           }
  //
  //
  //         }
  //
  //         // if(counter == Object.getLength(data) - 1 && typeof cb == 'function')
  //         //   cb(transformed)
  //
  //       }
  //       else if(counter == Object.getLength(data) - 1 && typeof cb == 'function'){
  //           cb(transformed)
  //       }
  //
  //     }//end if(d && d !== null)
  //     else if(counter == Object.getLength(data) - 1 && typeof cb == 'function'){
  //         cb(transformed)
  //     }
  //
  //     counter++
  //   }.bind(this))
  //
  //
  // },
  // __save_instances: function(cache_key, instances, cb){
  //   // debug_internals('__save_instances', instances)
  //
  //   this.cache.get(cache_key+'.instances', function(err, result){
  //     if(result){
  //       // Array.each(instances, function(instance){
  //       Object.each(instances, function(data, instance){
  //         if(!result.contains(instance)) result.push(instance)
  //       })
  //     }
  //     else
  //       result = Object.keys(instances)
  //
  //     this.cache.set(cache_key+'.instances', result, this.CHART_INSTANCE_TTL, function(err, result){
  //       debug_internals('__save_instances cache.set', err, result)
  //
  //       if(!err || err === null)
  //         this.fireEvent(this.ON_HOST_INSTANCES_UPDATED, {type: 'instances', host: cache_key, instances: instances})
  //
  //       if(typeof cb == 'function')
  //         cb()
  //
  //     }.bind(this))
  //   }.bind(this))
  // },
  // __merge_transformed: function(name, stat, merge){
  //   name = this.__transform_name(name)
  //
  //   let to_merge = {}
  //   to_merge[name] = stat
  //   return Object.merge(merge, to_merge)
  // },
  // __transform_name: function(name){
  //   name = name.replace(/\./g, '_')
  //   name = name.replace(/\%/g, 'percentage_')
  //   return name
  // },
  // __traverse_path_require: function(type, traverse_path, stat, original_path){
  //   original_path = original_path || traverse_path
  //   traverse_path = traverse_path.replace(/_/g, '.')
  //   original_path = original_path.replace(/_/g, '.')
  //
  //   // debug_internals('__traverse_path_require %s', path, original_path)
  //   try{
  //     // let chart = require('./libs/'+type+'/'+path)(stat, original_path)
  //     let chart = require(path.join(process.cwd(), './libs/'+type+'/'+traverse_path))(stat, original_path)
  //
  //     return chart
  //   }
  //   catch(e){
  //     if(traverse_path.indexOf('.') > -1){
  //       let pre_path = traverse_path.substring(0, traverse_path.lastIndexOf('.'))
  //       return this.__traverse_path_require(type, pre_path, stat, original_path)
  //     }
  //
  //     return undefined
  //   }
  //
  //
  //   // let path = path.split('.')
  //   // if(!Array.isArray(path))
  //   //   path = [path]
  //   //
  //   // Array.each()
  // },
  data_to_stat: data_to_stat.bind(this),
  data_to_tabular: data_to_tabular.bind(this),
  /**
  * @end transform data
  **/
})
