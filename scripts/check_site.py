"""Check deployed asset references, GEBCO data, and downloadable files."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
from zipfile import ZipFile
import json

root=Path(__file__).resolve().parents[1]
site=root/'site'
class References(HTMLParser):
    def __init__(self):
        super().__init__();self.refs=[];self.ids=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        for key in ['href','src']:
            if attrs.get(key):self.refs.append(attrs[key])
        if attrs.get('id'):self.ids.append(attrs['id'])
parser=References();parser.feed((site/'index.html').read_text())
assert len(set(parser.ids))==len(parser.ids),'Duplicate HTML element IDs'
for ref in parser.refs:
    parts=urlsplit(ref)
    if parts.scheme or parts.netloc or not parts.path:continue
    assert not parts.path.startswith('/'),f'Asset must support a GitHub Pages project subpath: {ref}'
    target=(site/unquote(parts.path)).resolve()
    assert site.resolve() in target.parents and target.is_file(),f'Missing asset: {ref}'
data=json.loads((site/'data.json').read_text())
assert len(data['values'])==data['height']
assert all(len(row)==data['width'] for row in data['values'])
assert (site/data['source']).is_file()
for name in ['contours','coastline']:
    geo=json.loads((site/(name+'.geojson')).read_text())
    assert geo['type']=='FeatureCollection' and len(geo['features'])>0
    assert all(f['geometry']['type'] in ['LineString','MultiLineString'] for f in geo['features'])
download=site/'downloads'/'utm51n'
base='gebco_2026_iloilo_guimaras_utm51n'
assert (download/(base+'.nc')).read_bytes()[:3]==b'CDF'
assert (download/(base+'.tif')).read_bytes()[:4] in [b'II*\x00',b'MM\x00*']
summary=json.loads((download/'conversion-details.json').read_text())
assert summary['epsg']==32651 and summary['cell_size_m']==460
with ZipFile(site/'downloads'/'gebco_2026_utm51n_delftdashboard.zip') as archive:
    assert archive.testzip() is None
for directory in [site,root/'tools']:
    for p in directory.rglob('*'):
        if p.is_file() and p.suffix in ['.py','.json','.js','.html','.txt']:
            assert '/Users/' not in p.read_text(),f'Personal filesystem path in publication: {p}'
print(f'Site validated: {len(parser.refs)} references; {data["width"]} x {data["height"]} terrain; UTM downloads and ZIP valid.')
