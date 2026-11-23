import { useState } from 'react';
import {
  ACHIEVEMENTS, cleanName, LEVELS, motherTier, NAME_MAX, SCHEMES, type Profile, type SchemeId,
} from '../game/progress';
import { formatTime } from './SpreadChart';

// A long time in plain words: "1 h 30 min", "12 min".
const duration = (seconds: number) => {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

// What the mother gains at each step (one every 2 player levels).
const MOTHER_STEPS = [
  'A bigger cap and a ring of small spots',
  'A golden rim',
  'Glowing stripes on her cap',
  'Two babies at her foot',
  'A crown of little lights',
];

// The player's profile: name and colours, the mother, records, progress, achievements.
export function ProfilePanel({ profile, onRename, onScheme, onClose }: {
  profile: Profile;
  onRename: (name: string) => void;
  onScheme: (id: SchemeId) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const tier = motherTier(profile.level);
  const nextAt = tier < 5 ? 2 * (tier + 1) + 1 : null;
  const earned = new Set(profile.achievements);
  const t = profile.totals;
  return (
    <div className="overlay menu" onClick={onClose}>
      <div className="menu-card profile-page" onClick={(e) => e.stopPropagation()}>
        <header className="profile-head">
          <div className="level-badge"><small>Level</small>{profile.level}</div>
          <div className="name-edit">
            <label>
              <span>Your fungus</span>
              <input value={name} maxLength={NAME_MAX} placeholder="Give it a name"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') onRename(cleanName(name)); }}
                onBlur={() => cleanName(name) !== profile.name && onRename(cleanName(name))} />
            </label>
          </div>
          <button className="secondary" onClick={onClose}>Back</button>
        </header>

        <div className="profile-grid">
          <section aria-label="Colours">
            <h2>Colours</h2>
            <div className="schemes">
              {SCHEMES.map((s) => {
                const open = profile.level >= s.level;
                return (
                  <button key={s.id} className={`scheme${profile.scheme === s.id ? ' on' : ''}`} disabled={!open}
                    onClick={() => onScheme(s.id)} title={open ? s.name : `Opens at level ${s.level}`}>
                    <span className="swatch">
                      <i style={{ background: hex(s.mother) }} className="mother-dot" />
                      {s.glow.map((c, k) => <i key={k} style={{ background: hex(c) }} />)}
                    </span>
                    <small>{open ? s.name : `Level ${s.level}`}</small>
                  </button>
                );
              })}
            </div>
            <h2>Your mother</h2>
            <p className="muted">
              Step {tier} of 5{nextAt ? ` · next at level ${nextAt}: ${MOTHER_STEPS[tier].toLowerCase()}` : ' · fully grown'}
            </p>
            <ul className="steps">
              {MOTHER_STEPS.map((s, k) => <li key={s} className={k < tier ? 'done' : ''}>{s}</li>)}
            </ul>
          </section>

          <section aria-label="Records">
            <h2>Records</h2>
            <dl className="records">
              {LEVELS.filter((l) => l.playable).map((l) => (
                <div key={l.id}><dt>Fastest win, {l.name}</dt><dd>{profile.bestTimes[l.id] !== undefined ? formatTime(profile.bestTimes[l.id]!) : '–'}</dd></div>
              ))}
              <div><dt>Most beetles in a round</dt><dd>{profile.records.mostKills || '–'}</dd></div>
              <div><dt>Most spores a second</dt><dd>{profile.records.mostSpores || '–'}</dd></div>
              <div><dt>Most mushrooms in a round</dt><dd>{profile.records.mostMushrooms || '–'}</dd></div>
              <div><dt>Fewest tiles by hand in a win</dt><dd>{profile.records.fewestHandWin ?? '–'}</dd></div>
            </dl>
            <h2>All together</h2>
            <dl className="records">
              <div><dt>Rounds / wins</dt><dd>{profile.rounds} / {profile.wins}</dd></div>
              <div><dt>Beetles beaten</dt><dd>{t.kills.toLocaleString()}</dd></div>
              <div><dt>Tiles grown by hand</dt><dd>{t.grown.toLocaleString()}</dd></div>
              <div><dt>Mushrooms grown</dt><dd>{t.mushrooms.toLocaleString()}</dd></div>
              <div><dt>Time in the forest</dt><dd>{duration(t.time)}</dd></div>
            </dl>
          </section>
        </div>

        <section aria-label="Progress">
          <h2>Progress <span className="muted small">your last {profile.history.length} rounds</span></h2>
          {profile.history.length < 2 ? <p className="muted">Play a few rounds to see your progress here.</p> : (
            <div className="charts">
              <XpChart profile={profile} />
              <BestTimeChart profile={profile} />
            </div>
          )}
        </section>

        <section aria-label="Achievements">
          <h2>Achievements <span className="muted small">{earned.size} of {ACHIEVEMENTS.length}</span></h2>
          <div className="achievements">
            {ACHIEVEMENTS.map((a) => {
              const got = earned.has(a.id);
              const secret = a.hidden && !got;
              return (
                <div key={a.id} className={`achievement${got ? ' got' : ''}`}>
                  <strong>{secret ? '???' : a.name}</strong>
                  <small>{secret ? 'Hidden until you find it' : a.about}</small>
                  <span className="xp">{got ? '✓ ' : ''}{a.xp} XP</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

// --- Charts ---

const CW = 420;
const CH = 140;
const PAD = { left: 34, right: 10, top: 10, bottom: 20 };

// XP earned in each round: a thin bar per round, won rounds bright, lost ones dim.
function XpChart({ profile }: { profile: Profile }) {
  const rounds = profile.history;
  const top = Math.max(...rounds.map((r) => r.xp), 1);
  const step = (CW - PAD.left - PAD.right) / rounds.length;
  const y = (v: number) => CH - PAD.bottom - (v / top) * (CH - PAD.top - PAD.bottom);
  return (
    <figure className="chart">
      <figcaption>XP each round <span className="key"><i className="won" /> won <i className="lost" /> lost</span></figcaption>
      <svg viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label="XP earned in each of your last rounds">
        {[0, top / 2, top].map((v) => (
          <g key={v}>
            <line className="grid" x1={PAD.left} x2={CW - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="axis" x={PAD.left - 5} y={y(v) + 3} textAnchor="end">{Math.round(v)}</text>
          </g>
        ))}
        {rounds.map((r, k) => (
          <rect key={k} className={r.won ? 'xpbar won' : 'xpbar lost'} x={PAD.left + k * step + step * 0.15} y={y(r.xp)}
            width={Math.max(1, step * 0.7)} height={Math.max(1, CH - PAD.bottom - y(r.xp))} rx={Math.min(2, step * 0.3)}>
            <title>{`${r.won ? 'Won' : 'Lost'} in ${formatTime(r.time)}: ${r.xp} XP`}</title>
          </rect>
        ))}
        <text className="axis" x={PAD.left} y={CH - 5}>older</text>
        <text className="axis" x={CW - PAD.right} y={CH - 5} textAnchor="end">latest</text>
      </svg>
    </figure>
  );
}

// The best time so far in each forest, round by round: lines that step down as you get faster.
function BestTimeChart({ profile }: { profile: Profile }) {
  const rounds = profile.history;
  const series = LEVELS.filter((l) => l.playable).map((l, k) => {
    let best = Infinity;
    const points: { i: number; t: number }[] = [];
    rounds.forEach((r, i) => {
      if (r.forest === l.id && r.won && r.time < best) best = r.time;
      if (best < Infinity) points.push({ i, t: best });
    });
    return { name: l.name, points, cls: `line line${k}` };
  }).filter((s) => s.points.length > 0);
  if (series.length === 0) {
    return <figure className="chart"><figcaption>Best time</figcaption><p className="muted">Win a round to see your best time here.</p></figure>;
  }
  const all = series.flatMap((s) => s.points.map((p) => p.t));
  const lo = Math.min(...all) * 0.95;
  const hi = Math.max(...all) * 1.05;
  const x = (i: number) => PAD.left + (rounds.length <= 1 ? 0 : (i / (rounds.length - 1)) * (CW - PAD.left - PAD.right));
  const y = (t: number) => PAD.top + ((t - lo) / (hi - lo || 1)) * (CH - PAD.top - PAD.bottom); // faster is higher
  return (
    <figure className="chart">
      <figcaption>
        Best time so far
        {series.length > 1 && <span className="key">{series.map((s, k) => <span key={s.name}><i className={`line${k}`} /> {s.name}</span>)}</span>}
      </figcaption>
      <svg viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label="Your best time in each forest, round by round">
        {[lo, (lo + hi) / 2, hi].map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={CW - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="axis" x={PAD.left - 5} y={y(t) + 3} textAnchor="end">{formatTime(t)}</text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.name}>
            <path className={s.cls} d={s.points.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.t).toFixed(1)}`).join('')} />
            <circle className={`${s.cls} end`} cx={x(s.points[s.points.length - 1].i)} cy={y(s.points[s.points.length - 1].t)} r={3.5}>
              <title>{`${s.name}: best ${formatTime(s.points[s.points.length - 1].t)}`}</title>
            </circle>
          </g>
        ))}
        <text className="axis" x={PAD.left} y={CH - 5}>older</text>
        <text className="axis" x={CW - PAD.right} y={CH - 5} textAnchor="end">latest</text>
      </svg>
    </figure>
  );
}
