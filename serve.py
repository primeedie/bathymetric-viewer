#!/usr/bin/env python3
"""Run the static bathymetry workbench locally using Python 3."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=8082)
    parser.add_argument('--host',default='127.0.0.1')
    args=parser.parse_args()
    directory=Path(__file__).resolve().parent/'site'
    handler=partial(SimpleHTTPRequestHandler,directory=str(directory))
    with ThreadingHTTPServer((args.host,args.port),handler) as server:
        print(f'Bathymetry Workbench: http://{args.host}:{args.port}',flush=True)
        try:server.serve_forever()
        except KeyboardInterrupt:pass

if __name__=='__main__':main()
