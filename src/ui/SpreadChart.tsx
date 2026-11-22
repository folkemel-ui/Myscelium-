import { useState } from 'react';

// A small line chart of how much of the forest was held over a round, with the goal as a dashed
// line. Hover to read the time and share at any point.
export function formatTime(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const W = 360;
const H = 150;
const PAD = { left: 34, right: 12, top: 12, bottom: 22 };

export function SpreadChart({ history, goal }: { history: { t: number; held: number }[]; goal: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (history.length < 2) return null;
  const end = history[history.length - 1].t || 1;
  const top = Math.max(goal * 1.15, ...history.map((p) => p.held));
  const x = (t: number) => PAD.left + (t / end) * (W - PAD.left - PAD.right);
  const y = (v: number) => H - PAD.bottom - (v / top) * (H - PAD.top - PAD.bottom);
  const line = history.map((p, k) => `${k ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.held).toFixed(1)}`).join('');
  const area = `${line}L${x(end).toFixed(1)},${y(0)}L${x(0)},${y(0)}Z`;
  const ticks = [0, goal / 2, goal];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const t = (((e.clientX - box.left) / box.width) * W - PAD.left) / (W - PAD.left - PAD.right) * end;
    let best = 0;
    history.forEach((p, k) => {
      if (Math.abs(p.t - t) < Math.abs(history[best].t - t)) best = k;
    });
    setHover(best);
  };
  const h = hover === null ? null : history[hover];

  return (
    <figure className="chart">
      <figcaption>How you spread</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Share of the forest held over the round"
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="spread-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--glow)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--glow)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="axis" x={PAD.left - 6} y={y(v) + 4} textAnchor="end">{Math.round(v * 100)}%</text>
          </g>
        ))}
        <line className="goal-line" x1={PAD.left} x2={W - PAD.right} y1={y(goal)} y2={y(goal)} />
        <text className="axis" x={W - PAD.right} y={y(goal) - 5} textAnchor="end">Goal</text>
        <path d={area} fill="url(#spread-fill)" />
        <path d={line} className="spread-line" />
        <text className="axis" x={PAD.left} y={H - 5}>0:00</text>
        <text className="axis" x={W - PAD.right} y={H - 5} textAnchor="end">{formatTime(end)}</text>
        {h && (
          <g>
            <line className="cross" x1={x(h.t)} x2={x(h.t)} y1={PAD.top} y2={H - PAD.bottom} />
            <circle cx={x(h.t)} cy={y(h.held)} r={4} className="dot" />
            <text className="tip" x={Math.min(x(h.t) + 6, W - 70)} y={PAD.top + 10}>
              {formatTime(h.t)} · {Math.round(h.held * 100)}%
            </text>
          </g>
        )}
      </svg>
    </figure>
  );
}
