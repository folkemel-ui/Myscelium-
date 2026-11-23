import { useRef, useState } from 'react';
import {
  BRANCHES, branchPoints, canBuy, forestOpen, LEVELS, rank, UPGRADES, xpToNext, type Profile, type UpgradeId,
} from '../game/progress';
import type { SavedRound, SlotSave } from '../game/save';
import { SlotCard } from './SaveDialog';
import { formatTime } from './SpreadChart';

interface MenuProps {
  profile: Profile;
  onPlay: (level: number) => void;
  onBuy: (id: UpgradeId) => void;
  autosave: SavedRound | null; // a round left unfinished, to continue
  onContinue: () => void;
  slots: (SlotSave | null)[];
  onLoadSlot: (n: number) => void;
  onDeleteSlot: (n: number) => void;
  onBackup: () => void;
  onRestore: (text: string) => string | null; // a reason if the file was not a backup
  onOpenProfile: () => void;
}

// The main menu: the player's profile, the forests to play, saved rounds, and upgrades.
export function MainMenu(p: MenuProps) {
  const { profile } = p;
  const need = xpToNext(profile.level);
  const unfinished = p.autosave;
  const held = unfinished?.history.length ? unfinished.history[unfinished.history.length - 1].held : 0;
  return (
    <div className="overlay menu">
      <div className="menu-card">
        <header className="menu-head">
          <h1>Mycelium</h1>
          <p>Spread through the forest. Bring it to life.</p>
        </header>

        <div className="menu-grid">
          <section className="profile" aria-label="Your profile">
            <div className="profile-top">
              <div className="level-badge"><small>Level</small>{profile.level}</div>
              <div className="who">
                <strong>{profile.name || 'Your fungus'}</strong>
                <button className="secondary" onClick={p.onOpenProfile}>View profile</button>
              </div>
            </div>
            <div className="xp">
              <div className="xp-text"><span>{profile.xp} / {need} XP</span><span>to level {profile.level + 1}</span></div>
              <div className="bar"><div style={{ width: `${(profile.xp / need) * 100}%` }} /></div>
            </div>
            <dl className="tallies">
              <div><dt>Rounds</dt><dd>{profile.rounds}</dd></div>
              <div><dt>Wins</dt><dd>{profile.wins}</dd></div>
              <div><dt>Forests won</dt><dd>{profile.forestsWon.length} of {LEVELS.filter((l) => l.playable).length}</dd></div>
            </dl>
            <Backup onBackup={p.onBackup} onRestore={p.onRestore} />
          </section>

          <section className="levels" aria-label="Forests">
            <h2>Forests</h2>
            {unfinished && (
              <div className="level-row continue">
                <div>
                  <strong>Continue your round</strong>
                  <small>{LEVELS.find((l) => l.id === unfinished.level)?.name ?? 'The Little Wood'} · {formatTime(unfinished.time)} · {Math.round(held * 100)}% held</small>
                </div>
                <button className="play" onClick={p.onContinue}>Continue</button>
              </div>
            )}
            {LEVELS.map((l) => {
              const open = forestOpen(profile, l);
              const best = profile.bestTimes[l.id];
              return (
                <div key={l.id} className={`level-row${open ? '' : ' locked'}`}>
                  <div>
                    <strong>{l.id}. {l.name}</strong>
                    <small>
                      {!l.playable ? 'Coming later' : open ? l.about : l.opens}
                      {open && best !== undefined && <> · best {formatTime(best)}</>}
                    </small>
                  </div>
                  {open
                    ? <button className={unfinished ? '' : 'play'} onClick={() => p.onPlay(l.id)}>{unfinished ? 'New round' : 'Play'}</button>
                    : <span className="lock">Locked</span>}
                </div>
              );
            })}
          </section>

          <section className="saves" aria-label="Saved rounds">
            <h2>Saved rounds</h2>
            {p.slots.map((save, k) => <SavedSlot key={k} n={k + 1} save={save} onLoad={p.onLoadSlot} onDelete={p.onDeleteSlot} />)}
            <small className="saves-note">Save during a round with S or the save button.</small>
          </section>
        </div>

        <section className="upgrades" aria-label="Upgrades">
          <h2>
            Upgrades
            <span className={profile.points ? 'points has' : 'points'}>
              {profile.points === 1 ? '1 point to spend' : `${profile.points} points to spend`}
            </span>
          </h2>
          <div className="tree">
            {BRANCHES.map((br) => (
              <div key={br.id} className={`branch ${br.id}`}>
                <div className="branch-head">
                  <strong>{br.name}</strong>
                  <small>{br.about} · {branchPoints(profile, br.id) === 1 ? '1 point' : `${branchPoints(profile, br.id)} points`}</small>
                </div>
                {[1, 2, 3].map((tier) => (
                  <div key={tier} className={`tier tier${tier}`}>
                    {UPGRADES.filter((u) => u.branch === br.id && u.tier === tier).map((u) => (
                      <UpgradeCard key={u.id} id={u.id} profile={profile} onBuy={p.onBuy} />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
        <p className="menu-foot">Points come from levelling up. Upgrades last for every round. Press Enter to play.</p>
      </div>
    </div>
  );
}

// One upgrade in the tree: its ranks, what the next one does, and why it can't be bought yet.
function UpgradeCard({ id, profile, onBuy }: { id: UpgradeId; profile: Profile; onBuy: (id: UpgradeId) => void }) {
  const u = UPGRADES.find((x) => x.id === id)!;
  const r = rank(profile, id);
  const maxed = r >= u.max;
  const buy = canBuy(profile, id);
  const locked = !maxed && !buy.ok && buy.why !== 'No points to spend';
  return (
    <div className={`upgrade${maxed ? ' maxed' : ''}${locked ? ' locked' : ''}${u.tier === 3 ? ' capstone' : ''}`}>
      <div className="upgrade-top">
        <strong>{u.name}</strong>
        <span className="pips" aria-label={`Rank ${r} of ${u.max}`}>
          {Array.from({ length: u.max }, (_, k) => <i key={k} className={k < r ? 'on' : ''} />)}
        </span>
      </div>
      <small>{maxed ? 'Fully grown' : u.about(r)}</small>
      <button disabled={!buy.ok} onClick={() => onBuy(id)}>
        {maxed ? 'Max' : locked ? buy.why : 'Upgrade · 1 point'}
      </button>
    </div>
  );
}

// A saved round in the menu: load it, or delete it (asking first).
function SavedSlot({ n, save, onLoad, onDelete }: {
  n: number;
  save: SlotSave | null;
  onLoad: (n: number) => void;
  onDelete: (n: number) => void;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <SlotCard n={n} save={save}>
      {save && !asking && (
        <>
          <button onClick={() => onLoad(n)}>Load</button>
          <button className="secondary" onClick={() => setAsking(true)} aria-label={`Delete ${save.name}`}>Delete</button>
        </>
      )}
      {save && asking && (
        <>
          <button className="warn" onClick={() => { setAsking(false); onDelete(n); }}>Yes, delete</button>
          <button className="secondary" onClick={() => setAsking(false)}>Keep</button>
        </>
      )}
    </SlotCard>
  );
}

// Back everything up to a file, or load a backup (asking before it replaces anything).
function Backup({ onBackup, onRestore }: { onBackup: () => void; onRestore: (text: string) => string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ name: string; text: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const choose = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setPending({ name: file.name, text: await file.text() });
    if (input.current) input.current.value = '';
  };
  return (
    <div className="backup">
      {!pending ? (
        <div className="backup-buttons">
          <button onClick={onBackup}>Back up to a file</button>
          <button onClick={() => input.current?.click()}>Load a backup</button>
        </div>
      ) : (
        <div className="backup-confirm">
          <small>Replace your progress and saves with “{pending.name}”?</small>
          <div className="backup-buttons">
            <button className="warn" onClick={() => { setProblem(onRestore(pending.text)); setPending(null); }}>Replace</button>
            <button className="secondary" onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      )}
      {problem && <small className="problem">{problem}</small>}
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => choose(e.target.files?.[0])} />
    </div>
  );
}
