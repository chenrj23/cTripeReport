const shttp = require('socks5-http-client');
const url = require('url');

let options = url.parse('http://www.baidu.com/')

console.log(options);
options.socksPort = 1086;

shttp.get(options, function(res) {
    res.setEncoding('utf8');
    res.on('readable', function() {
        console.log(res.read()); // Log response to console.
    });
});
