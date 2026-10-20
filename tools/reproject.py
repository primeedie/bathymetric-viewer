"""Reproject the supplied GEBCO elevation grid to WGS 84 / UTM zone 51N."""
import os

import json
import argparse
from pathlib import Path
import numpy as np
from osgeo import gdal, osr

gdal.UseExceptions()
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('source',type=Path,help='Source GEBCO NetCDF')
parser.add_argument('--output-dir',type=Path,default=Path('site/downloads/utm51n'))
args=parser.parse_args()
root=args.output_dir.resolve();root.mkdir(parents=True,exist_ok=True)
source=args.source.resolve()
base='gebco_2026_iloilo_guimaras_utm51n'
src=gdal.Open(str(source))
nodata=-32767.0
grid=gdal.Warp('',src,format='MEM',dstSRS='EPSG:32651',xRes=460,yRes=460,
              targetAlignedPixels=True,resampleAlg='bilinear',outputType=gdal.GDT_Float32,
              srcNodata=nodata,dstNodata=nodata,multithread=False)
assert grid is not None
grid.SetMetadata({
    'NC_GLOBAL#Conventions':'CF-1.5',
    'NC_GLOBAL#title':'GEBCO 2026 Iloilo-Guimaras elevation, WGS 84 / UTM zone 51N',
    'NC_GLOBAL#source':'GEBCO 2026 / Nippon Foundation-GEBCO Seabed 2030 Project',
    'NC_GLOBAL#references':'https://doi.org/10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa',
    'NC_GLOBAL#history':'Reprojected from EPSG:4326 to EPSG:32651 using GDAL bilinear resampling at 460 m spacing. Elevation sign and vertical reference retained; no vertical datum transformation.',
    'NC_GLOBAL#comment':'Elevation in metres relative to sea level, positive up. Land positive; seabed negative. Not for navigation or safety at sea.',
})
band=grid.GetRasterBand(1)
band.SetDescription('elevation')
band.SetMetadata({'NETCDF_VARNAME':'elevation','long_name':'Elevation relative to sea level','standard_name':'height_above_mean_sea_level','units':'m','positive':'up'})
band.SetUnitType('m');band.SetNoDataValue(nodata)
nc=gdal.Translate(str(root/(base+'.nc')),grid,format='netCDF',creationOptions=['FORMAT=NC','WRITE_GDAL_TAGS=YES','WRITE_LONLAT=NO'])
nc=None
tif=gdal.Translate(str(root/(base+'.tif')),grid,format='GTiff',creationOptions=['COMPRESS=DEFLATE','PREDICTOR=3'])
tif=None
values=band.ReadAsArray();gt=grid.GetGeoTransform();valid=values!=nodata
# A headerless x/y/z fallback for Delft Dashboard versions with older NetCDF importers.
with (root/(base+'.xyz')).open('w') as f:
    for y in range(grid.RasterYSize):
        for x in range(grid.RasterXSize):
            if valid[y,x]:
                f.write(f'{gt[0]+(x+.5)*gt[1]:.3f} {gt[3]+(y+.5)*gt[5]:.3f} {values[y,x]:.4f}\n')
summary={'input':source.name,'crs':'WGS 84 / UTM zone 51N','epsg':32651,'horizontal_units':'metre','vertical_units':'metre','vertical_positive':'up','cell_size_m':460,'resampling':'bilinear','width':grid.RasterXSize,'height':grid.RasterYSize,'valid_cells':int(valid.sum()),'nodata_cells':int((~valid).sum()),'nodata':nodata,'geotransform':gt,'elevation_min_m':float(values[valid].min()),'elevation_max_m':float(values[valid].max())}
# Re-open both outputs and verify projection, orientation, dimensions, nodata and values.
for ext in ['nc','tif']:
    check=gdal.Open(str(root/(base+'.'+ext)))
    srs=osr.SpatialReference(wkt=check.GetProjection());srs.AutoIdentifyEPSG()
    assert srs.GetAuthorityCode('PROJCS')=='32651',check.GetProjection()
    assert (check.RasterXSize,check.RasterYSize)==(grid.RasterXSize,grid.RasterYSize)
    assert np.allclose(check.GetGeoTransform(),gt,atol=1e-8)
    assert check.GetRasterBand(1).GetNoDataValue()==nodata
    assert np.allclose(check.GetRasterBand(1).ReadAsArray(),values,atol=1e-5)
    assert check.GetRasterBand(1).GetUnitType()=='m'
    check=None
(root/'conversion-details.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
print('Validated NetCDF and GeoTIFF: EPSG:32651, north-up, matching geotransform and elevation values.')
