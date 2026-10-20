# Bathymetric Viewer

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
- Multiple editable lines, live segment/total lengths, draggable vertices, browser-local saving, and GeoJSON export.
- Original NetCDF, GeoTIFF, contours, and reprojected UTM downloads for Delft Dashboard.

Start a measurement using **Draw line**, click to add vertices, and select **Finish** or press Enter. Backspace removes a draft vertex; Escape cancels. Drag saved handles to edit. Line lengths are horizontal WGS 84 ellipsoidal geodesic distances calculated with GeographicLib, not screen distances or terrain-following distances. Measurement accuracy depends on point placement.

## Publish with GitHub Pages

The repository includes `.github/workflows/pages.yml`, which validates and deploys only `site/` on pushes to `main`.

1. In the GitHub repository, open **Settings → Pages**.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Push to `main` or run **Publish bathymetry workbench** from the Actions tab.
4. Open the deployed URL shown by the completed workflow.

Relative asset paths support both a root domain and a GitHub Pages project path such as `/bathymetric-viewer/`. See [GitHub Pages custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Data and projection

The original WGS 84 grid contains **83 × 82 cells**, at **15 arcsecond** spacing, approximately 460 m here. Elevation is in metres relative to sea level: land positive, seabed negative. Bounds read from the supplied file are 122.433333°–122.779167° E and 10.525000°–10.866667° N. Zooming does not increase terrain resolution.

The map projects every native cell edge through Leaflet's map CRS, keeping the terrain aligned with OSM. The source NetCDF is preprocessed into browser-readable `data.json` and contour GeoJSON; it is not parsed dynamically by the website.

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
```

Node.js is needed only for these optional JavaScript syntax checks, not to serve or use the site.

## Attribution

- Terrain: [GEBCO 2026](https://doi.org/10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa), Nippon Foundation–GEBCO Seabed 2030 Project. Refer to [GEBCO terms of use](https://www.gebco.net/data-products/gridded-bathymetry-data).
- Basemap: [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright). The site uses standard browser tile requests under the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/), with visible attribution and no tile prefetching.
- [Leaflet](https://leafletjs.com/) 1.9.4 and [GeographicLib](https://geographiclib.sourceforge.io/html/js/) 2.2.0 are vendored with their license notices in `site/vendor/`.

Pins and drawn lines stay in the current browser's local storage until cleared or exported; they are not written back to GitHub.
