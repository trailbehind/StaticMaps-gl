const debug = require("debug")("StaticMaps-gl");
const express = require("express");
const getMap = require("./getMap");
const imageUtils = require("./imageUtils");
const request = require("request");
const sm = new (require("@mapbox/sphericalmercator"))();

const mapPool = getMap.getMapPool();

function handleRequest(req, res, width, height, background, format = "png") {
  const imageFormat = imageUtils.parseImageFormat(format);
  debug(
    "image format:" + imageFormat.format + " image options:" + JSON.stringify(imageFormat.options)
  );
  res.send("response");
}

const app = express();
const port = 3000;
app.listen(port, () => console.log(`StaticMaps-gl listening on port ${port}!`));
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
