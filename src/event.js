const EventEmitter = require('events');
const request = require('superagent');
const charset = require('superagent-charset');
charset(request);
const log4js = require('log4js');
const mysql = require('mysql');

const pool  = mysql.createPool({
  connectionLimit : 10,
  host            : '120.27.5.155',
  user            : 'root',
  password        : '',
  database        : 'cTrip'
});


log4js.configure({
    appenders: [{
        type: 'console'
    }, {
        type: 'file',
        filename: '../logs/cTrip.log',
        category: 'fileLog'
    }]
});

let logger = log4js.getLogger('console');
let loggerFile = log4js.getLogger('fileLog');

// logger.debug(errHead)
logger.setLevel('debug');


function setSearchParam(deptDate, deptAirportCode, arrAirportCode) {
    var requestHttp = `http://flights.ctrip.com/domesticsearch/search/SearchFirstRouteFlights?DCity1=${deptAirportCode}&ACity1=${arrAirportCode}&SearchType=S&DDate1=${deptDate}&LogToken=5ef45f7846b24fd2bf41f836cdf69832&CK=A40875E7E0BFDB8E7C75AA6A038668A2&r=0.84814912185842484141`;
    return requestHttp
}

function filter(resJson, deptDate, deptAirportCode, arrAirportCode) {
    if (resJson.Error) {
        loggerFile.error(deptAirportCode, arrAirportCode, deptDate, 'request error!')
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
            loggerFile.error(deptDate, deptAirportCode, arrAirportCode, 'insert have an error')
            loggerFile.error('flightDataArrays: ', flightDataArrays)
            loggerFile.error('filteredData:', [filteredData])
            loggerFile.error('insert error:', err)
            return
        }
        logger.info(deptDate, deptAirportCode, arrAirportCode, 'insert')
            // queryCount--;
            // logger.debug('query count is: ', queryCount)
            // logger.debug('query is start', result)
            // if (queryCount <= 0) {
            //     // connection.end();
            // }
    });
}

function reqCTrip(deptDate, deptAirportCode, arrAirportCode, errCount = requsetAgain) {
    logger.info(deptDate, deptAirportCode, arrAirportCode,"resquest start")
    let errHead = `${deptDate} from ${deptAirportCode} to ${arrAirportCode} `
    let searchParam = setSearchParam(deptDate, deptAirportCode, arrAirportCode);
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
                    reqCTrip(deptDate, deptAirportCode, arrAirportCode, errCount)
                }
            } else {
                let resJson = JSON.parse(res.text);
                filter(resJson, deptDate, deptAirportCode, arrAirportCode) // resolve(res)
            }
        })
}



class MyEmitter extends EventEmitter {}

const myEmitter = new MyEmitter();

// let collection = ['PVGHRB', 'HRBPVG', 'PVGKWL', 'KWLPVG', 'SYXPVG', 'PVGSYX', 'PVGKWE', 'KWEPVG', 'KWEWNZ', 'WNZKWE', 'PVGZUH', 'ZUHPVG', 'ZUHCGO', 'CGOZUH', 'CGOHAK', 'HAKCGO', 'WNZHAK', 'HAKWNZ', 'ZUHTNA', 'TNAZUH', 'SZXTYN', 'TYNSZX', 'HETTYN', 'TYNHET', 'SZXHET', 'HETSZX']
let tasks =[{route: 'PVGHRB', speed: 5000}, {route: 'HRBPVG', speed: 5000}]

function TaskControl(tasks){
  this.tasks = tasks || [];
}

TaskControl.prototype.tasksEmit = function(speed){
  let task = this.tasks.shift()
  setTimeout(()=>myEmitter.emit('request', task), task.speed)
}

myEmitter.on('request', (route) => {
  console.log(route);
  task.tasksEmit()
});
//
const task = new TaskControl(tasks);
task.tasksEmit()
