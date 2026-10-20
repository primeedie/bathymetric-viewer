const datasets = [];
let activeDataset = 0, editingGeometryId = null;
const panelNames = ['data', 'points', 'lines', 'layers'];
function showPanel(name, focus = false) {
  for (const panel of panelNames) {
    $('panel-' + panel).hidden = panel !== name;
    const tab = $('tab-' + panel);
    tab.setAttribute('aria-selected', String(panel === name));
    tab.tabIndex = panel === name ? 0 : -1;
    if (focus && panel === name) tab.focus();
  }
}
for (const tab of document.querySelectorAll('[data-panel]')) {
  tab.onclick = () => showPanel(tab.dataset.panel);
  tab.onkeydown = e => {
    let i = panelNames.indexOf(tab.dataset.panel);
    if (e.key === 'ArrowRight') i = (i + 1) % panelNames.length;
    else if (e.key === 'ArrowLeft') i = (i + 3) % panelNames.length;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = 3;
    else return;
    e.preventDefault(); showPanel(panelNames[i], true);
  };
}
function setCoordinateInputs(lat, lon) {
  const dms = $('coordinate-format').value === 'dms';
  $('latitude').value = dms ? formatDMS(lat, 'latitude') : lat.toFixed(6);
  $('longitude').value = dms ? formatDMS(lon, 'longitude') : lon.toFixed(6);
}
$('coordinate-format').onchange = () => {
  const dms = $('coordinate-format').value === 'dms';
  try {
    const lat = parseCoordinate($('latitude').value, 'latitude'), lon = parseCoordinate($('longitude').value, 'longitude');
    setCoordinateInputs(lat, lon);
  } catch { /* Keep incomplete values while editing; submit explains validation errors. */ }
  $('latitude').placeholder = dms ? '10°41′45″N' : '10.69583';
  $('longitude').placeholder = dms ? '122°36′22.5″E' : '122.60625';
  $('coordinate-help').textContent = dms
    ? 'Example: 10°41′45″N, 122°36′22.5″E. Spaces also work: 10 41 45 N. Both formats are accepted.'
    : 'Example: 10.69583, 122.60625. Use a minus sign for south or west. Both formats are accepted.';
};
function elevationAt(lat, lon) {
  if (!data) return null;
  const x = Math.floor(px(lon)), y = Math.floor(py(lat));
  return x >= 0 && y >= 0 && x < data.width && y < data.height ? data.values[y][x] : null;
}
function signed(n) { return (n > 0 ? '+' : '') + n.toFixed(2); }
function describeSegment(a, b) {
  const m = Transects.segment(a, b, elevationAt);
  return `${formatLength(m.distance)} · Bearing ${m.bearing === null ? '—' : m.bearing.toFixed(1) + '°'} · Slope ${m.slopePercent === null ? 'unavailable' : signed(m.slopePercent) + '% (' + signed(m.slopeDegrees) + '°)'}`;
}
function snappedPoint(event) {
  if (!draft.length || !($('snap-direction').checked || event.originalEvent?.shiftKey)) return event.latlng;
  const p = Transects.snap(draft.at(-1), event.latlng);
  return L.latLng(p.lat, p.lng);
}
function updateMapStatus() {
  $('status').textContent = `${data.width} × ${data.height} cells · ${data.imported ? 'Uploaded elevation grid' : $('interval').value + ' m contours'} · zoom ${map.getZoom()}`;
}
function refreshDatasetSelector() {
  $('dataset-select').replaceChildren(...datasets.map((d, i) => {
    const option = document.createElement('option'); option.value = i; option.textContent = d.label; return option;
  }));
  $('dataset-select').disabled = false;
}
function activateDataset(index) {
  const next = datasets[index]; if (!next) return;
  if (drawing) stopDrawing(false);
  for (const layer of [terrain, contourLayer, coastLayer, footprintLayer]) if (layer) map.removeLayer(layer);
  terrain = contourLayer = coastLayer = footprintLayer = null;
  activeDataset = index; data = next; contourData = next.contours || null; coastData = next.coastline || null;
  map.attributionControl.removeAttribution('Terrain: GEBCO 2026 / Seabed 2030');
  map.attributionControl.removeAttribution('Terrain: uploaded elevation grid');
  map.attributionControl.addAttribution(data.imported ? 'Terrain: uploaded elevation grid' : 'Terrain: GEBCO 2026 / Seabed 2030');
  const gt = data.transform, west = gt[0], east = west + data.width * gt[1], north = gt[3], south = north + data.height * gt[5];
  bounds = L.latLngBounds([[south, west], [north, east]]);
  $('dataset-select').value = String(index);
  $('dataset-title').textContent = data.imported ? data.label : 'Iloilo–Guimaras, Philippines';
  $('dataset-description').textContent = `${data.imported ? 'Uploaded terrain' : 'GEBCO 2026'} · WGS 84 · Elevation in metres`;
  $('data-badge').textContent = data.imported ? 'Local file' : 'Bundled grid';
  $('bounds-text').textContent = `N ${north.toFixed(6)}° · S ${south.toFixed(6)}°\nW ${west.toFixed(6)}° · E ${east.toFixed(6)}°`;
  $('bounds-text').style.whiteSpace = 'pre-line';
  $('min').textContent = Number(data.min.toFixed(2)) + ' m'; $('max').textContent = Number(data.max.toFixed(2)) + ' m';
  $('dims').textContent = data.width + ' × ' + data.height;
  $('cell-spacing').textContent = `${Number((gt[1] * 3600).toFixed(2))}″ × ${Number((-gt[5] * 3600).toFixed(2))}″`;
  $('legend-min').textContent = Number(data.min.toFixed(1)) + ' m'; $('legend-max').textContent = Number(data.max.toFixed(1)) + ' m';
  const gradient = 'linear-gradient(90deg,' + Array.from({length:21}, (_,i) => 'rgb(' + color(data.min + (data.max-data.min)*i/20).join(',') + ')').join(',') + ')';
  document.querySelector('.legend').style.background = gradient;
  $('map-legend-ramp').style.background = gradient;
  $('map-legend-min').textContent = Number(data.min.toFixed(1)) + ' m';
  $('map-legend-max').textContent = Number(data.max.toFixed(1)) + ' m';
  $('map-dataset-name').textContent = data.imported ? data.label : 'Iloilo–Guimaras';
  $('map-dataset-detail').textContent = `${data.imported ? 'Local elevation grid' : 'GEBCO 2026'} · WGS 84`;
  terrain = new TerrainLayer().addTo(map);
  updateContours();
  if (coastData) {
    coastLayer = L.geoJSON(coastData, {pane: 'contourPane', interactive: false, style: {color:'#b7bd9d', weight:1.8, opacity:.9}});
    toggle(coastLayer, $('coast').checked);
  }
  footprintLayer = L.rectangle(bounds, {color:'#89b6b1', weight:2, dashArray:'7 5', fill:false, interactive:false})
    .bindTooltip('Elevation grid extent', {permanent:true, direction:'top', className:'footprint-label'});
  toggle(footprintLayer, $('footprint').checked);
  for (const id of ['contours','coast','interval','opacity']) $(id).disabled = data.imported;
  $('contour-note').textContent = data.imported ? 'Contour overlays are not generated for uploaded grids. Switch to the bundled dataset to see its contours.' : 'Derived from the bundled elevation grid.';
  $('loading').hidden = true;
  if (selectedPinId !== null) {const pin = savedPins.find(p => p.id === selectedPinId); if (pin) selectPin(pin);}
  else resetSelectedPin();
  renderLineList(); fit(); updateGraticule(); updateMapStatus();
}
$('dataset-select').onchange = () => activateDataset(Number($('dataset-select').value));
$('terrain-files').onchange = async e => {
  const files = [...e.target.files]; if (!files.length) return;
  const messages = []; let last = null, failed = false;
  e.target.disabled = true;
  try {
    for (const file of files) {
      $('upload-message').textContent = `Reading ${file.name}…`;
      await new Promise(resolve => setTimeout(resolve, 20));
      try {
        if (datasets.length >= 5) throw Error('The library holds 4 uploaded grids. Reload to start a new session.');
        const grid = await GridImport.readFile(file);
        datasets.push(grid); last = datasets.length - 1; messages.push(`${file.name}: added.`);
      } catch (error) { failed = true; messages.push(`${file.name}: ${error.message}`); }
    }
    refreshDatasetSelector(); if (last !== null) activateDataset(last);
  } finally {
    $('upload-message').textContent = messages.join(' ');
    $('upload-message').className = 'message' + (failed ? ' error-text' : '');
    e.target.value = ''; e.target.disabled = false;
  }
};
function geometryMessage(text, error = false) {
  $('geometry-message').textContent = text; $('geometry-message').className = 'message' + (error ? ' error-text' : '');
}
function updateGeometryForm() {
  const rectangle = $('geometry-type').value === 'rectangle';
  $('rectangle-width-field').hidden = !rectangle; $('rectangle-width').required = rectangle;
  $('rectangle-width').disabled = !rectangle;
  $('line-distance').max = rectangle ? 50000 / Number($('distance-unit').value) : 1000000 / Number($('distance-unit').value);
  $('rectangle-width').max = 50000 / Number($('distance-unit').value);
  $('width-unit').textContent = $('distance-unit').value === '1000' ? 'kilometres' : 'metres';
  $('create-geometry').textContent = `${editingGeometryId === null ? 'Create' : 'Update'} ${rectangle ? 'rectangle' : 'line'}`;
  $('geometry-help').textContent = rectangle
    ? 'A closed rectangle with right angles on the map. Length and width are measured along the two sides at the start corner; opposite geodesic sides may differ slightly with latitude. Maximum 50 km per side.'
    : 'A straight geodesic segment from the start coordinate, using your exact horizontal length and initial bearing. Maximum 1,000 km.';
}
$('geometry-type').onchange = updateGeometryForm;
let previousDistanceUnit = 1;
$('distance-unit').onchange = () => {
  const next = Number($('distance-unit').value);
  for (const id of ['line-distance', 'rectangle-width']) {
    if ($(id).value !== '') $(id).value = Number($(id).value) * previousDistanceUnit / next;
  }
  previousDistanceUnit = next; updateGeometryForm();
};
for (const button of document.querySelectorAll('[data-bearing]')) button.onclick = () => {$('line-bearing').value = button.dataset.bearing;};
$('use-selected-point').onclick = () => {
  if (!selected) {geometryMessage('Add or select a point on the map first, then return to Transects.', true); return;}
  $('origin-lat').value = selected.lat.toFixed(6); $('origin-lon').value = selected.lon.toFixed(6);
  geometryMessage('Start coordinate copied from the selected point.');
};
function validGeometryParameters(p) {
  return p && p.origin && Number.isFinite(p.origin.lat) && Math.abs(p.origin.lat) <= 85 && Number.isFinite(p.origin.lng) && Math.abs(p.origin.lng) <= 180
    && Number.isFinite(p.length) && p.length > 0 && p.length <= 1000000 && Number.isFinite(p.bearing) && p.bearing >= 0 && p.bearing < 360
    && (p.width === undefined || Number.isFinite(p.width) && p.width > 0 && p.width <= 50000 && p.length <= 50000);
}
function cancelGeometryEdit() {
  editingGeometryId = null; $('cancel-geometry-edit').hidden = true; updateGeometryForm();
}
$('cancel-geometry-edit').onclick = () => {cancelGeometryEdit(); geometryMessage('Editing cancelled.');};
function editGeometry(line) {
  const p = line.parameters; editingGeometryId = line.id;
  $('geometry-type').value = line.shape; $('origin-lat').value = String(p.origin.lat); $('origin-lon').value = String(p.origin.lng);
  $('distance-unit').value = '1'; previousDistanceUnit = 1; $('line-distance').value = p.length; $('rectangle-width').value = p.width || 500; $('line-bearing').value = p.bearing;
  $('cancel-geometry-edit').hidden = false; updateGeometryForm(); showPanel('lines');
  $('geometry-form').scrollIntoView({block:'nearest', behavior:'instant'});
  geometryMessage(`Editing ${line.shape} ${line.id}. Update dimensions to keep the shape constrained.`);
}
$('geometry-form').onsubmit = e => {
  e.preventDefault();
  try {
    if (!data) throw Error('Wait for terrain to load.');
    if (drawing) throw Error('Save or cancel the freehand line first.');
    const origin = {lat:parseCoordinate($('origin-lat').value, 'latitude'), lng:parseCoordinate($('origin-lon').value, 'longitude')};
    const shape = $('geometry-type').value, rectangle = shape === 'rectangle', unit = Number($('distance-unit').value);
    const p = {origin, length:Number($('line-distance').value) * unit, bearing:Number($('line-bearing').value)};
    if (rectangle) p.width = Number($('rectangle-width').value) * unit;
    if (!validGeometryParameters(p)) throw Error('Check the start coordinate, positive dimensions, and bearing (0° to less than 360°). Rectangle sides must be at most 50 km; lines at most 1,000 km.');
    const points = rectangle ? Transects.rectangle(origin, p.length, p.width, p.bearing) : [origin, Transects.destination(origin, p.bearing, p.length)];
    if (points.some(p => Math.abs(p.lat) > 85 || Math.abs(p.lng) > 180)) throw Error('The shape leaves the supported map extent. Choose a shorter distance.');
    const id = editingGeometryId;
    if (id !== null) {const old = savedLines.find(l => l.id === id); if(old) {old.layers.forEach(l => measureLayers.removeLayer(l)); savedLines = savedLines.filter(l => l !== old);}}
    const line = addSavedLine(points, id === null ? nextLine++ : id, {shape, parameters:p});
    persistLines(); cancelGeometryEdit(); map.fitBounds(L.latLngBounds(line.points).pad(.25), {maxZoom:17, animate:false});
    const missing = points.some(p => elevationAt(p.lat, p.lng) === null);
    geometryMessage(`${rectangle ? 'Rectangle' : 'Line'} ${id === null ? 'created' : 'updated'}. ${rectangle ? 'Corners stay square; use Edit dimensions to adjust.' : describeSegment(points[0], points[1])}${missing ? ' Some vertices are outside valid terrain; their slopes are unavailable.' : ''}`);
  } catch (error) {geometryMessage(error.message, true);}
};
updateGeometryForm();
