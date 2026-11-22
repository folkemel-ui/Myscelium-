import { LEVELS, rank, UPGRADES, xpToNext, type Profile, type UpgradeId } from '../game/progress';
import { formatTime } from './SpreadChart';

// The main menu: the player's profile, the forests to play, and upgrades to spend points on.
export function MainMenu({ profile, onPlay, onBuy }: {
  profile: Profile;
  onPlay: (level: number) => void;
  onBuy: (id: UpgradeId) => void;
}) {
  const need = xpToNext(profile.level);
  return (
    <div className="overlay menu">
      <div className="menu-card">
        <header className="menu-head">
          <h1>Mycelium</h1>
          <p>Spread through the forest. Bring it to life.</p>
        </header>

        <div className="menu-grid">
          <section className="profile" aria-label="Your profile">
            <div className="level-badge"><small>Level</small>{profile.level}</div>
            <div className="xp">
              <div className="xp-text"><span>{profile.xp} / {need} XP</span><span>to level {profile.level + 1}</span></div>
              <div className="bar"><div style={{ width: `${(profile.xp / need) * 100}%` }} /></div>
            </div>
            <dl className="tallies">
              <div><dt>Rounds</dt><dd>{profile.rounds}</dd></div>
              <div><dt>Wins</dt><dd>{profile.wins}</dd></div>
              <div><dt>Best time</dt><dd>{profile.bestTime === null ? '–' : formatTime(profile.bestTime)}</dd></div>
            </dl>
          </section>

          <section className="levels" aria-label="Forests">
            <h2>Forests</h2>
            {LEVELS.map((l) => (
              <div key={l.id} className={`level-row${l.playable ? '' : ' locked'}`}>
                <div>
                  <strong>{l.id}. {l.name}</strong>
                  <small>{l.about}</small>
                </div>
                {l.playable ? <button className="play" onClick={() => onPlay(l.id)}>Play</button> : <span className="lock">Locked</span>}
              </div>
            ))}
          </section>
        </div>

        <section className="upgrades" aria-label="Upgrades">
          <h2>
            Upgrades
            <span className={profile.points ? 'points has' : 'points'}>
              {profile.points === 1 ? '1 point to spend' : `${profile.points} points to spend`}
            </span>
          </h2>
          <div className="upgrade-grid">
            {UPGRADES.map((u) => {
              const r = rank(profile, u.id);
              const maxed = r >= u.max;
              return (
                <div key={u.id} className={`upgrade${maxed ? ' maxed' : ''}`}>
                  <div className="upgrade-top">
                    <strong>{u.name}</strong>
                    <span className="pips" aria-label={`Rank ${r} of ${u.max}`}>
                      {Array.from({ length: u.max }, (_, k) => <i key={k} className={k < r ? 'on' : ''} />)}
                    </span>
                  </div>
                  <small>{maxed ? 'Fully grown' : u.about(r)}</small>
                  <button disabled={maxed || profile.points < 1} onClick={() => onBuy(u.id)}>
                    {maxed ? 'Max' : 'Upgrade · 1 point'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
        <p className="menu-foot">Points come from levelling up. Upgrades last for every round. Press Enter to play.</p>
      </div>
    </div>
  );
}
