var preview = require('./lib/preview.js');
var rewrite = require('./lib/rewrite.js');
var script = require('./lib/script.js');

function noop(req, res, next) {
    next();
}

module.exports = function( options ) {
    
    // sub midllewares
    return [rewrite, preview, script]
        
        // initialize
        .map(function(fn) {
            return fn(options);
        })

        // reduce right.
        .reverse()
        .reduce(function(prev, curr) {
            return function(req, res, next) {
                curr(req, res, function() {
                    prev(req, res, next);
                });
            }
        }, noop);
        
        // make sure the reduce excute even
        // the middlewares only got single child.
};