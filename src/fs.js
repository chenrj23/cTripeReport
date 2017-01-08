const fs = require('fs');

fs.readFile('../config/config.json', (err, data) => {
  if (err) throw err;
  console.log(data.toString());
});
