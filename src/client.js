const net = require('net');
const fs = require('fs');
const EventEmitter = require('events');
const moment = require('moment');
const CronJob = require('cron').CronJob;

const program = require('commander');
program
    .version('0.0.1')
    .option('-t, --depDate <time>', 'seaching date like 2016-03-28')
    .option('-d, --depAirCode <code>', 'depart airport code like SHA,PVG')
    .option('-a, --arrAirCode <code>', 'arrive airport code like BJS,PEK')
    .option('-l, --searchDayLong [number]', 'how many days search like 30')
    .option('-f, --searchDefault', 'searchDefault')
    .option('-i, --insist [times]', 'search auto')
    .option('-s, --speed [times]', 'search speed')
    .option('-z, --specialSearch', 'sepcial search')
    .option('-b, --debug [level]', '')
    .parse(process.argv);

const depAirCode = program.depAirCode || false,
    arrAirCode = program.arrAirCode || false,
    depDate = program.depDate || moment().format('YYYY-MM-DD'),
    searchDayLong = parseInt(program.searchDayLong) || 1,
    searchDefault = program.searchDefault || false,
    insist = program.insist || false,
    specialSearch = program.specialSearch || false,
    speed = parseInt(program.speed) || 2000
    // debugLevel = program.debug || 'debug';

const log4js = require('log4js');
log4js.configure('../config/my_log4js_configuration.json')
const logger = log4js.getLogger('client.js');

const logLevel = process.env.logLevel || 'info'
logger.info('logLevel ', logLevel)
logger.setLevel(logLevel);

const client = net
    .createConnection({
        host: '127.0.0.1',
        port: 8124
    }, () => {
        //'connect' listener
        console.log('connected to server!');
        client.on('data', (data) => {
            logger.info('have data come', data.toString())
            logger.debug('data: ', data.toString())
        });

        client.on('end', () => {
            console.log('disconnected from server');
        });
    });


function tasksBuild(depAirCode, arrAirCode, depDate, speed, searchDayLong, catalogue) {
    let tasks = [];
    for (let i = 0; i < searchDayLong; i++) {
        const deptDateAdded = moment(depDate).add(i, 'days').format('YYYY-MM-DD');
        const task = {
            depAirCode,
            arrAirCode,
            depDate: deptDateAdded,
            speed,
            catalogue,
            type: 'request'
        }
        tasks.push(task)
    }
    tasks.push({
        depAirCode,
        arrAirCode,
        type: 'cache'
    })
    return tasks
}


function startSearch() {
    logger.info("startSearch")

    fs.readFile('../config/config.json', (err, data) => {
        if (err) throw err;
        let dataByString = data.toString()
        let dataByJson = JSON.parse(dataByString)
        let defaultConfig = dataByJson;
        let defaultSearch = defaultConfig.defaultSearch

        let catalogue = (new Date).getTime();
        let defaultSearchRoutes = defaultSearch.routes
        let seachDayLong = defaultSearch.seachDayLong
        let seachDayStart = defaultSearch.seachDayStart
        let seachSpeed = defaultSearch.speed
        let tasksStack = []

        if (seachDayStart === 'today') {
            seachDayStart = moment().format('YYYY-MM-DD')
        }
        for (var i = 0; i < defaultSearchRoutes.length; i++) {
            let depAirCode = defaultSearchRoutes[i].slice(0, 3)
            let arrAirCode = defaultSearchRoutes[i].slice(3, 6)
            let tasks = tasksBuild(depAirCode, arrAirCode, seachDayStart, seachSpeed, seachDayLong, catalogue)
            tasksStack = tasksStack.concat(tasks)
        }
        tasksStack = JSON.stringify(tasksStack) + '\n';
        logger.debug('tasksStack', tasksStack);
        client.write(tasksStack)
    });
}

function startSpecialSearch() {

  logger.info("specialSearch start")
  fs.readFile('../config/config.json', (err, data) => {
    if (err) throw err;
    let dataByString = data.toString()
    let dataByJson = JSON.parse(dataByString)
    let defaultConfig = dataByJson;
    let specialSearch = defaultConfig.specialSearch

    let catalogue = (new Date).getTime();
    let defaultSearchRoutes = specialSearch.routes
    let seachDayLong = specialSearch.seachDayLong
    let seachDayStart = specialSearch.seachDayStart
    let seachSpeed = specialSearch.speed
    let tasksStack = []

    if (seachDayStart === 'today') {
      seachDayStart = moment().format('YYYY-MM-DD')
    }
    for (var i = 0; i < defaultSearchRoutes.length; i++) {
      let depAirCode = defaultSearchRoutes[i].slice(0, 3)
      let arrAirCode = defaultSearchRoutes[i].slice(3, 6)
      let tasks = tasksBuild(depAirCode, arrAirCode, seachDayStart, seachSpeed, seachDayLong, catalogue)
      tasksStack = tasksStack.concat(tasks)
    }
    tasksStack = JSON.stringify(tasksStack) + '\n';
    logger.debug('tasksStack', tasksStack);
    client.write(tasksStack)
  });
}

if (specialSearch && !insist) {
  startSpecialSearch()
}



if (searchDefault && !insist) {
    startSearch()
}

if (depDate && depAirCode && arrAirCode && searchDayLong && speed) {
    let tasksStack = []
    let catalogue = (new Date).getTime();

    tasksStack = tasksBuild(depAirCode, arrAirCode, depDate, speed, searchDayLong, catalogue)
    let tasksInString = JSON.stringify(tasksStack) + '\n';
    logger.debug('tasksStack', tasksStack);
    client.write(tasksInString)
}

if (insist) {
    var job = new CronJob({
        cronTime: insist,
        onTick: function() {
          if (searchDefault) {
            startSearch()
          }else if(specialSearch){
            startSpecialSearch()
          }else {
            logger.info('no function')
          }
        },
        start: false,
        timeZone: 'Asia/Shanghai'
    });
    job.start();
}

process.on('SIGINT', () => {
    client.destroy();
    console.log('Received SIGINT.');
    process.exit()

});
