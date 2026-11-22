import { useState } from 'react';
import { coverage } from '../game/sim';
import type { SlotSave } from '../game/save';
import type { Game } from '../game/world';
import { formatTime } from './SpreadChart';

export const savedWhen = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// One save slot as a small card: its picture, name and numbers, or "Empty".
export function SlotCard({ n, save, children }: { n: number; save: SlotSave | null; children: React.ReactNode }) {
  return (
    <div className={`slot${save ? '' : ' empty'}`}>
      {save?.picture ? <img src={save.picture} alt="" /> : <div className="slot-blank">{n}</div>}
      <div className="slot-text">
        <strong>{save ? save.name : `Slot ${n}`}</strong>
        <small>
          {save ? `${Math.round(save.held * 100)}% held · ${formatTime(save.time)} · ${savedWhen(save.savedAt)}` : 'Empty'}
        </small>
      </div>
      <div className="slot-buttons">{children}</div>
    </div>
  );
}

// Saving the round in progress to one of the slots, with a name. A slot in use asks before
// it is written over.
export function SaveDialog({ slots, game, onSave, onClose }: {
  slots: (SlotSave | null)[];
  game: Game;
  onSave: (slot: number, name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(`The Little Wood · ${Math.round(coverage(game) * 100)}%`);
  const [confirm, setConfirm] = useState<number | null>(null);
  const label = name.trim() || 'My round';
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card save-dialog" onClick={(e) => e.stopPropagation()}>
        <h1>Save the round</h1>
        <label className="name-field">
          <span>Name</span>
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} autoFocus />
        </label>
        {slots.map((save, k) => {
          const n = k + 1;
          const asking = confirm === n;
          return (
            <SlotCard key={n} n={n} save={save}>
              <button className={asking ? 'warn' : ''} onClick={() => (save && !asking ? setConfirm(n) : onSave(n, label))}>
                {!save ? 'Save here' : asking ? 'Yes, write over it' : 'Write over'}
              </button>
            </SlotCard>
          );
        })}
        <button className="secondary" onClick={onClose}>Back to the forest</button>
      </div>
    </div>
  );
}
