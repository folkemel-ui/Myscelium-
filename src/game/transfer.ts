// A progress code: everything in a backup (profile, unfinished round, saved rounds), squeezed into
// one line of text that can be copied in one place and pasted in another. On an iPhone the
// Home Screen app keeps its own storage, apart from Safari, so this is how progress moves over.
//
// The code is "MYC1." and then the backup's JSON, compressed (deflate) and written in base64url.
// Slot pictures are left out to keep it short; a slot without a picture shows a blank square.
import { makeBackup, restoreBackup, type Store } from './save';

const PREFIX = 'MYC1.';

const toBase64Url = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string) => {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function squeeze(bytes: Uint8Array, how: 'compress' | 'decompress') {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(
    how === 'compress' ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw'),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function makeCode(store: Store): Promise<string> {
  const backup = makeBackup(store);
  backup.slots = backup.slots.map((s) => (s ? { ...s, picture: '' } : s));
  const json = new TextEncoder().encode(JSON.stringify(backup));
  return PREFIX + toBase64Url(await squeeze(json, 'compress'));
}

// Put the progress in a code in place of what's stored now. Returns a reason if it isn't one.
export async function restoreCode(store: Store, code: string): Promise<string | null> {
  const text = code.replace(/\s+/g, '');
  if (!text.startsWith(PREFIX)) return 'That is not a Mycelium progress code';
  let json: string;
  try {
    json = new TextDecoder().decode(await squeeze(fromBase64Url(text.slice(PREFIX.length)), 'decompress'));
  } catch {
    return 'That code is broken or cut short: copy all of it and try again';
  }
  return restoreBackup(store, json);
}

// Can this browser make and read codes? (iPhone Safari 16.4 and later can.)
export const codesWork = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
