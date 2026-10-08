import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.mp3':'audio/mpeg'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}const content=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':content.length,'Cache-Control':'no-store'});res.end(content);}catch{res.writeHead(404);res.end('Not found');}});
server.on('error',e=>{console.error(`Could not start the server: ${e.message}`);process.exitCode=1;});
server.listen(8080,'0.0.0.0',()=>console.log('JFT-Basic Mock Test 01: http://localhost:8080\nKeep this window open. Press Ctrl+C to stop.'));
