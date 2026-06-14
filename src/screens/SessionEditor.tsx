import React, { useState, useCallback, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import type { Session, ClassRow, Centre } from '../types';
import { saveSession, getSession } from '../lib/storage';
import { importFromFile } from '../lib/importFile';
import { downloadTemplate } from '../lib/exportExcel';
import { computeRow, computeTotals, pct } from '../lib/calculations';
import { validateRow, countErrors } from '../lib/validation';
import { Masthead, Modal, Field, TextInput, SelectInput, SectionHead, Placeholder } from '../components/ui/design';

interface Props {
  sessionId: string;
  onBack: () => void;
  onReports: () => void;
}

type Tab = 'config' | 'classes' | 'saisie';

function emptyRow(): ClassRow {
  return { id: uuid(), name: '', centreId: null, inscritsGarcon: 0, inscritsFille: 0, presentsTotal: 0, presentsGarcon: 0, presentsFille: 0, admisGarcon: 0, admisFille: 0 };
}

function schoolYearOptions(current: string): string[] {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const currentStart = month >= 9 ? year : year - 1;
  const years = Array.from({ length: 6 }, (_, i) => {
    const start = currentStart - (5 - i);
    return `${start} - ${start + 1}`;
  });
  if (!years.includes(current)) years.unshift(current);
  return years;
}

export default function SessionEditor({ sessionId, onBack, onReports }: Props) {
  const [session, setSession] = useState<Session>(() => getSession(sessionId)!);
  const [tab, setTab] = useState<Tab>('config');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const persist = useCallback((s: Session) => {
    setSession(s);
    saveSession(s);
    setSaved(true);
    clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 1400);
  }, []);

  const setField = (k: keyof Session, v: string) => persist({ ...session, [k]: v });
  const addCentre = () => { const c: Centre = { id: uuid(), name: `CENTRE ${session.centres.length + 1}` }; persist({ ...session, centres: [...session.centres, c] }); };
  const updateCentre = (id: string, name: string) => persist({ ...session, centres: session.centres.map((c) => c.id === id ? { ...c, name } : c) });
  const deleteCentre = (id: string) => persist({ ...session, centres: session.centres.filter((c) => c.id !== id), classes: session.classes.map((c) => c.centreId === id ? { ...c, centreId: null } : c) });
  const addClass = () => persist({ ...session, classes: [...session.classes, emptyRow()] });
  const updateClass = (id: string, field: keyof ClassRow, value: string | number | null) => persist({ ...session, classes: session.classes.map((c) => c.id === id ? { ...c, [field]: value } : c) });
  const deleteClass = (id: string) => persist({ ...session, classes: session.classes.filter((c) => c.id !== id) });

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { rows, errors } = await importFromFile(file, session.examType);
    setImportErrors(errors);
    if (rows.length > 0) { persist({ ...session, classes: [...session.classes, ...rows] }); setShowImport(false); }
  }

  const isBac = session.examType === 'BAC';
  const totalErrors = countErrors(session.classes, session.examType);
  const centreOptions = [{ value: '', label: '— Aucun centre —' }, ...session.centres.map((c) => ({ value: c.id, label: c.name }))];

  const steps = [
    { id: 'config' as Tab, n: '01', label: 'Configuration' },
    { id: 'classes' as Tab, n: '02', label: isBac ? 'Classes' : 'Classes & centres' },
    { id: 'saisie' as Tab, n: '03', label: 'Saisie', badge: totalErrors },
  ];

  return (
    <div className="screen-enter" style={{ minHeight: '100vh' }}>
      <Masthead
        back={onBack}
        title={session.etablissement || 'Session sans nom'}
        sub={`${session.examType} · ${session.anneeScolaire}${session.examSession ? ' · ' + session.examSession : ''}`}
        right={
          <>
            <span className="mono" style={{ fontSize: 11, color: 'var(--green-d)', opacity: saved ? 1 : 0, transition: 'opacity .3s', minWidth: 78, textAlign: 'right' }}>
              {saved ? '✓ enregistré' : ''}
            </span>
            <button className="btn btn--accent btn--sm" onClick={onReports}>Voir les rapports →</button>
          </>
        }
      />

      {/* Stepper */}
      <div style={{ borderBottom: '1px solid var(--line)', background: 'var(--paper)', position: 'sticky', top: 64, zIndex: 90 }}>
        <div className="shell scroll-x" style={{ display: 'flex', gap: 0 }}>
          {steps.map((st) => {
            const active = tab === st.id;
            return (
              <button key={st.id} onClick={() => setTab(st.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '16px 22px 14px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  borderBottom: '2px solid ' + (active ? 'var(--ink)' : 'transparent'),
                  marginBottom: -1, whiteSpace: 'nowrap',
                }}>
                <span className="display tnum" style={{ fontSize: 20, color: active ? 'var(--ink)' : 'var(--ink-3)' }}>{st.n}</span>
                <span className="mono" style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: active ? 'var(--ink)' : 'var(--ink-3)' }}>{st.label}</span>
                {(st.badge ?? 0) > 0 && (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--orange-d)', borderRadius: 20, minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                    {st.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="shell" style={{ paddingTop: 30, paddingBottom: 90 }}>
        {tab === 'config' && (
          <div className="rise" style={{ maxWidth: 680 }}>
            <SectionHead n="01" title="Informations générales" desc="Identité officielle du relevé, reprise sur les exports PDF et Excel." />
            <div style={{ display: 'grid', gap: 22, marginTop: 28 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 22 }}>
                <Field label="Type d'examen"><TextInput value={session.examType} disabled /></Field>
                <Field label="Année scolaire"><SelectInput value={session.anneeScolaire} options={schoolYearOptions(session.anneeScolaire)} onChange={(v) => setField('anneeScolaire', v)} /></Field>
              </div>
              <Field label="Établissement"><TextInput value={session.etablissement} upper onChange={(v) => setField('etablissement', v)} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 22 }}>
                <Field label="Code établissement"><TextInput value={session.code} upper onChange={(v) => setField('code', v)} /></Field>
                <Field label="DRENA"><TextInput value={session.drena} upper onChange={(v) => setField('drena', v)} /></Field>
              </div>
              <Field label="Ministère"><TextInput value={session.ministere} upper onChange={(v) => setField('ministere', v)} /></Field>
              <Field label="Session"><TextInput value={session.examSession} upper placeholder="EX: SESSION 2025" onChange={(v) => setField('examSession', v)} /></Field>
            </div>
          </div>
        )}

        {tab === 'classes' && (
          <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 44, maxWidth: 800 }}>
            {!isBac && (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
                  <SectionHead n="02" title="Centres d'examen" desc="Regroupez les classes par centre pour le rapport par établissement." />
                  <button className="btn btn--sm" onClick={addCentre}>+ Centre</button>
                </div>
                <div style={{ marginTop: 22 }}>
                  {session.centres.length === 0 && <Placeholder text="Aucun centre pour l'instant." />}
                  {session.centres.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', width: 26 }}>{String(i + 1).padStart(2, '0')}</span>
                      <input className="input" style={{ flex: 1, borderBottom: 'none' }} value={c.name} onChange={(e) => updateCentre(c.id, e.target.value.toUpperCase())} />
                      <button className="btn btn--ghost btn--sm btn--danger" onClick={() => deleteCentre(c.id)}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <SectionHead n={isBac ? '02' : '·'} title="Classes" desc="Déclarez les classes ; saisissez les chiffres à l'étape suivante." />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--sm" onClick={() => setShowImport(true)}>Importer</button>
                  <button className="btn btn--sm btn--solid" onClick={addClass}>+ Classe</button>
                </div>
              </div>
              <div style={{ marginTop: 22 }}>
                {session.classes.length === 0 && <Placeholder text="Aucune classe. Ajoutez-en ou importez un fichier." />}
                {session.classes.map((cls, i) => (
                  <div key={cls.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', width: 26 }}>{String(i + 1).padStart(2, '0')}</span>
                    <input className="input input--up" style={{ flex: '1 1 160px', borderBottom: 'none' }} placeholder="EX: 3ÈME A" value={cls.name} onChange={(e) => updateClass(cls.id, 'name', e.target.value.toUpperCase())} />
                    {!isBac && (
                      <select className="select" style={{ flex: '0 1 200px' }} value={cls.centreId || ''} onChange={(e) => updateClass(cls.id, 'centreId', e.target.value || null)}>
                        {centreOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    )}
                    <button className="btn btn--ghost btn--sm btn--danger" onClick={() => deleteClass(cls.id)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'saisie' && (
          <div className="rise">
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
              <SectionHead n="03" title="Saisie des données" desc="Les colonnes grisées sont calculées en direct. Les valeurs impossibles sont signalées en orange." />
              <button className="btn btn--sm" onClick={() => setShowImport(true)}>Importer</button>
            </div>

            {totalErrors > 0 && (
              <div style={{ display: 'flex', gap: 12, padding: '14px 16px', border: '1px solid var(--orange-d)', background: 'var(--orange-w)', borderRadius: 4, marginBottom: 16 }}>
                <span style={{ color: 'var(--orange-d)', fontSize: 18, lineHeight: 1 }}>▲</span>
                <div>
                  <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange-d)', letterSpacing: '0.04em' }}>{totalErrors} VALEUR{totalErrors > 1 ? 'S' : ''} INCOHÉRENTE{totalErrors > 1 ? 'S' : ''}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 3 }}>Les cellules en orange sont impossibles (admis &gt; présents, présents &gt; inscrits…). Les taux restent plafonnés à 100 %.</div>
                </div>
              </div>
            )}

            {session.classes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '70px 0' }}>
                <p className="display" style={{ fontSize: 24, margin: 0 }}>Rien à saisir</p>
                <p className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>Ajoutez d'abord des classes.</p>
                <div style={{ marginTop: 20 }}><button className="btn btn--solid" onClick={() => setTab('classes')}>← Aller aux classes</button></div>
              </div>
            ) : (
              <SaisieTable session={session} isBac={isBac} updateClass={updateClass} />
            )}
          </div>
        )}
      </div>

      <Modal open={showImport} title="Importer des données" onClose={() => { setShowImport(false); setImportErrors([]); }}
        footer={<button className="btn" onClick={() => { setShowImport(false); setImportErrors([]); }}>Fermer</button>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.6 }}>Importez un fichier Excel (.xlsx) ou CSV. Les colonnes doivent suivre le modèle {session.examType}.</p>
          <button className="btn btn--ghost btn--sm" onClick={() => downloadTemplate(session.examType)}>↓ Télécharger le modèle {session.examType}</button>
          <label style={{ border: '1.5px dashed var(--line)', borderRadius: 4, padding: '34px 18px', textAlign: 'center', cursor: 'pointer', display: 'block' }}>
            <div className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>Cliquez ou glissez un fichier ici</div>
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
          </label>
          {importErrors.length > 0 && (
            <div style={{ border: '1px solid var(--orange-d)', borderRadius: 4, padding: '10px 14px', background: 'var(--orange-w)' }}>
              {importErrors.map((e, i) => <p key={i} className="mono" style={{ margin: i === 0 ? 0 : '4px 0 0', fontSize: 11, color: 'var(--orange-d)' }}>{e}</p>)}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function SaisieTable({ session, isBac, updateClass }: {
  session: Session;
  isBac: boolean;
  updateClass: (id: string, field: keyof ClassRow, value: string | number | null) => void;
}) {
  const computedRows = session.classes.map((c) => computeRow(c, session.examType));
  const totals = computeTotals(computedRows, session.examType);

  return (
    <div className="scroll-x" style={{ border: '1px solid var(--line)', borderRadius: 4 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, minWidth: isBac ? 1080 : 860 }}>
        <thead>
          <tr style={{ background: 'var(--ink)' }}>
            <ThG sticky>Classe</ThG>
            <ThG c="gar">Inscr. G</ThG>
            <ThG c="fil">Inscr. F</ThG>
            {isBac ? (
              <><ThG c="gar">Prés. G</ThG><ThG c="fil">Prés. F</ThG></>
            ) : (
              <ThG c="acc">Présents</ThG>
            )}
            <ThG c="gar">Admis G</ThG>
            <ThG c="fil">Admis F</ThG>
            <ThG calc>Tot. inscrits</ThG>
            {isBac && <ThG calc>Absents</ThG>}
            <ThG calc>Admis</ThG>
            <ThG calc>Taux</ThG>
          </tr>
        </thead>
        <tbody>
          {session.classes.map((cls, i) => {
            const cp = computedRows[i];
            const errs = validateRow(cls, session.examType);
            return (
              <tr key={cls.id} style={{ background: i % 2 ? 'var(--paper-2)' : 'var(--card)' }}>
                <td style={{ position: 'sticky', left: 0, zIndex: 2, background: 'inherit', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '0 12px', height: 40, fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
                  {cls.name || '—'}
                </td>
                <NumCell value={cls.inscritsGarcon} onChange={(v) => updateClass(cls.id, 'inscritsGarcon', v)} err={errs.inscritsGarcon} />
                <NumCell value={cls.inscritsFille} onChange={(v) => updateClass(cls.id, 'inscritsFille', v)} err={errs.inscritsFille} />
                {isBac ? (
                  <><NumCell value={cls.presentsGarcon} onChange={(v) => updateClass(cls.id, 'presentsGarcon', v)} err={errs.presentsGarcon} />
                  <NumCell value={cls.presentsFille} onChange={(v) => updateClass(cls.id, 'presentsFille', v)} err={errs.presentsFille} /></>
                ) : (
                  <NumCell value={cls.presentsTotal} onChange={(v) => updateClass(cls.id, 'presentsTotal', v)} err={errs.presentsTotal} />
                )}
                <NumCell value={cls.admisGarcon} onChange={(v) => updateClass(cls.id, 'admisGarcon', v)} err={errs.admisGarcon} />
                <NumCell value={cls.admisFille} onChange={(v) => updateClass(cls.id, 'admisFille', v)} err={errs.admisFille} />
                <CalcCell>{cp.inscritsTotal}</CalcCell>
                {isBac && <CalcCell>{cp.absents}</CalcCell>}
                <CalcCell strong>{cp.admisTotal}</CalcCell>
                <CalcCell strong>{pct(cp.tauxTotal)}</CalcCell>
              </tr>
            );
          })}
          <tr style={{ background: 'var(--paper-3)' }}>
            <td style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--paper-3)', borderRight: '1px solid var(--line)', padding: '0 12px', height: 42, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', fontWeight: 700 }}>TOTAL</td>
            <TotCell>{totals.inscritsGarcon}</TotCell>
            <TotCell>{totals.inscritsFille}</TotCell>
            {isBac ? (<><TotCell>{totals.presentsGarcon}</TotCell><TotCell>{totals.presentsFille}</TotCell></>) : (<TotCell>{totals.presentsTotal}</TotCell>)}
            <TotCell>{totals.admisGarcon}</TotCell>
            <TotCell>{totals.admisFille}</TotCell>
            <TotCell>{totals.inscritsTotal}</TotCell>
            {isBac && <TotCell>{totals.absents}</TotCell>}
            <TotCell strong>{totals.admisTotal}</TotCell>
            <TotCell strong>{pct(totals.tauxTotal)}</TotCell>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ThG({ children, sticky, c, calc }: { children: React.ReactNode; sticky?: boolean; c?: string; calc?: boolean }) {
  const color = c === 'gar' ? 'var(--green-w)' : c === 'fil' ? 'var(--orange-w)' : c === 'acc' ? 'var(--orange-w)' : calc ? 'rgba(255,255,255,0.55)' : '#fff';
  return (
    <th style={{ position: sticky ? 'sticky' : 'static', left: sticky ? 0 : 'auto', zIndex: sticky ? 3 : 1, background: 'var(--ink)', color, padding: '11px 10px', textAlign: sticky ? 'left' : 'center', fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 400, whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
      {children}
    </th>
  );
}

function NumCell({ value, onChange, err }: { value: number; onChange: (v: number) => void; err?: string }) {
  return (
    <td title={err || ''} style={{ padding: 0, height: 40, borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
      <input type="number" min={0} value={value === 0 ? '' : value} placeholder="0"
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        style={{ width: '100%', height: '100%', minWidth: 60, textAlign: 'center', border: 'none', background: err ? 'var(--orange-w)' : 'transparent', fontFamily: 'var(--mono)', fontSize: 13, color: err ? 'var(--orange-d)' : 'var(--ink)', fontWeight: err ? 700 : 400, outline: 'none', boxShadow: err ? 'inset 0 0 0 1.5px var(--orange-d)' : 'none' }}
        onFocus={(e) => { if (!err) e.target.style.background = 'var(--paper-2)'; }}
        onBlur={(e) => { if (!err) e.target.style.background = 'transparent'; }}
      />
    </td>
  );
}

function CalcCell({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <td style={{ height: 40, textAlign: 'center', background: 'var(--paper-2)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: strong ? 700 : 400, color: strong ? 'var(--ink)' : 'var(--ink-2)', whiteSpace: 'nowrap', padding: '0 8px' }}>{children}</td>;
}

function TotCell({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <td style={{ height: 42, textAlign: 'center', borderRight: '1px solid var(--line)', fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 700, color: strong ? 'var(--ink)' : 'var(--ink-2)', whiteSpace: 'nowrap', padding: '0 8px' }}>{children}</td>;
}
