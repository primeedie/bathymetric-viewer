/* Regional elevation imports. Files stay in this browser session. */
(function (root) {
  const MAX_CELLS = 250000;
  function validateGrid(input) {
    const {width, height, transform: gt, values} = input;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width * height > MAX_CELLS)
      throw Error('Choose a regional subset with 2–250,000 cells (at least 2 rows and columns).');
    if (input.crs !== 'EPSG:4326' || !Array.isArray(gt) || gt.length !== 6 || !gt.every(Number.isFinite) || gt[1] <= 0 || gt[5] >= 0 || gt[2] !== 0 || gt[4] !== 0)
      throw Error('Use a north-up geographic WGS 84 grid (EPSG:4326), not a projected UTM raster.');
    const east = gt[0] + width * gt[1], south = gt[3] + height * gt[5];
    if (gt[0] < -180 || east > 180.000001 || south < -85.05112878 || gt[3] > 85.05112878)
      throw Error('Choose a subset within 180°W–180°E and 85°S–85°N. Split areas crossing the date line.');
    if (!Array.isArray(values) || values.length !== height || values.some(row => !Array.isArray(row) || row.length !== width))
      throw Error('The grid dimensions do not match its elevation values.');
    let min = Infinity, max = -Infinity, validCells = 0, waterCells = 0;
    for (const row of values) for (const z of row) {
      if (z === null) continue;
      if (!Number.isFinite(z) || z < -12000 || z > 10000) throw Error('Expected terrain elevation in metres, from −12,000 to 10,000; missing cells must be null.');
      min = Math.min(min, z); max = Math.max(max, z); validCells++; if (z < 0) waterCells++;
    }
    if (!validCells) throw Error('This file has no valid elevation cells.');
    return {...input, width, height, transform: [...gt], values, min, max, validCells, waterCells,
      resolutionArcSeconds: gt[1] * 3600, crs: 'EPSG:4326'};
  }
  function parseASCII(text) {
    const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/), header = {};
    let start = 0;
    for (; start < lines.length; start++) {
      const parts = lines[start].trim().split(/\s+/), key = parts[0].toLowerCase();
      if (!['ncols','nrows','xllcorner','yllcorner','xllcenter','yllcenter','cellsize','nodata_value'].includes(key)) break;
      if (parts.length !== 2 || !Number.isFinite(Number(parts[1]))) throw Error('Invalid ESRI ASCII header.');
      header[key] = Number(parts[1]);
    }
    const width = header.ncols, height = header.nrows, cell = header.cellsize;
    if (!(cell > 0) || !Number.isInteger(width) || !Number.isInteger(height) || width * height > MAX_CELLS) throw Error('Invalid ASCII dimensions, or more than 250,000 cells.');
    const west = header.xllcorner ?? (header.xllcenter - cell / 2);
    const south = header.yllcorner ?? (header.yllcenter - cell / 2);
    const tokens = lines.slice(start).join(' ').trim().split(/\s+/);
    if (tokens.length !== width * height) throw Error('ASCII elevation count does not match ncols × nrows.');
    const flat = tokens.map(token => {const n = Number(token); if (!Number.isFinite(n)) throw Error('Invalid ASCII elevation.'); return n === header.nodata_value ? null : n;});
    return validateGrid({width, height, transform: [west, cell, 0, south + height * cell, 0, -cell],
      values: Array.from({length: height}, (_, y) => flat.slice(y * width, (y + 1) * width)), crs: 'EPSG:4326'});
  }
  async function readFile(file) {
    if (/(?:^|[_ .-])tid(?:[_ .-]|$)/i.test(file.name)) throw Error('TID grids contain source identifiers, not elevations. Choose the GEBCO elevation grid.');
    if (file.size > 30 * 1024 * 1024) throw Error('Maximum file size is 30 MB. Download a smaller regional subset.');
    const extension = file.name.split('.').pop().toLowerCase();
    let grid;
    if (extension === 'json') grid = validateGrid(JSON.parse(await file.text()));
    else if (['asc','ascii'].includes(extension)) grid = parseASCII(await file.text());
    else if (['tif','tiff'].includes(extension)) {
      const tiff = await root.GeoTIFF.fromArrayBuffer(await file.arrayBuffer()), image = await tiff.getImage();
      const keys = image.getGeoKeys();
      if (keys.GeographicTypeGeoKey !== 4326 || keys.ProjectedCSTypeGeoKey || image.getSamplesPerPixel() !== 1)
        throw Error('Choose the single-band GEBCO elevation GeoTIFF in WGS 84 (EPSG:4326), not an image, TID grid, or UTM file.');
      const width = image.getWidth(), height = image.getHeight();
      if (width * height > MAX_CELLS) throw Error('This grid exceeds 250,000 cells. Download a smaller regional subset.');
      const resolution = image.getResolution(), origin = image.getOrigin();
      if (image.fileDirectory.ModelTransformation || resolution[0] <= 0 || resolution[1] >= 0)
        throw Error('Only north-up GeoTIFF grids without rotation are supported.');
      // GeoTIFF point registration gives the centre of the first cell.
      const point = keys.GTRasterTypeGeoKey === 2;
      const west = origin[0] - (point ? resolution[0] / 2 : 0), north = origin[1] - (point ? resolution[1] / 2 : 0);
      const nodata = image.getGDALNoData(), raster = (await image.readRasters({samples: [0]}))[0];
      grid = validateGrid({width, height, crs: 'EPSG:4326', transform: [west, resolution[0], 0, north, 0, resolution[1]],
        values: Array.from({length: height}, (_, y) => Array.from(raster.slice(y * width, (y + 1) * width), z => !Number.isFinite(z) || z === nodata ? null : z))});
    } else throw Error('Upload an unzipped elevation .tif, .tiff, .asc, or prepared .json file. For .nc, download GeoTIFF instead or use tools/prepare.py.');
    return {...grid, source: file.name, label: file.name, imported: true};
  }
  root.GridImport = {validateGrid, parseASCII, readFile, MAX_CELLS};
  if (typeof module !== 'undefined') module.exports = root.GridImport;
})(typeof window !== 'undefined' ? window : globalThis);
