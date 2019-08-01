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
  periodicals: {},

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
            req = (req) ? Object.clone(req) : {}
            if(!req.query || (!req.query.register && !req.query.unregister)){
              debug_internals('default %o %o', req, req.params.value);

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

              // query = (req.params.prop && req.params.value)
              // ? query
              //   .getAll(app.r.args(req.params.value) , {index: pluralize(req.params.prop, 1)})
              // : query
              if(req.params.prop && req.params.value){
                if(!Array.isArray(req.params.value))
                  try{
                    req.params.value = JSON.parse(req.params.value)
                  }
                  catch(e){
                    req.params.value = [req.params.value]
                  }

                query = query.getAll(app.r.args(req.params.value) , {index: pluralize(req.params.prop, 1)})
              }

              if(req.query && req.query.transformation)
                query = app.query_with_transformation(query, req.query.transformation)

              query = (req.params.path)
              ? query
                .filter( app.r.row('metadata')('path').eq(req.params.path) )
              : query

              if (req.query && req.query.aggregation && !req.query.q) {
                query =  this.result_with_aggregation(query, req.query.aggregation)
              }
              else{
                query = query
                  .group( app.r.row('metadata')('path') )
                  .ungroup()
                  .map(
                    function (doc) {
                        return (req.query && req.query.q) ? app.build_default_query_result(doc, req.query) : app.build_default_result(doc)
                    }
                )
              }

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
                      transformation: (req.query.transformation) ? req.query.transformation : undefined,
                      aggregation: (req.query.aggregation) ? req.query.aggregation : undefined
                      // prop: pluralize(index)
                    }
                  }
                )
              })

            } //req.query.register === false
					}
				},

        {
					register: function(req, next, app){
            req = (req) ? Object.clone(req) : {}

            if(req.query.register || req.query.unregister){
              debug_internals('register', req);
              req.params = req.params || {}

              let from = req.from || app.FROM
              from = (from === 'minute' || from === 'hour') ? 'historical' : from

              let query
              let params = {
                _extras: {
                  from: from,
                  type: (req.params && req.params.path) ? req.params.path : app.options.type,
                  id: req.id,
                  transformation: (req.query.transformation) ? req.query.transformation : undefined,
                  aggregation: (req.query.aggregation) ? req.query.aggregation : undefined
                  // prop: pluralize(index)
                }
              }

              if(req.query.register){
                query = app.r
                  .db(app.options.db)
                  .table(from)

                // query = (req.params.prop && req.params.value)
                // ? query
                //   .getAll(req.params.value , {index: pluralize(req.params.prop, 1)})
                // : query
                if(req.params.prop && req.params.value){
                  if(!Array.isArray(req.params.value))
                    try{
                      req.params.value = JSON.parse(req.params.value)
                    }
                    catch(e){
                      req.params.value = [req.params.value]
                    }

                  query = query.getAll(app.r.args(req.params.value) , {index: pluralize(req.params.prop, 1)})
                }

                /**
                * changes (feed)
                **/
                if(req.query.register === 'changes')
                  query = query.changes({includeTypes: true, squash: 1})

                if(req.query && req.query.transformation)
                  query = app.query_with_transformation(query, req.query.transformation)

                query = (req.params.path)
                ? query
                  .filter( app.r.row('metadata')('path').eq(req.params.path) )
                : query

                /**
                * changes (feed)
                **/
                if(req.query.register === 'changes' && req.query.q && typeof req.query.q !== 'string'){
                  debug_internals('register query.q', req.query);
                  query = this.build_query_fields(query, {q: [{new_val: req.query.q }, 'type']})
                }


                /**
                * periodical
                **/
                if (req.query.register === 'periodical' && req.query.aggregation && !req.query.q) {
                  query =  this.result_with_aggregation(query, req.query.aggregation)
                }
                else if(req.query.register === 'periodical'){
                  query = query
                    .group( app.r.row('metadata')('path') )
                    .ungroup()
                    .map(
                      function (doc) {
                          return (req.query && req.query.q) ? app.build_default_query_result(doc, req.query) : app.build_default_result(doc)
                      }
                  )
                }


                app.register(
                  query,
                  req,
                  params
                )
              }
              else{

                app.unregister(
                  req,
                  params
                )
              }

            }//req.query.register === true
					}
				},

      ],

      /**
      * periodical data always comes from 'periodical' table
      **/
      periodical: [
        {
					default: function(req, next, app){
            req = (req) ? Object.clone(req) : {}
            debug_internals('periodical default %s', new Date());

            // if(!req.query || (!req.query.register && !req.query.unregister)){
            if(Object.getLength(app.periodicals) > 0){
              // debug_internals('periodical default %O', app.periodicals);

              Object.each(app.periodicals, function(req, uuid){
                Object.each(req, function(periodical, id){
                  let {query, params} = periodical
                  debug_internals('periodical default %s %O', id, periodical);
                  // req.id = id
                  query.run(app.conn, function(err, resp){
                    debug_internals('periodical default run', err, resp)//resp
                    app.process_default(
                      err,
                      resp,
                      params
                    )
                  })
                }.bind(this))
              }.bind(this))
              // let from = req.from || app.FROM
              // from = (from === 'minute' || from === 'hour') ? 'historical' : from
              //
              // let query = app.r
              //   .db(app.options.db)
              //   .table(from)
              //
              // query = (req.params.prop && req.params.value)
              // ? query
              //   .getAll(req.params.value , {index: pluralize(req.params.prop, 1)})
              // : query
              //
              //
              // if(req.query && req.query.transformation)
              //   query = app.query_with_transformation(query, req.query.transformation)
              //
              // query = (req.params.path)
              // ? query
              //   .filter( app.r.row('metadata')('path').eq(req.params.path) )
              // : query
              //
              // if (req.query && req.query.aggregation && !req.query.q) {
              //   query =  this.result_with_aggregation(query, req.query.aggregation)
              // }
              // else{
              //   query = query
              //     .group( app.r.row('metadata')('path') )
              //     .ungroup()
              //     .map(
              //       function (doc) {
              //           return (req.query && req.query.q) ? app.build_default_query_result(doc, req.query) : app.build_default_result(doc)
              //       }
              //   )
              // }
              //
              // query.run(app.conn, function(err, resp){
              //   debug_internals('run', err)//resp
              //   app.process_default(
              //     err,
              //     resp,
              //     {
              //       _extras: {
              //         from: from,
              //         type: (req.params && req.params.path) ? req.params.path : app.options.type,
              //         id: req.id,
              //         transformation: (req.query.transformation) ? req.query.transformation : undefined,
              //         aggregation: (req.query.aggregation) ? req.query.aggregation : undefined
              //         // prop: pluralize(index)
              //       }
              //     }
              //   )
              // })

            } //req.query.register === false
					}
				},
      ],

      range: [
        {
					default: function(req, next, app){
            req = (req) ? Object.clone(req) : {}

						debug_internals('default range', req);
            if(!req.query || (!req.query.register && !req.query.unregister)){

              let start, end
              end = (req.opt && req.opt.range) ? req.opt.range.end : Date.now()
              start  = (req.opt && req.opt.range) ? req.opt.range.start : end - 10000 //10 secs

              let range = 'posix '+start+'-'+end+'/*'


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

              if (req.query && req.query.aggregation && !req.query.q) {
                query =  this.result_with_aggregation(query, req.query.aggregation)
              }
              else{
                query = query
                  .group(app.r.row('metadata')('path'))
                  .ungroup()
                  .map(
                    function (doc) {
                        return (req.query && req.query.q) ? app.build_default_query_result(doc, req.query) : app.build_default_result(doc)
                    }
                )
              }

              query.run(app.conn, function(err, resp){
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
                      range: req.opt.range,
                      transformation: (req.query.transformation) ? req.query.transformation : undefined,
                      aggregation: (req.query.aggregation) ? req.query.aggregation : undefined
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
            req = (req) ? Object.clone(req) : {}

            if(req.query.register || req.query.unregister){
              debug_internals('range register', req);
              req.params = req.params || {}

              let start, end
              end = (req.opt && req.opt.range) ? req.opt.range.end : Date.now()
              start  = (req.opt && req.opt.range) ? req.opt.range.start : end - 10000 //10 secs

              let range = 'posix '+start+'-'+end+'/*'


              let from = req.from || app.FROM
              from = (from === 'minute' || from === 'hour') ? 'historical' : from

              let index = "timestamp"


              let query
              // let params = {
              //   _extras: {
              //     from: from,
              //     type: (req.params && req.params.path) ? req.params.path : app.options.type,
              //     id: req.id,
              //     transformation: (req.query.transformation) ? req.query.transformation : undefined,
              //     aggregation: (req.query.aggregation) ? req.query.aggregation : undefined
              //     // prop: pluralize(index)
              //   }
              // }
              let params = {
                _extras: {
                  from: from,
                  type: (req.params && req.params.path) ? req.params.path : app.options.type,
                  id: req.id,
                  Range: range,
                  range: req.opt.range,
                  transformation: (req.query.transformation) ? req.query.transformation : undefined,
                  aggregation: (req.query.aggregation) ? req.query.aggregation : undefined
                  // prop: pluralize(index)
                }
              }

              if(req.query.register){
                query = app.r
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

                /**
                * changes (feed)
                **/
                if(req.query.register === 'changes')
                  query = query.changes({includeTypes: true, squash: 1})

                if(req.query && req.query.transformation)
                  query = app.query_with_transformation(query, req.query.transformation)

                query = (req.params.path)
                ? query
                  .filter( app.r.row('metadata')('path').eq(req.params.path) )
                : query

                /**
                * changes (feed)
                **/
                if(req.query.register === 'changes' && req.query.q && typeof req.query.q !== 'string'){
                  debug_internals('register query.q', req.query);
                  query = this.build_query_fields(query, {q: [{new_val: req.query.q }, 'type']})
                }


                /**
                * periodical
                **/
                if (req.query.register === 'periodical' && req.query.aggregation && !req.query.q) {
                  query =  this.result_with_aggregation(query, req.query.aggregation)
                }
                else if(req.query.register === 'periodical'){
                  query = query
                    .group( app.r.row('metadata')('path') )
                    .ungroup()
                    .map(
                      function (doc) {
                          return (req.query && req.query.q) ? app.build_default_query_result(doc, req.query) : app.build_default_result(doc)
                      }
                  )
                }


                app.register(
                  query,
                  req,
                  params
                )
              }
              else{

                app.unregister(
                  req,
                  params
                )
              }

            }//req.query.register === true
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
  result_with_aggregation: function(query, aggregation){

    let _query_aggregation, _query_aggregation_value

    if(aggregation){
      if(typeof aggregation === 'string'){
        _query_aggregation = aggregation.split(':')[0]
        _query_aggregation_value = aggregation.split(':').slice(1)
      }
      else{
        _query_aggregation = Object.keys(aggregation)[0]
        _query_aggregation_value = aggregation[_query_aggregation]
      }

      debug_internals('result_with_aggregation %o', aggregation, _query_aggregation, _query_aggregation_value)

      /**
      * for "contains"
      * ex:
      * "aggregation":{
    	*	"contains": ["('data')('status')", 500]
    	* }
      **/
      let _query_aggregation_param
      if(Array.isArray(_query_aggregation_value)){
        _query_aggregation_param = _query_aggregation_value[1]
        _query_aggregation_value = _query_aggregation_value[0]
      }

      if(_query_aggregation_value)
        query = query
        .map(
          function (doc) {
            return eval( "doc"+_query_aggregation_value );
          }.bind(this)
        )

      switch(_query_aggregation){
        case 'count':
          query = query.count()
          break;

        case 'min':
          query = query.min()
          break;

        case 'max':
          query = query.max()
          break;

        case 'sum':
          query = query.sum()
          break;

        case 'avg':
          query = query.avg()
          break;

        case 'distinct':
          query = query.distinct()
          break;

        case 'contains':
          query = query.contains(_query_aggregation_param)
          break;
      }
    }

    // if(typeof query.q === 'string'){
    //   let query_with_fields = {}
    //
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
    //   // _return_obj[query.q] = r_query
    // }
    // else{
    //   // _return_obj['docs'] = r_query.pluck(this.r.args(query.q))
    //   // _return_obj = r_query.pluck(this.r.args(query.q))
    //   r_query = r_query.pluck(this.r.args(query.q))
    // }

    return query
  },
  build_default_result: function(doc){
    let self = this
    return {
      path: doc('group'),
      count: doc('reduction').count(),
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

    if(query && query.filter){
      debug_internals('build_default_query_result FILTER', query.filter)
      // r_query = r_query.filter(function(doc){ return doc('data')('status').eq(301) })
      r_query = r_query.filter(function(doc){ return eval( "doc"+query.filter ) })

    }

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
      if(query.aggregation){
        _return_obj[query.q] = this.result_with_aggregation(this.build_query_fields(r_query, query), query.aggregation)
      }
      else{
        _return_obj[query.q] = this.build_query_fields(r_query, query)
      }

    }
    else{
      // _return_obj['docs'] = r_query.pluck(this.r.args(query.q))
      if(query.aggregation){
        _return_obj = this.result_with_aggregation(this.build_query_fields(r_query, query), query.aggregation)
      }
      else{
        _return_obj = this.build_query_fields(r_query, query)
      }
    }


    // if(query.aggregation){
    //
    // }


    return _return_obj
  },
  build_query_fields: function(r_query, query){
    if(typeof query.q === 'string'){
      let query_with_fields = {}

      if(query.fields){

        try{
          query.fields = JSON.parse(query.fields)
        }
        catch(e){

        }
        query_with_fields[query.q] = query.fields
      }

      debug_internals('build_query_fields %o', query, query_with_fields)

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
    params = (params) ? Object.clone(params) : {}
    debug_internals('process_default', err, params)

    let extras = params._extras
    let type = extras.type
    let id = extras.id
    let transformation = extras.transformation
    let aggregation = extras.aggregation

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

    if(Array.isArray(resp))
      debug_internals('ARRAY RESP', resp)

    extras[type] = (Array.isArray(resp)) ? resp[0] : resp
    // extras[type] = (type === 'all') ? resp : (Array.isArray(resp)) ? resp[0]: resp
    // if(transformation && type === 'all')
    //   extras[type] = extras[type][0]

    // if(transformation && type === 'all')
    //   extras[type] = extras[type][0]

    delete extras.prop
    delete extras.type


    if(err){
      this.fireEvent(this.ON_DOC_ERROR, [err, extras]);
    }
    else{

      this.fireEvent(this.ON_DOC, [extras, Object.merge({input_type: this, app: null})]);
    }



  },
  __clean_registered_id: function(uuid, id, all_matching){
    debug_internals('__clean_registered_id uuid %s', uuid, id,all_matching)

    if(this.registered_ids[uuid]){
      if(all_matching){

        let _registered_ids = Array.clone(this.registered_ids[uuid])

        Array.each(_registered_ids, function(reg_id, index){
          debug_internals('PRE __clean_registered_id ', reg_id, index)

          if(reg_id.indexOf(id) === 0){
            debug_internals('__clean_registered_id TRUE', reg_id, index)
            this.registered_ids[uuid].splice(index, 1)
          }

        }.bind(this))


        this.registered_ids[uuid] = this.registered_ids[uuid].clean()
      }
      else{
        this.registered_ids[uuid] = this.registered_ids[uuid].erase(id)
      }

      if(this.registered_ids[uuid].length === 0){
        delete this.registered_ids[uuid]
        // this.close_feeds[uuid] = true

        if(this.periodicals[uuid]) delete this.periodicals[uuid]

        if(this.feeds[uuid])
          this.feeds[uuid].close(function (err) {
            // this.close_feeds[uuid] = true
            delete this.feeds[uuid]
            delete this.changes_buffer[uuid]
            delete this.changes_buffer_expire[uuid]

            if (err){
              debug_internals('err closing cursor onSuspend', err)
            }
          }.bind(this))
      }
    }



    debug_internals('__clean_registered_id uuid', uuid, id, this.registered_ids, this.periodicals )
  },
  unregister: function(req, params){
    debug_internals('UNregister %O', req)
    let {id} = req
    delete req.id

    if(req.query.unregister === true || req.query.unregister === '*'){
      let _registered_ids= Object.clone(this.registered_ids)
      Object.each(_registered_ids, function(ids, uuid){
        this.__clean_registered_id(uuid, id, true)
        // if(ids.contains(id)) this.registered_ids[uuid] = this.registered_ids[uuid].erase(id)
      }.bind(this))
    }
    else{
      /**
      * swap unregister => register so you get the same uuid
      */
      req.query.register = req.query.unregister
      delete req.query.unregister

      let uuid = uuidv5(JSON.stringify(req), this.ID)

      this.__clean_registered_id(uuid, id)

    }

  },
  register: function(query, req, params){
    params = (params) ? Object.clone(params) : {}
    debug_internals('register %o %O', query, req, params)
    let {id} = req
    delete req.id

    /**
    * delete and re add to ensure "register" es the last property on query (to match unregister uuid)
    **/
    let register = req.query.register
    delete req.query.register
    req.query.register = register


    let uuid = uuidv5(JSON.stringify(req), this.ID)

    debug_internals('register uuid %s', uuid)

    // if(!this.registered[uuid]) this.registered[uuid] = query
    if(!this.registered_ids[uuid]) this.registered_ids[uuid] = []
    this.registered_ids[uuid].combine([id])


    // if(!this.registered[host][prop]) this.registered[host][prop] = []
    // this.registered[host][prop].push(id)
    if(req.query.register === 'periodical'){
      if(!this.periodicals[uuid]) this.periodicals[uuid] = {}
      this.periodicals[uuid][id] = {query, params}
      // this.periodicals[uuid].push({query, params})
    }
    else if(req.query.register === 'changes' && !this.feeds[uuid]){
      debug_internals('registered %o %o', this.registered, this.registered_ids, req.query.q)

      // this.addEvent('onSuspend', this.__close_changes.pass(uuid, this))


      if(!this.changes_buffer[uuid]) this.changes_buffer[uuid] = []

      if(!this.changes_buffer_expire[uuid]) this.changes_buffer_expire[uuid] = Date.now()


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

                this.process_default(err, this.changes_buffer[uuid], params)

                // debug_internals('changes %s', new Date(), this.changes_buffer[uuid])

                this.changes_buffer_expire[uuid] = Date.now()
                this.changes_buffer[uuid] = []


              }

            }


          }.bind(this))

        }


      }.bind(this))

    }


  },
  // __process_changes: function(buffer){
  //   debug_internals('__process_changes %s', new Date(), buffer)
  //   // let data = {}
  //   // Array.each(buffer, function(doc){
  //   //   let path = doc.metadata.path
  //   //   let host = doc.metadata.host
  //   //
  //   //   if(!data[host]) data[host] = {}
  //   //   if(!data[host][path]) data[host][path] = []
  //   //   data[host][path].push(doc)
  //   //
  //   // }.bind(this))
  //   //
  //   // Object.each(data, function(host_data, host){
  //   //   // debug_internals('changes emiting %o', host, host_data)
  //   //   // let doc = {}
  //   //   // doc[host] = host_data
  //   //   // this.fireEvent('onDoc', [doc, Object.merge(
  //   //   //   {input_type: this, app: null},
  //   //   //   // {host: host, type: 'host', prop: prop, id: id}
  //   //   //   // {type: prop, host: host}
  //   //   // )])
  //   //   this.fireEvent('onDoc', [{ data : host_data }, Object.merge(
  //   //     {input_type: this, app: null},
  //   //     // {host: host, type: 'host', prop: prop, id: id}
  //   //     {type: 'data', host: host}
  //   //   )])
  //   //
  //   // }.bind(this))
  // },



});
