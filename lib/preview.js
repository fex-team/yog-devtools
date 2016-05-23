/**
 * @fileOverview 提供预览 tpl 页面功能
 * 数据自动关联 test/ns/xxx.json 文件。
 * 同时后续再关联 test/ns/xxx.js 文件进行动态补充。
 *
 * 比如: 预览 ns/page/index.tpl 页面时。
 * 数据来源自动读取自 test/ns/page/index.json
 * 同时 test/ns/page/index.js 脚本可以对数据进行进一步动态扩展。
 */
var path = require('path');
var fs = require('fs');

function mixin(a, b) {
    if (a && b) {
        for (var key in b) {
            a[key] = b[key];
        }
    }
    return a;
}

module.exports = function(options) {
    var rpage = /^\/([\w0-9_\-]+)\/page\/(.*)$/i;
    var tplroot = path.resolve(options.view_path);
    var dirs = Array.isArray(options.data_path) ? options.data_path : [options.data_path];

    dirs = dirs.map(function(dir) {
      return path.resolve(dir);
    })

    function previewPage(ns, page, req, res, next) {

        var tplfile, jsonfile, jsfile, m, ready;
        var data = {};
        var jsreturn = null;
        var rendered = false;

        m = /^(.*)\.tpl$/i.exec(page);

        if (m) {
            page = m[1];
        }

        tplfile = path.join(tplroot, ns, page + '.tpl');
        if (!fs.existsSync(tplfile)) {
            return next();
        }

        dirs.every(function(dir) {
          var filepath = path.join(dir, ns, 'page', page + '.json');

          if (fs.existsSync(filepath)) {
            jsonfile = filepath;
          }

          return !jsonfile;
        })

        if (jsonfile) {
            try {
                delete require.cache[require.resolve(jsonfile)];
                data = require(jsonfile);
            } catch(err) {
                data = {};
            }
        }

        render = function(locals) {

            if (rendered) {
                return;
            }
            rendered = true;

            var tpl = ns + '/' + page + '.tpl';

            locals && mixin(data, locals);
            res.render(tpl, data);
        };

        jsfile =  path.join(dataroot, ns, 'page', page + '.js');

        if (fs.existsSync(jsfile)) {
            delete require.cache[require.resolve(jsfile)];

            res.locals = res.locals || {};
            res.locals = mixin(res.locals, data);
            jsreturn = require(jsfile)(req, res, render);
        } else {
            render(data);
        }
    }

    return function(req, res, next) {
        var url = req.url;
        var match = rpage.exec(url);

        // 如果页面满足  namespace/page/xxxx 这样的路径规则。
        if (match) {
            previewPage(match[1], match[2], req, res, next);
        } else {
            next();
        }
    };
};
