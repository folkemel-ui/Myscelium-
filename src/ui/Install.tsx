// Full screen on the iPhone: Safari can't hide its bars, but the game added to the Home Screen opens
// full screen. That copy keeps its own storage, so progress moves over with a progress code.
import { useEffect, useState } from 'react';
import { browserStore } from '../game/save';
import { codesWork, makeCode } from '../game/transfer';

const HINT_KEY = 'mycelium.installHint'; // 'off': don't show the install card again
const WELCOME_KEY = 'mycelium.appWelcome'; // 'off': the Home Screen app's welcome was answered

// An iPhone or iPad (iPads say they are Macs, but have touch).
export const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Started from the Home Screen rather than in the browser.
export const isStandalone = () =>
  (navigator as { standalone?: boolean }).standalone === true ||
  matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches;

export const showInstallCard = () => isIos() && !isStandalone() && browserStore.get(HINT_KEY) !== 'off';
export const showAppWelcome = (rounds: number) => isStandalone() && rounds === 0 && browserStore.get(WELCOME_KEY) !== 'off';

// In Safari on an iPhone: how to add the game to the Home Screen, and taking progress along.
export function InstallCard({ rounds, onClose }: { rounds: number; onClose: () => void }) {
  const never = () => {
    browserStore.set(HINT_KEY, 'off');
    onClose();
  };
  return (
    <section className="install-card" aria-label="Play full screen">
      <h2>Play full screen</h2>
      <p>Add Mycelium to your Home Screen: it opens full screen, with no address bar.</p>
      <ol className="install-steps">
        <li><span className="step-icon"><ShareIcon /></span><span>Tap <b>Share</b> in Safari's bar</span></li>
        <li><span className="step-icon"><AddIcon /></span><span>Choose <b>Add to Home Screen</b></span></li>
        <li><span className="step-icon add">Add</span><span>Tap <b>Add</b>, then open it from the Home Screen</span></li>
      </ol>
      {rounds > 0 && (
        <div className="install-progress">
          <small>Your progress stays here in Safari. To take it along, copy your progress code now and paste it in the app.</small>
          <CopyCode label="Copy progress code" />
        </div>
      )}
      <div className="install-buttons">
        <button className="secondary" onClick={onClose}>Not now</button>
        <button className="secondary" onClick={never}>Don't show again</button>
      </div>
    </section>
  );
}

// In the Home Screen app, on a fresh profile: bring progress over from Safari.
export function AppWelcome({ onCode, onClose }: { onCode: (code: string) => Promise<string | null>; onClose: () => void }) {
  const done = () => {
    browserStore.set(WELCOME_KEY, 'off');
    onClose();
  };
  return (
    <section className="install-card" aria-label="Welcome">
      <h2>Coming from Safari?</h2>
      <p>The Home Screen app keeps its own progress. In Safari, tap <b>Move progress with a code</b> in the menu, then <b>Copy progress code</b>, and paste it here.</p>
      <PasteCode onCode={async (code) => {
        const problem = await onCode(code);
        if (!problem) done();
        return problem;
      }} />
      <div className="install-buttons">
        <button className="secondary" onClick={done}>Start fresh</button>
      </div>
    </section>
  );
}

// Copy the progress code. It is made ahead, so the copy happens straight from the tap (Safari only
// lets a page write to the clipboard during a tap); if copying fails, the code is shown to copy by hand.
export function CopyCode({ label }: { label: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'copied' | 'show'>('idle');
  useEffect(() => {
    if (codesWork()) makeCode(browserStore).then(setCode, () => setCode(null));
  }, []);
  if (!codesWork()) return null;
  const copy = () => {
    if (!code) return;
    const shown = () => setState('show');
    if (!navigator.clipboard?.writeText) return shown();
    navigator.clipboard.writeText(code).then(() => setState('copied'), shown);
  };
  return (
    <div className="code-copy">
      <button onClick={copy} disabled={!code}>{state === 'copied' ? 'Copied ✓' : label}</button>
      {state === 'copied' && <small>Now open the game where you want your progress and paste it there.</small>}
      {state === 'show' && (
        <>
          <small>Copying didn't work here: select all of this and copy it.</small>
          <textarea className="code-box" readOnly value={code ?? ''} rows={3} onFocus={(e) => e.currentTarget.select()} />
        </>
      )}
    </div>
  );
}

// Paste a progress code and load it, asking before it replaces anything.
export function PasteCode({ onCode, ask = false }: { onCode: (code: string) => Promise<string | null>; ask?: boolean }) {
  const [text, setText] = useState('');
  const [sure, setSure] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!codesWork()) return <small className="problem">This browser can't read progress codes. Use Load a backup instead.</small>;
  const load = async () => {
    if (ask && !sure) return setSure(true);
    setBusy(true);
    const p = await onCode(text);
    setBusy(false);
    setSure(false);
    setProblem(p);
    if (!p) setText('');
  };
  return (
    <div className="code-paste">
      <textarea className="code-box" rows={2} placeholder="Paste your progress code (MYC1.…)" value={text}
        onChange={(e) => { setText(e.target.value); setProblem(null); setSure(false); }} />
      <div className="backup-buttons">
        <button className={sure ? 'warn' : ''} onClick={load} disabled={!text.trim() || busy}>
          {sure ? 'Replace my progress' : 'Load the code'}
        </button>
        {sure && <button className="secondary" onClick={() => setSure(false)}>Cancel</button>}
      </div>
      {sure && <small>This replaces your progress and saves here.</small>}
      {problem && <small className="problem">{problem}</small>}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6.5 8H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1.5" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 12.5V2.5M6.8 5.4 10 2.2l3.2 3.2" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="3" fill="none" strokeWidth="1.5" />
      <path d="M10 6.5v7M6.5 10h7" fill="none" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
