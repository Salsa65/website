import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const partsDir = 'source-parts';
if (existsSync(partsDir)) {
  const parts = readdirSync(partsDir).filter((name) => name.endsWith('.b64')).sort();
  if (parts.length !== 8) throw new Error(`Expected 8 source parts, found ${parts.length}`);
  const encoded = parts.map((name) => readFileSync(`${partsDir}/${name}`, 'utf8').trim()).join('');
  const archive = Buffer.from(encoded, 'base64');
  const digest = createHash('sha256').update(archive).digest('hex');
  const expected = '4cba83c85267ed4272f578ccb5d493870c8ca71101b9f641ece608a3a65072a8';
  if (digest !== expected) throw new Error(`Reforge source hash mismatch: ${digest}`);
  const archivePath = '.reforge-source.zip';
  writeFileSync(archivePath, archive);
  execFileSync('unzip', ['-o', archivePath], { stdio: 'inherit' });
  rmSync(archivePath, { force: true });
}