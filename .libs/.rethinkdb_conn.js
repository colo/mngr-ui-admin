'use strict'

let debug = require('debug')('mngr-ui-admin:libs:rethinkdb_conn'),
    debug_events = require('debug')('mngr-ui-admin:libs:rethinkdb_conn:Events'),
    debug_internals = require('debug')('mngr-ui-admin:libs:rethinkdb_conn:Internals');

/**
 *  database.js
 *  The core database setup file for the project
 */

// let RthnkDBClient = require ( 'node-mngr-ui-admin:libs:rethinkdb_conn/index' )
let r = require('rethinkdb')

let conn = undefined

let connect_cb = function(err, result, cb){
  // debug_events('connect %o %o', err, conn)
  if(err){
    debug_internals('connect_cb err', err)
    // throw err
  }
  else if(result){
    conn = result
  }

  if(typeof cb == 'function')
    cb(err, conn)

  return conn
}

module.exports = function(options, cb){
  if(!conn){
    debug_internals('no conn: connecting...', options)
    r.connect(options, function(err, result){
      return connect_cb(err, result, cb)
    })
  }
  else{
    debug_internals('already connect')
    return connect_cb(undefined, conn, cb)

  }
}
