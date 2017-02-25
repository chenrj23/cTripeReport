const mysql = require('mysql');
const moment = require('moment');
const pool = mysql.createPool({
    connectionLimit: 10,
    host: '120.27.5.155',
    user: 'root',
    password: 'y8kyscsy',
    database: 'cTrip'
});

const redis = require("redis");
const client = redis.createClient({
    host: '120.27.5.155',
    password: 'Y8kyscsy'
});

const log4js = require('log4js');
log4js.configure('../config/my_log4js_configuration.json')
let logger = log4js.getLogger('cTripModule.js');

const logLevel = process.env.logLevel || 'info'
logger.setLevel(logLevel);


function catalogueMaxQuery(depAirport, arrAirport) {
    return new Promise(function(resolve, reject) {
        let catalogueMaxQueryString = `select max(catalogue) from flightsdata where depAirport = '${depAirport}' and arrAirport = '${arrAirport}'`;
        pool.query(catalogueMaxQueryString, function(err, rows, fields) {
            if (err) throw err;
            let catalogue = rows[0]['max(catalogue)']
            let result = {
                depAirport: depAirport,
                arrAirport: arrAirport,
                catalogue: catalogue,
                formatedCatalogue: (new Date(parseInt(catalogue))),
            }
            resolve(result)
        });
    })
}

function catalogueMaxQueryByCity(depCity, arrCity) {
    return new Promise(function(resolve, reject) {
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


function distinctFlightsQuery(result) {
    return new Promise(function(resolve, reject) {
        let distinctFlightsQueryString = `SELECT distinct airlineCode, flightNo , depDateTime from flightsdata where depAirport = '${result.depAirport}' and  arrAirport = '${result.arrAirport}' and catalogue = '${result.catalogue}' order by  depDateTime`;
        pool.query(distinctFlightsQueryString, function(err, rows, fields) {
            if (err) throw err;
            let flights = [];
            for (let flight of rows) {
                flights.push({
                    flightID: flight.airlineCode + 　flight.flightNo,
                    depDateTime: flight.depDateTime,
                })
            }
            result.route = `${result.depAirport}${result.arrAirport}`;
            result.route = result.route.toUpperCase();
            result.flights = flights;
            resolve(result)
        });
    })
}

function distinctFlightsQueryByCity(result) {
    return new Promise(function(resolve, reject) {
        let distinctFlightsQueryString = `SELECT distinct airlineCode, flightNo , depDateTime from flightsdata where depCity = '${result.depCity}' and  arrCity = '${result.arrCity}' and catalogue = '${result.catalogue}' and isShare='0'  order by  depDateTime`;
        pool.query(distinctFlightsQueryString, function(err, rows, fields) {
            if (err) throw err;
            let flights = [];
            for (let flight of rows) {
                flights.push({
                    flightID: flight.airlineCode + 　flight.flightNo,
                    depDateTime: flight.depDateTime,
                })
            }

            result.route = `${result.depCity}${result.arrCity}`;
            result.route = result.route.toUpperCase();
            result.flights = flights;
            resolve(result)
        });
    })
}

function distinctDepDateQuery(result) {
    return new Promise(function(resolve, reject) {
        let distinctDepDateQueryString = `select distinct(depDate) from flightsdata where arrAirport = '${result.arrAirport}' and depAirport = '${result.depAirport}' and catalogue = '${result.catalogue}' order by depDate`
        pool.query(distinctDepDateQueryString, function(err, rows, fields) {
            if (err) throw err;
            let times = rows.map(function(item, index) {
                return item.depDate
            })
            result.depDates = times
            resolve(result)
        });
    })
}

function distinctDepDateQueryByCity(result) {
    return new Promise(function(resolve, reject) {
        let distinctDepDateQueryString = `select distinct(depDate) from flightsdata where depCity = '${result.depCity}' and  arrCity = '${result.arrCity}'and catalogue = '${result.catalogue}' order by depDate`
        pool.query(distinctDepDateQueryString, function(err, rows, fields) {
            if (err) throw err;
            let times = rows.map(function(item, index) {
                return moment(item.depDate).format('MM-DD')
            })
            result.depDates = times
            resolve(result)
        });
    })
}

function findCatalogue(depCity, arrCity, day){
  return new Promise(function(resolve, reject) {
    let findCatalogueQueryString = `select distinct(catalogue) from flightsdata where searchTime >= '${day}' and searchTime < '${day}' + INTERVAL 1 DAY and depCity = '${depCity}' and  arrCity = '${arrCity}'`
    logger.info(findCatalogueQueryString)
    pool.query(findCatalogueQueryString, function(err, rows, fields){
      if (err) throw err;
      logger.info(rows)
      let catalogues = rows.map(function(item, index) {
          return item.catalogue
      })
      resolve(catalogues)
    })
  });
}

function findHistory(depCity, arrCity, day){
  return new Promise(function(resolve, reject) {
    findCatalogue(depCity, arrCity, day)
    .then((catalogues)=>{
      let findHistoryByCatalogues = catalogues.map(function(item, index){
        return queryLongPriceByCityAtCatalogue(depCity, arrCity, item)
      })
      Promise.all(findHistoryByCatalogues)
      .then(data=>{
        dataJson = {flightsPrice: data}
        resolve(dataJson)
      })
    })
  });
}

function findTime(time, flightID, depDateTime) {
    return function(flight) {
        return moment(flight.depDate).format('MM-DD') == time && flight.flight == flightID && flight.depDateTime == depDateTime
    }
}

function longPriceQuery(result) {
    return new Promise(function(resolve, reject) {
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
                    } else {
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

function longPriceQueryByCity(result) {
    return new Promise(function(resolve, reject) {
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
                let advancedDate = (depDate - NowDate) / 86400000;
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
                    } else {
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

function findRoute(depAirport, arrAirport) {
    let route = depAirport + arrAirport;
    route = route.toUpperCase()
    logger.debug("route is ", route)
    return function(data) {
        const flightPrice = data.flightPrice
        // logger.debug("flightPrice is ", flightPrice)
        // logger.debug("flightPrice route is ", flightPrice.route)
        return flightPrice.route == route
    }
}

function queryLongPriceByCity(depCity, arrCity) {
    return new Promise(function(resolve, reject) {
        catalogueMaxQueryByCity(depCity, arrCity)
            .then(function(result) {
                return distinctFlightsQueryByCity(result)
            })
            .then(function(result) {
                return distinctDepDateQueryByCity(result)
            })
            .then(function(result) {
                return longPriceQueryByCity(result)
            })
            .then(function(result) {
                // logger.debug(rows)
                logger.info('lt is ok ', depCity, ' to ', arrCity)
                result = {
                    flightPrice: result
                }
                logger.debug(`${depCity} to ${arrCity} data :`, result)
                resolve(result)
            })
    })
}

function queryLongPriceByCityAtCatalogue(depCity, arrCity, catalogue) {
    let result = {
        depCity: depCity,
        arrCity: arrCity,
        catalogue: catalogue,
        formatedCatalogue: (new Date(parseInt(catalogue))),
    }
    logger.debug("result", result)
    return new Promise(function(resolve, reject) {
        distinctDepDateQueryByCity(result)
            .then(function(result) {
                return distinctFlightsQueryByCity(result)
            })
            .then(function(result) {
                logger.debug('distinctDepDateQueryByCity is ok')
                return longPriceQueryByCity(result)
            })
            .then(function(result) {
                logger.debug('longPriceQueryByCity is ok')
                // logger.debug(rows)
                logger.info('lt is ok ', depCity, ' to ', arrCity)
                result = {
                    flightPrice: result
                }
                // logger.debug(result)
                resolve(result)
            })
    })
}

function queryStopOver(depCity, stopOverCity, arrCity) {
    return new Promise(function(resolve, reject) {
        let fSFlight = getFromCache(depCity + stopOverCity)
        let sSFlight = getFromCache(stopOverCity + arrCity)
        let longFlight = getFromCache(depCity + arrCity)
        Promise.all([fSFlight, longFlight, sSFlight])
            .then(data => {
                dataJson = {
                    flightsPrice: [
                        data[0],
                        data[1],
                        data[2]
                    ]
                }
                resolve(dataJson)
                logger.debug(dataJson)
            })
    });
}

function cache(depCity, arrCity) {
  return  new Promise(function(resolve, reject) {
    let timeStart = new Date()
    logger.info('cacheing from ', depCity, ' to ', arrCity)
    queryLongPriceByCity(depCity, arrCity)
    .then(function(result) {
      let queryTimeUsed = new Date() - timeStart
      logger.info('queryTimeUsed use :', queryTimeUsed)
      let resultString = JSON.stringify(result)
      logger.debug("result", resultString)
      let route = depCity.toUpperCase() + arrCity.toUpperCase()
      logger.debug('key:', route)
      client.set(route, resultString, redis.print);
      let redisSetTimeUsed = new Date() - queryTimeUsed;
      logger.info('redisSetTimeUsed:', redisSetTimeUsed)
      resolve('redisSet OK')
    },(err)=>logger.error('cache err:', err))

  });
}

function getFromCache(route) {
    return new Promise((resolve, reject) => {
        client.get(route.toUpperCase(), (err, reply) => {
            if (err) {
                logger.error('redis get have err', err)
                throw err;
            } else {
                const replyJson = JSON.parse(reply)
                if (replyJson) {
                    replyJson.flightPrice.formatedCatalogue = new Date(parseInt(replyJson.flightPrice.catalogue))
                    logger.debug(replyJson)
                    resolve(replyJson)
                } else {
                    reject(new Error(`No this ${route}`))
                }
            }
        })
    })
}

function CTripe() {
    this.name = 'test'
}

CTripe.prototype.cache = cache;
CTripe.prototype.findHistory = findHistory;
CTripe.prototype.getFromCache = getFromCache;
CTripe.prototype.queryStopOver = queryStopOver;
CTripe.prototype.findCatalogue = findCatalogue;
CTripe.prototype.queryLongPriceByCity = queryLongPriceByCity;
CTripe.prototype.queryLongPriceByCityAtCatalogue = queryLongPriceByCityAtCatalogue;

module.exports = new CTripe;
