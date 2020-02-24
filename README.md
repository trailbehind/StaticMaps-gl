# StaticMaps-gl

Static map rendering with mapbox-gl. Renders a static map image from a mapbox-gl style, optionally overlaying GeoJSON data sent from the client.

Multiple styles are supported, and must be specified with a config file. For an example config file see [backgrounds.json](backgrounds.json).

## Routes

### Zoom and Center coordinates

Request a map centered on a given coordinate, and a given zoom level.
/**zoom**/**lon**/**lat**/**width**/**height**/**background**.**format**
Example `/10.5/45/-111/200/200/default.png`
Post data is optional.
Zoom levels are based on 512 pixel tiles, so they may be 1 off from expected.

### Bounds

Request a map of a specific geographic region.
"/**bounds**/**width**/**height**/**background**.**format**"
Bounds is in the formal W,S,E,N.
Example: `/-110,44,-109,45/100/100/topo.png`
Post data is optional.

### Cover data

Request a map of a region that covers POSTed GeoJSON data.
Example: `/100/100/topo.png`
Post data is required.
Extent is buffered 10% so data does not touch edges of map.

## Styling data

Styling is based on the [simplestyle spec](https://github.com/mapbox/simplestyle-spec/tree/master/1.1.0). All keys are supported except `marker-symbol`.

## Image format options

The following image formats are supported:

- png
- jpg or jpeg
- webp

jpeg and webp can also specify a quality level, one of:

- 70
- 80
- 90
- 100

For example `.jpg90`

## Example requests

- `curl -d '{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[-111.37939453125,44.61393394730626]}}' -H 'Content-Type: application/json' http://localhost:3000/100/100/default.png`
