const debug = require("debug")("StaticMaps-gl");
const express = require("express");
const fs = require("fs");
const getMap = require("./getMap");
const imageUtils = require("./imageUtils");
const mapUtils = require("./mapUtils");
const turf = require("@turf/turf");

const mapPool = getMap.getMapPool();

var args = process.argv.slice(2);
if (args.length == 0) {
  throw "Must specify command line argument for background config file.";
}
const stylePaths = require(args[0]);

const maxLat = 85;
const maxLon = 180;

function handleExtentRequest(req, res, width, height, background, extent, format = "png") {
  if (extent == undefined) {
    const overlayData = Object.keys(req.body).length > 0 ? req.body : undefined;
    if (overlayData == undefined) {
      return res.status(400).send("Request must include bounds, or post geojson data.");
    }
    extent = turf.bbox(overlayData);
    // buffer extent so data doesnt hit the edge
    const xSpan = extent[2] - extent[0];
    const ySpan = extent[3] - extent[1];
    const buffer = 0.1;
    if (xSpan > 0 && ySpan > 0) {
      extent[0] -= xSpan * buffer;
      extent[1] -= ySpan * buffer;
      extent[2] += xSpan * buffer;
      extent[3] += ySpan * buffer;
    }
  }
  const center = [(extent[0] + extent[2]) / 2.0, (extent[1] + extent[3]) / 2.0];
  var zoom = mapUtils.calculateZoom(extent, width, height);
  if (zoom > 15) {
    zoom = 15;
  }
  handleRequest(req, res, width, height, background, zoom, center, format);
}

function handleRequest(req, res, width, height, background, zoom, center, format = "png") {
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

      const stylePath = stylePaths[background];
      if (stylePath === undefined) {
        return res.status(404).send("Style not found.");
      }
      const styleData = fs.readFileSync(stylePath);
      var style = JSON.parse(styleData);
      if (style === undefined) {
        return res.status(500).send("Failed to load style.");
      }
      //empty post body produces an empty dict instead of undefined, so check number of keys
      if (Object.keys(req.body).length > 0) {
        style = mapUtils.addOverlayDataToStyle(style, req.body);
      }

      map.load(style);
      const options = {
        center: center,
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

const app = express();
app.use(express.json());
const port = 3000;
app.listen(port, () => console.log(`StaticMaps-gl listening on port ${port}!`));

// URL that doesn't specify a location, must be a post so location can be based on posted GeoJSON
app.post("/:width(\\d+)/:height(\\d+)/:background.:format", function(req, res) {
  debug("got request " + JSON.stringify(req.params));
  handleExtentRequest(
    req,
    res,
    parseInt(req.params.width),
    parseInt(req.params.height),
    req.params.background,
    undefined,
    req.params.format
  );
});

// URL that specifies a bounds. Zoom will be calculated to fit requested size. Post data is optional.
app
  .route("/:bounds/:width(\\d+)/:height(\\d+)/:background.:format")
  .get(function(req, res) {
    handleRequestWithBounds(req, res);
  })
  .post(function(req, res) {
    handleRequestWithBounds(req, res);
  });

function handleRequestWithBounds(req, res) {
  debug("got request " + JSON.stringify(req.params));
  const boundsString = req.params.bounds;
  const bounds = boundsString.split(",").map(i => parseFloat(i));

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
  handleExtentRequest(
    req,
    res,
    parseInt(req.params.width),
    parseInt(req.params.height),
    req.params.background,
    bounds,
    req.params.format
  );
}

// URL that specifies a center and zoom. Post data is optional.
app
  .route("/:zoom/:lon/:lat/:width/:height(\\d+)/:background.:format")
  .get(function(req, res) {
    handleRequestWithCoordinates(req, res);
  })
  .post(function(req, res) {
    handleRequestWithCoordinates(req, res);
  });

function handleRequestWithCoordinates(req, res) {
  const zoom = parseFloat(req.params.zoom);
  const lat = parseFloat(req.params.lat);
  const lon = parseFloat(req.params.lon);
  if (zoom < 0 || zoom > 20) {
    return res.status(400).send("Zoom must be in range 0-20.");
  } else if (Math.abs(lat) > maxLat) {
    return res.status(400).send("Latitude out of range.");
  } else if (Math.abs(lon) > maxLon) {
    return res.status(400).send("Longitude out of range.");
  }
  handleRequest(
    req,
    res,
    parseInt(req.params.width),
    parseInt(req.params.height),
    req.params.background,
    zoom,
    [lon, lat],
    req.params.format
  );
}
