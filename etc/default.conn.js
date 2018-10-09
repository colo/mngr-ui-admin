'use strict'

// let request = function(){
//   return new Promise((resolve, reject) => {
//     var redis = require('redis')
//     try{
//       let client = redis.createClient(6379, '127.0.0.1')
//       client.on('connect', function() {
//           console.log('Redis client connected')
//           client.quit()
//           resolve( require('cachemachine')({redis: true, hostname: '127.0.0.1'}) )
//       });
//       client.on('error', function (err) {
//           console.log('Redis client error')
//           client.quit()
//           resolve( undefined )
//       })
//       // cachemachine({redis: true, hostname: '127.0.0.1'})
//       // cachemachine({method: 'get', url: 'http://127.0.0.1:5984/', qs: {limit:1}}, function() {
//       //   // console.log(b);
//       // })
//
//     }
//     catch(e){
//       console.log(e)
//       resolve( undefined )
//     }
//   })
// }

module.exports = function(redis){
  // let req = request()
  return {
    scheme: 'http',
    host:'127.0.0.1',
    port: 5984,
    db: 'live',
    couchdb: {
      request: (redis) ? require('cachemachine')({redis: true, hostname: '127.0.0.1'}) : undefined
    },
  }
}
