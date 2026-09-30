import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const INVENTORY = new URL('./migrations/fpv-20261001/inventory.json', import.meta.url);
const EXPECTED_HASH = '17baa2f9138b1a5d761dc24ff2be7c813eda78705906129d3bde6c36565bc7c9';

// Source-only historical receipt, not a feed or a new permission grant. Pinning
// the bytes prevents unrelated omissions from masquerading as this transfer.
export async function transferredRecordings() {
  const bytes = await readFile(INVENTORY);
  if (createHash('sha256').update(bytes).digest('hex') !== EXPECTED_HASH)
    throw new Error('FPV source-transfer receipt differs.');
  const inventory = JSON.parse(bytes);
  return inventory.records;
}

export async function transferredVolumeTags() {
  return new Set((await transferredRecordings()).map((entry) => entry.sourceVolume));
}

export async function assertNoTransferredRecordings(catalogue, volumes) {
  const rows = await transferredRecordings();
  const ids = new Set(rows.map((entry) => entry.id));
  const hashes = new Set(rows.map((entry) => entry.sha256));
  if (catalogue.tracks.some((entry) => ids.has(entry.id) || hashes.has(entry.audio?.sha256)) ||
      volumes.volumes.some((volume) => volume.assets.some((entry) => hashes.has(entry.sha256))))
    throw new Error('A transferred FPV recording re-entered the main archive.');
}
