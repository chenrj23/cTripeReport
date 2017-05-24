const request = require('superagent');
const charset = require('superagent-charset');
charset(request);

const log4js = require('log4js');
log4js.configure('../config/my_log4js_configuration.json')
const logger = log4js.getLogger('cTrip.js')

const logLevel = process.env.logLevel || 'info'
logger.setLevel(logLevel);

const connectMysql = require('./connectMysql.js');
const pool = connectMysql.pool;

const requsetAgain = 3;

function initreq(){
  return new Promise(function(resolve, reject) {
    const ctrip = request.agent()
    ctrip.get('http://flights.ctrip.com/booking/sha-kwe-day-1.html?ddate1=2017-05-25')
    .then((result)=>{
      logger.debug('get cookie:', result)
      logger.info('get cookie success!')
      resolve(ctrip)
    },err=>{
      throw new Error(err)
    })
  });
}
// initreq().then(ctrip=>{
//   console.log(ctrip);
//   ctrip.get('http://flights.ctrip.com/domesticsearch/search/SearchFirstRouteFlights?DCity1=SHA&ACity1=KWE&SearchType=S&DDate1=2017-05-25&IsNearAirportRecommond=0&LogToken=0798b09e899d4ff087bf68ee5f4748cd&rk=5.807500556901317201250&CK=288D49CD4426E90D1B9027776BA017BA&r=0.1838802595241774862313')
//          .then(result=>{
//            logger.info(result)
//          })
// })

function setSearchParam(depDate, depAiCode, arrAirCode) {
    var requestHttp = `http://flights.ctrip.com/domesticsearch/search/SearchFirstRouteFlights?DCity1=${depAiCode}&ACity1=${arrAirCode}&SearchType=S&DDate1=${depDate}&LogToken=5ef45f7846b24fd2bf41f836cdf69832&CK=A40875E7E0BFDB8E7C75AA6A038668A2&r=0.84814912185842484141`;
    logger.debug(depDate, depAiCode, arrAirCode, 'requestHttp = ', requestHttp)
    return requestHttp
}

function filter(resJson, depDate, depAiCode, arrAirCode, catalogue) {
  return new Promise(function(resolve, reject) {

    if (resJson.Error) {

      logger.error(depAiCode, arrAirCode, depDate, 'request error!')
      logger.error(resJson.Error)
      logger.error('resJson:',resJson)

      reject(new Error(resJson.Error))

    }else {
      const flightDataArrays = resJson.fis;
      if(flightDataArrays.length > 0){
        let filteredData = flightDataArrays.map(function(flightData) {

          const airlineCode = flightData.fn.slice(0, 2),
                flightNo = flightData.fn.slice(2),
                depAirport = flightData.dpc,
                arrAirport = flightData.apc,
                depCity = flightData.dcc,
                arrCity = flightData.acc,
                fType = flightData.cf.c,
                depDate = flightData.dt.slice(0,10),
                depDateTime = flightData.dt.slice(11),
                price = Number(flightData.lp);

          let isShare = false,
              isStopover = false,
              isCombinedTransport = false,
              shareFlight = 'none',
              stopoverCity = 'none',
              combinedTransport = 'none';

          if (flightData.sdft) {
            shareFlight = flightData.sdft;
            isShare = true;
          };

          if (flightData.sts) {
            isStopover = true;
            stopoverCity = '';
            for (let sts of flightData.sts) {
              stopoverCity += sts.cn;
            }
          };

          if (flightData.xpsm) {
            isCombinedTransport = true;
            combinedTransport = `from ${flightData.axp.ts.cn} by ${flightData.axp.num} `
          }


          let mysqlStructure = [
            airlineCode,
            flightNo,
            depDate,
            depDateTime,
            price,
            depCity,
            depAirport,
            arrCity,
            arrAirport,
            fType,
            isShare,
            shareFlight,
            isStopover,
            stopoverCity,
            isCombinedTransport,
            combinedTransport,
            catalogue,
          ];
          //
          logger.debug('mysqlStructure: ',mysqlStructure);
          return mysqlStructure
        })
        logger.debug('filteredData: ',filteredData);

        pool.query('INSERT INTO flightsdata (airlineCode,flightNo,depDate,depDateTime,price,depCity,depAirport,arrCity,arrAirport,fType,isShare,shareFlight,isStopover,stopoverCity,isCombinedTransport,combinedTransport,catalogue) VALUES ?', [filteredData], function(err, result) {
          if (err) {
            logger.error(depDate, depAiCode, arrAirCode, 'insert have an error')
            logger.error('flightDataArrays: ', flightDataArrays)
            logger.error('filteredData:', [filteredData])
            logger.error('insert error:', err)
            reject(err)
          }
          logger.info(depDate, depAiCode, arrAirCode, 'insert')
          resolve({depDate, depAiCode, arrAirCode})
        });
      }else {
        logger.info('flightDataArrays is []')
        resolve(null)
      }

    }
  });

}


function req(agent, depDate, depAiCode, arrAirCode, errCount = requsetAgain) {
  return new Promise(function(resolve, reject) {
    logger.info(depDate, depAiCode, arrAirCode,"resquest start")
    let errHead = `${depDate} from ${depAiCode} to ${arrAirCode} `
    let searchParam = setSearchParam(depDate, depAiCode, arrAirCode);
    // logger.info(errCount)
    agent
    .get(searchParam)
    .charset('gbk')
    .timeout(10000)
    .end(function(err, res) {
      if (err || res.Error) {
        errCount--;

        logger.error(errHead, err)
        logger.error(errHead, `errCount: `, errCount)
        logger.error('res: ',res)

        if (errCount === 0) {
          logger.fatal(errHead, `request fail`)
          reject(new Error('request fail, net maybe have err!'))

        } else {
          req(depDate, depAiCode, arrAirCode, errCount)
          .then(data=>resolve(data), reason=>reject(reason))
        }

      } else {

        try {
          let resJson = JSON.parse(res.text);
          let data = {resJson, depDate, depAiCode, arrAirCode,}
          resolve(data)
        } catch (e) {
          errCount--;
          logger.error('errCount :', errCount)
          logger.error('parse err :', res.text)
          reject(e)
        }

      }
    })

  });

}

exports.initreq = initreq
exports.req = req
exports.filter = filter
