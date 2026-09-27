import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

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
for (const volume of manifest.volumes) {
  const release = JSON.parse(await run(['release', 'view', volume.releaseTag, '--repo', repo, '--json', 'isDraft,assets,tagName']));
  const assets = new Map(release.assets.map((asset) => [asset.name, asset.size]));
  if (assets.size !== volume.assets.length) throw new Error(`Release asset count differs: ${volume.releaseTag}`);
  for (const asset of volume.assets) {
    const name = `${asset.sha256}.mp3`;
    if (assets.get(name) !== asset.bytes) throw new Error(`Release asset differs: ${volume.releaseTag}/${name}`);
  }
  if (release.isDraft) {
    await run(['release', 'edit', volume.releaseTag, '--repo', repo, '--draft=false', '--latest=false']);
    console.log(`Published ${volume.releaseTag}.`);
  } else console.log(`Verified ${volume.releaseTag}.`);
}
