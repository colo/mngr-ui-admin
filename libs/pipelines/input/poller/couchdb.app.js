'use strict'

// const App = require ( '../../node_modules/node-app-couchdb-client/index' )
const App = require ( 'node-app-couchdb-client/index' )

const roundMilliseconds = function(timestamp){
  let d = new Date(timestamp)
  d.setMilliseconds(0)

  // console.log('roundMilliseconds', d.getTime())
  return d.getTime()
}


const views = [
  {
    count_docs: function(req, next, app){
      ////console.log('search_hosts', next)

      // next(
      app.view({
        uri: app.options.db,
        args: [
          'sort',
          'by_date',
          {
            // startkey: [start_key, app.options.stat_host, "periodical",Date.now() + 0],
            // endkey: [end_key, app.options.stat_host, "periodical", Date.now() - 1000],
            startkey: [roundMilliseconds(Date.now() - 1000), "periodical"],
            endkey: [roundMilliseconds(Date.now()), "periodical\ufff0"],
            // limit: 1,
            // descending: true,
            inclusive_end: true,
            include_docs: false
          }
        ]
      })
      // )
    }

  },
  {
    search_hosts: function(req, next, app){
      // console.log('search_hosts', next)

      // next(
      app.view({
        uri: app.options.db,
        args: [
          'search',
          'hosts',
          {
            //limit: 1,
            reduce: true, //avoid geting duplicate host
            group: true,

          }
        ]
      })
      // )
    }
  },
  {
    search_paths: function(req, next, app){
      console.log('search_paths', app.options.db)

      // next(
      app.view({
        uri: app.options.db,
        args: [
          'search',
          'paths',
          {
            //limit: 1,
            reduce: true, //avoid geting duplicate host
            group: true,

          }
        ]
      })
      // )
    }
  },
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

			request: [
				{
					path: '',
					callbacks: ['request'],
				}
			],
			view: [
				{
					path: ':database',
					callbacks: ['view'],
					//version: '',
				},
			]
		},


  },

  view: function(err, resp, view){
		// console.log('count.view ', resp, view.options.args);

		if(err){
			////////console.log('this.sort_by_path error %o', err);
		}
    else if (view.options.args[0] == 'sort' && view.options.args[1] == 'by_date') {
      this.fireEvent('onPeriodicalDoc', [{type: 'count', value: resp.rows.length }, {type: 'periodical', input_type: this, app: null}]);
    }
    else{
      let data = []
      resp.rows.each(function(row){
        data.push(row.key)
      })

      if (view.options.args[0] == 'search' && view.options.args[1] == 'hosts') {

        this.fireEvent('onPeriodicalDoc', [{type: 'hosts', value: data }, {type: 'periodical', input_type: this, app: null}]);
      }
      else{
        this.fireEvent('onPeriodicalDoc', [{type: 'paths', value: data }, {type: 'periodical', input_type: this, app: null}]);
      }


		}
  },
  request: function(err, resp){
		if(err){
			////////console.log('this.info error %o', err);
			//this.fireEvent(this.ON_CONNECT_ERROR, err);
		}
	},
  initialize: function(options){
		this.parent(options);//override default options

		this.profile('root_init');//start profiling


		this.profile('root_init');//end profiling

		this.log('root', 'info', 'root started');
  },
  connect: function(){
		// console.log('this.connect');
    //
		// try{
		// 	//this.os.api.get({uri: 'hostname'});
		// 	//this.get({uri: '/'}, this._first_connect.bind(this));
		// 	this.request(
    //     {
    //       opts: {
    //         path: '/'
    //       }
    //     },
    //     this._first_connect.bind(this)
    //   );
    //
		// }
		// catch(e){
		// 	////////console.log(e);
		// }
	},
	_first_connect: function(err, result, body, opts){
		// // //////console.log('first_connect %o', result.uuid);
		// this.options.id = 'hosts-'+result.uuid;//set ID
    //
    // // this.fireEvent('ON_RANGE', {})
	}

});
