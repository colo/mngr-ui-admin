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

module.exports = new Class({
  Extends: App,

  // changes_buffer: [],
  // changes_buffer_expire: undefined,
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
					distinct_index: function(req, next, app){
						debug_internals('property', req);

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

            query = (req.params.path)
            ? query
              .filter( app.r.row('metadata')('path').eq(req.params.path) )
            : query


            query
              .group( app.r.row('metadata')('path') )
              .ungroup()
              .map(
                function (doc) {
                    return app.build_default_result(doc)
                }
            )
            .run(app.conn, function(err, resp){
              debug_internals('run', err, resp)
              app.query(
                err,
                resp,
                {
                  _extras: {
                    from: from,
                    type: (req.params && req.params.path) ? req.params.path : app.options.type,
                    id: req.id,
                    // prop: pluralize(index)
                  }
                }
              )
            })


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
					distinct_index: function(req, next, app){
						debug_internals('distinct_index', req);

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


            query
              .group(app.r.row('metadata')('path'))
              .ungroup()
              .map(
                function (doc) {
                    return app.build_default_result(doc)
                }
            )
            .run(app.conn, function(err, resp){
              debug_internals('run', err, resp)
              app.query(
                err,
                resp,
                {
                  _extras: {
                    from: from,
                    type: (req.params && req.params.path) ? req.params.path : app.options.type,
                    id: req.id,
                    Range: range
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
      distinct: [{
        path: ':database/:table',
        callbacks: ['distinct']
      }],
      nth: [{
        path: ':database/:table',
        callbacks: ['range']
      }],
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
  query: function(err, resp, params){
    debug_internals('query', err, resp, params)

    let extras = params._extras
    let type = extras.type
    let id = extras.id

    delete extras.type

    if(err){
      debug_internals('query err', err)

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

    extras[type] = (type === 'all') ? resp : (Array.isArray(resp)) ? resp[0]: resp


    delete extras.prop
    delete extras.type


    if(err){
      this.fireEvent(this.ON_DOC_ERROR, [err, extras]);
    }
    else{

      this.fireEvent(this.ON_DOC, [extras, Object.merge({input_type: this, app: null})]);
    }



  },
  distinct: function(err, resp, params){
    // debug_internals('distinct', err, resp)


    let extras = params.options._extras
    let domain = extras.domain
    let prop = extras.prop
    let type = extras.type
    let id = extras.id

    delete extras.type

    // extras.type = (id === undefined) ? 'prop' : app.options.type
    // extras.type = (extras.type === app.options.type) ? extras.type : extras.prop

    // extras[extras.type] = this.type_props

    // if(!this.domains[domain] || type == 'prop') this.domains[domain] = {}

    // this.domains[domain][prop] = (resp) ? Object.keys(resp) : null



    if(err){
      debug_internals('distinct err', err)

			if(params.uri != ''){
				this.fireEvent('on'+params.uri.charAt(0).toUpperCase() + params.uri.slice(1)+'Error', err);//capitalize first letter
			}
			else{
				this.fireEvent('onGetError', err);
			}

			this.fireEvent(this.ON_DOC_ERROR, [err, extras]);

			this.fireEvent(
				this[
					'ON_'+this.options.requests.current.type.toUpperCase()+'_DOC_ERROR'
				],
				[err, extras]
			);
    }
    else{
      // let type = params.options._extras.type


      // let arr = (resp) ? Object.keys(resp) : null
      resp.toArray(function(err, arr){
        // resp.toArray(function(err, arr){

        debug_internals('distinct count', arr, type)
        this.type_props[extras.prop] = arr
        // extras[type] = (type === 'logs') ? this.type_props : this.type_props[extras.prop]
        if(type === this.options.type){
          extras[this.options.type] = this.type_props
        }
        else{
          extras[this.options.type] = {}
          extras[this.options.type][extras.prop]
          extras[this.options.type][extras.prop] = this.type_props[extras.prop]
        }

        // if(extras.type === 'logs')
        delete extras.prop
        delete extras.type

        let properties = [].combine(this.distinct_indexes).combine(this.custom)

        if(type == 'prop' || (Object.keys(this.type_props).length == properties.length)){
          let found = false
          Object.each(this.type_props, function(data, property){//if at least a property has data, domain exist
            if(data !== null && ((Array.isArray(data) || data.length > 0) || Object.getLength(data) > 0))
              found = true
          })

          if(err){
            // let err = {}
            // err['status'] = 404
            // err['message'] = 'not found'
            this.fireEvent(this.ON_DOC_ERROR, [err, extras]);
          }
          else if(!found){
            let err = {}
            err['status'] = 404
            err['message'] = 'not found'
            this.fireEvent(this.ON_DOC_ERROR, [err, extras]);
          }
          else{

            this.fireEvent(this.ON_DOC, [extras, Object.merge({input_type: this, app: null})]);
          }

          this.type_props = {}
        }


      }.bind(this))



    }
  },
  range: function(err, resp, params){
    debug_internals('range', err, resp, params.options)

    let extras = params.options._extras
    let range_select = extras.range_select //start | end
    // let domain = extras.domain
    let prop = extras.prop
    let type = extras.type
    let id = extras.id

    // extras.type = (id === undefined) ? 'prop' : 'logs'

    if(!this.type_props[extras.prop]) this.type_props[extras.prop] = {start: undefined, end: undefined}

    delete extras.range_select
    delete extras.type

    if(prop === 'data_range'){
      this.type_props[extras.prop][range_select] = (resp && resp.data && resp.data.timestamp) ? resp.data.timestamp : null
    }
    else{
      this.type_props[extras.prop][range_select] = (resp && resp.metadata && resp.metadata.timestamp) ? resp.metadata.timestamp : null
    }


    if(err){
      // debug_internals('reduce err', err)

			if(params.uri != ''){
				this.fireEvent('on'+params.uri.charAt(0).toUpperCase() + params.uri.slice(1)+'Error', err);//capitalize first letter
			}
			else{
				this.fireEvent('onGetError', err);
			}

			if(
        this.type_props[extras.prop]['start'] !== undefined
        && this.type_props[extras.prop]['end'] !== undefined
      )
        this.fireEvent(this.ON_DOC_ERROR, [err, extras])

			this.fireEvent(
				this[
					'ON_'+this.options.requests.current.type.toUpperCase()+'_DOC_ERROR'
				],
				err
			);
    }
    else{

      if(this.type_props[prop]['start'] !== undefined && this.type_props[prop]['end'] !== undefined ){
        if(type === this.options.type)
          delete extras.prop

        let properties = [].combine(this.distinct_indexes).combine(this.custom)

        if(type === this.options.type){
          extras[this.options.type] = this.type_props
        }
        else{
          extras[this.options.type] = {}
          extras[this.options.type][extras.prop]
          extras[this.options.type][extras.prop] = this.type_props[extras.prop]
        }

        if(type == 'prop' || (Object.keys(this.type_props).length == properties.length)){
          let found = false
          Object.each(this.type_props, function(data, property){//if at least a property has data, domain exist
            if(data !== null && ((Array.isArray(data) || data.length > 0) || Object.getLength(data) > 0))
              found = true
          })

          if(!found){
            let err = {}
            err['status'] = 404
            err['message'] = 'not found'
            this.fireEvent(this.ON_DOC_ERROR, [err, extras]);
          }
          else{

            this.fireEvent(this.ON_DOC, [extras, Object.merge({input_type: this, app: null})]);
          }

          this.type_props = {}
        }
      }

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
