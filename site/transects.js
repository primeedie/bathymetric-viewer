/* Measurement helpers, shared by freehand and parameter-based tools. */
(function(root) {
  const geod = root.geodesic.Geodesic.WGS84;
  const bearing = angle => (angle % 360 + 360) % 360;
  function segment(a, b, elevationAt) {
    const inverse = geod.Inverse(a.lat, a.lng, b.lat, b.lng), distance = inverse.s12;
    const start = elevationAt(a.lat, a.lng), end = elevationAt(b.lat, b.lng);
    const rise = Number.isFinite(start) && Number.isFinite(end) ? end - start : null;
    return {distance, bearing: distance > .001 ? bearing(inverse.azi1) : null, rise,
      slopePercent: rise !== null && distance > .001 ? 100 * rise / distance : null,
      slopeDegrees: rise !== null && distance > .001 ? Math.atan2(rise, distance) * 180 / Math.PI : null};
  }
  function destination(a, azimuth, metres) {
    const p = geod.Direct(a.lat, a.lng, azimuth, metres);
    return {lat: p.lat2, lng: p.lon2};
  }
  function snap(a, b, increment = 45) {
    const inv = geod.Inverse(a.lat, a.lng, b.lat, b.lng);
    return destination(a, Math.round(inv.azi1 / increment) * increment, inv.s12);
  }
  // Mercator orthogonal sides keep the rectangle square on the north-up map.
  // Solve both adjacent side lengths using ellipsoidal distances at the origin.
  function rectangle(origin, length, width, azimuth) {
    const R = 6378137, rad = Math.PI / 180;
    const project = p => ({x: R * p.lng * rad, y: R * Math.log(Math.tan(Math.PI / 4 + p.lat * rad / 2))});
    const unproject = p => ({lat: (2 * Math.atan(Math.exp(p.y / R)) - Math.PI / 2) / rad, lng: p.x / R / rad});
    const start = project(origin), theta = azimuth * rad;
    const along = {x: Math.sin(theta), y: Math.cos(theta)}, across = {x: Math.cos(theta), y: -Math.sin(theta)};
    function size(direction, target) {
      let low = 0, high = target / Math.max(.05, Math.cos(origin.lat * rad)) * 2;
      for (let i = 0; i < 50; i++) {
        const mid = (low + high) / 2, end = unproject({x: start.x + direction.x * mid, y: start.y + direction.y * mid});
        if (geod.Inverse(origin.lat, origin.lng, end.lat, end.lng).s12 < target) low = mid; else high = mid;
      }
      return (low + high) / 2;
    }
    const l = size(along, length), w = size(across, width);
    const points = [[0,0],[l,0],[l,w],[0,w],[0,0]].map(([u,v]) => unproject({x: start.x + along.x * u + across.x * v, y: start.y + along.y * u + across.y * v}));
    if (points.some(p => Math.abs(p.lat) > 85 || Math.abs(p.lng) > 180)) throw Error('This rectangle crosses the supported map extent. Choose a smaller size or a different origin.');
    return points;
  }
  root.Transects = {bearing, segment, destination, snap, rectangle};
  if (typeof module !== 'undefined') module.exports = root.Transects;
})(typeof window !== 'undefined' ? window : globalThis);
