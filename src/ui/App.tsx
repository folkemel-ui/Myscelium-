import { useEffect, useRef, useState } from 'react';
import { GROW_COST, MUSHROOM_COST, WIN_COVERAGE } from '../game/constants';
import { coverage, sporesPerSecond, step } from '../game/sim';
import { createLevel1, type Game } from '../game/world';
import { GameView, type Tool } from '../render/GameView';

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
});

const TOOLS: { tool: Tool; key: string; name: string; cost: string }[] = [
  { tool: 'grow', key: '1', name: 'Grow mycelium', cost: `${GROW_COST} spores a tile` },
  { tool: 'mushroom', key: '2', name: 'Grow mushroom', cost: `${MUSHROOM_COST} nutrients` },
];

const beetles = (n: number) => (n === 1 ? '1 beetle' : `${n} beetles`);

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const nutrientsEl = useRef<HTMLElement>(null);
  const [bump, setBump] = useState(0); // goes up as nutrient sparkles land, to make the number jump
  const view = useRef<GameView | null>(null);
  const game = useRef<Game>(createLevel1(Math.floor(Math.random() * 1e9)));
  const [snap, setSnap] = useState(() => snapshot(game.current));
  const [tool, setTool] = useState<Tool>('grow');
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);

  // In development, the game is on window.game for poking at from the console.
  if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game.current;

  useEffect(() => {
    let disposed = false;
    let sinceSnap = 0;
    const onTick = (dt: number) => {
      step(game.current, dt);
      sinceSnap += dt;
      if (sinceSnap > 0.1) {
        sinceSnap = 0;
        setSnap(snapshot(game.current));
      }
    };
    const onMessage = (text: string) => setMessage({ text, id: Date.now() });
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
    GameView.create(host.current!, game.current, { onMessage, nutrientCounter, onSparkle }, onTick).then((v) => {
      if (disposed) v.destroy();
      else view.current = v;
      if (import.meta.env.DEV) (window as unknown as { view: GameView }).view = v;
    });
    return () => {
      disposed = true;
      view.current?.destroy();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    if (view.current) view.current.tool = tool;
  }, [tool, snap]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = TOOLS.find((t) => t.key === e.key);
      if (t) setTool(t.tool);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 2200);
    return () => clearTimeout(timer);
  }, [message]);

  const restart = () => {
    game.current = createLevel1(Math.floor(Math.random() * 1e9));
    view.current?.setGame(game.current);
    setSnap(snapshot(game.current));
  };

  const goal = Math.min(1, snap.held / WIN_COVERAGE);
  return (
    <div className="app">
      <div className="stage" ref={host} />
      <header className="panel">
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
      </header>
      <p className="hint">Drag to grow mycelium · click a mushroom to burst it at beetles</p>
      {message && <div className="toast" key={message.id}>{message.text}</div>}
      {snap.status !== 'playing' && (
        <div className="end">
          <div className="card">
            <h1>{snap.status === 'won' ? 'The forest is yours' : 'The mother mushroom was eaten'}</h1>
            <p>
              {snap.status === 'won'
                ? `You held ${Math.round(snap.held * 100)}% of the forest floor in ${Math.round(snap.time)} seconds and beat ${beetles(snap.kills)}.`
                : `You lasted ${Math.round(snap.time)} seconds and beat ${beetles(snap.kills)}.`}
            </p>
            <button onClick={restart}>Play again</button>
          </div>
        </div>
      )}
    </div>
  );
}
