const mysql      = require('mysql');
const pool  = mysql.createPool({
  connectionLimit : 10,
  host            : '120.27.5.155',
  user            : 'root',
  password        : 'y8kyscsy',
  database        : 'cTrip'
});

const log4js = require('log4js');
log4js.configure('../config/my_log4js_configuration.json')
let logger = log4js.getLogger('console');
let loggerFile = log4js.getLogger('fileLog'); //可以模块化
logger.setLevel('debug');

const redis = require("redis"),
    client = redis.createClient({
      host:  '120.27.5.155',
      password: 'Y8kyscsy'
    });

// if you'd like to select database 3, instead of 0 (default), call
// client.select(3, function() { /* ... */ });

function catalogueMaxQueryByCity(depCity, arrCity){
  return new Promise(function(resolve,reject){
    let catalogueMaxQueryString = `select max(catalogue) from flightsdata where depCity = '${depCity}' and arrCity = '${arrCity}'`;
    pool.query(catalogueMaxQueryString, function(err, rows, fields) {
      if (err) throw err;
      let catalogue = rows[0]['max(catalogue)']
      let result = {
        depCity: depCity,
        arrCity: arrCity,
        catalogue: catalogue,
      }
      resolve(result)
    });
  })
}

function distinctFlightsQueryByCity (result){
  return new Promise(function(resolve, reject){
    let distinctFlightsQueryString = `SELECT distinct airlineCode, flightNo , depDateTime from flightsdata where depCity = '${result.depCity}' and  arrCity = '${result.arrCity}' and catalogue = '${result.catalogue}' and isShare='0'  order by  depDateTime`;
    pool.query(distinctFlightsQueryString, function(err, rows, fields) {
      if (err) throw err;
      let flights = [];
      for (let flight of rows) {
        flights.push(
          {flightID: flight.airlineCode +　flight.flightNo,
            depDateTime: flight.depDateTime,
          }
        )
      }

      result.route = `${result.depCity}${result.arrCity}`;
      result.route = result.route.toUpperCase();
      result.flights = flights;
      resolve(result)
    });
  })
}


function distinctDepDateQueryByCity(result){
  return new Promise(function(resolve, reject){
    let distinctDepDateQueryString = `select distinct(depDate) from flightsdata where depCity = '${result.depCity}' and  arrCity = '${result.arrCity}'and catalogue = '${result.catalogue}' order by depDate`
    pool.query(distinctDepDateQueryString, function(err, rows, fields) {
      if (err) throw err;
      let times = rows.map(function(item, index){
        return item.depDate
      })
      result.depDates = times
      resolve(result)
    });
  })
}


function findTime(time, flightID, depDateTime){
  return function(flight){
    return flight.depDate == time && flight.flight == flightID && flight.depDateTime == depDateTime
  }
}

function longPriceQueryByCity (result){
  return new Promise(function(resolve, reject){
    let queryString = `select concat(airlineCode, flightNo) flight, depDate, depDateTime, price from flightsdata where depCity = '${result.depCity}' and  arrCity = '${result.arrCity}' and catalogue = '${result.catalogue}' order by depDate, depDateTime`
    pool.query(queryString, function(err, rows, fields) {
      if (err) throw err;
      let longPrices = [];

      result.Dows = ['', 'DOW:'];
      for (var i = 0; i < result.depDates.length; i++) {
        let depDate = result.depDates[i];
        let dow = new Date(depDate).getDay();
        if (dow === 0) {
          dow = 7
        }
        result.Dows.push(dow)
      }

      result.advancedDates = ['', '提前数:'];
      let NowDate = new Date(result.depDates[0])
      for (var i = 0; i < result.depDates.length; i++) {
        let depDate = new Date(result.depDates[i]);
        let advancedDate = (depDate - NowDate)/86400000;
        result.advancedDates.push(advancedDate)
      }


      for (let flight of result.flights) {
        let longPrice = {
          airline: flight.flightID,
          depDateTime: flight.depDateTime,
          // Dow: ['', ''],
          // advancedDate:['', '']
          prices: [],
        }

        for (let time of result.depDates) {
          let findTheTime = findTime(time, flight.flightID, flight.depDateTime);
          let depDataFlight = rows.find(findTheTime)
          if (depDataFlight) {
            longPrice.prices.push({
              depDate: time,
              price: depDataFlight.price,
            })
          }else {
            longPrice.prices.push({
              depDate: time,
              price: '  ',
            })
          }
        }
        longPrices.push(longPrice)
      }
      result.longPrice = longPrices
      resolve(result)
    });
  })
}

function queryLongPriceByCity(depCity, arrCity){
  return new Promise(function(resolve, reject){
    catalogueMaxQueryByCity(depCity, arrCity)
    .then(function(result){
      return distinctFlightsQueryByCity(result)
    })
    .then(function(result){
      return distinctDepDateQueryByCity(result)
    })
    .then(function(result){
      return longPriceQueryByCity(result)
    })
    .then(function(result){
      // logger.debug(rows)
      // logger.debug(result)
      logger.info('lt is ok ', depCity, ' to ', arrCity)
      result = {flightPrice: result}
      resolve(result)
    })
  })
}



function cache(depCity, arrCity) {
  let timeStart = new Date()
  logger.info('cacheing from ', depCity, ' to ', arrCity)
  queryLongPriceByCity(depCity, arrCity)
  .then(function(result){
    let timeUsed = new Date() - timeStart
    logger.info('Time use :', timeUsed)
    // logger.debug("result", result)
    let resultString = JSON.stringify(result)
    let key = depCity.toUpperCase() + arrCity..toUpperCase()
    logger.debug('key:', key)
    client.set(key, resultString, redis.print);
  })
}

exports.cache  = cache


// client.on("error", function (err) {
//     console.log("Error " + err);
// });
//
// client.hset("hash key", "hashtest 1", "some value", redis.print);
// client.hset(["hash key", "hashtest 2", "some other value"], redis.print);
// client.hkeys("hash key", function (err, replies) {
//     console.log(replies.length + " replies:");
//     replies.forEach(function (reply, i) {
//         console.log("    " + i + ": " + reply);
//     });
//     client.quit();
// });
