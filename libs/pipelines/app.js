'use strict'

const InputPollerCouchDBApp = require ( './input/poller/couchdb.app.js' )

module.exports = function(conn, io){
  let conf = {
  	input: [
  		{
  			poll: {
          suspended: true,//start suspended
  				id: "input.count.docs",
  				conn: [
            Object.merge(
              Object.clone(conn),
              {
                id: 'input.count.docs',
                module: InputPollerCouchDBApp,
              }
            )

  				],
  				connect_retry_count: 5,
  				connect_retry_periodical: 1000,
  				requests: {
  					periodical: 10000,
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
        console.log('output', doc)

        io.emit('app.doc', doc)
  			// doc = JSON.decode(doc)

  			// console.log(doc)
  			// store.commit('app/doc', {type: 'count', 'value': doc.data})

  			// if(typeof EventBus !== 'undefined')
  			// 	EventBus.$emit('count', doc)


  		}
  	]
  }

  return conf
}
