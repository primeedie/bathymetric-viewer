const {test} = require('node:test');
const assert = require('node:assert/strict');
globalThis.geodesic = require('../site/vendor/geographiclib-geodesic.min.js');
const T = require('../site/transects.js');
const G = require('../site/grid-import.js');
const {parseCoordinate} = require('../site/coordinates.js');
const geod = geodesic.Geodesic.WGS84;

test('rectangles stay closed and orthogonal at multiple latitudes and rotations', () => {
  const mercator = p => [p.lng * Math.PI / 180, Math.log(Math.tan(Math.PI / 4 + p.lat * Math.PI / 360))];
  for (const lat of [-60, 0, 10.7, 60]) for (const angle of [0, 45, 90, 135, 267]) {
    const origin = {lat, lng:122};
    const points = T.rectangle(origin, 1000, 500, angle);
    assert.deepEqual(points[0], points[4]);
    assert.ok(Math.abs(geod.Inverse(points[0].lat, points[0].lng, points[1].lat, points[1].lng).s12 - 1000) < 1e-5);
    assert.ok(Math.abs(geod.Inverse(points[0].lat, points[0].lng, points[3].lat, points[3].lng).s12 - 500) < 1e-5);
    const p = points.map(mercator);
    for (let i = 0; i < 4; i++) {
      const a = p[i], b = p[(i+1)%4], c = p[(i+2)%4];
      const u = [b[0]-a[0], b[1]-a[1]], v = [c[0]-b[0], c[1]-b[1]];
      assert.ok(Math.abs((u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v))) < 1e-7);
    }
  }
});
test('geodesic line length, diagonal bearing, signed slope, and absent elevation', () => {
  const a = {lat:10.7,lng:122.6}, b = T.destination(a, 45, 1500);
  let i = 0; const result = T.segment(a,b,()=>[-100,-85][i++]);
  assert.ok(Math.abs(result.distance-1500)<1e-6);
  assert.ok(Math.abs(result.bearing-45)<1e-7);
  assert.ok(Math.abs(result.slopePercent-1)<1e-7);
  assert.equal(T.segment(a,b,()=>null).slopePercent,null);
  assert.equal(T.segment(a,a,()=>0).bearing,null);
  assert.equal(T.segment(a,a,()=>0).slopePercent,null);
});
test('ASCII grid origin, centre registration, nodata, and geographic validation', () => {
  const grid=G.parseASCII('ncols 2\nnrows 2\nxllcenter 122\nyllcenter 10\ncellsize 0.01\nNODATA_value -9999\n-100 -90\n-9999 10');
  assert.deepEqual(grid.values,[[-100,-90],[null,10]]);
  assert.equal(grid.min,-100); assert.equal(grid.max,10); assert.equal(grid.validCells,3);
  assert.ok(Math.abs(grid.transform[0]-121.995)<1e-10);
  assert.throws(()=>G.validateGrid({...grid,crs:'EPSG:32651'}),/WGS 84/);
  assert.throws(()=>G.validateGrid({...grid,width:1000000}),/250,000/);
  assert.throws(()=>G.validateGrid({...grid,values:[[null,null],[null,null]]}),/no valid elevation/);
  assert.throws(()=>G.parseASCII('ncols 2\nnrows 2\ncellsize 1\nxllcorner 122\nyllcorner 10\n1 2 3'),/count/);
});
test('DMS and decimal inputs, range and conflicting hemisphere validation', () => {
  assert.ok(Math.abs(parseCoordinate('10°41′45″N','latitude')-10.6958333333)<1e-8);
  assert.ok(Math.abs(parseCoordinate('122 36 22.5 E','longitude')-122.60625)<1e-8);
  assert.equal(parseCoordinate('-10.5','latitude'),-10.5);
  assert.throws(()=>parseCoordinate('10 60 0 N','latitude'),/Minutes/);
  assert.throws(()=>parseCoordinate('91 N','latitude'),/between/);
  assert.throws(()=>parseCoordinate('-10 N','latitude'),/conflicts/);
});
