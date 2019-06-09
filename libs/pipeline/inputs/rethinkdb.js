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

            let distinct_indexes = (req.params && req.params.prop ) ? pluralize(req.params.prop, 1) : app.distinct_indexes
            if(!Array.isArray(distinct_indexes))
              distinct_indexes = [distinct_indexes]

            debug_internals('property', distinct_indexes);

            // app.distinct({
            //   _extras: {type: 'logs', id: req.id},
            //   uri: app.options.db+'/periodical',
            //   args: {index: 'log'}
            // })
            let from = req.from || app.FROM
            from = (from === 'minute' || from === 'hour') ? 'historical' : from
            /**
            * reducing last minute of logs should be enough, and is way faster than "distinct" from all docs
            **/
            // app.reduce({
            //   _extras: {from: from, type: 'logs', id: req.id},
            //   uri: app.options.db+'/'+from,
            //   args: function(left, right) {
            //       return left.merge(right)
            //   },
            //
            //   query: app.r.db(app.options.db).
            //           table(from).
            //           // between(
            //           //   Date.now() - app.RANGES[from], //60000
            //           //   Date.now(),
            //           //   {index: 'timestamp'}
            //           // ).
            //           map(function(doc) {
            //             return app.r.object(doc("metadata")("tag"), true) // return { <country>: true}
            //           }.bind(app))
            // })

            Array.each(distinct_indexes, function(index){
              // if((!req.params || (req.params && req.params.prop)) && app.distinct_indexes.indexOf(index) > -1){
              if(app.distinct_indexes.indexOf(index) > -1){
                app.distinct({
                  _extras: {
                  from: from,
                  type: (req.params && req.params.prop) ? 'prop' : app.options.type,
                  id: req.id,
                  prop: pluralize(index)},
                  uri: app.options.db+'/periodical',
                  args: {index: index}
                })
              }

            }.bind(app))




					}
				},
        {
					range: function(req, next, app){
            // debug_internals('get_data_range', req);
						// if(!req.type || (req.params && req.params.prop == 'range')){
            if(!req.params || !req.params.prop || req.params.prop == 'range'){
              debug_internals('range', req);
              let from = req.from || app.FROM
              from = (from === 'minute' || from === 'hour') ? 'historical' : from

              //get last
              app.nth({
                _extras: {
                  from: from,
                  id: req.id,
                  prop: 'range',
                  range_select : 'end',
                  // domain: req.params.domain,
                  type: (req.params && req.params.prop) ? 'prop' : app.options.type,
                },
                uri: app.options.db+'/'+from,
                args: -1,
                query: app.r.db(app.options.db).table(req.from)
                .orderBy({index: 'timestamp'})
                .pluck({'metadata': ['timestamp']})
                // between(
                //   // [req.params.domain, 'periodical', app.r.now().toEpochTime().mul(1000).sub(5000)],//last 5 secs
                //   [req.params.domain, req.from, 0],//last 5 secs
                //   [req.params.domain, req.from, ''],
                //   {index: 'timestamp'}
                // )
              })

              //get first
              app.nth({
                _extras: {
                  from: from,
                  id: req.id,
                  prop: 'range',
                  range_select : 'start',
                  // domain: req.params.domain,
                  type: (req.params && req.params.prop) ? 'prop' : app.options.type,
                },
                uri: app.options.db+'/'+req.from,
                args: 0,
                query: app.r.db(app.options.db).table(req.from)
                .orderBy({index: 'timestamp'})
                .pluck({'metadata': ['timestamp']})
                // between(
                //   [req.params.domain, req.from, 0],
                //   [req.params.domain, req.from, ''],
                //   {index: 'sort_by_domain'}
                // )
              })




            }

					}
				},

        // {
				// 	data_range: function(req, next, app){
        //     // debug_internals('get_data_range', req);
				// 		// if(!req.type || (req.params && req.params.prop == 'data_range')){
        //     if(!req.params || !req.params.prop || req.params.prop == 'data_range'){
        //       debug_internals('data_range', req);
        //       let from = req.from || app.FROM
        //       from = (from === 'minute' || from === 'hour') ? 'historical' : from
        //
        //       //get last
        //       app.nth({
        //         _extras: {
        //           from: from,
        //           id: req.id,
        //           prop: 'data_range',
        //           range_select : 'end',
        //           // domain: req.params.domain,
        //           type: (req.params && req.params.prop) ? 'prop' : app.options.type,
        //         },
        //         uri: app.options.db+'/'+from,
        //         args: -1,
        //         query: app.r.db(app.options.db).table(req.from)
        //         .orderBy({index: 'logs_by_data.timestamp'})
        //         .pluck({'data': ['timestamp']})
        //         // between(
        //         //   // [req.params.domain, 'periodical', app.r.now().toEpochTime().mul(1000).sub(5000)],//last 5 secs
        //         //   [req.params.domain, req.from, 0],//last 5 secs
        //         //   [req.params.domain, req.from, ''],
        //         //   {index: 'timestamp'}
        //         // )
        //       })
        //
        //       //get first
        //       app.nth({
        //         _extras: {
        //           from: from,
        //           id: req.id,
        //           prop: 'data_range',
        //           range_select : 'start',
        //           // domain: req.params.domain,
        //           type: (req.params && req.params.prop) ? 'prop' : app.options.type,
        //         },
        //         uri: app.options.db+'/'+req.from,
        //         args: 0,
        //         query: app.r.db(app.options.db).table(req.from)
        //         .orderBy({index: 'logs_by_data.timestamp'})
        //         .pluck({'data': ['timestamp']})
        //         // between(
        //         //   [req.params.domain, req.from, 0],
        //         //   [req.params.domain, req.from, ''],
        //         //   {index: 'sort_by_domain'}
        //         // )
        //       })
        //
        //
        //
        //
        //     }
        //
				// 	}
				// },

      ],

      /**
      * periodical data always comes from 'periodical' table
      **/
      periodical: [
      //   {
			// 		tags: function(req, next, app){
			// 			debug_internals('tags');
      //
      //       /**
      //       * reducing last minute of tags should be enough, and is way faster than "distinct" from all docs
      //       **/
      //       // app.reduce({
      //       //   _extras: {from: 'periodical', type: 'tags', id: undefined},
      //       //   uri: app.options.db+'/periodical',
      //       //   args: function(left, right) {
      //       //       return left.merge(right)
      //       //   },
      //       //
      //       //   query: app.r.db(app.options.db).table('periodical').between(Date.now() - app.RANGES['periodical'], Date.now(), {index: 'timestamp'}).map(function(doc) {
      //       //     return app.r.object(doc("metadata")("tag"), true) // return { <country>: true}
      //       //   }.bind(app))
      //       // })
      //
      //       app.distinct({
      //         _extras: {from: from, type: app.options.type, id: undefined},
      //         uri: app.options.db+'/periodical',
      //         args: {index: 'tags'}
      //       })
      //
			// 		}
			// 	},

      ],

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

  // custom: ['range', 'data_range'],
  // distinct_indexes: ['tag', 'type', 'host', 'domain',],
  custom: ['range'],
  distinct_indexes: ['tag', 'type', 'host', 'path'],
  type_props: {},

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
