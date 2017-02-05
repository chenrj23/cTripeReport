const express = require('express');
const app = express();
const path = require('path');

const connectMysql = require('./connectMysql.js');
const pool = connectMysql.pool;

const redis = require("redis"),
    client = redis.createClient({
      host:  '120.27.5.155',
      password: 'Y8kyscsy'
    });


const log4js = require('log4js');
log4js.configure('../config/my_log4js_configuration.json')
let logger = log4js.getLogger('console');
let loggerFile = log4js.getLogger('fileLog'); //可以模块化
logger.setLevel('debug');

app.set('views', '../views')
app.set('view engine', 'pug')
app.use('/', express.static(path.join(__dirname, '../public')));

function catalogueMaxQuery(depAirport, arrAirport){
  return new Promise(function(resolve,reject){
    let catalogueMaxQueryString = `select max(catalogue) from flightsdata where depAirport = '${depAirport}' and arrAirport = '${arrAirport}'`;
    pool.query(catalogueMaxQueryString, function(err, rows, fields) {
      if (err) throw err;
      let catalogue = rows[0]['max(catalogue)']
      let result = {
        depAirport: depAirport,
        arrAirport: arrAirport,
        catalogue: catalogue,
        formatedCatalogue: Date(catalogue),
      }
      resolve(result)
    });
  })
}
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
        formatedCatalogue: (new Date(parseInt(catalogue))),
      }
      resolve(result)
    });
  })
}


function distinctFlightsQuery (result){
  return new Promise(function(resolve, reject){
    let distinctFlightsQueryString = `SELECT distinct airlineCode, flightNo , depDateTime from flightsdata where depAirport = '${result.depAirport}' and  arrAirport = '${result.arrAirport}' and catalogue = '${result.catalogue}' order by  depDateTime`;
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

      // logger.debug(rows)
      result.route = `${result.depAirport}${result.arrAirport}`;
      result.route = result.route.toUpperCase();
      result.flights = flights;
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

function distinctDepDateQuery(result){
  return new Promise(function(resolve, reject){
    let distinctDepDateQueryString = `select distinct(depDate) from flightsdata where arrAirport = '${result.arrAirport}' and depAirport = '${result.depAirport}' and catalogue = '${result.catalogue}' order by depDate`
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

function longPriceQuery (result){
  return new Promise(function(resolve, reject){
    let queryString = `select concat(airlineCode, flightNo) flight, depDate, depDateTime, price from flightsdata where depAirport = '${result.depAirport}' and arrAirport = '${result.arrAirport}' and catalogue = '${result.catalogue}' order by depDate, depDateTime`
    pool.query(queryString, function(err, rows, fields) {
      if (err) throw err;
      let longPrices = [];
      for (let flight of result.flights) {
        let longPrice = {
          airline: flight.flightID,
          depDateTime: flight.depDateTime,
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

function findRoute(depAirport, arrAirport){
  let route = depAirport + arrAirport;
  route = route.toUpperCase()
  logger.debug("route is ", route)
  return function (data) {
    const flightPrice = data.flightPrice
    // logger.debug("flightPrice is ", flightPrice)
    // logger.debug("flightPrice route is ", flightPrice.route)
    return flightPrice.route == route
  }
}

app.get('/api/byCity', function (req, res) {
  let depCity = req.query.depCity
  let arrCity = req.query.arrCity
  let timeStart = new Date()
  logger.info('have a req from ', depCity, ' to ', arrCity)
  queryLongPriceByCity(depCity, arrCity)
    .then(function(result){
      let timeUsed = new Date() - timeStart
      logger.info('Time use :', timeUsed)
      res.render('index', result)
    })
});

app.get('/api/byCityFromCache', function (req, res) {
  let depCity = req.query.depCity
  let arrCity = req.query.arrCity
  let timeStart = new Date()
  logger.info('have a req from ', depCity, ' to ', arrCity)
  const key = depCity.toUpperCase() + arrCity.toUpperCase()
  client.get(key, (err, reply)=>{
    if (err) {
      logger.error('redis get have err', err)
    }else {
      const replyJson = JSON.parse(reply)
      replyJson.flightPrice.formatedCatalogue = new Date(parseInt(replyJson.flightPrice.catalogue))
      // logger.debug(replyJson)
      res.render('index', replyJson)
    }
  })
});

app.get('/api/byCityAtCatalogue', function (req, res) {
  let depCity = req.query.depCity
  let arrCity = req.query.arrCity
  let catalogue = req.query.catalogue
  let timeStart = new Date()
  logger.info('have a req from ', depCity, ' to ', arrCity)
  queryLongPriceByCityAtCatalogue(depCity, arrCity, catalogue)
    .then(function(result){
      let timeUsed = new Date() - timeStart
      logger.info('Time use :', timeUsed)
      res.render('index', result)
    })
});

app.get('/api/byCityStopOver', function (req, res) {
  let depCity = req.query.depCity
  let stopOverCity = req.query.stopOverCity
  let arrCity = req.query.arrCity
  let firstShortFlight = queryLongPriceByCity(depCity, stopOverCity)
  let secondShortFlight = queryLongPriceByCity(stopOverCity, arrCity)
  let longFlight = queryLongPriceByCity(depCity, arrCity)
  let timeStart = new Date()
  logger.info('have a req StopOver from ', depCity, ' to ', stopOverCity , ' to ', arrCity)
  Promise.all([firstShortFlight, secondShortFlight, longFlight]).then(function(flightsPrice){
    let data = {};
    data.flightsPrice = []

    let findFirstShortFlight = findRoute(depCity, stopOverCity)
    let findSecondShortFlight = findRoute(stopOverCity, arrCity)
    let findLongFlight = findRoute(depCity, arrCity)

    logger.debug('flightsPrice is ', flightsPrice)
    let FirstShortFlightArrNumber = flightsPrice.findIndex(findFirstShortFlight)
    let SecondShortFlightArrNumber = flightsPrice.findIndex(findSecondShortFlight)
    let LongFlightArrNumber = flightsPrice.findIndex(findLongFlight)

    console.log(FirstShortFlightArrNumber);
    console.log(SecondShortFlightArrNumber);
    console.log(LongFlightArrNumber);

    data.flightsPrice[0] = flightsPrice[FirstShortFlightArrNumber];
    data.flightsPrice[1] = flightsPrice[LongFlightArrNumber];
    data.flightsPrice[2] = flightsPrice[SecondShortFlightArrNumber];

    data.route =  depCity +　'-' + stopOverCity　+ '-' + arrCity;
    // date.route = data.route.toUpperCase() ;
    let timeUsed = new Date() - timeStart
    logger.info('Time use :', timeUsed)
    logger.debug('byCityStopOver', data)
    res.render('byCityStopOver', data)
    // res.send(data)
  })
});

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
      logger.info('lt is ok ', depCity, ' to ', arrCity)
      result = {flightPrice: result}
      logger.debug(`${depCity} to ${arrCity} data :`,result)
      resolve(result)
    })
  })
}
function queryLongPriceByCityAtCatalogue(depCity, arrCity, catalogue){
  let result = {
    depCity: depCity,
    arrCity: arrCity,
    catalogue: catalogue,
    formatedCatalogue: (new Date(parseInt(catalogue))),
  }
  logger.debug("result", result)
  return new Promise(function(resolve, reject){
    distinctDepDateQueryByCity(result)
    .then(function(result){
      return distinctFlightsQueryByCity(result)
    })
    .then(function(result){
      logger.debug('distinctDepDateQueryByCity is ok')
      return longPriceQueryByCity(result)
    })
    .then(function(result){
      logger.debug('longPriceQueryByCity is ok')
      // logger.debug(rows)
      logger.info('lt is ok ', depCity, ' to ', arrCity)
      result = {flightPrice: result}
      // logger.debug(result)
      resolve(result)
    })
  })
}


app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
