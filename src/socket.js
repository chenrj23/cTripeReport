const net = require('net');
const EventEmitter = require('events');
const program = require('commander');
const charset = require('superagent-charset');
const request = require('superagent');
charset(request);
const moment = require('moment');
const CronJob = require('cron').CronJob;
const log4js = require('log4js');
const mysql = require('mysql');
let catalogue = (new Date).getTime();

const pool  = mysql.createPool({
  connectionLimit : 10,
  host            : '120.27.5.155',
  user            : 'root',
  password        : 'y8kyscsy',
  database        : 'cTrip'
});

program
    .version('0.0.1')
    .option('-t, --depDate <time>', 'seaching date like 2016-03-28')
    .option('-d, --depAirCode <code>', 'depart airport code like SHA,PVG')
    .option('-a, --arrAirCode <code>', 'arrive airport code like BJS,PEK')
    .option('-l, --searchDayLong [number]', 'how many days search like 30')
    .option('-f, --searchDefault', 'searchDefault')
    .option('-i, --insist [times]', 'search auto')
    .option('-s, --speed [times]', 'search speed')
    // .option('-b, --debug [level]', '')
    .parse(process.argv);

const depAirCode = program.depAirCode || false,
    arrAirCode = program.arrAirCode || false,
    depDate = program.depDate || moment().format('YYYY-MM-DD'),
    searchDayLong = parseInt(program.searchDayLong) || 1,
    searchDefault = program.searchDefault || false,
    insist = program.insist || false,
    speed = parseInt(program.speed) || 2000;

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
let loggerFile = log4js.getLogger('fileLog'); //可以模块化
logger.setLevel('debug');

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


function reqCTrip(depDate, depAiCode, arrAirCode, errCount = requsetAgain) {
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


class MyEmitter extends EventEmitter {}

const myEmitter = new MyEmitter();

function TaskControl(tasks){
  this.tasks = tasks || [];
}

TaskControl.prototype.tasksEmit = function(speed){
  while (this.tasks.length > 0) {
    let oneTask = this.tasks.shift()
    setTimeout(()=>myEmitter.emit('request', oneTask), oneTask.speed)
  }
}

myEmitter.on('request', (oneTask) => {
  console.log("one task", oneTask);
  let depDate = oneTask.depDate;
  let depAirCode = oneTask.depAirCode;
  let arrAirCode = oneTask.arrAirCode
  reqCTrip(depDate, depAirCode, arrAirCode)
  task.tasksEmit()
});

const server = net.createServer((c) => {
  // 'connection' listener
  console.log('client connected');
  console.log(c.remoteAddress);
  c.on('end', () => {
    console.log('client disconnected');
  });
  c.on('connection', () => {
    console.log('client sconnected');
  });
  c.on('data', (data) => {
    console.log('client say');
    dataByString = data.toString()
    dataByJson = JSON.parse(dataByString)
    task.tasks.unshift(dataByJson)
    task.tasksEmit()
    console.log(task.tasks);
  });
  c.write('You are Welcome！\r\n');
  c.pipe(c);
});
server.on('error', (err) => {
  throw err;
});
server.listen(8124, () => {
  console.log('server bound');
});

const task = new TaskControl();
