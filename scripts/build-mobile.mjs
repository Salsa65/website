import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
const root=process.cwd(),source=resolve(root,'public'),mobile=resolve(root,'mobile-dist');
if(!existsSync(resolve(source,'index.html'))) throw new Error('Expected public/index.html for Aetherfall.');
rmSync(mobile,{recursive:true,force:true});mkdirSync(mobile,{recursive:true});cpSync(source,mobile,{recursive:true});
console.log('Prepared Aetherfall mobile bundle.');
