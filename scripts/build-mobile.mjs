import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const source = resolve(root, 'public');
const mobile = resolve(root, 'mobile-dist');

if (!existsSync(resolve(source, 'index.html'))) {
  throw new Error('Expected public/index.html for Hazel Novel Studio.');
}

rmSync(mobile, { recursive: true, force: true });
mkdirSync(mobile, { recursive: true });
cpSync(source, mobile, { recursive: true });

console.log('Prepared mobile-dist with Hazel Novel Studio as the native start screen.');
