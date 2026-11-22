import { useEffect, useRef, useState } from 'react';
import { GROW_COST, MUSHROOM_COST, WIN_COVERAGE } from '../game/constants';
import { coverage, sporesPerSecond, step } from '../game/sim';
import { createLevel1, type Game, type RoundStats } from '../game/world';
import { GameView, type Tool } from '../render/GameView';
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
});

const TOOLS: { tool: Tool; key: string; name: string; cost: string }[] = [
  { tool: 'grow', key: '1', name: 'Grow mycelium', cost: `${GROW_COST} spores a tile` },
  { tool: 'mushroom', key: '2', name: 'Grow mushroom', cost: `${MUSHROOM_COST} nutrients` },
];

// Every way to play, for the help panel.
const HELP: [string, string][] = [
  ['Drag from your network', 'Grow mycelium (Grow tool)'],
  ['Click your mycelium', 'Grow a mushroom (Mushroom tool)'],
  ['Click a mushroom', 'Burst it at beetles nearby'],
  ['1 / 2', 'Grow mycelium / Grow mushroom'],
  ['B', 'Burst the ready mushroom nearest the mouse'],
  ['Space or P', 'Pause and resume'],
  ['R', 'Restart (press twice during a round)'],
  ['F', 'Fullscreen'],
  ['H or ?', 'This help'],
  ['Esc', 'Close the help, or resume'],
];

const RESTART_WINDOW = 2000; // ms to press R a second time

const newGame = () => createLevel1(Math.floor(Math.random() * 1e9));

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
  const restartArmed = useRef(0); // when R was pressed once during a round

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
    GameView.create(host.current!, game.current, { onMessage: say, nutrientCounter, onSparkle }, onTick).then((v) => {
      if (disposed) v.destroy();
      else {
        view.current = v;
        v.topSpace = topSpace.current;
      }
      if (import.meta.env.DEV) (window as unknown as { view: GameView }).view = v;
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
    view.current.frozen = paused || help;
  }, [tool, paused, help, snap]);

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

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 2200);
    return () => clearTimeout(timer);
  }, [message]);

  const restart = () => {
    game.current = newGame();
    view.current?.setGame(game.current);
    setSnap(snapshot(game.current));
    setPaused(false);
    setHelp(false);
    restartArmed.current = 0;
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const t = TOOLS.find((t) => t.key === key);
      if (t) return setTool(t.tool);
      if (key === ' ' || key === 'p') {
        e.preventDefault(); // Space would also press the focused button
        if (!e.repeat) togglePause();
      } else if (key === 'escape') {
        if (help) setHelp(false);
        else if (paused) setPaused(false);
      } else if (key === 'h' || key === '?') {
        if (!e.repeat) setHelp((h) => !h);
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
  }, [help, paused]);

  const goal = Math.min(1, snap.held / WIN_COVERAGE);
  const won = snap.status === 'won';
  return (
    <div className="app">
      <div className="stage" ref={host} />
      <header className="panel" ref={panel}>
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
              <small>{t.cost}</small>
            </button>
          ))}
        </div>
        <div className="icons">
          <button className="icon" onClick={togglePause} title={paused ? 'Resume (Space)' : 'Pause (Space)'}
            aria-label={paused ? 'Resume' : 'Pause'} disabled={snap.status !== 'playing'}>
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
          <button className="icon" onClick={() => setHelp((h) => !h)} title="Help (H)" aria-label="Help">?</button>
          <button className="icon" onClick={toggleFullscreen} title={fullscreen ? 'Leave fullscreen (F)' : 'Fullscreen (F)'}
            aria-label={fullscreen ? 'Leave fullscreen' : 'Fullscreen'}>
            <FullscreenIcon out={fullscreen} />
          </button>
        </div>
      </header>
      <p className="hint">Drag to grow mycelium · click a mushroom to burst it · H for help</p>
      {message && <div className="toast" key={message.id}>{message.text}</div>}

      {paused && !help && snap.status === 'playing' && (
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
                {HELP.map(([k, what]) => (
                  <tr key={k}><th>{k}</th><td>{what}</td></tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setHelp(false)}>Back to the forest</button>
          </div>
        </div>
      )}

      {snap.status !== 'playing' && (
        <div className="overlay end">
          <div className="card">
            <h1>{won ? 'The forest is yours' : 'The mother mushroom was eaten'}</h1>
            <dl className="round-stats">
              <div><dt>Time</dt><dd>{formatTime(snap.time)}</dd></div>
              <div><dt>Forest held</dt><dd>{Math.round(snap.held * 100)}%</dd></div>
              <div><dt>Beetles beaten</dt><dd>{snap.kills}</dd></div>
              <div><dt>Mushrooms grown</dt><dd>{snap.stats.mushrooms}</dd></div>
              <div><dt>Tiles grown by hand</dt><dd>{snap.stats.grown}</dd></div>
              <div><dt>Most spores a second</dt><dd>{snap.stats.peakSpores.toFixed(1)}</dd></div>
            </dl>
            {snap.history && <SpreadChart history={snap.history} goal={WIN_COVERAGE} />}
            <button onClick={restart}>Play again</button>
          </div>
        </div>
      )}
    </div>
  );
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
