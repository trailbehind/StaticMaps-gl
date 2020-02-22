const debug = require("debug")("StaticMaps-gl");
const express = require("express");
const getMap = require("./getMap");
const imageUtils = require("./imageUtils");
const request = require("request");
const sm = new (require("@mapbox/sphericalmercator"))();

const mapPool = getMap.getMapPool();

//TODO: load background options

function handleRequest(req, res, width, height, background, format = "png") {
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
      //TODO: calulate extent
      //TODO: add overlay

      const options = {
        center: [45, -111],
        width: width,
        height: height,
        zoom: 0
      };

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
const port = 3000;
app.listen(port, () => console.log(`StaticMaps-gl listening on port ${port}!`));
//TODO: change this to post
app.get("/:width(\\d+)/:height(\\d+)/:background.:format", function(req, res) {
  debug(req.params);
  handleRequest(
    req,
    res,
    parseInt(req.params.width),
    parseInt(req.params.height),
    req.params.background,
    req.params.format
  );
});

//TODO: add route to handle bbox
