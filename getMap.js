const debug = require("debug")("StaticMaps-gl.getMap");
const genericPool = require("generic-pool");
const mbgl = require("@mapbox/mapbox-gl-native");
const request = require("request");

mbgl.on("message", function(e) {
  debug("mbgl: ", e);
  if (e.severity == "WARNING" || e.severity == "ERROR") {
    console.log("mbgl:", e);
  }
});

function getMap() {
  debug("Creating map");
  var _map = new mbgl.Map({
    mode: "static",
    ratio: 1.0,
    request: function(req, callback) {
      debug("request: " + JSON.stringify(req));
      var start = Date.now();
      var protocol = req.url.split(":")[0];
      if (protocol == "file") {
        var path = req.url.split("://")[1];
        fs.readFile(path, function(err, data) {
          if (err) {
            return callback(err);
          }
          var response = {};
          response.data = data;
          callback(null, response);
          debug("Request for " + req.url + " complete in " + (Date.now() - start) + "ms");
        });
      } else if (protocol == "http" || protocol == "https") {
        request(
          {
            url: req.url,
            encoding: null,
            gzip: true
          },
          function(err, res, body) {
            var duration = Date.now() - start;
            if (duration > 500) {
              if (res === undefined) {
                // If request timed out response will be undefined
                debug("Request for " + req.url + " failed in " + duration + "ms.");
              } else {
                // Headers are needed for debugging cases of slow responses from AWS s3
                debug(
                  "Request for " +
                    req.url +
                    " complete in " +
                    duration +
                    "ms.  Headers:" +
                    JSON.stringify(res.headers || null)
                );
              }
            } else {
              debug("Request for " + req.url + " complete in " + duration + "ms");
            }
            if (err) {
              callback(err);
            } else if (res.statusCode == 200) {
              var response = {};
              if (res.headers.modified) {
                response.modified = new Date(res.headers.modified);
              }
              if (res.headers.expires) {
                response.expires = new Date(res.headers.expires);
              }
              if (res.headers.etag) {
                response.etag = res.headers.etag;
              }

              response.data = body;

              callback(null, response);
            } else {
              //Dont make rendering fail if a resource is missing
              return callback(null, {});
            }
          }
        );
      } else {
        debug(`request for invalid url: "${req.url}"`);
        return callback(`request for invalid url: "${req.url}"`);
      }
    }
  });
  return _map;
}

exports.getMap = getMap;
exports.getMapPool = function() {
  const factory = {
    create: function() {
      return new Promise(function(resolve, reject) {
        try {
          var map = getMap();
          resolve(map);
        } catch (err) {
          console.error("Error creating map:", err);
          reject(err);
        }
      });
    },
    destroy: function(resource) {
      return new Promise(function(resolve) {
        debug("Destroying map, used " + resource.useCount + " times.");
        resource.release();
        resolve();
      });
    }
  };

  const maxMapUses = 0;
  if (maxMapUses > 0) {
    factory["validate"] = function(resource) {
      debug("validate");
      return new Promise(function(resolve) {
        console.log("validate: usecount:" + resource.useCount);
        if (resource.useCount != undefined && resource.useCount > maxMapUses) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    };
  }

  const opts = {
    max: 20, // maximum size of the pool
    min: 0, // minimum size of the pool
    testOnBorrow: maxMapUses > 0,
    idleTimeoutMillis: 15 * 60 * 1000,
    evictionRunIntervalMillis: maxMapUses > 0 ? 5 * 60 * 1000 : 0
  };

  debug("Creating map pool with opts:", opts);
  const mapPool = genericPool.createPool(factory, opts);
  return mapPool;
};
