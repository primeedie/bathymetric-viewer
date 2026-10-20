function parseCoordinate(input,axis){
 const text=input.trim().toUpperCase();if(!text)throw Error(`Enter ${axis}.`);
 const suffix=text.match(/[NSEW]$/)?.[0];if(/[NSEW]/.test(text.replace(/[NSEW]$/,'')))throw Error('Place N, S, E, or W at the end of a coordinate.');
 if(suffix&&!((axis==='latitude'?'NS':'EW').includes(suffix)))throw Error(`${axis} uses ${axis==='latitude'?'N or S':'E or W'}.`);
 const body=text.replace(/[NSEW]$/,'').trim();if(/[^\d+\-\.\s°º'′"″:]/.test(body))throw Error('Use decimal degrees or degrees/minutes/seconds.');
 const parts=body.split(/[\s°º'′"″:]+/).filter(Boolean);if(parts.length<1||parts.length>3||!parts.every(p=>/^[+-]?\d+(?:\.\d*)?$/.test(p)))throw Error('Invalid coordinate format.');
 const nums=parts.map(Number);if(nums.slice(1).some(n=>n<0||n>=60))throw Error('Minutes and seconds must be between 0 and 60.');
 if(parts.length>1&&!Number.isInteger(nums[0]))throw Error('Use whole degrees when entering minutes.');if(parts.length>2&&!Number.isInteger(nums[1]))throw Error('Use whole minutes when entering seconds.');
 let sign=body.startsWith('-')?-1:1;if(suffix){const direction='SW'.includes(suffix)?-1:1;if(sign<0&&direction>0)throw Error('The negative sign conflicts with the direction.');sign=direction;}
 const n=sign*(Math.abs(nums[0])+(nums[1]||0)/60+(nums[2]||0)/3600),limit=axis==='latitude'?90:180;if(!Number.isFinite(n)||Math.abs(n)>limit)throw Error(`${axis} must be between −${limit} and ${limit}.`);return n;
}
function formatDMS(value,axis){let total=Math.round(Math.abs(value)*360000)/100;const d=Math.floor(total/3600);total-=d*3600;const m=Math.floor(total/60),s=total-m*60;return `${d}°${String(m).padStart(2,'0')}′${s.toFixed(2).padStart(5,'0')}″${axis==='latitude'?(value<0?'S':'N'):(value<0?'W':'E')}`;}
function toUTM(lat,lon){
 if(lat< -80||lat>84)return null;
 let zone=Math.min(60,Math.floor((lon+180)/6)+1);if(lat>=56&&lat<64&&lon>=3&&lon<12)zone=32;if(lat>=72&&lat<84&&lon>=0&&lon<42)zone=lon<9?31:lon<21?33:lon<33?35:37;
 const rad=Math.PI/180,a=6378137,e2=0.0066943799901413165,ep=e2/(1-e2),k=.9996,phi=lat*rad,lam=lon*rad,central=((zone-1)*6-177)*rad;
 const N=a/Math.sqrt(1-e2*Math.sin(phi)**2),T=Math.tan(phi)**2,C=ep*Math.cos(phi)**2,A=Math.cos(phi)*(lam-central);
 const M=a*((1-e2/4-3*e2**2/64-5*e2**3/256)*phi-(3*e2/8+3*e2**2/32+45*e2**3/1024)*Math.sin(2*phi)+(15*e2**2/256+45*e2**3/1024)*Math.sin(4*phi)-35*e2**3/3072*Math.sin(6*phi));
 const easting=k*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep)*A**5/120)+500000;
 const northing=k*(M+N*Math.tan(phi)*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep)*A**6/720))+(lat<0?10000000:0);
 return{zone,hemisphere:lat<0?'S':'N',easting,northing,epsg:(lat<0?32700:32600)+zone};
}
if(typeof module!=='undefined')module.exports={parseCoordinate,formatDMS,toUTM};
