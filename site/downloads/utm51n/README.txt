GEBCO 2026: Iloilo-Guimaras, Philippines — projected bathymetry

Output coordinate system: WGS 84 / UTM zone 51N (EPSG:32651).
Horizontal coordinates: easting (x), northing (y), metres.
Elevation: metres relative to sea level, positive upward.
Seabed elevations remain negative; land elevations remain positive.
No vertical datum transformation or elevation offset was applied.

Files
- gebco_2026_iloilo_guimaras_utm51n.nc: classic NetCDF with CF-1.5
  projection metadata, one-dimensional projected x/y coordinates,
  elevation(y,x), and a transverse_mercator grid mapping.
- gebco_2026_iloilo_guimaras_utm51n.tif: equivalent projected GeoTIFF.
- gebco_2026_iloilo_guimaras_utm51n.xyz: headerless space-separated
  easting, northing, elevation; valid cell centres only, no missing-data rows.
- conversion-details.json: projection, grid, processing, and output statistics.
- reproject.py: reproducible conversion using the supplied source NetCDF.

Grid
460 x 460 metre cells, 83 columns x 84 rows.
Resampling: bilinear, suitable for continuous terrain elevations.
This is a true reprojection and resampling, not a CRS-label change.
Resampling changes individual elevations and may smooth local extrema.
NoData: -32767; edge cells outside source coverage are missing, not zero.
The nominal source resolution is 15 arcseconds (roughly 460 metres here).

DelftDashboard import (current Python-based version)
1. Set model/project CRS to WGS 84 / UTM zone 51N, EPSG:32651.
2. Open Bathymetry Import; select NetCDF and the .nc file.
3. Select the elevation variable (x/y coordinates are metres).
4. Set vertical units to metres, elevation positive up, source GEBCO 2026.
   The source defines elevation relative to sea level; use a 0 m offset
   only if that agrees with the model's intended vertical reference.
5. Import to the bathymetry catalog, then select it for grid interpolation.

If a version-specific NetCDF importer cannot read this layout, import the
GeoTIFF instead, or import the XYZ file and explicitly select EPSG:32651.
Legacy MATLAB-based Delft Dashboard menus and supported NetCDF layouts
vary; these files have not been tested in a running Delft Dashboard.

Validation completed
GDAL successfully re-opened both NetCDF and GeoTIFF and confirmed EPSG:32651,
grid orientation, spacing, dimensions, NoData, units, and matching elevations.

References
https://delftdashboard.readthedocs.io/en/latest/toolboxes/bathymetry.html
https://epsg.io/32651
https://doi.org/10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa

GEBCO data should not be used for navigation or safety at sea.
