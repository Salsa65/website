import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
if (existsSync('reforge-source.tgz.b64')) {
  const raw=readFileSync('reforge-source.tgz.b64','utf8').trim();
  writeFileSync('.reforge-source.tgz',Buffer.from(raw,'base64'));
  execFileSync('tar',['-xzf','.reforge-source.tgz','--overwrite'],{stdio:'inherit'});
}