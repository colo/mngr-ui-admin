'use strict'

let request = function(){
  var redis = require('redis')
  try{
    let client = redis.createClient(6379, '127.0.0.1')
    client.on('connect', function() {
        // console.log('Redis client connected')
        return require('cachemachine')({redis: true, hostname: '127.0.0.1'})
    });
    client.on('error', function (err) {
        client.quit()
        return undefined
    })
    // cachemachine({redis: true, hostname: '127.0.0.1'})
    // cachemachine({method: 'get', url: 'http://127.0.0.1:5984/', qs: {limit:1}}, function() {
    //   // console.log(b);
    // })

  }
  catch(e){
    console.log(e)
    return undefined
  }
}

module.exports = function(){
  let req = request()
  return {
    scheme: 'http',
    host:'127.0.0.1',
    port: 5984,
    db: 'live',
    couchdb: {
      request: req
    },
  }
}
