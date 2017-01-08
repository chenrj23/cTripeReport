const request = require('superagent');
const charset = require('superagent-charset');
charset(request);

const log4js = require('log4js');
log4js.configure('../config/my_log4js_configuration.json')
let logger = log4js.getLogger('console');
let loggerFile = log4js.getLogger('fileLog'); //可以模块化
logger.setLevel('debug');

const connectMysql = require('./connectMysql.js');
const pool = connectMysql.pool;

let catalogue = (new Date).getTime();
const collection = ['PVGHRB', 'HRBPVG', 'PVGKWL', 'KWLPVG', 'SYXPVG', 'PVGSYX', 'PVGKWE', 'KWEPVG', 'KWEWNZ', 'WNZKWE', 'PVGZUH', 'ZUHPVG', 'ZUHCGO', 'CGOZUH', 'CGOHAK', 'HAKCGO', 'WNZHAK', 'HAKWNZ', 'ZUHTNA', 'TNAZUH', 'SZXTYN', 'TYNSZX', 'HETTYN', 'TYNHET', 'SZXHET', 'HETSZX', 'szxxic', 'xicszx', 'xicmig', 'migxic', 'migtna', 'tnamig', 'szxmig', 'migszx', 'xictna', 'tnaxic', 'szxhld', 'hldszx', 'hethld', 'hldhet']

const requsetAgain = 3;

function setSearchParam(depDate, depAiCode, arrAirCode) {
    var requestHttp = `http://flights.ctrip.com/domesticsearch/search/SearchFirstRouteFlights?DCity1=${depAiCode}&ACity1=${arrAirCode}&SearchType=S&DDate1=${depDate}&LogToken=5ef45f7846b24fd2bf41f836cdf69832&CK=A40875E7E0BFDB8E7C75AA6A038668A2&r=0.84814912185842484141`;
    return requestHttp
}

function filter(resJson, depDate, depAiCode, arrAirCode) {
    if (resJson.Error) {
        loggerFile.error(depAiCode, arrAirCode, depDate, 'request error!')
        loggerFile.error(resJson.Error)
        return
    }
    let flightDataArrays = resJson.fis;
    // console.log(resJson);
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
            // loggerFile.error(err)
            // loggerFile.error('INSERT INTO flightsdata (airlineCode,flightNo,depDate,depDateTime,price,depAirport,arrAirport,fType,isShare,shareFlight,isStopover,stopoverCity,isCombinedTransport,combinedTransport,catalogue) VALUES ?')
            loggerFile.error(depDate, depAiCode, arrAirCode, 'insert have an error')
            loggerFile.error('flightDataArrays: ', flightDataArrays)
            loggerFile.error('filteredData:', [filteredData])
            loggerFile.error('insert error:', err)
            return
        }
        logger.info(depDate, depAiCode, arrAirCode, 'insert')
            // queryCount--;
            // logger.debug('query count is: ', queryCount)
            // logger.debug('query is start', result)
            // if (queryCount <= 0) {
            //     // connection.end();
            // }
    });
}


function req(depDate, depAiCode, arrAirCode, errCount = requsetAgain) {
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
                    reqCTrip(depDate, depAiCode, arrAirCode, errCount)
                }
            } else {
                let resJson = JSON.parse(res.text);
                filter(resJson, depDate, depAiCode, arrAirCode) // resolve(res)
            }
        })
}

exports.req = req
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

function longSearch(searchDayLong){
  let timeCount = 0;
  catalogue = (new Date).getTime();
  loggerFile.debug('catalogue: ',catalogue)
  for (let route of collection) {
    let depAirCode = route.slice(0, 3)
    let arrAirCode = route.slice(3, 6)
    // let deptDate = moment().format('YYYY-MM-DD')
    setTimeout(function() {
      search(depDate, depAirCode, arrAirCode, searchDayLong)
    }, timeCount)
    timeCount += searchDayLong*speed;
  }
}
//
if (searchDefault) {
  longSearch(searchDayLong)
}
//
//
// if (depDate && depAirCode && arrAirCode && searchDayLong) {
//   search(depDate, depAirCode, arrAirCode, searchDayLong)
// }
//
// if (insist) {
//   var job = new CronJob({
//     cronTime: insist,
//     onTick: function() {
//       longSearch(searchDayLong)
//     },
//     start: false,
//     timeZone: 'Asia/Shanghai'
//   });
//   job.start();
// }
