var gulp = require("gulp");
var babel = require("gulp-babel");

gulp.task("default", function() {
  return gulp.src("src/*.js")
    .pipe(babel())
    .on('error', function(err) {
      console.log('babel Error!', err.message);
      this.end();
    })
    .pipe(gulp.dest("./build"));
});

var watcher = gulp.watch('src/*.js', ['default']);
watcher.on('change', function(event) {
  console.log('File ' + event.path + ' was ' + event.type + ', running tasks...');
});
