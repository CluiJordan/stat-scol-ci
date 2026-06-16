import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/* ---------- SealMark ---------- */
export function SealMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" style={{ display: 'block' }}>
      <rect x="1.25" y="1.25" width="37.5" height="37.5" rx="2" stroke="var(--ink)" strokeWidth="1.5" strokeOpacity="0.45" />
      <rect x="7.5" y="7.5" width="25" height="25" rx="1" stroke="var(--ink)" strokeWidth="1.5" />
      <rect x="11" y="24" width="3.4" height="6" fill="var(--ink)" opacity="0.85" />
      <rect x="15.8" y="20" width="3.4" height="10" fill="var(--ink)" opacity="0.85" />
      <rect x="20.6" y="16" width="3.4" height="14" fill="var(--green)" />
      <rect x="25.4" y="11" width="3.4" height="19" fill="var(--orange)" />
      <polyline points="12.7,23 17.5,19 22.3,15 27.1,10" stroke="var(--ink)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12.7" cy="23" r="1.5" fill="var(--ink)" />
      <circle cx="27.1" cy="10" r="1.5" fill="var(--orange)" />
    </svg>
  );
}

export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <SealMark size={size + 8} />
      <span className="display" style={{ fontSize: size, color: 'var(--ink)', lineHeight: 1 }}>
        StatScol<span style={{ color: 'var(--orange)' }}>CI</span>
      </span>
    </div>
  );
}

/* ---------- Tag ---------- */
export function Tag({ children, kind }: { children: React.ReactNode; kind?: string }) {
  return <span className={'tag' + (kind ? ' tag--' + kind.toLowerCase() : '')}>{children}</span>;
}

/* ---------- Ticker (count-up animation) ---------- */
function useCountUp(target: number, duration = 1100) {
  const [val, setVal] = useState(0);
  const rafRef = useRef(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setVal(target); return; }
    const from = fromRef.current;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * ease);
      if (p < 1) { rafRef.current = requestAnimationFrame(tick); }
      else { fromRef.current = target; }
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return val;
}

export function Ticker({
  value, decimals = 0, className = '', style, duration = 1100,
}: {
  value: number; decimals?: number; className?: string;
  style?: React.CSSProperties; duration?: number;
}) {
  const v = useCountUp(value, duration);
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(v * factor) / factor;
  const txt = decimals > 0
    ? rounded.toFixed(decimals).replace('.', ',')
    : Math.round(rounded).toLocaleString('fr-FR');
  return <span className={className} style={style}>{txt}</span>;
}

/* ---------- Masthead ---------- */
export function Masthead({ back, title, sub, right }: {
  back?: () => void;
  title?: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <header style={{ borderBottom: '2px solid var(--ink)', position: 'sticky', top: 0, zIndex: 100, background: 'var(--paper)' }}>
      <div className="shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          {back ? (
            <button className="btn btn--ghost btn--sm" onClick={back} aria-label="Retour" style={{ marginLeft: -8 }}>
              ← <span style={{ marginLeft: 4 }}>Retour</span>
            </button>
          ) : (
            <Wordmark size={20} />
          )}
          {title && (
            <div style={{ minWidth: 0, borderLeft: '1px solid var(--line)', paddingLeft: 16 }}>
              <div className="display" style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '46vw' }}>
                {title}
              </div>
              {sub && <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 }}>{sub}</div>}
            </div>
          )}
        </div>
        {right && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>{right}</div>}
      </div>
    </header>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, title, onClose, children, footer }: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, background: 'rgba(26,22,17,0.42)', backdropFilter: 'blur(3px)', animation: 'fadein calc(.25s * var(--speed)) ease both' }}
    >
      <div onClick={(e) => e.stopPropagation()} className="rise" style={{ background: 'var(--card)', width: '100%', maxWidth: 460, border: '1px solid var(--line)', borderRadius: 5, overflow: 'hidden', boxShadow: '0 24px 70px rgba(26,22,17,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h3 className="display" style={{ fontSize: 19, margin: 0, fontWeight: 800 }}>{title}</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>{children}</div>
        {footer && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', background: 'var(--paper-2)', borderTop: '1px solid var(--line)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Field + form primitives ---------- */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function TextInput({ value, onChange, placeholder, upper, disabled, style }: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  upper?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <input
      className={'input' + (upper ? ' input--up' : '')}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      style={style}
      onChange={(e) => onChange?.(upper ? e.target.value.toUpperCase() : e.target.value)}
    />
  );
}

export function SelectInput({ value, onChange, options, style }: {
  value: string;
  onChange?: (v: string) => void;
  options: (string | { value: string; label: string })[];
  style?: React.CSSProperties;
}) {
  return (
    <select className="select" value={value} style={style} onChange={(e) => onChange?.(e.target.value)}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

/* ---------- Toast ---------- */
export function useToast(): [React.ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = (m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  };
  const node: React.ReactNode = msg ? (
    <div className="fadein" style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: 'var(--ink)', color: 'var(--paper)', padding: '12px 18px', borderRadius: 4, zIndex: 6000, fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.04em', boxShadow: '0 8px 30px rgba(0,0,0,0.22)', whiteSpace: 'nowrap' }}>
      {msg}
    </div>
  ) : null;
  return [node, show];
}

/* ---------- SVG Donut chart ---------- */
export function Donut({ a, b, labelA, labelB, colorA = 'var(--gar)', colorB = 'var(--fil)', size = 168 }: {
  a: number; b: number; labelA: string; labelB: string;
  colorA?: string; colorB?: string; size?: number;
}) {
  const actualTotal = a + b;
  const total = actualTotal || 1;
  const r = size / 2 - 14;
  const circ = 2 * Math.PI * r;
  const pa = a / total;
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const dashA = (grown ? pa : 0) * circ;
  const dashB = (grown ? (1 - pa) : 0) * circ;
  const cx = size / 2;
  const cy = size / 2;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-2)" strokeWidth="14" />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={colorB} strokeWidth="14"
            strokeDasharray={`${dashB} ${circ}`} strokeDashoffset={-dashA}
            style={{ transition: 'stroke-dasharray .9s cubic-bezier(.2,.75,.2,1) .1s, stroke-dashoffset .9s cubic-bezier(.2,.75,.2,1) .1s' }} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={colorA} strokeWidth="14"
            strokeDasharray={`${dashA} ${circ}`}
            style={{ transition: 'stroke-dasharray .9s cubic-bezier(.2,.75,.2,1)' }} />
        </g>
        <text x={cx} y={cy - 4} textAnchor="middle"
          fontFamily="var(--display)" fontWeight="800" fontSize="26" fill="var(--ink)">
          {actualTotal}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle"
          fontFamily="var(--mono)" fontSize="9" letterSpacing="0.12em" fill="var(--ink-3)">
          ADMIS
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <DonutLegend color={colorA} label={labelA} value={a} pct={actualTotal === 0 ? '0,00%' : (Math.round(pa * 10000) / 100).toFixed(2).replace('.', ',') + '%'} />
        <DonutLegend color={colorB} label={labelB} value={b} pct={actualTotal === 0 ? '0,00%' : (Math.round((1 - pa) * 10000) / 100).toFixed(2).replace('.', ',') + '%'} />
      </div>
    </div>
  );
}

function DonutLegend({ color, label, value, pct }: { color: string; label: string; value: number; pct: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span style={{ width: 10, height: 10, background: color, borderRadius: 2, alignSelf: 'center', flexShrink: 0 }} />
      <span className="mono" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-2)', minWidth: 60 }}>{label}</span>
      <span className="display tnum" style={{ fontSize: 22 }}>{value}</span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{pct}</span>
    </div>
  );
}

/* ---------- Horizontal bar chart ---------- */
export function BarChart({ rows }: { rows: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((r, i) => (
        <div key={r.label + i} style={{ display: 'grid', gridTemplateColumns: '78px 1fr 34px', alignItems: 'center', gap: 12 }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--ink-2)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          <div style={{ height: 16, background: 'var(--paper-3)', borderRadius: 2, overflow: 'hidden' }}>
            <div className="bar-fill" style={{ height: '100%', width: (r.value / max * 100) + '%', background: r.color || 'var(--ink)', borderRadius: 2, animationDelay: `calc(${0.05 * i}s * var(--speed))` }} />
          </div>
          <span className="mono tnum" style={{ fontSize: 12, fontWeight: 700 }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Section heading ---------- */
export function SectionHead({ n, title, desc }: { n: string; title: string; desc?: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span className="display tnum" style={{ fontSize: 30, color: 'var(--ink-3)', fontWeight: 800, lineHeight: 1 }}>{n}</span>
        <h2 className="display" style={{ fontSize: 'clamp(22px, 3.5vw, 30px)', margin: 0, fontWeight: 700, lineHeight: 1.1 }}>{title}</h2>
      </div>
      {desc && <p style={{ margin: '8px 0 0 42px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{desc}</p>}
    </div>
  );
}

export function Placeholder({ text }: { text: string }) {
  return <p className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', padding: '18px 0', margin: 0 }}>{text}</p>;
}
