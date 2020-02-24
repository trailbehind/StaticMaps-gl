const sm = new (require("@mapbox/sphericalmercator"))({ size: 512 });

exports.calculateZoom = function(extent, width, height) {
  for (var zoom = 20; zoom > 0; zoom -= 0.1) {
    const ll = sm.px([extent[0], extent[1]], zoom);
    const ur = sm.px([extent[2], extent[3]], zoom);
    if (ur[0] - ll[0] < width && ll[1] - ur[1] < height) {
      return zoom;
    }
  }
  return 15;
};

exports.addOverlayDataToStyle = function(style, overlay) {
  style.sources["overlay"] = { type: "geojson", data: overlay };
  // TODO: add style layers
  return style;
};
