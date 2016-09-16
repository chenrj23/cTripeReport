const program = require('commander');
const request = require('superagent');
const charset = require('superagent-charset');
const moment = require('moment');
const log4js = require('log4js');
const mysql      = require('mysql');
const connection = mysql.createConnection({
  host     : '127.0.0.1',
  user     : 'root',
  password : 'chenrj23',
  database : 'cTrip',
});

program
.version('0.0.1')
.option('-t, --deptDate <time>', 'seaching date like 2016-03-28')
.option('-d, --deptAirportCode <code>', 'depart airport code like SHA,PVG')
.option('-a, --arrAirportCode <code>', 'arrive airport code like BJS,PEK')
.option('-l, --searchDayLong [number]', 'how many days search like 30')
// .option('-b, --debug [level]', '')
.parse(process.argv);

const deptAirportCode = program.deptAirportCode,
arrAirportCode = program.arrAirportCode,
deptDate = program.deptDate || moment().format('YYYY-MM-DD'),
searchDayLong = program.searchDayLong || '1';
const requsetAgain = 3;
const catalogue = (new Date).getTime();
let queryCount = searchDayLong;

log4js.configure({
  appenders: [
    { type: 'console' },
    { type: 'file', filename: '../logs/cTrip.log', category: 'fileLog' }
  ]
});

let logger = log4js.getLogger('console');
let loggerFile = log4js.getLogger('fileLog');
let errHead = `${deptDate} from ${deptAirportCode} to ${arrAirportCode} `
// logger.debug(errHead)
logger.setLevel('debug');
logger.debug(queryCount)

charset(request);                            // this will add request.Request.prototype.charset
                                             // fix the superagent decode form gbk data

function connectMysql(){

  connection.connect(function(err) {
    if (err) {
      logger.error('error connecting: ' + err.stack);
      return;
    }
    logger.info('connected as id ' + connection.threadId);
  });

}


function setSearchParam(deptDate, deptAirportCode, arrAirportCode) {
  var requestHttp = `http://flights.ctrip.com/domesticsearch/search/SearchFirstRouteFlights?DCity1=${deptAirportCode}&ACity1=${arrAirportCode}&SearchType=S&DDate1=${deptDate}&LogToken=5ef45f7846b24fd2bf41f836cdf69832&CK=A40875E7E0BFDB8E7C75AA6A038668A2&r=0.84814912185842484141`;
  return requestHttp
}

function filter(resJson){
  if (resJson.Error) {
    loggerFile.error(resJson.Error)
  }
  let flightDataArrays = resJson.fis;
  // console.log(resJson);
  let filteredData =  flightDataArrays.map(function(flightData){
    let flightNo,
    airlineCode,
    depAirport,
    arrAirport,
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
      airlineCode: flightNo.slice(0,2),
      flightNo: flightNo.slice(2),
      depDate: depDateTime.slice(0,10),
      depDateTime: depDateTime.slice(11),
      price: price,
      depAirport: depAirport,
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
    for(let i in mysqlStructure){
         arr.push(mysqlStructure[i]);
    }
    // console.log(mysqlStructure);
    return arr
  })
  // logger.debug(filteredData)

  connection.query('INSERT INTO flightsdata (airlineCode,flightNo,depDate,depDateTime,price,depAirport,arrAirport,fType,isShare,shareFlight,isStopover,stopoverCity,isCombinedTransport,combinedTransport,catalogue) VALUES ?',[filteredData], function(err, result) {
    if (err) {
      // loggerFile.error(err)
      // loggerFile.error('INSERT INTO flightsdata (airlineCode,flightNo,depDate,depDateTime,price,depAirport,arrAirport,fType,isShare,shareFlight,isStopover,stopoverCity,isCombinedTransport,combinedTransport,catalogue) VALUES ?')
      // loggerFile.error([filteredData])
      throw err;
    }
    queryCount--;
    logger.debug('query count is: ', queryCount)
    logger.debug('query is start', result)
    if (queryCount <= 0 ) {
      connection.end();
    }
  });
}

function reqCTrip(deptDate, deptAirportCode, arrAirportCode, errCount = requsetAgain){
  let searchParam = setSearchParam (deptDate, deptAirportCode, arrAirportCode);
  // logger.info(errCount)
  request
  .get(searchParam)
  .charset('gbk')
  .timeout(10000)
  .end(function(err, res){
    // logger.debug(res)
    if (err || res.Error) {
      err.errCount = --errCount;
      loggerFile.error(errHead, err)
      loggerFile.error(errHead, `errCount: `,errCount)
      if (errCount === 0) {
        loggerFile.fatal(errHead,`request fail`)
      }else {
        reqCTrip(deptDate, deptAirportCode, arrAirportCode, errCount)
      }
    }else {
      let resJson = JSON.parse(res.text);
      filter(resJson)// resolve(res)
    }
  })
}

// reqCTrip(deptDate, deptAirportCode, arrAirportCode)


function search(){
  if (searchDayLong === '1') {
    connectMysql();
    reqCTrip(deptDate, deptAirportCode, arrAirportCode);
  }else {
    connectMysql();
    for (let i = 0; i < searchDayLong; i++) {
      let deptDateAdded = moment(deptDate).add(i, 'days').format('YYYY-MM-DD');
      reqCTrip(deptDateAdded, deptAirportCode, arrAirportCode);
      // timeParams.push(timeParam)
    }
  }
}

search();
setInterval(search, 600000)
