'use strict'

let DefaultDygraphLine = require('mngr-ui-admin-charts/defaults/dygraph.line')

let debug = require('debug')('mngr-ui-admin:apps:hosts:libs:tabular'),
    debug_internals = require('debug')('mngr-ui-admin:apps:hosts:libs:tabular:Internals');

// let data_to_tabular = require( 'node-tabular-data' ).data_to_tabular

// let chart = Object.clone(DefaultDygraphLine)

let __process_stat = function(chart, name, stat){
  // console.log('__process_stat', chart, name, stat)
  if(!Array.isArray(stat))
    stat = [stat]

  if(stat[0] && isNaN(stat[0].value)){
    //sdX.stats.

    let filtered = false
    if(chart.watch && chart.watch.filters){
      Array.each(chart.watch.filters, function(filter){
        let prop_to_filter = Object.keys(filter)[0]
        let value_to_filter = filter[prop_to_filter]

        // //////console.log('stat[0].value[prop_to_filter]', name, stat)
        if(
          stat[0].value[prop_to_filter]
          && value_to_filter.test(stat[0].value[prop_to_filter]) == true
        ){
          filtered = true
        }

      })
    }
    else{
      filtered = true
    }

    if(filtered == true){

      chart = chart.pre_process(chart, name, stat)

      // chart.label = this.__process_chart_label(chart, name, stat) || name
      // let chart_name = this.__process_chart_name(chart, stat) || name

      __process_chart(chart, name, stat)
    }

  }
  else if(stat[0]){

    // chart.label = this.__process_chart_label(chart, name, stat) || name
    // let chart_name = this.__process_chart_name(chart, stat) || name
    chart = chart.pre_process(chart, name, stat)

    __process_chart(
      chart,
      name,
      stat
    )
  }

  return chart
}

let __process_chart = function(chart, name, stat){

  if(chart.init && typeOf(chart.init) == 'function')
    chart.init(undefined, chart, name, stat, 'chart')

}


// module.exports = function(stat, name, cb){
module.exports = function(stat, name){
  return __process_stat(Object.clone(DefaultDygraphLine), name, stat)
  // cb(chart)

  // data_to_tabular(doc, {}, name, function(name, tabular){
  //   Array.each(tabular, function(val, index){
  //     Array.each(val, function(row, i_row){
  //       if(isNaN(row))
  //         val[i_row] = undefined
  //     })
  //     tabular[index] = val.clean()
  //   })
  //
  //   debug_internals(name, tabular)
  //
  //   if(tabular.length == 0 || (tabular[0].length <= 1)){
  //     cb(name, undefined)
  //   }
  //   else{
  //     cb(name, tabular)
  //   }
  //
  // })
}
