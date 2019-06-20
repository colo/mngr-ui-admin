'use strict'

const App = require ( 'node-app-rethinkdb-client/index' )

let debug = require('debug')('mngr-ui-admin:apps:libs:Pipeline:Inputs:Rethinkdb'),
    debug_internals = require('debug')('mngr-ui-admin:apps:libs:Pipeline:Inputs:Rethinkdb:Internals');


const roundMilliseconds = function(timestamp){
  let d = new Date(timestamp)
  d.setMilliseconds(0)

  // console.log('roundMilliseconds', d.getTime())
  return d.getTime()
}

const pluralize = require('pluralize')

const uuidv5 = require('uuid/v5')

module.exports = new Class({
  Extends: App,

  ID: 'b1f06da2-82bd-4c95-8e4e-a5a25075e39b',
  registered: {},
  registered_ids: {},
  feeds: {},
  close_feeds: {},
  changes_buffer: {},
  changes_buffer_expire: {},
  // logs: [],

  FROM: 'periodical',
  RANGES: {
    'periodical': 10000,
    'historical': 60000,

  },
  options: {
    type: undefined,

		requests : {
      once: [
        {
					default: function(req, next, app){
						debug_internals('default', req);
            if(!req.query.register){
              // let distinct_indexes = (req.params && req.params.prop ) ? pluralize(req.params.prop, 1) : app.distinct_indexes
              // if(!Array.isArray(distinct_indexes))
              //   distinct_indexes = [distinct_indexes]
              //
              // debug_internals('property', distinct_indexes);

              let from = req.from || app.FROM
              from = (from === 'minute' || from === 'hour') ? 'historical' : from

              let query = app.r
                .db(app.options.db)
                .table(from)

              query = (req.params.prop && req.params.value)
              ? query
                .getAll(req.params.value , {index: pluralize(req.params.prop, 1)})
              : query

              if(req.query && req.query.transformation)
                query = app.query_with_transformation(query, req.query.transformation)

              query = (req.params.path)
              ? query
                .filter( app.r.row('metadata')('path').eq(req.params.path) )
              : query

              query = query
                .group( app.r.row('metadata')('path') )
                .ungroup()
                .map(
                  function (doc) {
                      return (req.query && req.query.q) ? app.build_default_query_result(doc, req.query) : app.build_default_result(doc)
                  }
                )


              query.run(app.conn, function(err, resp){
                debug_internals('run', err)//resp
                app.process_default(
                  err,
                  resp,
                  {
                    _extras: {
                      from: from,
                      type: (req.params && req.params.path) ? req.params.path : app.options.type,
                      id: req.id,
                      transformation: (req.query.transformation) ? true : false
                      // prop: pluralize(index)
                    }
                  }
                )
              })

            }
					}
				},
        {
					register: function(req, next, app){
						debug_internals('register', req);

            if(req.query.register){
              // let distinct_indexes = (req.params && req.params.prop ) ? pluralize(req.params.prop, 1) : app.distinct_indexes
              // if(!Array.isArray(distinct_indexes))
              //   distinct_indexes = [distinct_indexes]
              //
              // debug_internals('property', distinct_indexes);

              let from = req.from || app.FROM
              from = (from === 'minute' || from === 'hour') ? 'historical' : from

              let query = app.r
                .db(app.options.db)
                .table(from)

              query = (req.params.prop && req.params.value)
              ? query
                .getAll(req.params.value , {index: pluralize(req.params.prop, 1)})
              : query

              if(req.query.register && req.query.register === 'changes')
                query = query.changes({includeTypes: true, squash: 1})

              if(req.query && req.query.transformation)
                query = app.query_with_transformation(query, req.query.transformation)

              query = (req.params.path)
              ? query
                .filter( app.r.row('metadata')('path').eq(req.params.path) )
              : query

              if(!req.query.register || req.query.register !== 'changes')
                query = query
                  .group( app.r.row('metadata')('path') )
                  .ungroup()
                  .map(
                    function (doc) {
                        return (req.query && req.query.q) ? app.build_default_query_result(doc, req.query) : app.build_default_result(doc)
                    }
                  )

              if(req.query.register){
                app.register(query, req)
              }
              else{
                query.run(app.conn, function(err, resp){
                  debug_internals('run', err)//resp
                  app.process_default(
                    err,
                    resp,
                    {
                      _extras: {
                        from: from,
                        type: (req.params && req.params.path) ? req.params.path : app.options.type,
                        id: req.id,
                        transformation: (req.query.transformation) ? true : false
                        // prop: pluralize(index)
                      }
                    }
                  )
                })
              }


            }//req.query.register === true
					}
				},

      ],

      /**
      * periodical data always comes from 'periodical' table
      **/
      periodical: [
      ],

      range: [
        {
					default: function(req, next, app){
						debug_internals('default range', req);

            let start, end
            end = (req.opt && req.opt.range) ? req.opt.range.end : Date.now()
            start  = (req.opt && req.opt.range) ? req.opt.range.start : end - 10000 //10 secs

            let range = 'posix '+start+'-'+end+'/*'

            // let distinct_indexes = (req.params && req.params.prop ) ? pluralize(req.params.prop, 1) : app.distinct_indexes
            // if(!Array.isArray(distinct_indexes))
            //   distinct_indexes = [distinct_indexes]
            //
            // debug_internals('property', distinct_indexes);

            let from = req.from || app.FROM
            from = (from === 'minute' || from === 'hour') ? 'historical' : from

            let index = "timestamp"

            let query = app.r
              .db(app.options.db)
              .table(from)

            index = (req.params.prop && req.params.value)
            ? pluralize(req.params.prop, 1)+'.timestamp'
            : index

            start = (req.params.prop && req.params.value)
            ? [req.params.value, start]
            : start

            end = (req.params.prop && req.params.value)
            ? [req.params.value, end]
            : end

            query = (req.params.path)
            ? query
              .between(
              	start,
              	end,
              	{index: index}
              )
              .filter( app.r.row('metadata')('path').eq(req.params.path) )
            : query
              .between(
              	start,
              	end,
              	{index: index}
              )



            if(req.query && req.query.transformation)
              query = app.query_with_transformation(query, req.query.transformation)

            query
              .group(app.r.row('metadata')('path'))
              .ungroup()
              .map(
                function (doc) {
                    return (req.query && req.query.q) ? app.build_default_query_result(doc, req.query) : app.build_default_result(doc)
                }
            )
            .run(app.conn, function(err, resp){
              debug_internals('run', err) //resp
              app.process_default(
                err,
                resp,
                {
                  _extras: {
                    from: from,
                    type: (req.params && req.params.path) ? req.params.path : app.options.type,
                    id: req.id,
                    Range: range,
                    transformation: (req.query.transformation) ? true : false
                    // prop: pluralize(index)
                  }
                }
              )
            })


					}
				},
      ]

		},

		routes: {

      // distinct: [{
      //   path: ':database/:table',
      //   callbacks: ['distinct']
      // }],
      // distinct: [{
      //   path: ':database/:table',
      //   callbacks: ['distinct']
      // }],
      // nth: [{
      //   path: ':database/:table',
      //   callbacks: ['range']
      // }],
      // changes: [{
      //   // path: ':database/:table',
      //   path: '',
      //   callbacks: ['changes']
      // }],

		},


  },



  initialize: function(options){
    // let paths = []
    // Array.each(options.paths, function(path){
    //   if(this.paths.test(path) == true)
    //     paths.push(path)
    // }.bind(this))
    //
    // options.paths = paths

  	this.parent(options);//override default options


    // this.addEvent('onConnect', this.register_on_changes.bind(this))
    // this.register_on_changes.bind(this)

		this.profile('mngr-ui-admin:apps:libs:Pipeline:Inputs:Rethinkdb_init');//start profiling


		this.profile('mngr-ui-admin:apps:libs:Pipeline:Inputs:Rethinkdb_init');//end profiling

		this.log('mngr-ui-admin:apps:libs:Pipeline:Inputs:Rethinkdb', 'info', 'mngr-ui-admin:apps:libs:Pipeline:Inputs:Rethinkdb started');
  },
  query_with_transformation: function(query, transformation){
    let _query_transform, _query_transform_value

    if(transformation){
      if(typeof transformation === 'string'){
        _query_transform = transformation.split(':')[0]
        _query_transform_value = transformation.split(':').slice(1)
      }
      else{
        _query_transform = Object.keys(transformation)[0]
        _query_transform_value = transformation[_query_transform]
      }
      switch(_query_transform){
        case 'sample':
          query = query.sample(_query_transform_value[0] * 1)
          break;

        case 'limit':
          query = query.limit(_query_transform_value[0] * 1)
          break;

        case 'skip':
          query = query.skip(_query_transform_value[0] * 1)
          break;

        case 'slice':
          query = query.slice(_query_transform_value[0] * 1, _query_transform_value[1] * 1, _query_transform_value[2])
          break;
      }
    }

    return query
  },
  build_default_result: function(doc){
    let self = this
    return {
      path: doc('group'),
      hosts: doc('reduction').filter(function (doc) {
        return doc('metadata').hasFields('host');
      }).map(function(doc) {
        return self.r.object(doc('metadata')('host'), true) // return { <country>: true}
      }).reduce(function(left, right) {
          return left.merge(right)
      }).default({}).keys(),
      types: doc('reduction').filter(function (doc) {
        return doc('metadata').hasFields('type');
      }).map(function(doc) {
        return self.r.object(doc('metadata')('type'), true) // return { <country>: true}
      }).reduce(function(left, right) {
          return left.merge(right)
      }).default({}).keys(),
      tags: doc('reduction').filter(function (doc) {
        return doc('metadata').hasFields('tag');
      }).concatMap(function(doc) {
        return doc('metadata')('tag')
      }).distinct(),
      range: [
        doc('reduction').min(
          function (set) {
              return set('metadata')('timestamp')
          }
        )('metadata')('timestamp'),
        doc('reduction').max(
          function (set) {
              return set('metadata')('timestamp')
          }
        )('metadata')('timestamp'),
      ]
    }
  },
  build_default_query_result: function(doc, query){
    debug_internals('build_default_query_result %o', query)

    let self = this
    let r_query = doc('reduction')

    let query_with_fields = {}


    let _return_obj = {
      path: doc('group')
    }

    // if(query.q)
      // _return_obj = this.build_query_fields(_return_obj, query)

    // if(typeof query.q === 'string'){
    //   if(query.fields){
    //
    //     try{
    //       query.fields = JSON.parse(query.fields)
    //     }
    //     catch(e){
    //
    //     }
    //     query_with_fields[query.q] = query.fields
    //   }
    //
    //   debug_internals('build_default_query_result %o', query, query_with_fields)
    //
    //   r_query = (query.fields)
    //   ? r_query.withFields(query_with_fields)(query.q)
    //   : r_query.withFields(query.q)(query.q)
    //
    //   _return_obj[query.q] = r_query
    // }
    // else{
    //   // _return_obj['docs'] = r_query.pluck(this.r.args(query.q))
    //   _return_obj = r_query.pluck(this.r.args(query.q))
    // }
    if(typeof query.q === 'string'){

      _return_obj[query.q] = this.build_query_fields(r_query, query)
    }
    else{
      // _return_obj['docs'] = r_query.pluck(this.r.args(query.q))
      _return_obj = this.build_query_fields(r_query, query)
    }





    return _return_obj
  },
  build_query_fields: function(r_query, query){
    if(typeof query.q === 'string'){
      if(query.fields){

        try{
          query.fields = JSON.parse(query.fields)
        }
        catch(e){

        }
        query_with_fields[query.q] = query.fields
      }

      debug_internals('build_default_query_result %o', query, query_with_fields)

      r_query = (query.fields)
      ? r_query.withFields(query_with_fields)(query.q)
      : r_query.withFields(query.q)(query.q)

      // _return_obj[query.q] = r_query
    }
    else{
      // _return_obj['docs'] = r_query.pluck(this.r.args(query.q))
      // _return_obj = r_query.pluck(this.r.args(query.q))
      r_query = r_query.pluck(this.r.args(query.q))
    }

    return r_query
  },
  process_default: function(err, resp, params){
    debug_internals('process_default', err, params)

    let extras = params._extras
    let type = extras.type
    let id = extras.id
    let transformation = extras.transformation

    delete extras.type

    if(err){
      debug_internals('process_default err', err)

			// if(params.uri != ''){
			// 	this.fireEvent('on'+params.uri.charAt(0).toUpperCase() + params.uri.slice(1)+'Error', err);//capitalize first letter
			// }
			// else{
				this.fireEvent('onGetError', err);
			// }

			// this.fireEvent(this.ON_DOC_ERROR, [err, extras]);

			this.fireEvent(
				this[
					'ON_'+this.options.requests.current.type.toUpperCase()+'_DOC_ERROR'
				],
				[err, extras]
			);
    }

    if(!err && Array.isArray(resp) && resp.length === 0)
      err = {
        status: 404,
        message: 'Not Found'
      }

    extras[type] = (type === 'all') ? resp : (Array.isArray(resp)) ? resp[0]: resp
    if(transformation && type === 'all')
      extras[type] = extras[type][0]

    delete extras.prop
    delete extras.type


    if(err){
      this.fireEvent(this.ON_DOC_ERROR, [err, extras]);
    }
    else{

      this.fireEvent(this.ON_DOC, [extras, Object.merge({input_type: this, app: null})]);
    }



  },
  register: function(query, req){
    debug_internals('register %o %O', query, req)
    let {id} = req
    delete req.id

    let uuid = uuidv5(JSON.stringify(req), this.ID)

    debug_internals('register uuid %s', uuid)

    if(!this.registered[uuid]) this.registered[uuid] = query
    if(!this.registered_ids[uuid]) this.registered_ids[uuid] = []
    this.registered_ids[uuid].combine([id])


    // if(!this.registered[host][prop]) this.registered[host][prop] = []
    // this.registered[host][prop].push(id)

    if(!this.feeds[uuid]){
      debug_internals('registered %o %o', this.registered, this.registered_ids, req.query.q)

      // this.addEvent('onSuspend', this.__close_changes.pass(uuid, this))


      if(!this.changes_buffer[uuid]) this.changes_buffer[uuid] = []

      if(!this.changes_buffer_expire[uuid]) this.changes_buffer_expire[uuid] = Date.now()

      if(req.query.q && typeof req.query.q !== 'string')
        query = this.build_query_fields(query, {q: [{new_val: req.query.q }, 'type']})

      query
        // .group( this.r.row('metadata')('path') )
        // .ungroup()
        // .map(
        //   function (doc) {
        //       return (req.query && req.query.q) ? self.build_default_query_result(doc, req.query) : self.build_default_result(doc)
        //   }.bind(this)
        // )
        // .pluck({'new_val': this.r.args(req.query.q)})
        // .withFields({'new_val': ['data', 'metadata']})
        .run(this.conn, {maxBatchSeconds: 1, includeTypes: true}, function(err, cursor) {

        debug_internals('registered %o %o', err, cursor)
        if(err){

        }
        else{
          this.feeds[uuid] = cursor

          // cursor.on("data", function(message) {
          //   debug_internals('changes %s', new Date(), message)
          // })

          this.feeds[uuid].each(function(err, row){
            // debug_internals('changes %s', new Date(), err, row)

            /**
            * https://www.rethinkdb.com/api/javascript/each/
            * Iteration can be stopped prematurely by returning false from the callback.
            */
            if(this.close_feeds[uuid] === true){ this.close_feeds[uuid] = false; this.feeds[uuid] = undefined; return false }

            // debug_internals('changes %s', new Date())
            if(row && row !== null ){
              if(row.type == 'add'){
                // debug_internals('changes add %s %o', new Date(), row.new_val)
                // debug_internals("changes add now: %s \n timstamp: %s \n expire: %s \n host: %s \n path: %s",
                //   new Date(roundMilliseconds(Date.now())),
                //   new Date(roundMilliseconds(row.new_val.metadata.timestamp)),
                //   new Date(roundMilliseconds(this.changes_buffer_expire[host])),
                //   row.new_val.metadata.host,
                //   row.new_val.metadata.path
                // )

                this.changes_buffer[uuid].push(row.new_val)
              }

              if(this.changes_buffer_expire[uuid] < Date.now() - 900 && this.changes_buffer[uuid].length > 0){
                // console.log('onPeriodicalDoc', this.changes_buffer.length)

                // this.__process_changes(this.changes_buffer[uuid])

                debug_internals('changes %s', new Date(), this.changes_buffer[uuid])

                this.changes_buffer_expire[uuid] = Date.now()
                this.changes_buffer[uuid] = []


              }

            }


          }.bind(this))

        }


      }.bind(this))

    }


  },
  // changes: function(err, resp, params){
  //   debug_internals('changes %o %o %o %s', err, resp, params, new Date())
  //
  //   let _close = function(){
  //     resp.close()
  //     this.removeEvent('onSuspend', _close)
  //   }.bind(this)
  //
  //   this.addEvent('onSuspend', _close)
  //
  //   if(!this.changes_buffer_expire)
  //     this.changes_buffer_expire = Date.now()
  //
  //   let extras = params.options._extras
  //
  //   resp.each(function(err, row){
  //
  //     debug_internals('changes %s', new Date(), row)
  //
  //     if(row.type == 'add'){
  //       // console.log(row.new_val)
  //       // this.fireEvent('onPeriodicalDoc', [row.new_val, {type: 'periodical', input_type: this, app: null}]);
  //       if(!this.changes_buffer.contains(row.new_val.metadata.tag))
  //         this.changes_buffer.push(row.new_val.metadata.tag)
  //     }
  //
  //     if(this.changes_buffer_expire < Date.now() - 900 && this.changes_buffer.length > 0){
  //       // console.log('onPeriodicalDoc', this.changes_buffer.length)
  //       // this.fireEvent('onPeriodicalDoc', [Array.clone(this.changes_buffer), {type: 'periodical', input_type: this, app: null}])
  //       this.fireEvent('onDoc', [Array.clone(this.changes_buffer), Object.merge({input_type: this, app: null}, Object.clone(extras))]);
  //       this.changes_buffer_expire = Date.now()
  //       this.changes_buffer = []
  //     }
  //
  //   }.bind(this));
  // },
  // register_on_changes: function(){
  //   debug_internals('register_on_changes')
  //   /**
  //   * @hardcoded: sqash: 1.1 => "sqash all changes between a 1100 ms"
  //   * should be "aligned" with dashboard refreshs?
  //   **/
  //   this.changes({
  //      _extras: {type: 'tags', id: undefined},
  //      // uri: this.options.db+'/periodical',
  //      args: {includeTypes: true, squash: 1.1},
  //      // query: this.r.db(this.options.db).table('periodical').distinct({index: 'tag'})
  //      query: this.r.db(this.options.db).
  //       table('periodical').
  //       pluck({'metadata': 'tag'})
  //
  //
  //   })
  //   // app.between({
  //   //   _extras: 'tag',
  //   //   uri: app.options.db+'/periodical',
  //   //   args: [
  //   //     roundMilliseconds(Date.now() - 1000),
  //   //     roundMilliseconds(Date.now()),
  //   //     {
  //   //       index: 'timestamp',
  //   //       leftBound: 'open',
  //   //       rightBound: 'open'
  //   //     }
  //   //   ]
  //   // })
  //
  // }



});
