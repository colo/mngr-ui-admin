'use strict'

const App = require('js-pipeline.input.rethinkdb-rest')
// const App = require ( 'node-app-rethinkdb-client/index' )

let debug = require('debug')('mngr-ui-admin:apps:libs:Pipeline:Inputs:Rethinkdb'),
    debug_internals = require('debug')('mngr-ui-admin:apps:libs:Pipeline:Inputs:Rethinkdb:Internals');


const roundMilliseconds = function(timestamp){
  let d = new Date(timestamp)
  d.setMilliseconds(0)

  // console.log('roundMilliseconds', d.getTime())
  return d.getTime()
}

const pluralize = require('pluralize')


module.exports = new Class({
  Extends: App,

  ID: 'b1f06da2-82bd-4c95-8e4e-a5a25075e39b',

  options: {
    db: undefined,
    table: undefined,
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

              let from = req.from || app.options.table


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

              /**
              * orderBy need to be called before filters (its order table), other trasnform like "slice" are run after "filters"
              **/
              let transformation = (req.query && req.query.transformation) ? req.query.transformation : undefined
              if(
                transformation
                && (transformation.orderBy
                  || (Array.isArray(transformation) && transformation.some(function(trasnform){ return Object.keys(trasnform)[0] === 'orderBy'}))
                )
              ){
                let orderBy = (transformation.orderBy) ? transformation.orderBy : transformation.filter(function(trasnform){ return Object.keys(trasnform)[0] === 'orderBy' })[0]//one orderBy
                query = app.query_with_transformation(query, orderBy)

                if(Array.isArray(transformation)){
                  transformation = Array.clone(transformation)
                  transformation.each(function(trasnform, index){
                    if(Object.keys(trasnform)[0] === 'orderBy')
                      transformation[index] = undefined
                  })

                  transformation = transformation.clean()
                }


              }

              if(req.query && req.query.filter)
                query = app.query_with_filter(query, req.query.filter)

              if(transformation)
                query = app.query_with_transformation(query, transformation)
              /**
              * orderBy need to be called before filters (its order table), other trasnform like "slice" are run after "filters"
              **/

              // debug('WITH PATH', req.params.path)
              // query = (req.params.path)
              // ? query
              //   .filter( app.r.row('metadata')('path').eq(req.params.path) )
              // : query

              let _result_callback = function(err, resp){
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
                      aggregation: (req.query.aggregation) ? req.query.aggregation : undefined,
                      filter: (req.query.filter) ? req.query.filter : undefined
                      // prop: pluralize(index)
                    }
                  }
                )
              }

              if (req.query && req.query.aggregation && !req.query.q) {
                query =  this.result_with_aggregation(query, req.query.aggregation)

                query.run(app.conn, {arrayLimit: 1000000}, _result_callback)
              }
              else{
                if(req.query && req.query.q){
                  query = query
                    .group( app.r.row('metadata')('path') )
                    // .group( {index:'path'} )
                    .ungroup()
                    .map(
                      function (doc) {
                        return app.build_default_query_result(doc, req.query)
                      }
                    )
                    .run(app.conn, {arrayLimit: 1000000}, _result_callback)

                }
                else{
                  app.build_default_result(query, _result_callback)
                }


                // query = query
                //   .group( app.r.row('metadata')('path') )
                //   // .group( {index:'path'} )
                //   .ungroup()
                //   .map(
                //     function (doc) {
                //         return (req.query && req.query.q) ? app.build_default_query_result(doc, req.query) : app.build_default_result(doc)
                //     }
                //   )

              }



            } //req.query.register === false
					}
				},

        {
					register: function(req, next, app){
            req = (req) ? Object.clone(req) : {}

            if(req.query.register || req.query.unregister){
              debug_internals('register', req);
              // process.exit(1)
              req.params = req.params || {}

              let from = req.from || app.options.table
              // from = (from === 'minute' || from === 'hour') ? 'historical' : from

              let query
              let params = {
                _extras: {
                  from: from,
                  type: (req.params && req.params.path) ? req.params.path : app.options.type,
                  id: req.id,
                  transformation: (req.query.transformation) ? req.query.transformation : undefined,
                  aggregation: (req.query.aggregation) ? req.query.aggregation : undefined,
                  filter: (req.query.filter) ? req.query.filter : undefined
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
                  // query = query
                  //   .group( app.r.row('metadata')('path') )
                  //   // .group( {index:'path'} )
                  //   .ungroup()
                  //   .map(
                  //     function (doc) {
                  //         return (req.query && req.query.q) ? app.build_default_query_result(doc, req.query) : app.build_default_result(doc)
                  //     }
                  // )
                  if(req.query && req.query.q){
                    query = query
                      .group( app.r.row('metadata')('path') )
                      // .group( {index:'path'} )
                      .ungroup()
                      .map(
                        function (doc) {
                          return app.build_default_query_result(doc, req.query)
                        }
                      )


                  }
                  else{
                    //Promise
                    // process.exit(1)
                    query = app.build_default_result(query)
                  }
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
            // req = (req) ? Object.clone(req) : {}
            debug_internals('periodical default %s', new Date());

            // if(!req.query || (!req.query.register && !req.query.unregister)){
            if(Object.getLength(app.periodicals) > 0){
              // debug_internals('periodical default %O', app.periodicals);

              Object.each(app.periodicals, function(periodical_req, uuid){
                Object.each(periodical_req, function(periodical, id){
                  let {query, params} = periodical
                  debug_internals('periodical default %s %O', id, periodical);
                  // periodical_req.id = id
                  if(query instanceof Promise){
                    query.then(function(resp) {
                      debug('periodical default result as Promise %o', resp)
                      // process.exit(1)
                      app.process_default(
                        undefined,
                        resp,
                        params
                      )
                    }, function(err) {
                      debug('periodical default ERRROR as Promise %o', err)
                      // process.exit(1)
                      app.process_default(
                        err,
                        undefined,
                        params
                      )
                    })
                  }
                  else{
                    query.run(app.conn, {arrayLimit: 1000000}, function(err, resp){
                      debug_internals('periodical default run', err, resp)//resp
                      app.process_default(
                        err,
                        resp,
                        params
                      )
                    })
                  }

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
              // query.run(app.conn, {arrayLimit: 1000000}, function(err, resp){
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


              let from = req.from || app.options.table
              // from = (from === 'minute' || from === 'hour') ? 'historical' : from

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


              /**
              * orderBy need to be called before filters (its order table), other trasnform like "slice" are run after "filters"
              **/
              let transformation = (req.query && req.query.transformation) ? req.query.transformation : undefined
              if(
                transformation
                && (transformation.orderBy
                  || (Array.isArray(transformation) && transformation.some(function(trasnform){ return Object.keys(trasnform)[0] === 'orderBy'}))
                )
              ){
                let orderBy = (transformation.orderBy) ? transformation.orderBy : transformation.filter(function(trasnform){ return Object.keys(trasnform)[0] === 'orderBy' })[0]//one orderBy
                query = app.query_with_transformation(query, orderBy)

                if(Array.isArray(transformation)){
                  transformation = Array.clone(transformation)
                  transformation.each(function(trasnform, index){
                    if(Object.keys(trasnform)[0] === 'orderBy')
                      transformation[index] = undefined
                  })

                  transformation = transformation.clean()
                }


              }

              if(req.query && req.query.filter)
                query = app.query_with_filter(query, req.query.filter)

              if(transformation)
                query = app.query_with_transformation(query, transformation)
              /**
              * orderBy need to be called before filters (its order table), other trasnform like "slice" are run after "filters"
              **/

              if (req.query && req.query.aggregation && !req.query.q) {
                query =  this.result_with_aggregation(query, req.query.aggregation)

                // query.run(app.conn, {arrayLimit: 1000000}, _result_callback)
              }
              else{
                query = query
                  .group(app.r.row('metadata')('path'))
                  .ungroup()
                  .map(
                    function (doc) {
                      return (req.query && req.query.q) ? app.build_default_query_result(doc, req.query) : app.build_default_result_between(doc)
                    }
                )
              }

              query.run(app.conn, {arrayLimit: 1000000}, function(err, resp){
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
                      aggregation: (req.query.aggregation) ? req.query.aggregation : undefined,
                      filter: (req.query.filter) ? req.query.filter : undefined
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


              let from = req.from || app.options.table
              // from = (from === 'minute' || from === 'hour') ? 'historical' : from

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
                  aggregation: (req.query.aggregation) ? req.query.aggregation : undefined,
                  filter: (req.query.filter) ? req.query.filter : undefined
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
                    // .group( {index:'path'} )
                    .ungroup()
                    .map(
                      function (doc) {
                        return (req.query && req.query.q) ? app.build_default_query_result(doc, req.query) : app.build_default_result_between(doc)
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





});
