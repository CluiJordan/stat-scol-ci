import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { Session, ExamType } from '../types';
import { getSessions, saveSession, deleteSession } from '../lib/storage';
import { computeTotals, computeRow, pct } from '../lib/calculations';
import { SealMark, Tag, Masthead, Modal, Field, TextInput, SelectInput } from '../components/ui/design';

const DEFAULT_MINISTERE =
  "MINISTÈRE DE L'ÉDUCATION NATIONALE, DE L'ALPHABÉTISATION, DE L'ENSEIGNEMENT TECHNIQUE ET DE LA FORMATION PROFESSIONNEL";

function schoolYearOptions(current?: string): string[] {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const currentStart = month >= 9 ? year : year - 1;
  const years = Array.from({ length: 6 }, (_, i) => {
    const start = currentStart - (5 - i);
    return `${start} - ${start + 1}`;
  });
  if (current && !years.includes(current)) years.unshift(current);
  return years;
}

interface Props {
  onOpen: (id: string) => void;
  onReports: (id: string) => void;
}

export default function Dashboard({ onOpen, onReports }: Props) {
  const [sessions, setSessions] = useState<Session[]>(getSessions);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const years = schoolYearOptions();
  const [form, setForm] = useState({
    etablissement: '',
    code: '',
    drena: '',
    anneeScolaire: years[years.length - 1] || '2025 - 2026',
    examType: 'BEPC' as ExamType,
    examSession: 'SESSION 2025',
  });

  function refresh() { setSessions(getSessions()); }

  function handleCreate() {
    if (!form.etablissement) return;
    const session: Session = {
      id: uuid(),
      ministere: DEFAULT_MINISTERE,
      drena: form.drena,
      etablissement: form.etablissement,
      code: form.code,
      anneeScolaire: form.anneeScolaire,
      examType: form.examType,
      examSession: form.examSession,
      centres: [],
      classes: [],
      eleves: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveSession(session);
    refresh();
    setShowCreate(false);
    setForm((f) => ({ ...f, etablissement: '', code: '', drena: '' }));
    onOpen(session.id);
  }

  function handleDelete() {
    if (deleteId) { deleteSession(deleteId); refresh(); setDeleteId(null); }
  }

  const toDelete = sessions.find((s) => s.id === deleteId);

  return (
    <div className="screen-enter" style={{ minHeight: '100vh' }}>
      <Masthead right={
        <button className="btn btn--solid" onClick={() => setShowCreate(true)}>+ Nouvelle session</button>
      } />

      <div className="shell" style={{ paddingTop: 36, paddingBottom: 80 }}>
        <div className="rise" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <div className="eyebrow">Statistiques d'examens · BEPC &amp; BAC · Côte d'Ivoire</div>
          <div className="eyebrow" style={{ whiteSpace: 'nowrap' }}>
            <span className="display tnum" style={{ fontSize: 17, color: 'var(--ink)' }}>{String(sessions.length).padStart(2, '0')}</span> sessions
          </div>
        </div>
        <h1 className="display rise" style={{ fontSize: 'clamp(44px, 8vw, 96px)', margin: '14px 0 0', animationDelay: 'calc(.05s * var(--speed))' }}>Les relevés</h1>
        <hr className="rule-ink" style={{ marginTop: 20 }} />

        {sessions.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} />
        ) : (
          <div>
            {sessions.map((s, i) => {
              const computed = s.classes.map((c) => computeRow(c, s.examType));
              const totals = computeTotals(computed, s.examType);
              return (
                <SessionRow key={s.id} s={s} totals={totals} index={i}
                  onOpen={() => onOpen(s.id)}
                  onReports={() => onReports(s.id)}
                  onDelete={() => setDeleteId(s.id)} />
              );
            })}
          </div>
        )}
      </div>

      <Modal open={showCreate} title="Nouvelle session" onClose={() => setShowCreate(false)}
        footer={
          <>
            <button className="btn" onClick={() => setShowCreate(false)}>Annuler</button>
            <button className="btn btn--accent" disabled={!form.etablissement} onClick={handleCreate}>Créer</button>
          </>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(['BEPC', 'BAC'] as ExamType[]).map((t) => (
              <button key={t} onClick={() => setForm((f) => ({ ...f, examType: t }))}
                style={{
                  padding: '12px', borderRadius: 3, cursor: 'pointer',
                  fontFamily: 'var(--display)', fontWeight: 800, fontSize: 17,
                  border: '1.5px solid ' + (form.examType === t ? (t === 'BEPC' ? 'var(--orange-d)' : 'var(--green-d)') : 'var(--line)'),
                  background: form.examType === t ? (t === 'BEPC' ? 'var(--orange)' : 'var(--green)') : 'transparent',
                  color: form.examType === t ? '#fff' : 'var(--ink-3)',
                  transition: 'all .15s ease',
                }}>{t}</button>
            ))}
          </div>
          <Field label="Établissement *">
            <TextInput value={form.etablissement} upper placeholder="EX: COLLÈGE MODERNE DE GAGNOA"
              onChange={(v) => setForm((f) => ({ ...f, etablissement: v }))} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            <Field label="Code">
              <TextInput value={form.code} upper placeholder="EX: 013077"
                onChange={(v) => setForm((f) => ({ ...f, code: v }))} />
            </Field>
            <Field label="Année scolaire">
              <SelectInput value={form.anneeScolaire}
                options={schoolYearOptions(form.anneeScolaire)}
                onChange={(v) => setForm((f) => ({ ...f, anneeScolaire: v }))} />
            </Field>
          </div>
          <Field label="DRENA">
            <TextInput value={form.drena} upper placeholder="EX: DRENA DE GAGNOA"
              onChange={(v) => setForm((f) => ({ ...f, drena: v }))} />
          </Field>
          <Field label="Session">
            <TextInput value={form.examSession} upper placeholder="EX: SESSION 2025"
              onChange={(v) => setForm((f) => ({ ...f, examSession: v }))} />
          </Field>
        </div>
      </Modal>

      <Modal open={!!deleteId} title="Supprimer la session ?" onClose={() => setDeleteId(null)}
        footer={
          <>
            <button className="btn" onClick={() => setDeleteId(null)}>Annuler</button>
            <button className="btn btn--accent" onClick={handleDelete}>Supprimer</button>
          </>
        }>
        <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--ink)' }}>{toDelete?.etablissement}</strong><br />
          Cette action est irréversible. Toutes les données seront effacées.
        </p>
      </Modal>
    </div>
  );
}

function SessionRow({ s, totals, index, onOpen, onReports, onDelete }: {
  s: Session;
  totals: ReturnType<typeof computeTotals>;
  index: number;
  onOpen: () => void;
  onReports: () => void;
  onDelete: () => void;
}) {
  const [hover, setHover] = useState(false);
  const presents = totals.presentsTotal || 1;
  const fillPct = Math.min(100, Math.round((totals.admisTotal / presents) * 100));
  const good = totals.tauxTotal >= 0.5;
  const tauxStr = pct(totals.tauxTotal).replace('%', '');
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="rise dash-row"
      style={{
        animationDelay: `calc(${0.05 + index * 0.05}s * var(--speed))`,
        borderBottom: '1px solid var(--line)',
        background: hover ? 'var(--paper-2)' : 'transparent',
        transition: 'background .18s ease',
        padding: '22px clamp(8px, 2vw, 18px)',
        marginInline: 'clamp(-8px, -2vw, -18px)',
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) auto',
        gap: 20,
        alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Tag kind={s.examType}>{s.examType}</Tag>
          {s.code && <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>N° {s.code}</span>}
        </div>
        <h2 className="display" style={{ fontSize: 'clamp(20px, 3vw, 28px)', margin: '8px 0 0', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.etablissement || 'Sans nom'}
        </h2>
        <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 7, letterSpacing: '0.03em' }}>
          {[s.drena, s.anneeScolaire, s.examSession].filter(Boolean).join(' · ')}
        </div>
        <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>
          {s.classes.length} classe{s.classes.length !== 1 ? 's' : ''} · {totals.admisTotal}/{totals.presentsTotal} admis
        </div>
      </div>

      <div className="dash-row-right" style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px, 3vw, 34px)' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, justifyContent: 'flex-end' }}>
            <span className="display tnum" style={{ fontSize: 'clamp(36px, 5.5vw, 56px)', color: good ? 'var(--green-d)' : 'var(--orange-d)', lineHeight: 1 }}>
              {tauxStr}
            </span>
            <span className="mono" style={{ fontSize: 14, color: good ? 'var(--green-d)' : 'var(--orange-d)' }}>%</span>
          </div>
          <div className="eyebrow" style={{ marginTop: 4 }}>taux d&apos;admission</div>
          <div style={{ height: 4, width: 100, background: 'var(--paper-3)', borderRadius: 3, marginTop: 8, marginLeft: 'auto', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: fillPct + '%', background: good ? 'var(--green)' : 'var(--orange)', borderRadius: 3, transition: 'width .8s ease' }} />
          </div>
        </div>

        <div
          className="row-actions"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
            opacity: hover ? 1 : 0,
            transform: hover ? 'translateX(0)' : 'translateX(8px)',
            transition: 'opacity .18s ease, transform .18s ease',
            pointerEvents: hover ? 'auto' : 'none',
          }}
        >
          <button className="btn btn--sm btn--solid" onClick={onOpen}>Modifier</button>
          <button className="btn btn--sm" onClick={onReports}>Rapports</button>
          <button className="btn btn--sm btn--danger" onClick={onDelete}>Suppr.</button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rise" style={{ textAlign: 'center', padding: '90px 0' }}>
      <div style={{ display: 'inline-flex', marginBottom: 18 }}><SealMark size={56} /></div>
      <p className="display" style={{ fontSize: 28, margin: 0 }}>Aucune session</p>
      <p className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>Créez votre premier relevé pour commencer.</p>
      <div style={{ marginTop: 22 }}><button className="btn btn--solid" onClick={onCreate}>+ Nouvelle session</button></div>
    </div>
  );
}
