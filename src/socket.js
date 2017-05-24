const net = require('net');
const EventEmitter = require('events');
const program = require('commander');
const cTrip = require('./cTrip.js')
const cTripModule = require('./cTripModule.js');
const log4js = require('log4js');
log4js.configure('../config/my_log4js_configuration.json')
let logger = log4js.getLogger('socket.js');

const logLevel = process.env.logLevel || 'info'
logger.info('logLevel ', logLevel)
logger.setLevel(logLevel);


class MyEmitter extends EventEmitter {}

const myEmitter = new MyEmitter();

function TaskControl(tasks) {
    this.tasks = tasks || [];
    this.execution = 0;
}

TaskControl.prototype.nextTask = function(speed) {

    if (this.tasks.length > 0 && this.execution === 1) {
        logger.info('nextTask')
        let oneTask = this.tasks.shift()
        setTimeout(() => myEmitter.emit(oneTask.type, oneTask), oneTask.speed)
    } else if (this.execution > 1) {
        logger.info('lt have ', this.execution, ' execution')
        this.cutExecution();
    } else {
        logger.info('no tasks')
        this.cutExecution();
    }
}

TaskControl.prototype.addExecution = function() {
    this.execution++
}

TaskControl.prototype.cutExecution = function() {
    this.execution--
}


const task = new TaskControl();

myEmitter.on('request', (oneTask) => {

  let depDate = oneTask.depDate;
  let depAirCode = oneTask.depAirCode;
  let arrAirCode = oneTask.arrAirCode
  cTrip.req(depDate, depAirCode, arrAirCode)
  .then(({
    resJson,
    depDate,
    depAiCode,
    arrAirCode
  }) => {
    cTrip.filter(resJson, depDate, depAiCode, arrAirCode, oneTask.catalogue)
    .then(({
      depDate,
      depAiCode,
      arrAirCode
    }) => {
      logger.info(`${depDate} from ${depAiCode} to ${arrAirCode} filter ok`)
    }, err => logger.error('filter err :', err))

  },
  (reason) => {
    logger.error('req have err!', reason)
    logger.info("wait 1 min restart for request")
    setTimeout(() => {
      logger.info("now after 1 min restart request")
      task.nextTask()
    }, 60000)
  }
)
.then(() => {
  task.nextTask()
}, (reason) => {
  logger.error('filter havev err', reason)
})
.catch((err) => {
  logger.errot('unexpect err!', err)
})
});


myEmitter.on('cache', (oneTask) => {
    let depAirCode = oneTask.depAirCode;
    let arrAirCode = oneTask.arrAirCode;
    cTripModule.cache(depAirCode, arrAirCode)
    task.nextTask()
});


const server = net.createServer((c) => {
    // 'connection' listener
    console.log('client connected')
    let bufferString = '';
    let tasksStack;
    c.on('end', () => {
        console.log('client disconnected');
    });
    c.on('connection', () => {
        console.log('client sconnected');
    });
    c.on('data', (data) => {
        let dataByString = data.toString()
        bufferString += dataByString
        let bufferArray = bufferString.split(/\r\n|\n|\r/)
        if (bufferArray.length > 1) {
            let bufferArrayFirst = bufferArray.shift()
            try {
                tasksStack = JSON.parse(bufferArrayFirst)

            } catch (e) {
                logger.error('JSON pares have err:', e)
                logger.error('bufferArrayFirst', bufferArrayFirst)
            }
            bufferString = bufferArray.join('')
            task.tasks = tasksStack.concat(task.tasks)
            logger.debug('tasksStack', tasksStack);
            logger.debug('task.tasks', task.tasks);
            task.addExecution()
            task.nextTask()
        }
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
