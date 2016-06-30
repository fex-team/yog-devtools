/**
 * @fileOverview 负责读取 server.conf 转发规则。
 *
 * 支持 rewrite redirect 两种重定向规则。
 *
 * ```
 * rewrite ^\/testpage /example/page/testpage
 *
 * rewrite ^\/ajaxHander /test/page/ajaxHandler.js
 * rewrite ^\/somejsonfile /test/page/data.json
 * ```
 */

var fs = require('fs');
var parseUrl = require('url').parse;
var httpProxy = require('http-proxy');

function escapeHtml(html) {
    return String(html)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}


function rewriteParser(file) {
    var rules = [];


    function Ruler(type, reg, to) {
        return {
            type: type,
            reg: reg,
            to: to
        }
    }

    if (!Array.isArray(file)) {
        file = [file]
    };

    file.forEach(function(file) {
        if (!fs.existsSync(file)) {
            return null;
        }

        var content = fs.readFileSync(file, 'utf-8');
        var lines = content.split(/\r\n|\n/);
        var rrule = /^(rewrite|redirect|proxy)\s+([^\s]+)\s+([^\s]+)$/i

        lines.forEach(function(line) {
            var m = rrule.exec(line);

            if (!m) {
                return;
            }

            rules.push(new Ruler(m[1].toLowerCase(), new RegExp(m[2], 'i'), m[3]));
        });
    });

    return {
        match: function(url) {
            var found;

            var arr = [
                url.path,
                url.pathname
            ];

            rules.every(function(ruler) {

                arr.every(function(url) {
                    var m = url.match(ruler.reg);

                    if (m) {
                        found = ruler;
                        found.match = m;
                        return false;
                    }

                    return !found;
                });

                return !found;
            });

            return found;
        }
    }
}

module.exports = function(options) {
    var file = options.rewrite_file;
    var parser;

    // todo cache the file.
    function lazyload() {
        // 每次都加载好了，server.conf 有可能经常改动。
        parser = /*parser || */rewriteParser(file);
    }


    var proxy = httpProxy.createProxyServer({
        changeOrigin: true,
        autoRewrite: true
    });

    proxy.on('error', function(error, req, res) {
        var json;
        console.log('proxy error', error);
        if (!res.headersSent) {
            res.writeHead(500, { 'content-type': 'application/json' });
        }

        json = { error: 'proxy_error', reason: error.message };
        res.end(JSON.stringify(json));
    });

    return function(req, res, next) {
        lazyload();

        var url = parseUrl(req.url);
        var ruler = parser && parser.match(url);

        if (ruler) {
            var to = ruler.to.replace(/\$(\d+)/g, function(all, index) {
              return ruler.match[index] || '';
            });

            switch (ruler.type) {
                case 'rewrite':
                    req.originalUrl = req.originalUrl || req.url;
                    req.url = to;
                    break;
                case 'proxy':
                    var target = parseUrl(to);
                    req.originalUrl = req.originalUrl || req.url;
                    req.url = target.path + (target.search ? (url.query ? ('&' + url.query) : '') : url.search || '');
                    proxy.web(req, res, {
                        target: target.protocol + '//' + target.host
                    });
                    return;

                case 'redirect':
                default:
                    res.statusCode = 303
                    res.setHeader('Content-Type', 'text/html; charset=utf-8')
                    res.setHeader('Location', to)
                    res.end('Redirecting to <a href="' + escapeHtml(to) + '">' + escapeHtml(to) + '</a>\n')
                    return;
            }
        }

        next();
    };
};
