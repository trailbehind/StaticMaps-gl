const turf = require("@turf/turf");
const debug = require("debug")("StaticMaps-gl");
const express = require("express");
const getMap = require("./getMap");
const imageUtils = require("./imageUtils");
const sm = new (require("@mapbox/sphericalmercator"))({ size: 512 });

const mapPool = getMap.getMapPool();

//TODO: load background options
const stylePaths = {
  topo: "./style.json"
};

function calculateZoom(extent, width, height) {
  for (var zoom = 20; zoom > 0; zoom -= 0.1) {
    const ll = sm.px([extent[0], extent[1]], zoom);
    const ur = sm.px([extent[2], extent[3]], zoom);
    if (ur[0] - ll[0] < width && ll[1] - ur[1] < height) {
      return zoom;
    }
  }
  return 15;
}

function handleExtentRequest(req, res, width, height, background, extent, format = "png") {
  const overlayData = Object.keys(req.body).length > 0 ? req.body : undefined;
  if (extent == undefined) {
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
  var zoom = calculateZoom(extent, width, height);
  if (zoom > 15) {
    zoom = 15;
  }
  handleRequest(req, res, width, height, background, zoom, center, format);
};


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
      var style = require(stylePath);
      if (style === undefined) {
        return res.status(500).send("Failed to load style.");
      }
      const overlayData = Object.keys(req.body).length > 0 ? req.body : undefined;
      if (overlayData != undefined) {
        style.sources["overlay"] = { type: "geojson", data: overlayData };
        //TODO: style overlay data
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
