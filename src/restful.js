const express = require('express');
const app = express();
const path = require('path');

const log4js = require('log4js');
log4js.configure('../config/my_log4js_configuration.json')
let logger = log4js.getLogger('restful.js');
logger.setLevel('debug');

const cTrip = require('./cTripModule.js');

app.set('views', '../views')
app.set('view engine', 'pug')
app.use('/', express.static(path.join(__dirname, '../public')));


app.get('/api/byCity', function (req, res) {
  let depCity = req.query.depCity
  let arrCity = req.query.arrCity
  let timeStart = new Date()
  logger.info('have a req from ', depCity, ' to ', arrCity)

  cTrip.queryLongPriceByCity(depCity, arrCity)
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
  const route = depCity.toUpperCase() + arrCity.toUpperCase()
  cTrip.getFromCache(route)
    .then(data=>res.render('index', data),reason=>res.end(reason))
    .catch(err=>{
      logger.error(err)
      res.end(err)
    })
});

// app.get('/api/byCityAtCatalogue', function (req, res) {
//   let depCity = req.query.depCity
//   let arrCity = req.query.arrCity
//   let catalogue = req.query.catalogue
//   let timeStart = new Date()
//   logger.info('have a req from ', depCity, ' to ', arrCity)
//   queryLongPriceByCityAtCatalogue(depCity, arrCity, catalogue)
//     .then(function(result){
//       let timeUsed = new Date() - timeStart
//       logger.info('Time use :', timeUsed)
//       res.render('index', result)
//     })
// });

app.get('/api/byCityStopOver', function (req, res) {
  let depCity = req.query.depCity
  let stopOverCity = req.query.stopOverCity
  let arrCity = req.query.arrCity

  logger.info('have a req StopOver from ', depCity, ' to ', stopOverCity , ' to ', arrCity)
  cTrip.queryStopOver(depCity, stopOverCity, arrCity)
    .then(data=>{
      logger.info('data get')
      res.render('byCityStopOver', data)
    })
    .catch(err=>{
      logger.error(err)
      res.end(err)
    })

});


app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
