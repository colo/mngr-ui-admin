'use strict'

const mootools = require("mootools"),
      debug = require('debug')('libs:fork')



debug('args', process.argv)
let filter = require(process.argv[2])
let filter_params = process.argv[3]
filter_params = (filter_params !== undefined) ? JSON.parse(filter_params) : undefined
// debug('filter_params %O', JSON.parse(filter_params))

if(Object.getLength(filter_params) > 0){
  Object.each(filter_params, function(val, prop){
    filter[prop] = val
  })
}

// process.exit(1)

process.on('message', (msg) => {
  debug('message', msg)
  if(msg.params){
    let params = Array.clone(msg.params)
    params.push(function(data){
      debug('data', data)
      process.send({
        result: data,
        doc: msg.doc
      })
    })
    filter.attempt(params)
  }
});
