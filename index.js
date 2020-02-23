const debug = require("debug")("StaticMaps-gl");
const express = require("express");
const getMap = require("./getMap");
const imageUtils = require("./imageUtils");
const request = require("request");
const sm = new (require("@mapbox/sphericalmercator"))();

const mapPool = getMap.getMapPool();

//TODO: load background options

function handleRequest(req, res, width, height, background, extent, format = "png") {
  const imageFormat = imageUtils.parseImageFormat(format);

  var start = Date.now();
  mapPool
    .acquire()
    .then(function(map) {
      debug("Got map in " + (Date.now() - start) + "ms");
      if (map.useCount == undefined) {
        map.useCount = 0;
      }
      debug("Map used " + map.useCount + " times.");
      map.useCount++;

      //TODO: set style
      //TODO: add overlay
      var overlayData;
      if (extent == undefined) {
        if (overlayData == undefined) {
          return res.status(400).send("Request must include bounds, or post geojson data.");
        }
        //TODO: calulate extent from overlay data
      }
      //TODO: calculate zoom
      var zoom = 10;
      const options = {
        center: [(extent[0] + extent[2]) / 2.0, (extent[1] + extent[3]) / 2.0],
        width: width,
        height: height,
        zoom: zoom
      };
      debug("rendering map with options " + JSON.stringify(options));

      start = Date.now();
      map.render(options, (err, data) => {
        debug("Rendering complete in " + (Date.now() - start) + "ms");
        mapPool.release(map);
        if (err) {
          debug("error rendering map: " + err);
          return res.sendStatus(500);
        }
        imageUtils.sendImageResponse(res, width, height, data, imageFormat);
      });
    })
    .catch(error => {
      debug("exception rendering map: " + error);
      return res.sendStatus(500);
    });
}

function handleRequestWithBounds(req, res) {
  debug("got request " + JSON.stringify(req.params));
  const boundsString = req.params.bounds;
  const bounds = boundsString.split(",").map(i => parseFloat(i));
  const maxLat = 85;
  const maxLon = 180;
  if (bounds.length != 4) {
    return res.status(400).send("Bounds must have 4 values.");
  } else if (
    Math.abs(bounds[0]) > maxLon ||
    Math.abs(bounds[1]) > maxLat ||
    Math.abs(bounds[2]) > maxLon ||
    Math.abs(bounds[3]) > maxLat
  ) {
    return res.status(400).send("bounds out of range.");
  } else if (bounds[0] > bounds[2] || bounds[1] > bounds[3]) {
    return res.status(400).send("invalid bounds.");
  }
  handleRequest(
    req,
    res,
    parseInt(req.params.width),
    parseInt(req.params.height),
    req.params.background,
    bounds,
    req.params.format
  );
}

const app = express();
const port = 3000;
app.listen(port, () => console.log(`StaticMaps-gl listening on port ${port}!`));
app.post("/:width(\\d+)/:height(\\d+)/:background.:format", function(req, res) {
  debug("got request " + JSON.stringify(req.params));
  handleRequest(
    req,
    res,
    parseInt(req.params.width),
    parseInt(req.params.height),
    req.params.background,
    undefined,
    req.params.format
  );
});

app
  .route("/:bounds/:width(\\d+)/:height(\\d+)/:background.:format")
  .get(function(req, res) {
    handleRequestWithBounds(req, res);
  })
  .post(function(req, res) {
    handleRequestWithBounds(req, res);
  });
