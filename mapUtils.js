const sm = new (require("@mapbox/sphericalmercator"))({ size: 512 });

const overlayLineLayerDef = {
  id: "overlay-line",
  type: "line",
  source: "overlay",
  paint: {
    "line-width": ["coalesce", ["get", "stroke-width"], 2.0],
    "line-color": ["coalesce", ["get", "stroke"], "#FF0000"],
    "line-opacity": ["coalesce", ["get", "stroke-opacity"], 1.0]
  }
};

const overlayFillLayerDef = {
  id: "overlay-fill",
  type: "fill",
  source: "overlay",
  paint: {
    "fill-color": ["coalesce", ["get", "fill"], "#FF0000"],
    "fill-opacity": ["coalesce", ["get", "fill-opacity"], 0.6]
  }
};

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
  style.layers.push(overlayLineLayerDef);
  style.layers.push(overlayFillLayerDef);
  return style;
};
