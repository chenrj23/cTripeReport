const request = require('superagent');
const charset = require('superagent-charset');
charset(request);

const log4js = require('log4js');
log4js.configure('../config/my_log4js_configuration.json')
let logger = log4js.getLogger('console');
let loggerFile = log4js.getLogger('fileLog'); //应模块化
logger.setLevel('debug');

const connectMysql = require('./connectMysql.js');
const pool = connectMysql.pool;

const requsetAgain = 3;

function setSearchParam(depDate, depAiCode, arrAirCode) {
    var requestHttp = `http://flights.ctrip.com/domesticsearch/search/SearchFirstRouteFlights?DCity1=${depAiCode}&ACity1=${arrAirCode}&SearchType=S&DDate1=${depDate}&LogToken=5ef45f7846b24fd2bf41f836cdf69832&CK=A40875E7E0BFDB8E7C75AA6A038668A2&r=0.84814912185842484141`;
    return requestHttp
}

function filter(resJson, depDate, depAiCode, arrAirCode, catalogue) {
  return new Promise(function(resolve, reject) {

    if (resJson.Error) {
      loggerFile.error(depAiCode, arrAirCode, depDate, 'request error!')
      loggerFile.error(resJson.Error)
      reject(resJson.Error)
    }else {
      let flightDataArrays = resJson.fis;
      if(flightDataArrays.length > 0){
        let filteredData = flightDataArrays.map(function(flightData) {
          let flightNo,
          airlineCode,
          depAirport,
          arrAirport,
          depCity,
          arrCity,
          depDate,
          depDateTime,
          price,
          fType,
          // lowestPrice,
          // fullPrice,
          isShare = false,
          isStopover = false,
          isCombinedTransport = false,
          shareFlight = 'none',
          stopoverCity = 'none',
          combinedTransport = 'none';

          flightNo = flightData.fn;
          depAirport = flightData.dpc;
          arrAirport = flightData.apc;
          depCity = flightData.dcc;
          arrCity = flightData.acc;
          fType = flightData.cf.c;
          depDateTime = flightData.dt;
          price = Number(flightData.lp);
          // console.log(price);
          // console.log(typeof depDateTime);

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


          let mysqlStructure = {
            airlineCode: flightNo.slice(0, 2),
            flightNo: flightNo.slice(2),
            depDate: depDateTime.slice(0, 10),
            depDateTime: depDateTime.slice(11),
            price: price,
            depCity: depCity,
            depAirport: depAirport,
            arrCity: arrCity,
            arrAirport: arrAirport,
            fType: fType,
            isShare: isShare,
            shareFlight: shareFlight,
            isStopover: isStopover,
            stopoverCity: stopoverCity,
            isCombinedTransport: isCombinedTransport,
            combinedTransport: combinedTransport,
            catalogue: catalogue,
          };
          //
          let arr = [];
          for (let i in mysqlStructure) {
            arr.push(mysqlStructure[i]);
          }
          // console.log(mysqlStructure);
          return arr
        })
        // logger.debug(filteredData)

        pool.query('INSERT INTO flightsdata (airlineCode,flightNo,depDate,depDateTime,price,depCity,depAirport,arrCity,arrAirport,fType,isShare,shareFlight,isStopover,stopoverCity,isCombinedTransport,combinedTransport,catalogue) VALUES ?', [filteredData], function(err, result) {
          if (err) {
            loggerFile.error(depDate, depAiCode, arrAirCode, 'insert have an error')
            loggerFile.error('flightDataArrays: ', flightDataArrays)
            loggerFile.error('filteredData:', [filteredData])
            loggerFile.error('insert error:', err)
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


function req(depDate, depAiCode, arrAirCode, errCount = requsetAgain) {
  return new Promise(function(resolve, reject) {
    logger.info(depDate, depAiCode, arrAirCode,"resquest start")
    let errHead = `${depDate} from ${depAiCode} to ${arrAirCode} `
    let searchParam = setSearchParam(depDate, depAiCode, arrAirCode);
    // logger.info(errCount)
    request
    .get(searchParam)
    .charset('gbk')
    .timeout(10000)
    .end(function(err, res) {
      // logger.debug(res)
      if (err || res.Error) {
        err.errCount = --errCount;
        loggerFile.error(errHead, err)
        loggerFile.error(errHead, `errCount: `, errCount)
        if (errCount === 0) {
          loggerFile.fatal(errHead, `request fail`)
          process.exit(1);
        } else {
          req(depDate, depAiCode, arrAirCode, errCount)
          .then((data)=>resolve(data))
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
          loggerFile.error('errCount :', errCount)
          loggerFile.error('parse err :', res.text)
          reject(e)
        }
      }
    })

  });



}

exports.req = req
exports.filter = filter
// function search(depDate, depAiCode, arrAirCode, searchDayLong) {
//     if (searchDayLong === 1) {
//         reqCTrip(deptDate, deptAirportCode, arrAirportCode);
//     } else {
//         let timeCount = 0;
//         for (let i = 0; i < searchDayLong; i++) {
//             let deptDateAdded = moment(deptDate).add(i, 'days').format('YYYY-MM-DD');
//             setTimeout(function() {
//               reqCTrip(deptDateAdded, deptAirportCode, arrAirportCode);
//             }, timeCount)
//             timeCount += speed;
//             // console.log(timeCount);
//
//             // timeParams.push(timeParam)
//         }
//     }
// }
