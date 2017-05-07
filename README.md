# pogogr-map
Google Maps with overlay for Grand Rapids Pokemon Go mappers. Use `config.json`
to change the region coverage.

## Code relevant to others

The files `hexgrid.js` and `index.html` contain most of the relevant logic for
creating a hex grid, and marking up regions. For libraries, `fork.css` is used
for the github banner, and `maplabel.js` is used for adding text to regions.

Anyone who sets up their own copy of this repo should completely change
`config.json`.

## config.json

There's essentially three parts to the config: Top-Level, maps, and regions.

### Top-Level config

  - `center` controls the initial center point of the map, in
  `lat`titude/`long`itude.
  - `zoom` controls the initial zoom level. Lower numbers zoom out, higher
  numbers zoom in. Each level corresponds to one "click" on a Windows scroll
  wheel.
  - `maps` lists all the hex grids/maps that exist.

### Maps

Each map is currently a hex grid and a bunch of regions. It's better to have more
maps than a single large map, since error accumulates rather quickly in hex
locations. Each hex grid is a bunch of "rings" of hexes, one nested in another.
Each "ring" is laid out in a hexagon shape itself, due to the single central
hexagon.

Options:
  - `name` is a human-friendly label for a region. It should be kept unique for
  clarity, and so that each map has a unique ID in the page.
  - `lat` and `long` control the "origin" or "center" of the grid.
  - `steps` control how big the hexes are. Step size 1 is roughly 70 meters center
  to corner, and each step above that is roughly 121.25 meters on top of that.
  These numbers are controlled by the `scanRadius` in `hexgrid.js`.
  - `ringCount` controls how many rings are drawn in the grid. Nothing requires
  that you limit your regions to the drawn grid. Each ring is a single layer of
  hexes drawn on top of the center. So, 0 rings is just the center, 1 is a total
  of 7 hexes, and so on.
  - `regions` lists all of the highlighted regions that exist.

### Regions

Each region is a group of adjacent hexes on a single grid. Each hex is
referenced by `{"ring": __, "offset": __}` notation. Regions are ultimately what
allow people to talk about particular areas on a map, so most of the control
over appearance is left to the region. Hexes that are in a grid, but not a
region, are assumed to not be of interest unless someone is creating a region.

Options:

  - `name` is used by both humans and machines to uniquely identify a region.
  - `textStyle` are used to control the appearance of the region label. See
  `maplabel.js`. Options include:
    - `fontFamily` indicates which font is used in the text. Defaults to
    `sans-serif`.
    - `fontSize` is how large the text is, in points. Defaults to 12.
    - `fontColor` is the color of the text itself. Defaults to `'#000000'`, or
    black.
    - `strokeWeight` is the size of the background behind the text. Defaults to
    4.
    - `strokeColor` is the color of the background behind the text. Defaults to
    `'#ffffff'`, or white.
    - `algin` controls how the text is aligned with the label's location
    (currently, the center of the hex). Defaults to `'center'`.
    - `zIndex` probably controls the order in which the label shows up on the
    page. Defaults to `1e3`, haven't messed with it yet.
  - `style` controls how the hexes themselves are drawn. Passed directly to
  Google Maps API. See [the offical documentation](https://developers.google.com/maps/documentation/javascript/reference#Data.StyleOptions).
