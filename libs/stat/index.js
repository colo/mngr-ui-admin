'use strict'

let debug = require('debug')('mngr-ui-admin:apps:hosts:libs:stat'),
    debug_internals = require('debug')('mngr-ui-admin:apps:hosts:libs:stat:Internals');


let extract_data_os = require( 'node-mngr-docs' ).extract_data_os

// module.exports = function(doc, name, cb){
//   //console.log('__process_os_doc', doc)
//
//   let paths = {}
//
//   if(Array.isArray(doc)){
//     Array.each(doc, function(row){
//
//       // if(row != null && row.metadata.host == this.host){
//       if(row != null){
//         let {keys, path, host} = extract_data_os(row)
//
//         // //////console.log('ROW', keys, path)
//
//         if(!paths[path])
//           paths[path] = {}
//
//
//         Object.each(keys, function(data, key){
//           // ////////console.log('ROW', key, data)
//           if(!paths[path][key])
//             paths[path][key] = []
//
//           paths[path][key].push(data)
//         })
//       }
//     })
//   }
//   // else if(doc.metadata.host == this.host){
//   else{
//     let {keys, path, host} = extract_data_os(doc)
//     if(!paths[path])
//       paths[path] = {}
//
//     paths[path] = keys
//   }
//
//   if(typeof cb == 'function')
//     cb(name, paths)
//
//   else
//     return paths
// }

module.exports = function(doc, name, cb){
  //console.log('__process_os_doc', doc)

  let paths = {}

  if(Array.isArray(doc)){
    Array.each(doc, function(row){

      // if(row != null && row.metadata.host == this.host){
      if(row != null){
        let {keys, path, host} = extract_data_os(row)

        // //////console.log('ROW', keys, path)

        // if(!paths[path])
        //   paths[path] = {}


        Object.each(keys, function(data, key){
          // ////////console.log('ROW', key, data)
          if(!paths[key])
            paths[key] = []

          paths[key].push(data)
        })
      }
    })
  }
  // else if(doc.metadata.host == this.host){
  else{
    let {keys, path, host} = extract_data_os(doc)
    // if(!paths[path])
    //   paths[path] = {}

    paths = keys
  }

  if(typeof cb == 'function')
    cb(name, paths)

  else
    return paths
}
