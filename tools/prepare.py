import json, pathlib, shutil, os

import argparse
import numpy as np
from osgeo import gdal, ogr, osr

parser=argparse.ArgumentParser(description='Prepare GEBCO grid and contours for the web viewer.')
parser.add_argument('source',type=pathlib.Path)
parser.add_argument('--output-dir',type=pathlib.Path,default=pathlib.Path('site'))
args=parser.parse_args()
root=args.output_dir.resolve();root.mkdir(parents=True,exist_ok=True)
source=args.source.resolve()
ds=gdal.Open(str(source)); band=ds.GetRasterBand(1); a=band.ReadAsArray(); nodata=band.GetNoDataValue(); valid=a!=nodata; gt=ds.GetGeoTransform()
data={'width':ds.RasterXSize,'height':ds.RasterYSize,'transform':list(gt),'nodata':nodata,'values':[[int(v) if v!=nodata else None for v in row] for row in a], 'min':int(a[valid].min()),'max':int(a[valid].max()),'waterCells':int(((a<0)&valid).sum()),'validCells':int(valid.sum()),'source':source.name,'crs':'EPSG:4326','resolutionArcSeconds':15}
(root/'data.json').write_text(json.dumps(data,separators=(',',':')))
srs=osr.SpatialReference();srs.ImportFromEPSG(4326)
for name,interval,levels in [('contours',10,[]),('coastline',0,[0])]:
    target=root/(name+'.geojson')
    if target.exists(): target.unlink()
    out=ogr.GetDriverByName('GeoJSON').CreateDataSource(str(target));layer=out.CreateLayer(name,srs,ogr.wkbLineString);layer.CreateField(ogr.FieldDefn('id',ogr.OFTInteger));layer.CreateField(ogr.FieldDefn('elevation',ogr.OFTReal))
    result=gdal.ContourGenerate(band,interval,0,levels,1,nodata,layer,0,1)
    assert result==0
    out=None
    check=ogr.Open(str(target));count=check.GetLayer(0).GetFeatureCount();check=None
    print(name,count)
gdal.Translate(str(root/'bathymetry.tif'),ds,format='GTiff',creationOptions=['COMPRESS=DEFLATE'])
if source != root/source.name:
    shutil.copy2(source,root/source.name)
print(json.dumps({k:v for k,v in data.items() if k!='values'},indent=2))
