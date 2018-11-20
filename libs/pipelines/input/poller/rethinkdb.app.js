'use strict'

// const App = require ( '../../node_modules/node-app-rethinkdb-client/index' )
const App = require ( 'node-app-rethinkdb-client/index' )

let debug = require('debug')('input:poller:rethinkdb.app'),
    debug_internals = require('debug')('input:poller:rethinkdb.app:Internals');

const roundMilliseconds = function(timestamp){
  let d = new Date(timestamp)
  d.setMilliseconds(0)

  // console.log('roundMilliseconds', d.getTime())
  return d.getTime()
}


const views = [
  {
    doc_count: function(req, next, app){
      debug_internals('count_docs', app.options)

      app.between({
        _extras: 'count',
        uri: app.options.db+'/live',
        args: [
          roundMilliseconds(Date.now() - 1000),
          roundMilliseconds(Date.now()),
          {
            index: 'timestamp',
            leftBound: 'open',
            rightBound: 'open'
          }
        ]
      })

      // next(
      // app.view({
      //   uri: app.options.db,
      //   args: [
      //     'docs',
      //     'by_date',
      //     {
      //       // startkey: [start_key, app.options.stat_host, "periodical",Date.now() + 0],
      //       // endkey: [end_key, app.options.stat_host, "periodical", Date.now() - 1000],
      //       startkey: [roundMilliseconds(Date.now() - 1000), "periodical"],
      //       endkey: [roundMilliseconds(Date.now()), "periodical\ufff0"],
      //       // limit: 1,
      //       // descending: true,
      //       inclusive_end: true,
      //       include_docs: false
      //     }
      //   ]
      // })
      // )
    }

  },
  {
    search_hosts: function(req, next, app){
      debug_internals('search_hosts', app.options)

      app.between({
        _extras: 'host',
        uri: app.options.db+'/live',
        args: [
          roundMilliseconds(Date.now() - 1000),
          roundMilliseconds(Date.now()),
          {
            index: 'timestamp',
            leftBound: 'open',
            rightBound: 'open'
          }
        ]
      })
      // app.distinct({
      //   _extras: 'hosts',
      //   uri: app.options.db+'/live',
      //   args: {index: 'host'}
      // })

      // next(
      // app.view({
      //   uri: app.options.db,
      //   args: [
      //     'search',
      //     'hosts',
      //     {
      //       //limit: 1,
      //       reduce: true, //avoid geting duplicate host
      //       group: true,
      //
      //     }
      //   ]
      // })
      // )
    }
  },
  {
    search_paths: function(req, next, app){
      debug_internals('search_paths', app.options)

      app.between({
        _extras: 'path',
        uri: app.options.db+'/live',
        args: [
          roundMilliseconds(Date.now() - 1000),
          roundMilliseconds(Date.now()),
          {
            index: 'timestamp',
            leftBound: 'open',
            rightBound: 'open'
          }
        ]
      })

      // app.distinct({
      //   _extras: 'paths',
      //   uri: app.options.db+'/live',
      //   args: {index: 'path'}
      // })

      // next(
      // app.view({
      //   uri: app.options.db,
      //   args: [
      //     'search',
      //     'paths',
      //     {
      //       //limit: 1,
      //       reduce: true, //avoid geting duplicate host
      //       group: true,
      //
      //     }
      //   ]
      // })
      // )
    }
  },
  // {
  //   changes: function(req, next, app){
  //     console.log('follow')
  //     app.follow({
  //       uri: app.options.db,
  //       args: [{
  //         since: "now",
  //         include_docs:true,
  //         // seq_interval: 2
  //         // view: "docs/_view/by_date"
  //       }]
  //     })
  //   }
  // }
]



module.exports = new Class({
  Extends: App,

  // hosts: [],
  // hosts_range_started: [],


  options: {


    // range: [
    //   Date.now() - 300000,
    //   Date.now()
    // ],

		requests : {
      once: Array.clone(views),
      // once: [
      //   {
			// 		count_docs: function(req, next, app){
      //       ////console.log('search_hosts', next)
      //
			// 			// next(
      //       app.view({
			// 				uri: app.options.db,
      //         args: [
      //           'sort',
      //           'by_date',
      //           {
      //             // startkey: [start_key, app.options.stat_host, "periodical",Date.now() + 0],
      //             // endkey: [end_key, app.options.stat_host, "periodical", Date.now() - 1000],
      //             startkey: [Date.now() - 1000, "periodical"],
      //             endkey: [Date.now(), "periodical\ufff0"],
      //             // limit: 1,
      //             // descending: true,
      //             inclusive_end: true,
      //             include_docs: false
      //           }
      //         ]
			// 			})
      //       // )
			// 		}
			// 	},
      //
			// ],
			periodical: Array.clone(views)

		},

		routes: {
      between: [{
        path: ':database/:table',
        callbacks: ['between']
      }],
      // distinct: [{
      //   path: ':database/:table',
      //   callbacks: ['distinct']
      // }],

			// request: [
			// 	{
			// 		path: '',
			// 		callbacks: ['request'],
			// 	}
			// ],
			// view: [
			// 	{
			// 		path: ':database',
			// 		callbacks: ['view'],
			// 		//version: '',
			// 	},
			// ],
      // follow: [
			// 	{
			// 		path: ':database',
			// 		callbacks: ['follow'],
			// 		//version: '',
			// 	},
			// ]
		},


  },
  // follow: function(err, resp, view){
	// 	console.log('follow ', err, resp, view.options.args);
  // },
  between: function(err, resp, params){
    // debug_internals('between', arguments)
    // resp.each(function(err, row) {
    //     if (err) throw err;
    //     debug_internals('between', row)
    // });

    resp.toArray(function(err, arr){
      debug_internals('between count', arr.length)
      if(params.options._extras == 'count'){
        this.fireEvent('onPeriodicalDoc', [{type: params.options._extras, value: arr.length }, {type: 'periodical', input_type: this, app: null}]);
      }
      else{
        let result = []

        Array.each(arr, function(row, index){
          if(!result.contains(row.metadata[params.options._extras]))
            result.push(row.metadata[params.options._extras])

          // debug_internals('between '+params.options._extras, result)
          //   row.metadata[params.options._extras]
          if(index == arr.length -1 ){
            debug_internals('between '+params.options._extras, result)
            this.fireEvent('onPeriodicalDoc', [{type: params.options._extras+'s', value: result }, {type: 'periodical', input_type: this, app: null}]);
          }
        }.bind(this))



      }

    }.bind(this))


    // debug_internals('count', this.r.count(resp))

  },
  // distinct: function(err, resp, params){
  //   // debug_internals('distinct', arguments)
  //   // // resp.each(function(err, row) {
  //   // //     if (err) throw err;
  //   // //     debug_internals('between', row)
  //   // // });
  //   //
  //
  //   resp.toArray(function(err, arr){
  //     debug_internals('distinct', err, arr)
  //
  //     this.fireEvent('onPeriodicalDoc', [{type: params.options._extras, value: arr }, {type: 'periodical', input_type: this, app: null}]);
  //
  //
  //   }.bind(this))
  //
  //   //
  //   // // debug_internals('count', this.r.count(resp))
  //
  // },
  // view: function(err, resp, view){
	// 	// console.log('count.view ', resp, view.options.args);
  //
	// 	if(err){
	// 		////////console.log('this.sort_by_path error %o', err);
	// 	}
  //   else if (view.options.args[0] == 'docs' && view.options.args[1] == 'by_date') {
  //     this.fireEvent('onPeriodicalDoc', [{type: 'count', value: resp.rows.length }, {type: 'periodical', input_type: this, app: null}]);
  //   }
  //   else{
  //     let data = []
  //     resp.rows.each(function(row){
  //       data.push(row.key)
  //     })
  //
  //     if (view.options.args[0] == 'search' && view.options.args[1] == 'hosts') {
  //
  //       this.fireEvent('onPeriodicalDoc', [{type: 'hosts', value: data }, {type: 'periodical', input_type: this, app: null}]);
  //     }
  //     else{
  //       this.fireEvent('onPeriodicalDoc', [{type: 'paths', value: data }, {type: 'periodical', input_type: this, app: null}]);
  //     }
  //
  //
	// 	}
  // },
  // request: function(err, resp){
	// 	if(err){
	// 		////////console.log('this.info error %o', err);
	// 		//this.fireEvent(this.ON_CONNECT_ERROR, err);
	// 	}
	// },
  initialize: function(options){
		this.parent(options);//override default options

		this.profile('root_init');//start profiling


		this.profile('root_init');//end profiling

		this.log('root', 'info', 'root started');
  },
  // connect: function(){
	// 	// console.log('this.connect');
  //   //
	// 	// try{
	// 	// 	//this.os.api.get({uri: 'hostname'});
	// 	// 	//this.get({uri: '/'}, this._first_connect.bind(this));
	// 	// 	this.request(
  //   //     {
  //   //       opts: {
  //   //         path: '/'
  //   //       }
  //   //     },
  //   //     this._first_connect.bind(this)
  //   //   );
  //   //
	// 	// }
	// 	// catch(e){
	// 	// 	////////console.log(e);
	// 	// }
	// },
	// _first_connect: function(err, result, body, opts){
	// 	// // //////console.log('first_connect %o', result.uuid);
	// 	// this.options.id = 'hosts-'+result.uuid;//set ID
  //   //
  //   // // this.fireEvent('ON_RANGE', {})
	// }

});
