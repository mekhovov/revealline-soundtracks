import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { promoteAudioVolume } from './audio-volume.mjs';

const repo = process.env.GITHUB_REPOSITORY || 'mekhovov/revealline-soundtracks';
const token = process.env.GH_TOKEN;
if (!token) throw new Error('GH_TOKEN is required.');
const run = (args) => new Promise((resolve, reject) => {
  const child = spawn('gh', args, { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', error = '';
  child.stdout.on('data', (chunk) => output += chunk);
  child.stderr.on('data', (chunk) => error += chunk);
  child.on('error', reject);
  child.on('exit', (code) => code === 0 ? resolve(output) : reject(new Error(`gh exited with ${code}: ${error.trim()}`)));
});
const manifest = JSON.parse(await readFile(new URL('../audio-volumes.json', import.meta.url), 'utf8'));
if (manifest.format !== 'revealline-soundtrack-audio-volumes.v1' || !Array.isArray(manifest.volumes)) {
  throw new Error('Audio volume manifest is invalid.');
}
for (const volume of manifest.volumes) {
  const action = await promoteAudioVolume(volume, { repo, run });
  console.log(`${action[0].toUpperCase()}${action.slice(1)} ${volume.releaseTag}.`);
}
