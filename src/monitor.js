const program = require('commander');
const moment = require('moment');
const log4js = require('log4js');
const mysql      = require('mysql');
const nodemailer = require('nodemailer');

const connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'ecm.361',
  database : 'test',
});

connection.connect(function(err) {
  if (err) {
    logger.error('error connecting: ' + err.stack);
    return;
  }
  logger.info('connected as id ' + connection.threadId);
});

let  transporter = nodemailer.createTransport('smtps://yzjsygl%40163.com:yzjsygl23@smtp.163.com');

log4js.configure({
  appenders: [
    { type: 'console' },
    { type: 'file', filename: '../logs/monitor.log', category: 'fileLog' }
  ]
});
let logger = log4js.getLogger('console');
let loggerFile = log4js.getLogger('fileLog');
logger.setLevel('debug');



function sendMail(content, title = '价格监控'){
  let mailOptions = {
    from: '<yzjsygl@163.com>', // sender address
    to: '<yzjsygl@163.com>', // list of receivers
    subject: title, // Subject line
    // text: '测试下', // plaintext body
    html: content // html body
  };
  transporter.sendMail(mailOptions, function(error, info){
    if(error){
      return loggerFile.error(error);
    }
    console.log('Message sent: ' + info.response);
  });
}

function priceOver(beforePrice, afterPrice, percentage){
  let differecePercentage  = (afterPrice - beforePrice)/beforePrice;
  logger.debug('priceOver:', differecePercentage);
  return Math.abs(differecePercentage) > percentage
}

function monitor(){
  connection.query(`select  distinct flightNo ,airlineCode, depDate from test.flightsdata
                    where catalogue = (select max(catalogue) FROM test.flightsdata)
                    or catalogue = (select max(catalogue)-1 FROM test.flightsdata)`,function(err, results){
    if(err){
      loggerFile.error(err)
    }
    let flightNosAndDepDates = results;
    for (let item of flightNosAndDepDates) {
      let temp = moment(item.depDate).format('YYYY-MM-DD')
      //  logger.info(`select * from test.flightsdata where flightNo = '${item.flightNo}' and depDate = '${temp}'`)
      connection.query(`select * from test.flightsdata where flightNo = '${item.flightNo}'
      and airlineCode = '${item.airlineCode}' and depDate = '${temp}'
      and (catalogue = (select max(catalogue) FROM test.flightsdata)
      or catalogue = (select max(catalogue)-1 FROM test.flightsdata))`,function(err, results){
        // logger.debug('after query: ', results)
        if(err){
          loggerFile.error(err)
        }
        // logger.debug(results)
        if (results.length === 2) {
          // logger.debug('done')
          try {
            if (priceOver(results[0].price, results[1].price, 0.05)) {
              loggerFile.info(`${results[0].airlineCode} ${results[0].flightNo} ${moment(results[0].depDate).format('MM-DD')} ${results[0].depDateTime.slice(0,5)}`,'price is different!')
              // logger.info(results[0], results[1])
              let sendContent = `<table border = "1">
                                    <tr>
                                      <th>airlineCode</th>
                                      <th>flightNo</th>
                                      <th>depDate</th>
                                      <th>depDateTime</th>
                                      <th>beforePrice</th>
                                      <th>afterPrice</th>
                                    </tr>
                                    <tr>
                                      <td>${results[0].airlineCode}</td>
                                      <td>${results[0].flightNo}</td>
                                      <td>${moment(results[0].depDate).format('MM-DD')}</td>
                                      <td>${results[0].depDateTime.slice(0,5)}</td>
                                      <td>${results[0].price}</td>
                                      <td>${results[1].price}</td>
                                    </tr>
                                  </table>`
                let  title = `${results[0].airlineCode}${results[0].flightNo} at ${moment(results[0].depDate).format('MM-DD')} ${results[0].depDateTime.slice(0,5)} from ${results[0].price} to ${results[1].price}`
              sendMail(sendContent, title)
            }else {
              if (results[0].price === results[1].price) {
                loggerFile.info(`${results[0].airlineCode} ${results[0].flightNo} ${moment(results[0].depDate).format('MM-DD')} ${results[0].depDateTime.slice(0,5)}`,'price is same!')
              }else {
                loggerFile.info(`${results[0].airlineCode} ${results[0].flightNo} ${moment(results[0].depDate).format('MM-DD')} ${results[0].depDateTime.slice(0,5)} ${results[0].price} ${results[1].price}`,'price change no too much!')

              }
            }

            } catch (e) {
              loggerFile.error(e, item.flightNo, item.airlineCode, temp, results)
            }
        }else {
            loggerFile.fatal('results length is not 2',results)
        }
      })

    }
    // logger.info(flightNosAndDepDates)
  })
}

monitor();
setInterval(monitor, 600000)
