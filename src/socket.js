const net = require('net');
const EventEmitter = require('events');
const program = require('commander');
const ctrip = require('./cTrip.js')

const moment = require('moment');
const CronJob = require('cron').CronJob;

const log4js = require('log4js');
log4js.configure('../config/my_log4js_configuration.json')
let logger = log4js.getLogger('console');
let loggerFile = log4js.getLogger('fileLog'); //可以模块化
logger.setLevel('debug');


let catalogue = (new Date).getTime();

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
  ctrip.req(depDate, depAirCode, arrAirCode)
  task.tasksEmit()
});

const server = net.createServer((c) => {
  // 'connection' listener
  console.log('client connected');
  c.on('end', () => {
    console.log('client disconnected');
  });
  c.on('connection', () => {
    console.log('client sconnected');
  });
  c.on('data', (data) => {
    // console.log('client say');
    console.log("tasks", task.tasks);
    dataByString = data.toString()
    dataByJson = JSON.parse(dataByString)
    task.tasks.unshift(dataByJson)
    task.tasksEmit()
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
