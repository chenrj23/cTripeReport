const mysql = require('mysql');

exports.pool  = mysql.createPool({
  connectionLimit : 10,
  host            : '120.27.5.155',
  user            : 'root',
  password        : 'y8kyscsy',
  database        : 'cTrip'
});
