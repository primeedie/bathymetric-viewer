# Bathymetry Studio

A runnable, static bathymetry viewer for the Iloilo–Guimaras area of the Philippines. Built with Leaflet, OpenStreetMap, GEBCO 2026 terrain, and GeographicLib. No API keys, npm installation, or application server are required.

## Run locally

With Python 3 installed, run from this repository:

```sh
python3 serve.py
```

Open **http://127.0.0.1:8082**. Choose another port with `python3 serve.py --port 8090`.

Serve the site over HTTP rather than opening `index.html` as a file, because the viewer fetches its local data files. Internet access is needed for OpenStreetMap tiles; the terrain, contours, coordinate conversions, and line calculations are bundled locally.

## Features

- OpenStreetMap basemap with a georeferenced GEBCO NetCDF-derived elevation overlay, visibility toggle, and opacity slider.
- Exact file footprint, north-up view, coordinate grid, scale bar, Philippines overview, and native cell inspection.
- Depth/elevation contours, sea-level contour, and optional cell boundaries.
- Coordinate search using decimal degrees or degrees/minutes/seconds, with decimal, DMS, and UTM equivalents.
- Device geolocation when the browser grants permission. Coordinates are processed in the browser; external map links open only when clicked.
- Multiple named, draggable pins, single/multiple-pin mode, browser-local saving, view-all, and point GeoJSON export.
- A light interface with Data, Points, Transects, and Display tabs, a persistent map legend, and responsive desktop/mobile layouts.
- Explicit decimal-degree and DMS coordinate modes. Both formats are accepted in coordinate and transect-origin fields.
- Regional elevation uploads: unzipped geographic WGS 84 GeoTIFF (`.tif`, `.tiff`), ESRI ASCII (`.asc`, `.ascii`), or the prepared viewer grid (`.json`).
- Four imported datasets per session, with a selector to switch between them and the bundled grid. Files stay on the device; uploads are not saved across reloads.
- Rectangle transects with a start corner, length, width, and rotation. Adjacent dimensions are solved with GeographicLib; sides remain perpendicular in the north-up Mercator map. Opposite geodesic sides may differ slightly with latitude. Edit dimensions to preserve the rectangle instead of dragging corners independently.
- Straight lines created from a start coordinate, exact horizontal length in metres or kilometres, and initial bearing.
- Freehand lines with optional 45° snapping (or hold Shift), live length/bearing/slope, draggable vertices, browser-local saving, and GeoJSON export with per-segment measurements.
- Original NetCDF, GeoTIFF, contours, and reprojected UTM downloads for Delft Dashboard.

Start a measurement using **Draw line**, click to add vertices, and select **Finish** or press Enter. Backspace removes a draft vertex; Escape cancels. Drag saved handles to edit. Line lengths are horizontal WGS 84 ellipsoidal geodesic distances calculated with GeographicLib, not screen distances or terrain-following distances. Measurement accuracy depends on point placement. Rectangles are limited to 50 km per side; straight lines to 1,000 km. Rectangle rotation is measured relative to map north; each segment’s ellipsoidal bearing is listed separately. Slope is the signed change in the containing grid cells’ elevation divided by horizontal endpoint distance, shown in percent and degrees. It is an endpoint estimate, not a sampled seabed profile or terrain-following distance. Slopes are unavailable outside valid terrain cells.

## Publish with GitHub Pages

The repository includes `.github/workflows/pages.yml`, which validates and deploys only `site/` on pushes to `main`.

1. In the GitHub repository, open **Settings → Pages**.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Push to `main` or run **Publish bathymetry workbench** from the Actions tab.
4. Open the deployed URL shown by the completed workflow.

Relative asset paths support both a root domain and a GitHub Pages project path such as `/bathymetric-viewer/`. See [GitHub Pages custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Data and projection

The original WGS 84 grid contains **83 × 82 cells**, at **15 arcsecond** spacing, approximately 460 m here. Elevation is in metres relative to sea level: land positive, seabed negative. Bounds read from the supplied file are 122.433333°–122.779167° E and 10.525000°–10.866667° N. Zooming does not increase terrain resolution.

The map projects every native cell edge through Leaflet's map CRS, keeping the terrain aligned with OSM. The source NetCDF is preprocessed into browser-readable `data.json` and contour GeoJSON; NetCDF is not parsed dynamically by the website.

For new GEBCO downloads, choose a regional **elevation Data GeoTIFF** or **ESRI ASCII** file from the [GEBCO download app](https://download.gebco.net/), unzip it, and use **Data → Choose terrain files**. Use geographic WGS 84 coordinates, positive-up elevations in metres, a north-up raster, and at most **250,000 cells / 30 MB per file**. Choose a small regional subset, not the global grid. Shaded images, source identifier (TID) grids, projected UTM grids, polar areas beyond 85°, date-line-crossing grids, ZIP archives, and direct NetCDF uploads are not supported. For NetCDF, download GeoTIFF instead or convert using `tools/prepare.py` and upload its `data.json`.

Uploaded terrain retains native cell elevations and georeferencing. NoData cells remain missing. Derived contours are disabled for uploaded grids, and re-enabled when switching back to the bundled dataset. Existing points and transects are preserved; elevations and slopes are recalculated from the active grid. Download links always refer to the bundled Iloilo–Guimaras dataset.

The `site/downloads/utm51n/` dataset is reprojected to **WGS 84 / UTM zone 51N, EPSG:32651**, with easting/northing coordinates in metres, square 460 m cells, and bilinear resampling. The output has 83 × 84 cells. No vertical datum transformation or elevation-sign change was applied. Edge NoData cells are preserved as missing data, not zero elevation.

The converted NetCDF, GeoTIFF, and XYZ were checked with GDAL. They have not been tested inside a running Delft Dashboard. Version-specific import notes are included in the download package. This website displays terrain; it does not run a hydrodynamic simulation. GEBCO data are not for navigation or safety at sea.

## Optional data preparation

The checked-in site is already prepared. Only regeneration needs Python with NumPy and GDAL, including its NetCDF driver and configured PROJ data:

```sh
python3 tools/prepare.py path/to/source.nc --output-dir site
python3 tools/reproject.py path/to/source.nc --output-dir site/downloads/utm51n
```

The preparation scripts do not require MATLAB or QGIS. They use standard GDAL Python bindings. If replacing the dataset, update place labels and rebuild the downloadable ZIP to match.

## Checks

```sh
python3 scripts/check_site.py
node --check site/viewer.js
node --check site/coordinates.js
node --check site/workspace.js
node --check site/grid-import.js
node --check site/transects.js
node --test scripts/tools.test.cjs
```

Browser regression checks cover GeoTIFF/ASCII uploads, invalid and projected files, dataset switching, DMS, rectangle constraints and edits, exact-length lines, slope calculations, snapping, exports, persistence, and desktop/mobile overflow. Run an isolated Chrome with `--remote-debugging-port=9224`, serve the site on port 8083, then run `node scripts/browser-check.mjs`. Set `BASE_URL` or `CDP_PORT` to use different addresses. The script changes test-origin browser storage and should use a separate browser profile.

Node.js is needed only for these optional JavaScript syntax checks, not to serve or use the site.

## Attribution

- Terrain: [GEBCO 2026](https://doi.org/10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa), Nippon Foundation–GEBCO Seabed 2030 Project. Refer to [GEBCO terms of use](https://www.gebco.net/data-products/gridded-bathymetry-data).
- Basemap: [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright). The site uses standard browser tile requests under the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/), with visible attribution and no tile prefetching.
- [geotiff.js](https://github.com/geotiffjs/geotiff.js/) 3.0.5 decodes uploaded GeoTIFFs locally. Its MIT license is included in `site/vendor/GEOTIFF-LICENSE.txt`.
- [Leaflet](https://leafletjs.com/) 1.9.4 and [GeographicLib](https://geographiclib.sourceforge.io/html/js/) 2.2.0 are vendored with their license notices in `site/vendor/`.

Pins and drawn lines stay in the current browser's local storage until cleared or exported; they are not written back to GitHub.
