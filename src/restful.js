const express = require('express');
const app = express();
const log4js = require('log4js');
const mysql      = require('mysql');
const path = require('path');
const connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'chenrj23',
  database : 'cTrip',
});

app.set('views', '../views')
app.set('view engine', 'pug')
app.use('/', express.static(path.join(__dirname, '../public')));

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
    let distinctFlightsQueryString = `SELECT distinct airlineCode, flightNo , depDateTime from flightsdata where depAirport = '${result.depAirport}' and  arrAirport = '${result.arrAirport}' and catalogue = '${result.catalogue}' order by  depDateTime`;
    connection.query(distinctFlightsQueryString, function(err, rows, fields) {
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
    return flight.depDateTime == time && flight.flight == flightID
  }
}

function longPriceQuery (result){
  return new Promise(function(resolve, reject){
    let queryString = `select concat(airlineCode, flightNo) flight, depDate, depDateTime, price from flightsdata where depAirport = '${result.depAirport}' and arrAirport = '${result.arrAirport}' and catalogue = '${result.catalogue}' order by depDate, depDateTime`
    connection.query(queryString, function(err, rows, fields) {
      if (err) throw err;
      let longPrices = [];
      //
      for (let flight of result.flights) {
        let findTheTime = findTime(flight.depDateTime, flight.flightID);
        let filteredFlights = rows.filter(findTheTime)
        let longPrice = {
          flight: flight.flightID,
          depTime: flight.depDateTime,
        }
        // console.log(filteredFlight);
        for (let  filteredFlight of filteredFlights) {
          let depDate = filteredFlight.depDate.slice(5)
          longPrice[depDate] = filteredFlight.price
        }
        longPrice.key = longPrice.flight + longPrice.depTime

        longPrices.push(longPrice)
      }
      result.longPrice = longPrices
      resolve(result)
    });
  })
}


app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS");
    res.header("X-Powered-By",' 3.2.1')
    res.header("Content-Type", "application/json;charset=utf-8");
    next();
});


app.get('/', function (req, res) {
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
    // res.render('index', result);
    // res.header("Access-Control-Allow-Origin", "*");

    res.send(result);
  })
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
