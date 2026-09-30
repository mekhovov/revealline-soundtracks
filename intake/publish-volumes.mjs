import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promoteAudioVolume } from './audio-volume.mjs';
import { publicVolumeTags } from '../licensing-policy.mjs';
import { transferredVolumeTags } from '../source-transfer.mjs';

export async function publishVolumes(catalogue, manifest, { repo, run, report = () => {} }) {
  if (manifest.format !== 'revealline-soundtrack-audio-volumes.v1' || !Array.isArray(manifest.volumes))
    throw new Error('Audio volume manifest is invalid.');
  const eligible = publicVolumeTags(catalogue, manifest);
  const historical = await transferredVolumeTags();
  for (const volume of manifest.volumes) {
    if (historical.has(volume.releaseTag)) {
      report(`Preserved historical ${volume.releaseTag}; transferred assets are never republished or removed.`);
      continue;
    }
    if (!eligible.has(volume.releaseTag)) {
      report(`Preserved ${volume.releaseTag} without promotion; it contains quarantined recordings.`);
      continue;
    }
    const action = await promoteAudioVolume(volume, { repo, run });
    report(`${action[0].toUpperCase()}${action.slice(1)} ${volume.releaseTag}.`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
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
  const catalogue = JSON.parse(await readFile(new URL('../catalogue.json', import.meta.url), 'utf8'));
  await publishVolumes(catalogue, manifest, { repo, run, report: console.log });
}
