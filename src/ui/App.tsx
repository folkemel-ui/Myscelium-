import { useEffect, useRef, useState } from 'react';
import { WIN_COVERAGE } from '../game/constants';
import {
  award, buyUpgrade, finishRound, forestOpen, LEVELS, modsFor, motherTier, SCHEMES, totalXp, xpToNext, type Achievement, type Profile, type SchemeId, type UpgradeId, type XpLine,
} from '../game/progress';
import { coverage, sporesPerSecond, step, underAttack } from '../game/sim';
import { createLevel, type Game, type Mods, type RoundStats } from '../game/world';
import { GameView, type Tool } from '../render/GameView';
import {
  browserStore, clearAutosave, clearSlot, loadRound, makeBackup, readAutosave, readProfile, readSlot, restoreBackup,
  saveRound, SLOT_COUNT, writeAutosave, writeProfile, writeSlot, type SavedRound, type SlotSave,
} from '../game/save';
import { thumbnail } from '../render/thumbnail';
import { STAGES } from '../render/trip';
import { applyScheme } from '../render/forestLayout';
import { MainMenu } from './MainMenu';
import { ProfilePanel } from './ProfilePanel';
import { SaveDialog } from './SaveDialog';
import { formatTime, SpreadChart } from './SpreadChart';

// What the panel shows, copied out of the game a few times a second (the game itself changes
// every frame, far too often for React).
interface Snapshot {
  spores: number;
  sporeRate: number;
  nutrients: number;
  held: number;
  beetles: number;
  kills: number;
  status: Game['status'];
  time: number;
  stats: RoundStats;
  history: Game['history'] | null; // only once the round is over, for the chart
  growCost: number;
  mushroomCost: number;
  motherAttacked: boolean;
}

const snapshot = (g: Game): Snapshot => ({
  spores: g.spores,
  sporeRate: sporesPerSecond(g),
  nutrients: g.nutrients,
  held: coverage(g),
  beetles: g.beetles.length,
  kills: g.kills,
  status: g.status,
  time: g.time,
  stats: { ...g.stats },
  history: g.status === 'playing' ? null : g.history.slice(),
  growCost: g.mods.growCost,
  mushroomCost: g.mods.mushroomCost,
  motherAttacked: underAttack(g).some((a) => a.mushroom.mother),
});

const TOOLS: { tool: Tool; key: string; name: string; cost: (s: Snapshot) => string }[] = [
  { tool: 'grow', key: '1', name: 'Grow mycelium', cost: (s) => `${s.growCost} spores a tile` },
  { tool: 'mushroom', key: '2', name: 'Grow mushroom', cost: (s) => `${s.mushroomCost} nutrients` },
];

// How to play on a touch screen, for the help panel there.
const TOUCH_HELP: [string, string][] = [
  ['Drag from your network', 'Grow mycelium (Grow tool)'],
  ['Tap your mycelium', 'Grow a mushroom (Mushroom tool)'],
  ['Tap a mushroom', 'Burst it at beetles nearby'],
  ['Pinch', 'Zoom in and out'],
  ['Drag with two fingers', 'Move the view'],
  ['Buttons at the top', 'Pause, save, main menu, help'],
];

// Is this a touch screen (a phone or tablet) rather than a mouse?
const isTouch = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

// Every way to play, for the help panel.
const HELP: [string, string][] = [
  ['Drag from your network', 'Grow mycelium (Grow tool)'],
  ['Click your mycelium', 'Grow a mushroom (Mushroom tool)'],
  ['Click a mushroom', 'Burst it at beetles nearby'],
  ['Mouse wheel / right-drag', 'Zoom in and out / move the view'],
  ['+ / - / 0', 'Zoom in / out / show the whole forest'],
  ['1 / 2', 'Grow mycelium / Grow mushroom'],
  ['B', 'Burst the ready mushroom nearest the mouse'],
  ['Space or P', 'Pause and resume'],
  ['R', 'Restart (press twice during a round)'],
  ['S', 'Save the round to a slot'],
  ['F', 'Fullscreen'],
  ['H or ?', 'This help'],
  ['Esc', 'Close the help, or resume'],
];

const RESTART_WINDOW = 2000; // ms to press R a second time
const AUTOSAVE_EVERY = 5000; // ms
const store = browserStore;
const readSlots = () => Array.from({ length: SLOT_COUNT }, (_, k) => readSlot(store, k + 1));

const newGame = (level = 1, mods?: Mods) => createLevel(level, Math.floor(Math.random() * 1e9), mods);

// What a finished round earned, for the end screen.
interface Summary {
  lines: XpLine[];
  before: Profile;
  after: Profile;
  levelsGained: number;
  opened: string | null; // a forest this round opened
  newRecords: string[];
  earned: Achievement[];
}

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const topSpace = useRef(76); // where the forest may start, below the panel
  const nutrientsEl = useRef<HTMLElement>(null);
  const [bump, setBump] = useState(0); // goes up as nutrient sparkles land, to make the number jump
  const view = useRef<GameView | null>(null);
  const game = useRef<Game>(newGame());
  const [snap, setSnap] = useState(() => snapshot(game.current));
  const [tool, setTool] = useState<Tool>('grow');
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [help, setHelp] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [touch] = useState(isTouch);
  // A phone held upright gets a hint that the forest is bigger sideways (once a visit).
  const [upright, setUpright] = useState(false);
  const [uprightSeen, setUprightSeen] = useState(false);
  const restartArmed = useRef(0); // when R was pressed once during a round
  const [screen, setScreen] = useState<'menu' | 'game'>('menu');
  const [profile, setProfile] = useState<Profile>(() => readProfile(store));
  const [autosave, setAutosave] = useState<SavedRound | null>(() => readAutosave(store));
  const [slots, setSlots] = useState<(SlotSave | null)[]>(readSlots);
  const [saving, setSaving] = useState(false); // the save dialog is open
  const [stageBanner, setStageBanner] = useState<{ stage: number; id: number } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const awarded = useRef<Game | null>(null); // the round XP was last given for

  // In development, the game is on window.game for poking at from the console.
  if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game.current;

  const say = (text: string) => setMessage({ text, id: Date.now() });

  useEffect(() => {
    let disposed = false;
    let sinceSnap = 0;
    const onTick = (dt: number) => {
      step(game.current, dt);
      sinceSnap += dt;
      if (sinceSnap > 0.1 || game.current.status !== 'playing') {
        sinceSnap = 0;
        setSnap(snapshot(game.current));
      }
    };
    // Where the nutrient counter is, in the canvas's own pixels.
    const nutrientCounter = () => {
      const el = nutrientsEl.current;
      const box = host.current;
      if (!el || !box) return null;
      const r = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 };
    };
    const onSparkle = () => setBump((n) => n + 1);
    const onStage = (stage: number) => setStageBanner({ stage, id: Date.now() });
    GameView.create(host.current!, game.current, { onMessage: say, nutrientCounter, onSparkle, onStage }, onTick).then((v) => {
      if (disposed) v.destroy();
      else {
        view.current = v;
        v.topSpace = topSpace.current;
        // In development, the live view is on window.view (not one thrown away by React starting twice).
        if (import.meta.env.DEV) (window as unknown as { view: GameView }).view = v;
      }
    });
    return () => {
      disposed = true;
      view.current?.destroy();
      view.current = null;
    };
  }, []);

  // The view follows the tool, and stands still while paused or reading the help.
  useEffect(() => {
    if (!view.current) return;
    view.current.tool = tool;
    view.current.frozen = paused || help || saving || screen === 'menu';
    view.current.creatures.motherTier = motherTier(profile.level);
  }, [tool, paused, help, saving, screen, snap]);

  // The profile is kept for good, whenever it changes.
  useEffect(() => {
    writeProfile(store, profile);
  }, [profile]);

  // The round in progress is saved every few seconds and when the page is closed; a finished
  // round's autosave is cleared.
  const screenRef = useRef(screen);
  screenRef.current = screen;
  useEffect(() => {
    const save = () => {
      if (screenRef.current === 'game' && game.current.status === 'playing') writeAutosave(store, game.current);
    };
    const timer = setInterval(save, AUTOSAVE_EVERY);
    window.addEventListener('pagehide', save);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', save);
    };
  }, []);
  useEffect(() => {
    if (snap.status !== 'playing' && screen === 'game') {
      clearAutosave(store);
      setAutosave(null);
    }
  }, [snap.status, screen]);

  // When a round ends, it earns XP (once).
  useEffect(() => {
    if (snap.status === 'playing' || screen !== 'game' || awarded.current === game.current) return;
    awarded.current = game.current;
    const g = game.current;
    const result = finishRound(profile, {
      forest: g.level, won: g.status === 'won', held: coverage(g), kills: g.kills, time: g.time, stats: { ...g.stats },
    });
    const opened = LEVELS.find((l) => !forestOpen(profile, l) && forestOpen(result.profile, l))?.name ?? null;
    setSummary({
      lines: result.lines, before: profile, after: result.profile, levelsGained: result.levelsGained, opened,
      newRecords: result.newRecords, earned: result.earned,
    });
    setProfile(result.profile);
  }, [snap.status, screen]);

  // The forest starts below the panel, however tall it is.
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const fit = () => {
      topSpace.current = el.getBoundingClientRect().bottom + 8;
      if (view.current) view.current.topSpace = topSpace.current;
    };
    const watcher = new ResizeObserver(fit);
    watcher.observe(el);
    fit();
    return () => watcher.disconnect();
  }, []);

  // Switching to another tab pauses the round.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && game.current.status === 'playing') setPaused(true);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  // Watch whether the phone is held upright.
  useEffect(() => {
    const check = () => setUpright(window.innerHeight > window.innerWidth * 1.1);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Safari zooms the whole page on a pinch, even where the game takes the touches: stop that, so a
  // pinch only zooms the forest.
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', stop);
    document.addEventListener('gesturechange', stop);
    return () => {
      document.removeEventListener('gesturestart', stop);
      document.removeEventListener('gesturechange', stop);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!stageBanner) return;
    const timer = setTimeout(() => setStageBanner(null), 3200);
    return () => clearTimeout(timer);
  }, [stageBanner]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 2200);
    return () => clearTimeout(timer);
  }, [message]);

  // Start playing a round: a new one, or one loaded from a save (which starts paused, so the
  // player can look before it moves).
  const startRound = (g: Game, pause: boolean) => {
    game.current = g;
    setSummary(null);
    setScreen('game');
    view.current?.setGame(g);
    setSnap(snapshot(g));
    setPaused(pause);
    setHelp(false);
    setSaving(false);
    restartArmed.current = 0;
  };
  // A new round in a forest; restarting plays the same forest again.
  const play = (level: number) => startRound(newGame(level, modsFor(profile)), false);
  const restart = () => play(game.current.level);
  const loadSaved = (round: SavedRound) => {
    const g = loadRound(round);
    if (g) startRound(g, true);
    else say('That save could not be read');
  };

  // Back to the menu in the middle of a round: it is autosaved, to continue later.
  const leaveRound = () => {
    if (game.current.status === 'playing') {
      writeAutosave(store, game.current);
      setAutosave(saveRound(game.current));
    }
    toMenu();
  };

  const saveToSlot = (n: number, name: string) => {
    const g = game.current;
    const ok = writeSlot(store, n, {
      name, savedAt: Date.now(), held: coverage(g), time: g.time, picture: thumbnail(g), round: saveRound(g),
    });
    setSlots(readSlots());
    setSaving(false);
    say(ok ? `Saved in slot ${n}` : 'The browser would not store the save');
  };
  const deleteSlot = (n: number) => {
    clearSlot(store, n);
    setSlots(readSlots());
  };

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(makeBackup(store))], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mycelium-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  // Returns a reason if the file isn't a backup; otherwise everything is replaced by it.
  const loadBackup = (text: string) => {
    const problem = restoreBackup(store, text);
    if (problem) return problem;
    setProfile(readProfile(store));
    setAutosave(readAutosave(store));
    setSlots(readSlots());
    say('Backup loaded');
    return null;
  };

  const togglePause = () => {
    if (game.current.status !== 'playing') return;
    setHelp(false);
    setPaused((p) => !p);
  };

  // Some browsers (and embedded previews) refuse fullscreen, by throwing or by a failed promise.
  const toggleFullscreen = () => {
    const refused = () => say('Fullscreen is not allowed here');
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen().catch(refused);
    } catch {
      refused();
    }
  };

  const toMenu = () => {
    setScreen('menu');
    setPaused(false);
    setHelp(false);
    setSaving(false);
  };
  // A change to the profile from the menu (an upgrade, a name, colours) may earn achievements.
  const changeProfile = (next: Profile) => {
    const out = award(next);
    setProfile(out.profile);
    for (const a of out.earned) say(`Achievement: ${a.name} (+${a.xp} XP)`);
  };
  const buy = (id: UpgradeId) => {
    const next = buyUpgrade(profile, id);
    if (next) changeProfile(next);
  };
  const rename = (name: string) => changeProfile({ ...profile, name });
  const chooseScheme = (scheme: SchemeId) => changeProfile({ ...profile, scheme });
  const [showProfile, setShowProfile] = useState(false);

  // The colours follow the chosen scheme; the forest behind the menu is redrawn in them.
  useEffect(() => {
    const s = SCHEMES.find((x) => x.id === profile.scheme) ?? SCHEMES[0];
    applyScheme(s.glow, s.mother);
    if (view.current && screen === 'menu') view.current.setGame(game.current);
  }, [profile.scheme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (screen === 'menu') {
        if (key === 'enter') restart();
        else if (key === 'f' && !e.repeat) toggleFullscreen();
        return;
      }
      const t = TOOLS.find((t) => t.key === key);
      if (t) return setTool(t.tool);
      if (key === ' ' || key === 'p') {
        e.preventDefault(); // Space would also press the focused button
        if (!e.repeat) togglePause();
      } else if (key === 's' && !e.repeat) {
        if (game.current.status === 'playing') setSaving((v) => !v);
      } else if (key === 'escape') {
        if (saving) setSaving(false);
        else if (help) setHelp(false);
        else if (paused) setPaused(false);
      } else if (key === 'h' || key === '?') {
        if (!e.repeat) setHelp((h) => !h);
      } else if (key === '+' || key === '=') {
        view.current?.zoomBy(1.25);
      } else if (key === '-' || key === '_') {
        view.current?.zoomBy(0.8);
      } else if (key === '0') {
        view.current?.resetCamera();
      } else if (key === 'b') {
        view.current?.burstNearest();
      } else if (key === 'f') {
        if (!e.repeat) toggleFullscreen();
      } else if (key === 'r' && !e.repeat) {
        if (game.current.status !== 'playing' || Date.now() - restartArmed.current < RESTART_WINDOW) restart();
        else {
          restartArmed.current = Date.now();
          say('Press R again to restart');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [help, paused, saving, screen, profile]);

  const goal = Math.min(1, snap.held / WIN_COVERAGE);
  const won = snap.status === 'won';
  return (
    <div className="app">
      <div className="stage" ref={host} />
      <header className="panel" ref={panel} hidden={screen === 'menu'}>
        <div className="stat time">
          <span className="label">Time</span>
          <strong>{formatTime(snap.time)}</strong>
        </div>
        <div className="stat">
          <span className="label">Spores</span>
          <strong>{Math.floor(snap.spores)}</strong>
          <span className="rate">+{snap.sporeRate.toFixed(1)}/s</span>
        </div>
        <div className="stat">
          <span className="label">Nutrients</span>
          <strong ref={nutrientsEl} key={bump} className={bump ? 'bump' : ''}>{Math.floor(snap.nutrients)}</strong>
        </div>
        <div className="stat goal">
          <span className="label">
            Forest held: {Math.round(snap.held * 100)}% of {Math.round(WIN_COVERAGE * 100)}%
          </span>
          <div className="bar"><div style={{ width: `${goal * 100}%` }} /></div>
        </div>
        <div className="stat">
          <span className="label">Beetles</span>
          <strong>{snap.beetles}</strong>
          <span className="rate">{snap.kills} beaten</span>
        </div>
        <div className="tools">
          {TOOLS.map((t) => (
            <button key={t.tool} className={tool === t.tool ? 'on' : ''} onClick={() => setTool(t.tool)}>
              <kbd>{t.key}</kbd> {t.name}
              <small>{t.cost(snap)}</small>
            </button>
          ))}
        </div>
        <div className="icons">
          <button className="icon" onClick={togglePause} title={paused ? 'Resume (Space)' : 'Pause (Space)'}
            aria-label={paused ? 'Resume' : 'Pause'} disabled={snap.status !== 'playing'}>
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
          <button className="icon" onClick={() => setSaving(true)} title="Save to a slot (S)" aria-label="Save"
            disabled={snap.status !== 'playing'}>
            <SaveIcon />
          </button>
          <button className="icon" onClick={leaveRound} title="Main menu (the round is kept)" aria-label="Main menu">
            <MenuIcon />
          </button>
          <button className="icon" onClick={() => setHelp((h) => !h)} title="Help (H)" aria-label="Help">?</button>
          {document.fullscreenEnabled && (
            <button className="icon" onClick={toggleFullscreen} title={fullscreen ? 'Leave fullscreen (F)' : 'Fullscreen (F)'}
              aria-label={fullscreen ? 'Leave fullscreen' : 'Fullscreen'}>
              <FullscreenIcon out={fullscreen} />
            </button>
          )}
        </div>
      </header>
      {screen === 'game' && (
        <p className="hint">
          {touch
            ? 'Drag to grow · tap a mushroom to burst it · pinch to zoom'
            : 'Drag to grow mycelium · click a mushroom to burst it · wheel to zoom · H for help'}
        </p>
      )}
      {touch && upright && !uprightSeen && screen === 'game' && (
        <button className="turn-hint" onClick={() => setUprightSeen(true)}>Turn your phone sideways for a bigger forest ✕</button>
      )}
      {message && <div className="toast" key={message.id}>{message.text}</div>}
      {snap.motherAttacked && screen === 'game' && snap.status === 'playing' && (
        <div className="mother-alarm" role="alert">The mother is being eaten! Burst her (click or B)</div>
      )}
      {stageBanner && screen === 'game' && snap.status === 'playing' && (
        <div className="stage-banner" key={stageBanner.id} role="status">
          <small>Stage {stageBanner.stage}</small>
          <strong>{STAGES[stageBanner.stage - 1].name}</strong>
          <span>{STAGES[stageBanner.stage - 1].adds}</span>
        </div>
      )}

      {screen === 'menu' && (
        <MainMenu
          profile={profile} onPlay={play} onBuy={buy}
          autosave={autosave} onContinue={() => autosave && loadSaved(autosave)}
          slots={slots} onLoadSlot={(n) => slots[n - 1] && loadSaved(slots[n - 1]!.round)} onDeleteSlot={deleteSlot}
          onBackup={downloadBackup} onRestore={loadBackup} onOpenProfile={() => setShowProfile(true)}
        />
      )}
      {screen === 'menu' && showProfile && (
        <ProfilePanel profile={profile} onRename={rename} onScheme={chooseScheme} onClose={() => setShowProfile(false)} />
      )}

      {saving && screen === 'game' && (
        <SaveDialog slots={slots} game={game.current} onSave={saveToSlot} onClose={() => setSaving(false)} />
      )}

      {paused && !help && !saving && snap.status === 'playing' && screen === 'game' && (
        <div className="overlay" onClick={() => setPaused(false)}>
          <div className="paused">
            <h1>Paused</h1>
            <p>Press Space or click to resume</p>
          </div>
        </div>
      )}

      {help && (
        <div className="overlay" onClick={() => setHelp(false)}>
          <div className="card help" onClick={(e) => e.stopPropagation()}>
            <h1>How to play</h1>
            <p>Spread your mycelium over half the forest floor. Beetles eat it; keep them off the mother mushroom.</p>
            <table>
              <tbody>
                {(touch ? TOUCH_HELP : HELP).map(([k, what]) => (
                  <tr key={k}><th>{k}</th><td>{what}</td></tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setHelp(false)}>Back to the forest</button>
          </div>
        </div>
      )}

      {snap.status !== 'playing' && screen === 'game' && (
        <div className="overlay end">
          <div className="card">
            <h1>{won ? 'The forest is yours' : 'The mother mushroom was eaten'}</h1>
            {summary && <XpSummary summary={summary} />}
            <dl className="round-stats">
              <div><dt>Time</dt><dd>{formatTime(snap.time)}</dd></div>
              <div><dt>Forest held</dt><dd>{Math.round(snap.held * 100)}%</dd></div>
              <div><dt>Beetles beaten</dt><dd>{snap.kills}</dd></div>
              <div><dt>Mushrooms grown</dt><dd>{snap.stats.mushrooms}</dd></div>
              <div><dt>Tiles grown by hand</dt><dd>{snap.stats.grown}</dd></div>
              <div><dt>Most spores a second</dt><dd>{snap.stats.peakSpores.toFixed(1)}</dd></div>
            </dl>
            {snap.history && <SpreadChart history={snap.history} goal={WIN_COVERAGE} />}
            <div className="end-buttons">
              <button onClick={restart}>Play again</button>
              <button className="secondary" onClick={toMenu}>Main Menu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// The XP a round earned, line by line, and the level bar filling up.
function XpSummary({ summary }: { summary: Summary }) {
  const { lines, after, levelsGained } = summary;
  const need = xpToNext(after.level);
  return (
    <section className="xp-summary" aria-label="XP earned">
      <ul>
        {lines.map((l) => (
          <li key={l.label}><span>{l.label}</span><b>+{l.xp} XP</b></li>
        ))}
        {summary.earned.map((a) => (
          <li key={a.id} className="achieved"><span>Achievement: {a.name}</span><b>+{a.xp} XP</b></li>
        ))}
        <li className="total"><span>Total</span><b>+{totalXp(lines) + summary.earned.reduce((s, a) => s + a.xp, 0)} XP</b></li>
      </ul>
      {summary.newRecords.length > 0 && (
        <div className="records-new">{summary.newRecords.map((r) => <p key={r}>New record! {r}</p>)}</div>
      )}
      <div className="xp-level">
        <span>Level {after.level}</span>
        <div className="bar"><div style={{ width: `${(after.xp / need) * 100}%` }} /></div>
        <span>{after.xp} / {need}</span>
      </div>
      {summary.opened && <p className="level-up">New forest open: {summary.opened}!</p>}
      {levelsGained > 0 && (
        <p className="level-up">
          Level up! +{levelsGained} upgrade point{levelsGained > 1 ? 's' : ''} to spend in the Main Menu
        </p>
      )}
    </section>
  );
}

function SaveIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h8l3 3v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" fill="none" strokeWidth="1.5" /><rect x="5" y="9" width="6" height="4" rx="0.5" /><rect x="5" y="2.5" width="5" height="3" rx="0.5" /></svg>;
}

function MenuIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M3 8h10M3 12h10" fill="none" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function PauseIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3" width="3" height="10" rx="1" /><rect x="9.5" y="3" width="3" height="10" rx="1" /></svg>;
}

function PlayIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.4-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z" /></svg>;
}

function FullscreenIcon({ out }: { out: boolean }) {
  const d = out
    ? 'M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4'
    : 'M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4';
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d={d} fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
