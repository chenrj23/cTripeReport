const express = require('express');
const app = express();
const log4js = require('log4js');
const mysql      = require('mysql');
const connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'chenrj23',
  database : 'cTrip',
});

app.set('views', '../views')
app.set('view engine', 'pug')

connection.connect(function(err) {
  if (err) {
    logger.error('error connecting: ' + err.stack);
    return;
  }
  logger.info('connected as id ' + connection.threadId);
});

log4js.configure({
  appenders: [
    { type: 'console' },
    { type: 'file', filename: '../logs/cTrip.log', category: 'fileLog' }
  ]
});

let logger = log4js.getLogger('console');
let loggerFile = log4js.getLogger('fileLog');

logger.setLevel('debug');


// SELECT * FROM flightsdata where depAirport = 'ZUH' and  arrAirport = 'PVG' order by depDate, depDateTime;
// SELECT * from flightsdata where airlineCode = 'SC' and  flightNo = '8824' order by depDate, depDateTime;

function catalogueMaxQuery(depAirport, arrAirport){
  return new Promise(function(resolve,reject){
    let catalogueMaxQueryString = `select max(catalogue) from flightsdata where depAirport = '${depAirport}' and arrAirport = '${arrAirport}'`;
    connection.query(catalogueMaxQueryString, function(err, rows, fields) {
      if (err) throw err;
      let catalogue = rows[0]['max(catalogue)']
      let result = {
        depAirport: depAirport,
        arrAirport: arrAirport,
        catalogue: catalogue,
      }
      resolve(result)
    });
  })
}


function distinctFlightsQuery (result){
  return new Promise(function(resolve, reject){
    let distinctFlightsQueryString = `SELECT distinct airlineCode, flightNo , depDateTime from flightsdata where depAirport = '${result.depAirport}' and  arrAirport = '${result.arrAirport}' and catalogue = '${result.catalogue}' order by depDate, depDateTime`;
    connection.query(distinctFlightsQueryString, function(err, rows, fields) {
      if (err) throw err;
      let flights = rows.map(function(item, index){
        return {flightID: item.airlineCode +　item.flightNo,
                depDateTime: item.depDateTime,
        }
      })
      // logger.debug(rows)
      result.routes = `${result.depAirport}${result.arrAirport}`;
      result.flights = flights;
      resolve(result)
    });
  })
}

function distinctDepDateQuery(result){
  return new Promise(function(resolve, reject){
    let distinctDepDateQueryString = `select distinct(depDate) from flightsdata where arrAirport = '${result.arrAirport}' and depAirport = '${result.depAirport}' and catalogue = '${result.catalogue}' order by depDate`
    connection.query(distinctDepDateQueryString, function(err, rows, fields) {
      if (err) throw err;
      let times = rows.map(function(item, index){
        return item.depDate
      })
      result.depDates = times
      resolve(result)
    });
  })
}

function findTime(time, flightID){
  return function(flight){
    return flight.depDate == time && flight.flight == flightID
  }
}

function longPriceQuery (result){
  return new Promise(function(resolve, reject){
    let queryString = `select concat(airlineCode, flightNo) flight, depDate, depDateTime, price from flightsdata where depAirport = '${result.depAirport}' and arrAirport = '${result.arrAirport}' and catalogue = '${result.catalogue}' order by depDate, depDateTime`
    connection.query(queryString, function(err, rows, fields) {
      if (err) throw err;
      result.longPrice = result.flights.map(function(flight){
        let longPrice = {
          airline: flight.flightID,
          depDateTime: flight.depDateTime,
          prices: [],
        }
        for (let time of result.depDates) {
          let findTheTime = findTime(time, flight.flightID);
          let depDataFlight = rows.find(findTheTime)
          if (depDataFlight) {
            longPrice.prices.push({
              depDate: time,
              price: depDataFlight.price,
            })
          }else {
            longPrice.prices.push({
              depDate: time,
              price: 'null',
            })
          }
        }
        return longPrice
      })

      resolve(result)
    });
  })
}

app.get('/', function (req, res) {
  res.render('index', { title: 'Hey', message: 'Hello there!'});
})

app.get('/api/', function (req, res) {
  let depAirport = req.query.depAirport
  let arrAirport = req.query.arrAirport
  catalogueMaxQuery(depAirport, arrAirport)
  .then(function(result){
    return distinctFlightsQuery(result)
  })
  .then(function(result){
    return distinctDepDateQuery(result)
  })
  .then(function(result){
    return longPriceQuery(result)
  })
  .then(function(result){
    // logger.debug(rows)
    res.render('index', result);
    // res.send(result);
  })
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
