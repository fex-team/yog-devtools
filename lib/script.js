/**
 * @fileOverview 添加 js 脚本页面功能。
 * 让 test 目录的 js 脚本能够想 jsp, php 脚本一样运行。
 */

var path = require('path');
var fs = require('fs');

module.exports = function(options) {
  var dataroot = options.data_path;
  var rpage = /^\/(?:test|mock)\/(.*\.(js|json))(?:$|\?)/i;

  function execScript(page, type, req, res, next) {
    var dirs = Array.isArray(dataroot) ? dataroot : [dataroot];
    var file;

    dirs.every(function(dir) {
      var filepath = path.join(dir, page);

      if (fs.existsSync(filepath)) {
        file = filepath;
      }

      return !file;
    });

    // 文件不存在，则跳过。
    if (!file) {
      return next();
    }

    if (type === 'js') {
      try {
        delete require.cache[require.resolve(file)];
        require(file)(req, res, next);
      } catch (err) {
        next(err);
      }
    } else {
      fs.readFile(file, function(err, buf) {
        if (err) return next(err);

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Length': buf.length
        });

        res.end(buf);
      });
    }
  }

  return function(req, res, next) {
    var url = req.url;

    var match = rpage.exec(url);

    if (match) {
      execScript(match[1], match[2], req, res, next);
    } else {
      next();
    }
  };
}
