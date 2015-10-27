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

function escapeHtml(html) {
    return String(html)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}


function rewriteParser(file) {
    if (!fs.existsSync(file)) {
        return null;
    }

    var rules = [];
    var content = fs.readFileSync(file, 'utf-8');
    var lines = content.split(/\r\n|\n/);
    var rrule = /^(rewrite|redirect)\s+([^\s]+)\s+([^\s]+)$/i

    function Ruler(type, reg, to) {
        return {
            type: type,
            reg: reg,
            to: to
        }
    }

    lines.forEach(function(line) {
        var m = rrule.exec(line);

        if (!m) {
            return;
        }

        rules.push(new Ruler(m[1].toLowerCase(), new RegExp(m[2], 'i'), m[3]));
    });

    return {
        match: function(url) {
            var found;

            rules.some(function(ruler) {
                var m = url.match(ruler.reg);

                if (m) {
                    found = ruler;
                    found.match = m;
                    return true;
                }
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

    return function(req, res, next) {
        lazyload();

        var url = parseUrl(req.url);
        var ruler = parser && parser.match(url.pathname);

        if (ruler) {
            var to = ruler.to.replace(/\$(\d+)/g, function(all, index) {
              return ruler.match[index] || '';
            });

            switch (ruler.type) {
                case 'rewrite':
                    req.originalUrl = req.url;
                    req.url = to;
                    break;
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
