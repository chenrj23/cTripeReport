const net = require('net');
const EventEmitter = require('events');
const program = require('commander');
const moment = require('moment');
let catalogue = (new Date).getTime();

const log4js = require('log4js');
log4js.configure('../config/my_log4js_configuration.json')
let logger = log4js.getLogger('console');
let loggerFile = log4js.getLogger('fileLog'); //可以模块化
logger.setLevel('debug');

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

const client = net.createConnection({port: 8124}, () => {
  //'connect' listener
  console.log('connected to server!');
});
client.on('data', (data) => {
  console.log(data.toString());
  client.end();
});
client.on('end', () => {
  console.log('disconnected from server');
});

function taskBuild(depAirCode, arrAirCode, depDate, speed){
  return {
    depAirCode: depAirCode,
    arrAirCode: arrAirCode,
    depDate: depDate,
    speed: speed,
    catalogue: catalogue,
  }
}

function search(depDate, depAirCode, arrAirCode, speed, searchDayLong) {
    if (searchDayLong === 1) {
      let task = taskBuild(depAirCode, arrAirCode, depDate, speed)
      // logger.info('task', task);
      client.write(JSON.stringify(task));
    } else {
        for (let i = 0; i < searchDayLong; i++) {
            let deptDateAdded = moment(depDate).add(i, 'days').format('YYYY-MM-DD');
            let task = taskBuild(depAirCode, arrAirCode, deptDateAdded, speed)
            client.write(JSON.stringify(task));
        }
    }
}

search(depDate, depAirCode, arrAirCode, speed, searchDayLong)
