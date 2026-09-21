import { cpSync, copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root=process.cwd();
const run=spawnSync(process.platform==='win32'?'npx.cmd':'npx',['next','build'],{
  cwd:root,
  stdio:'inherit',
  env:{...process.env,NEXT_PUBLIC_BASE_PATH:''}
});
if(run.status!==0)process.exit(run.status??1);

const out=resolve(root,'out');
const mobile=resolve(root,'mobile-dist');
const duo=resolve(out,'duo','index.html');
if(!existsSync(duo))throw new Error('Expected out/duo/index.html after Next.js export.');

rmSync(mobile,{recursive:true,force:true});
mkdirSync(mobile,{recursive:true});
cpSync(out,mobile,{recursive:true});
copyFileSync(duo,resolve(mobile,'index.html'));

console.log('Prepared mobile-dist with Reforge Duo as the native start screen.');
