// const later = require('later');
const moment = require('moment');
const exec = require('child_process').exec;
const fs = require('fs');

// const oneSearchSpace = later.parse.text('every 0.1 sec');
// const eachSearchSpace = later.parse.text('every 1 day');
const collectedDays = 60;
const outDir = 'SHA2TSN';
const outDir9C = '9C';
const outDirHO = 'HO';
const outDirMU = 'MU';
// const startTime = Date.now();


fs.mkdir(`../data/${outDir}`, err => {
  if (err && err.code != 'EEXIST') {
    console.error(`[${Date()}]: ${err}\n`);
  }else {
    oneSearch()
  }
})


function oneSearch() {
  let timeParams = [];
  let count = 0;
  // let searchTime = moment().format('YYYY-MM-DD HH:MM');

  for (let i = 0; i < collectedDays; i++) {
    let timeParam = moment().add(i, 'days').format('YYYY-MM-DD');
    timeParams.push(timeParam)
  }

  let timerQuick = setInterval(function() {
    exec(`node ${__dirname}/HO.js -d ${timeParams[count]} -s SHA -a TSN -o ../data/${outDir}/${outDirHO} `, (err, stdout, stderr) => {
      if (err) {
        console.error(`[${Date()}]: ${err}`);
        // console.error(stderr);
        return;
      }
      console.log(stdout);
    });

    // exec(`node ${__dirname}/9C.js -d ${timeParams[count]} -s 上海 -a 天津 -o ../data/${outDir}/${outDir9C}`, (err, stdout, stderr) => {
    //   if (err) {
    //     console.error(`[${Date()}]: ${err}`);
    //     // console.error(stderr);
    //     return;
    //   }
    //   console.log(stdout);
    // });


    count++;
    if (count === timeParams.length) {
      clearInterval(timerQuick)
      count = 0;
    }
  }, 1)

  // let timerSlower = setInterval(function() {
  //
  //   exec(`node ${__dirname}/MU.js -t ${timeParams[count]} --deptCdTxt 上海 --deptCityCode SHA --deptCd PVG  --arrCdTxt 天津 --arrCityCode TSN --arrCd TSN -o ../data/${outDir}/${outDirMU}`, (err, stdout, stderr) => {
  //     if (err) {
  //       console.error(`[${Date()}]: ${err}`);
  //       // console.error(stderr);
  //       return;
  //     }
  //     console.log(stdout);
  //   });
  //
  //   count++;
  //   if (count === timeParams.length) {
  //     clearInterval(timerSlower)
  //     count = 0;
  //   }
  // }, 30000)
}
