var gulp = require("gulp");
var babel = require("gulp-babel");
const exec = require('child_process').exec;

// console.log(process.cwd());
//

gulp.task("default", function() {
  return gulp.src("src/*.js")
    .pipe(babel())
    .on('error', function(err) {
      console.log('babel Error!', err.message);
      this.end();
    })
    .pipe(gulp.dest("./build"));
});

gulp.task("express", ['default'],function(){
  exec('node ./build/restful.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
    console.log(`stderr: ${stderr}`);
  });
})

var watcher = gulp.watch('src/*.js', ['default','express']);
watcher.on('change', function(event) {
  console.log('File ' + event.path + ' was ' + event.type + ', running tasks...');
});
