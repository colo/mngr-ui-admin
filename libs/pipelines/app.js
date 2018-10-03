'use strict'

const InputPollerCouchDBApp = require ( './input/poller/couchdb.app.js' )

let cron = require('node-cron')

module.exports = function(conn, io){
  let conf = {
  	input: [
  		{
  			poll: {
          suspended: true,//start suspended
  				id: "input.docs",
  				conn: [
            Object.merge(
              Object.clone(conn),
              {
                id: 'input.docs',
                module: InputPollerCouchDBApp,
              }
            )

  				],
  				connect_retry_count: 5,
  				connect_retry_periodical: 1000,
  				// requests: {
  				// 	periodical: 5000,
  				// },
          requests: {
      			periodical: function(dispatch){
  						// //////////console.log('host periodical running')
      				return cron.schedule('*/5 * * * * *', dispatch);//every 5 seconds
      			}
      		},
  			},
  		},

  	],
  	// filters: [
  	// 	function(doc, opts, next){
    //
  	// 		// console.log('search_pipeline ', doc)
    //
  	// 		buffer = Object.merge(buffer, doc.data)
    //
  	// 		if(buffer.hosts && buffer.paths){
  	// 			next(buffer)
  	// 			buffer = {}
  	// 		}
  	// 	}
  	// ],
  	output: [
  		function(doc){
        // console.log('output', doc)

        io.volatile.emit('app.doc', doc)



  		}
  	]
  }

  return conf
}
