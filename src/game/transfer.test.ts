import { describe, expect, test } from 'vitest';
import { finishRound, newProfile } from './progress';
import { KEYS, readAutosave, readProfile, readSlot, saveRound, writeAutosave, writeProfile, writeSlot, type Store } from './save';
import { step } from './sim';
import { makeCode, restoreCode } from './transfer';
import { createLevel1 } from './world';

const memoryStore = (): Store & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => (data.set(k, v), true), remove: (k) => void data.delete(k) };
};

// A player with some history: 30 rounds played, a round left unfinished and a saved slot.
function playedStore() {
  const store = memoryStore();
  let p = { ...newProfile(), name: 'The Violet Bloom' };
  for (let k = 0; k < 30; k++) p = finishRound(p, { won: k % 2 === 0, held: 0.5, kills: 12, time: 200 + k }).profile;
  writeProfile(store, p);
  const g = createLevel1(3);
  for (let k = 0; k < 300; k++) step(g, 0.1);
  writeAutosave(store, g);
  writeSlot(store, 2, { name: 'Halfway', savedAt: 1, held: 0.2, time: g.time, picture: 'data:image/png;base64,AAAA', round: saveRound(g) });
  return store;
}

describe('progress codes', () => {
  test('a code carries the profile, the unfinished round and the slots to another store', async () => {
    const from = playedStore();
    const code = await makeCode(from);
    expect(code.startsWith('MYC1.')).toBe(true);
    expect(code).toMatch(/^[A-Za-z0-9._-]+$/); // one line, safe to paste anywhere

    const to = memoryStore();
    expect(await restoreCode(to, code)).toBeNull();
    expect(readProfile(to)).toEqual(readProfile(from));
    expect(readAutosave(to)).toEqual(readAutosave(from));
    expect(readSlot(to, 2)?.name).toBe('Halfway');
    expect(readSlot(to, 2)?.picture).toBe(''); // pictures stay behind, to keep the code short
    expect(to.get(KEYS.slot(1))).toBeNull();
    // Much shorter than the backup file.
    console.log(`code: ${code.length} characters`);
  });

  test('spaces and line breaks from pasting are ignored', async () => {
    const code = await makeCode(playedStore());
    const messy = ` ${code.slice(0, 40)}\n${code.slice(40, 90)} \n${code.slice(90)}\n`;
    expect(await restoreCode(memoryStore(), messy)).toBeNull();
  });

  test('anything else is refused and nothing is replaced', async () => {
    const to = playedStore();
    const before = new Map(to.data);
    expect(await restoreCode(to, 'hello')).toMatch(/not a Mycelium progress code/);
    const code = await makeCode(playedStore());
    expect(await restoreCode(to, code.slice(0, code.length / 2))).toMatch(/broken or cut short/);
    expect(to.data).toEqual(before);
  });
});
