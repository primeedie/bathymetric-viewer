// Run with a separate Chrome started with --remote-debugging-port=9224.
// BASE_URL defaults to the local preview. No browser packages are required.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:8083/';
const tabs = await (await fetch('http://127.0.0.1:' + (process.env.CDP_PORT || 9224) + '/json/list')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => {ws.onopen = resolve; ws.onerror = reject;});
let id = 0; const pending = new Map(), exceptions = [];
ws.onmessage = e => {
  const message = JSON.parse(e.data);
  if (message.id) {const job = pending.get(message.id); if (!job) return; pending.delete(message.id); clearTimeout(job.timer); message.error ? job.reject(Error(JSON.stringify(message.error))) : job.resolve(message.result);}
  else if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
};
function send(method, params = {}) {return new Promise((resolve, reject) => {const key = ++id; const timer = setTimeout(() => {pending.delete(key); reject(Error('CDP timeout: ' + method));}, 20000); pending.set(key, {resolve, reject, timer}); ws.send(JSON.stringify({id:key, method, params}));});}
async function run(expression) {const r = await send('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true}); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value;}
async function waitFor(expression) {for (let i=0; i<100; i++) {if(await run(expression)) return; await new Promise(r=>setTimeout(r,100));} throw Error('Condition not met: ' + expression);}
async function screenshot(path) {const shot = await send('Page.captureScreenshot', {format:'png',captureBeyondViewport:false}); fs.writeFileSync(path, Buffer.from(shot.data,'base64'));}
try {
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:base});
  await waitFor("typeof data!=='undefined' && !!data && document.getElementById('loading').hidden");
  await run("clearPins();savedLines.forEach(l=>l.layers.forEach(x=>measureLayers.removeLayer(x)));savedLines=[];nextLine=1;persistLines();renderLineList();");
  assert.equal(await run("$('data-badge').textContent"), 'Bundled grid');
  assert.equal(await run('!!terrain._canvas'), true);
  const parsed = await run("[parseCoordinate('10°41′45″N','latitude'),parseCoordinate('122 36 22.5 E','longitude'),parseCoordinate('-10.5','latitude')]");
  [10.695833333333333,122.60625,-10.5].forEach((n,i)=>assert.ok(Math.abs(parsed[i]-n)<1e-10));
  const coordinates = await run("(()=>{showPanel('points');$('coordinate-format').value='dms';$('coordinate-format').onchange();$('coordinate-form').requestSubmit();locatePoint(10.70,122.61);return {count:savedPins.length,dms:$('latitude').value,elevation:selected.z};})()");
  assert.equal(coordinates.count,2); assert.match(coordinates.dms,/°/);
  console.log('Coordinate formats and multiple pins pass',coordinates);
  const rectangles=await run(`(()=>{const results=[];showPanel('lines');for(const angle of [0,45,90,135,267]){$('geometry-type').value='rectangle';$('origin-lat').value='10.69583';$('origin-lon').value='122.60625';$('line-distance').value='1000';$('rectangle-width').value='500';$('line-bearing').value=angle;updateGeometryForm();$('geometry-form').requestSubmit();const line=savedLines.at(-1),p=line.points.map(p=>map.options.crs.project(p));const a=p[1].subtract(p[0]),b=p[2].subtract(p[1]);results.push({angle,shape:line.shape,closed:line.points[0].equals(line.points.at(-1)),length:geod.Inverse(line.points[0].lat,line.points[0].lng,line.points[1].lat,line.points[1].lng).s12,width:geod.Inverse(line.points[0].lat,line.points[0].lng,line.points[3].lat,line.points[3].lng).s12,dot:(a.x*b.x+a.y*b.y)/(Math.hypot(a.x,a.y)*Math.hypot(b.x,b.y)),draggable:!!line.layers[1].dragging?.enabled()});}return results;})()`);
  for(const r of rectangles){assert.equal(r.shape,'rectangle');assert.equal(r.closed,true);assert.ok(Math.abs(r.length-1000)<.001);assert.ok(Math.abs(r.width-500)<.001);assert.ok(Math.abs(r.dot)<1e-7);assert.equal(r.draggable,false);}
  console.log('Five rectangle rotations: closed, square, exact adjacent lengths, constrained handles');
  assert.deepEqual(await run(`(()=>{const line=savedLines.at(-1),id=line.id;editGeometry(line);$('line-distance').value='1200';$('geometry-form').requestSubmit();return {id:savedLines.at(-1).id,length:savedLines.at(-1).parameters.length,count:savedLines.length};})()`),{id:5,length:1200,count:5});
  const straight=await run(`(()=>{$('geometry-type').value='line';updateGeometryForm();$('line-distance').value='1.5';$('distance-unit').value='1000';updateGeometryForm();$('line-bearing').value='45';$('geometry-form').requestSubmit();const l=savedLines.at(-1),s=Transects.segment(l.points[0],l.points[1],elevationAt);return s;})()`);
  assert.ok(Math.abs(straight.distance-1500)<.001);assert.ok(Math.abs(straight.bearing-45)<1e-7);
  const slopes=await run(`(()=>{const a={lat:10,lng:122},b=Transects.destination(a,90,1000);let n=0;const s=Transects.segment(a,b,()=>[10,110][n++]);return {s,missing:Transects.segment(a,b,()=>null)};})()`);
  assert.ok(Math.abs(slopes.s.slopePercent-10)<1e-7);assert.equal(slopes.missing.slopePercent,null);
  const snapped=await run(`(()=>{startDrawing();map.fire('click',{latlng:L.latLng(10.69583,122.60625)});$('snap-direction').checked=true;map.fire('click',{latlng:L.latLng(10.71,122.62)});const bearing=Transects.segment(draft[0],draft[1],elevationAt).bearing;stopDrawing(true);$('snap-direction').checked=false;return bearing;})()`);
  assert.ok(Math.abs(snapped-45)<1e-7);
  console.log('Rectangle edits, exact-length diagonal line, slopes, and 45° snap pass');
  const imported=await run(`(async()=>{const bytes=await(await fetch('bathymetry.tif')).arrayBuffer();const grid=await GridImport.readFile(new File([bytes],'regional-gebco.tif'));return {width:grid.width,height:grid.height,values:grid.values,transform:grid.transform};})()`);
  assert.equal(imported.width,83);assert.equal(imported.height,82);assert.deepEqual(imported.values,await run('datasets[0].values'));assert.deepEqual(imported.transform,await run('datasets[0].transform'));
  console.log('GeoTIFF upload decodes original elevations and georeferencing exactly');
  const rejected=await run(`(async()=>{const bytes=await(await fetch('downloads/utm51n/gebco_2026_iloilo_guimaras_utm51n.tif')).arrayBuffer();try{await GridImport.readFile(new File([bytes],'utm.tif'));return false;}catch(e){return e.message;}})()`);
  assert.match(rejected,/WGS 84/);
  const ascii='ncols 2\nnrows 2\nxllcorner 122\nyllcorner 10\ncellsize 0.01\nNODATA_value -9999\n-100 -90\n-9999 10';
  assert.deepEqual(await run(`GridImport.parseASCII(${JSON.stringify(ascii)}).values`),[[-100,-90],[null,10]]);
  await run(`(async()=>{const transfer=new DataTransfer();const tif=await(await fetch('bathymetry.tif')).arrayBuffer();transfer.items.add(new File([tif],'uploaded.tif'));transfer.items.add(new File([${JSON.stringify(ascii)}],'regional.asc'));$('terrain-files').files=transfer.files;await $('terrain-files').onchange({target:$('terrain-files')});})()`);
  assert.deepEqual(await run("({count:datasets.length,active:data.label,contoursDisabled:$('contours').disabled,coast:coastLayer!==null,oldLayer:!!contourLayer})"),{count:3,active:'regional.asc',contoursDisabled:true,coast:false,oldLayer:false});
  const bad=await run(`(async()=>{const original=data;const transfer=new DataTransfer();transfer.items.add(new File(['{"width":2}'],'bad.json'));transfer.items.add(new File(['test'],'test.nc'));$('terrain-files').files=transfer.files;await $('terrain-files').onchange({target:$('terrain-files')});return {same:data===original,message:$('upload-message').textContent};})()`);
  assert.equal(bad.same,true);assert.match(bad.message,/GeoTIFF instead/);
  await run('activateDataset(0);showPanel("lines");');
  assert.equal(await run("$('contours').disabled"),false);
  const exported=await run(`(async()=>{let blob;const oldURL=URL.createObjectURL,oldClick=HTMLAnchorElement.prototype.click;URL.createObjectURL=b=>{blob=b;return 'blob:test'};HTMLAnchorElement.prototype.click=function(){};try{$('export-lines').click();return JSON.parse(await blob.text());}finally{URL.createObjectURL=oldURL;HTMLAnchorElement.prototype.click=oldClick;}})()`);
  assert.equal(exported.features[0].properties.shape,'rectangle');assert.equal(exported.features[0].properties.segments.length,4);assert.equal(exported.features[0].geometry.type,'LineString');
  await send('Page.reload',{ignoreCache:true}); await waitFor("typeof data!=='undefined' && !!data && $('loading').hidden");
  assert.equal(await run('savedLines.filter(l=>l.shape==="rectangle").length'),5);assert.equal(await run('savedPins.length'),2);
  console.log('Batch file input, ASCII, invalid-file recovery, UTM rejection, switching, export, and persistence pass');
  await run('showPanel("lines");fit();');
  await screenshot('/private/tmp/bathymetric-improved-desktop.png');
  assert.equal(await run('document.body.scrollWidth<=innerWidth'),true);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await run('map.invalidateSize({pan:false});fit()');
  await new Promise(r=>setTimeout(r,300));
  assert.equal(await run('document.body.scrollWidth<=innerWidth'),true);
  await screenshot('/private/tmp/bathymetric-improved-mobile.png');
  assert.equal(exceptions.length,0,JSON.stringify(exceptions));
  console.log('Desktop/mobile layout pass; no browser exceptions.');
} finally {ws.close();}
