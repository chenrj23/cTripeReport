const express = require('express');
const app = express();
const log4js = require('log4js');
const mysql      = require('mysql');
const connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'ecm.361',
  database : 'test',
});

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


// SELECT * FROM test.flightsdata where depAirport = 'ZUH' and  arrAirport = 'PVG' order by depDate, depDateTime;
// SELECT * from test.flightsdata where airlineCode = 'SC' and  flightNo = '8824' order by depDate, depDateTime;

function catalogueMaxQuery(){
  return new Promise(function(resolve,reject){
    let catalogueMaxQueryString = `select max(catalogue) from test.flightsdata where depAirport = 'ZUH' and arrAirport = 'PVG'`;
    connection.query(catalogueMaxQueryString, function(err, rows, fields) {
      if (err) throw err;
      let catalogue = rows[0]['max(catalogue)']
      resolve(catalogue)
    });
  })
}


function distinctFlightsQuery (catalogue){
  return new Promise(function(resolve, reject){
    let distinctFlightsQueryString = `SELECT distinct airlineCode, flightNo from test.flightsdata where depAirport = 'ZUH' and  arrAirport = 'PVG' and catalogue = '${catalogue}' order by depDate, depDateTime`;
    connection.query(distinctFlightsQueryString, function(err, rows, fields) {
      if (err) throw err;
      logger.debug(rows)
      resolve(rows)
    });
  })
}

function longPriceQuery (){
  return new Promise(function(resolve, reject){
    connection.query(flightQueryString, function(err, rows, fields) {
      if (err) throw err;
      resolve(rows)
    });
  })
}

app.get('/api/', function (req, res) {
  catalogueMaxQuery()
  .then(function(catalogue){
    return distinctFlightsQuery(catalogue)
  })
  .then(function(rows){
    logger.debug(rows)
    res.send(rows);
  })
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
