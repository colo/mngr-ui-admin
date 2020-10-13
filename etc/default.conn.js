'use strict'

module.exports = function(){
  // let req = request()
  return {
    host: 'elk',
		port: 28015,
		db: 'devel',
    // couchdb: {
    //   request: (redis) ? require('cachemachine')({redis: true, hostname: 'elk'}) : undefined
    // },
  }
}
