const CPUCount = require("os").cpus().length;
const debug = require("debug")("StaticMaps-gl");
const genericPool = require("generic-pool");
const mbgl = require("@mapbox/mapbox-gl-native");
const request = require("request");
const sharp = require("sharp");
const sm = new (require("@mapbox/sphericalmercator"))();
const express = require("express");

mbgl.on("message", function(e) {
  debug("mbgl: ", e);
  if (e.severity == "WARNING" || e.severity == "ERROR") {
    console.log("mbgl:", e);
  }
});
debug("simd available: " + sharp.simd(true));

const app = express();
const port = 3000;

app.listen(port, () => console.log(`StaticMaps-gl listening on port ${port}!`));
