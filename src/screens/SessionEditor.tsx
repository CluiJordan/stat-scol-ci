import React, { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import type { Session, ClassRow, Centre, Eleve } from '../types';
import { saveSession, getSession } from '../lib/storage';
import { importFromFile } from '../lib/importFile';
import { downloadTemplate, downloadElevesTemplate, exportElevesResultats } from '../lib/exportExcel';
import { computeRow, computeTotals, pct, applyElevesToClasses, admisThreshold } from '../lib/calculations';
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
  const [dragOver, setDragOver] = useState(false);
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
  const addCentre = () => { const c: Centre = { id: uuid(), name: `COLLÈGE ${session.centres.length + 1}` }; persist({ ...session, centres: [...session.centres, c] }); };
  const updateCentre = (id: string, name: string) => persist({ ...session, centres: session.centres.map((c) => c.id === id ? { ...c, name } : c) });
  const deleteCentre = (id: string) => persist({ ...session, centres: session.centres.filter((c) => c.id !== id), classes: session.classes.map((c) => c.centreId === id ? { ...c, centreId: null } : c) });
  const addClass = () => persist({ ...session, classes: [...session.classes, emptyRow()] });
  const updateClass = (id: string, field: keyof ClassRow, value: string | number | null) => persist({ ...session, classes: session.classes.map((c) => c.id === id ? { ...c, [field]: value } : c) });
  const deleteClass = (id: string) => persist({ ...session, classes: session.classes.filter((c) => c.id !== id) });

  const addEleve = useCallback((eleve: Omit<Eleve, 'id'>) => {
    const newEleve: Eleve = { ...eleve, id: uuid() };
    const newEleves = [...session.eleves, newEleve];
    const newClasses = applyElevesToClasses(session.classes, newEleves, session.examType);
    persist({ ...session, eleves: newEleves, classes: newClasses });
  }, [session, persist]);

  const updateEleve = useCallback((id: string, points: number | null) => {
    const newEleves = session.eleves.map((e) => e.id === id ? { ...e, points } : e);
    const newClasses = applyElevesToClasses(session.classes, newEleves, session.examType);
    persist({ ...session, eleves: newEleves, classes: newClasses });
  }, [session, persist]);

  const deleteEleve = useCallback((id: string) => {
    const newEleves = session.eleves.filter((e) => e.id !== id);
    const newClasses = applyElevesToClasses(session.classes, newEleves, session.examType);
    persist({ ...session, eleves: newEleves, classes: newClasses });
  }, [session, persist]);

  const updateEleveInfo = useCallback((id: string, updates: Partial<Omit<Eleve, 'id' | 'points'>>) => {
    const newEleves = session.eleves.map((e) => e.id === id ? { ...e, ...updates } : e);
    const newClasses = applyElevesToClasses(session.classes, newEleves, session.examType);
    persist({ ...session, eleves: newEleves, classes: newClasses });
  }, [session, persist]);

  const clearEleves = () => {
    if (!window.confirm(`Supprimer les ${session.eleves.length} élèves importés ? Les totaux retourneront à la saisie manuelle.`)) return;
    persist({ ...session, eleves: [] });
  };

  async function processFile(file: File) {
    const result = await importFromFile(file, session.examType);
    setImportErrors(result.errors);

    if (result.eleves.length > 0) {
      const existingMatricules = new Set(session.eleves.filter((e) => e.matricule).map((e) => e.matricule));
      const toAdd = result.eleves.filter((e) => !e.matricule || !existingMatricules.has(e.matricule));
      const knownClasses = new Set(session.classes.map((c) => c.name));
      const newClassNames = [...new Set(toAdd.map((e) => e.classe))].filter((n) => n && !knownClasses.has(n));
      const newClassRows: ClassRow[] = newClassNames.map((name) => ({
        id: uuid(), name, centreId: null,
        inscritsGarcon: 0, inscritsFille: 0, presentsTotal: 0,
        presentsGarcon: 0, presentsFille: 0, admisGarcon: 0, admisFille: 0,
      }));
      const allEleves = [...session.eleves, ...toAdd];
      const allClasses = applyElevesToClasses([...session.classes, ...newClassRows], allEleves, session.examType);
      persist({ ...session, eleves: allEleves, classes: allClasses });
      if (result.errors.length === 0) setShowImport(false);
    } else if (result.rows.length > 0) {
      persist({ ...session, classes: [...session.classes, ...result.rows] });
      if (result.errors.length === 0) setShowImport(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await processFile(file);
  }

  const isBac = session.examType === 'BAC';
  const hasEleves = session.eleves.length > 0;
  const totalErrors = hasEleves ? 0 : countErrors(session.classes, session.examType);
  const centreOptions = [{ value: '', label: '— Aucun collège —' }, ...session.centres.map((c) => ({ value: c.id, label: c.name }))];

  const steps = [
    { id: 'config' as Tab, n: '01', label: 'Configuration' },
    { id: 'classes' as Tab, n: '02', label: isBac ? 'Classes' : 'Classes & collèges' },
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
        <div className="shell scroll-x" style={{ display: 'flex', gap: 0, overflowY: 'hidden' }}>
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

        {/* ── 01 CONFIG ── */}
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

        {/* ── 02 CLASSES ── */}
        {tab === 'classes' && (
          <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 44, maxWidth: 800 }}>
            {!isBac && (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
                  <SectionHead n="02" title="Collèges" desc="Regroupez les classes par collège pour le rapport par établissement." />
                  <button className="btn btn--sm" onClick={addCentre}>+ Collège</button>
                </div>
                <div style={{ marginTop: 22 }}>
                  {session.centres.length === 0 && <Placeholder text="Aucun collège pour l'instant." />}
                  {session.centres.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', width: 26 }}>{String(i + 1).padStart(2, '0')}</span>
                      <input className="input input--up" style={{ flex: 1 }} value={c.name} onChange={(e) => updateCentre(c.id, e.target.value.toUpperCase())} />
                      <button className="btn btn--ghost btn--sm btn--danger" onClick={() => deleteCentre(c.id)}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <SectionHead n={isBac ? '02' : '·'} title="Classes" desc="Déclarez les classes manuellement ou importez un fichier élèves / statistiques." />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--sm" onClick={() => setShowImport(true)}>Importer</button>
                  <button className="btn btn--sm btn--solid" onClick={addClass}>+ Classe</button>
                </div>
              </div>

              {hasEleves && (
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--green-w)', border: '1px solid var(--green-d)', borderRadius: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                    <strong style={{ color: 'var(--green-d)' }}>{session.eleves.length} élèves importés</strong> — les stats sont calculées automatiquement depuis leurs points.
                  </span>
                  <button className="btn btn--ghost btn--sm btn--danger" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }} onClick={clearEleves}>Supprimer les élèves</button>
                </div>
              )}

              <div style={{ marginTop: 22 }}>
                {session.classes.length === 0 && <Placeholder text="Aucune classe. Ajoutez-en ou importez un fichier." />}
                {session.classes.map((cls, i) => {
                  const classEleves = session.eleves.filter((e) => e.classe === cls.name);
                  return (
                    <div key={cls.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', width: 26 }}>{String(i + 1).padStart(2, '0')}</span>
                      <input className="input input--up" style={{ flex: '1 1 160px', borderBottom: 'none' }} placeholder="EX: 3ÈME A" value={cls.name} onChange={(e) => updateClass(cls.id, 'name', e.target.value.toUpperCase())} />
                      {classEleves.length > 0 && (
                        <span className="mono" style={{ fontSize: 11, color: 'var(--green-d)', whiteSpace: 'nowrap' }}>{classEleves.length} élèves</span>
                      )}
                      {!isBac && (
                        <select className="select" style={{ flex: '0 1 200px' }} value={cls.centreId || ''} onChange={(e) => updateClass(cls.id, 'centreId', e.target.value || null)}>
                          {centreOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      )}
                      <button className="btn btn--ghost btn--sm btn--danger" onClick={() => deleteClass(cls.id)}>✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 03 SAISIE ── */}
        {tab === 'saisie' && (
          <div className="rise">
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
              <SectionHead n="03" title="Saisie des données"
                desc={hasEleves
                  ? `Entrez les points de chaque élève. Points ≥ ${admisThreshold(session.examType)} = Admis · Points = 0 = Absent.`
                  : 'Les colonnes grisées sont calculées en direct. Les valeurs impossibles sont signalées en orange.'
                }
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--sm" onClick={() => setShowImport(true)}>Importer</button>
                {hasEleves && (
                  <>
                    <button className="btn btn--sm" onClick={() => exportElevesResultats(session)}>↓ Résultats Excel</button>
                    <button className="btn btn--sm btn--danger" onClick={clearEleves}>Effacer élèves</button>
                  </>
                )}
              </div>
            </div>

            {/* Error banner — manual mode only */}
            {!hasEleves && totalErrors > 0 && (
              <div style={{ display: 'flex', gap: 12, padding: '14px 16px', border: '1px solid var(--orange-d)', background: 'var(--orange-w)', borderRadius: 4, marginBottom: 16 }}>
                <span style={{ color: 'var(--orange-d)', fontSize: 18, lineHeight: 1 }}>▲</span>
                <div>
                  <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange-d)', letterSpacing: '0.04em' }}>{totalErrors} VALEUR{totalErrors > 1 ? 'S' : ''} INCOHÉRENTE{totalErrors > 1 ? 'S' : ''}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 3 }}>Les cellules en orange sont impossibles. Les taux restent plafonnés à 100 %.</div>
                </div>
              </div>
            )}

            {/* Content */}
            {session.classes.length === 0 && !hasEleves ? (
              <div style={{ textAlign: 'center', padding: '70px 0' }}>
                <p className="display" style={{ fontSize: 24, margin: 0 }}>Rien à saisir</p>
                <p className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>Ajoutez d'abord des classes ou importez un fichier élèves.</p>
                <div style={{ marginTop: 20 }}><button className="btn btn--solid" onClick={() => setTab('classes')}>← Aller aux classes</button></div>
              </div>
            ) : hasEleves ? (
              <EleveSaisie session={session} addEleve={addEleve} updateEleve={updateEleve} deleteEleve={deleteEleve} updateEleveInfo={updateEleveInfo} />
            ) : (
              <SaisieTable session={session} isBac={isBac} updateClass={updateClass} />
            )}
          </div>
        )}
      </div>

      {/* Import modal */}
      <Modal open={showImport} title="Importer des données" onClose={() => { setShowImport(false); setImportErrors([]); }}
        footer={<button className="btn" onClick={() => { setShowImport(false); setImportErrors([]); }}>Fermer</button>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.6 }}>
            Importez un fichier Excel (.xlsx) ou CSV — l'app détecte automatiquement s'il s'agit d'une liste d'élèves ou de statistiques par classe.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '14px', border: '1px solid var(--green-d)', borderRadius: 4, background: 'var(--green-w)' }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--green-d)', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Liste élèves</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 10, lineHeight: 1.5 }}>Colonnes&nbsp;: Matricule · Nom · Prenoms · Genre (M/F) · Classe</div>
              <button className="btn btn--ghost btn--sm" onClick={downloadElevesTemplate}>↓ Modèle élèves</button>
            </div>
            <div style={{ padding: '14px', border: '1px solid var(--line)', borderRadius: 4 }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Stats par classe</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 10, lineHeight: 1.5 }}>Colonnes&nbsp;: Classe · Inscrits · Présents · Admis… (format {session.examType})</div>
              <button className="btn btn--ghost btn--sm" onClick={() => downloadTemplate(session.examType)}>↓ Modèle {session.examType}</button>
            </div>
          </div>

          <label
            style={{ border: `1.5px dashed ${dragOver ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 4, padding: '34px 18px', textAlign: 'center', cursor: 'pointer', display: 'block', background: dragOver ? 'var(--paper-2)' : 'transparent', transition: 'border-color .15s, background .15s' }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) processFile(file); }}
          >
            <div className="mono" style={{ fontSize: 12, color: dragOver ? 'var(--ink)' : 'var(--ink-3)' }}>
              {dragOver ? 'Relâchez pour importer' : 'Cliquez ou glissez un fichier ici'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>(.xlsx, .xls, .csv)</div>
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

/* ─────────────────────────── Student list saisie ─────────────────────────── */

function EleveSaisie({ session, addEleve, updateEleve, deleteEleve, updateEleveInfo }: {
  session: Session;
  addEleve: (eleve: Omit<Eleve, 'id'>) => void;
  updateEleve: (id: string, points: number | null) => void;
  deleteEleve: (id: string) => void;
  updateEleveInfo: (id: string, updates: Partial<Omit<Eleve, 'id' | 'points'>>) => void;
}) {
  const [search, setSearch] = useState('');
  const [editingEleve, setEditingEleve] = useState<Eleve | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const { classes, eleves } = session;

  const q = search.toLowerCase().trim();

  const groups = classes
    .map((cls) => {
      const all = eleves.filter((e) => e.classe === cls.name).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      const rows = q ? all.filter((e) =>
        e.nom.toLowerCase().includes(q) ||
        e.prenoms.toLowerCase().includes(q) ||
        e.matricule.toLowerCase().includes(q)
      ) : all;
      return { cls, rows, total: all.length };
    })
    .filter((g) => g.rows.length > 0);

  const matchedClasses = new Set(classes.map((c) => c.name));
  const unmatchedAll = eleves.filter((e) => !matchedClasses.has(e.classe));
  const unmatched = q ? unmatchedAll.filter((e) =>
    e.nom.toLowerCase().includes(q) ||
    e.prenoms.toLowerCase().includes(q) ||
    e.matricule.toLowerCase().includes(q)
  ) : unmatchedAll;

  const totalMatches = groups.reduce((s, g) => s + g.rows.length, 0) + unmatched.length;

  if (groups.length === 0 && unmatched.length === 0 && !q) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <p className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>Aucun élève correspondant aux classes déclarées. Vérifiez les noms de classe.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Search bar + add button */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            className="input"
            placeholder="Rechercher par nom, prénoms ou matricule…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: 36 }}
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', fontSize: 14, pointerEvents: 'none' }}>⌕</span>
          {q && (
            <span className="mono" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--ink-3)' }}>
              {totalMatches} résultat{totalMatches !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button className="btn btn--sm btn--solid" style={{ whiteSpace: 'nowrap' }} onClick={() => setShowAdd(true)}>+ Ajouter un élève</button>
      </div>

      {groups.map(({ cls, rows, total }) => {
        const entered = rows.filter((e) => e.points !== null).length;
        const present = rows.filter((e) => e.points !== null && e.points > 0).length;
        const threshold = admisThreshold(session.examType);
        const admis = rows.filter((e) => e.points !== null && e.points >= threshold).length;
        const progress = total > 0 ? Math.round((eleves.filter((e) => e.classe === cls.name && e.points !== null).length / total) * 100) : 0;
        return (
          <div key={cls.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '10px 0', borderBottom: '2px solid var(--ink)' }}>
              <span className="display" style={{ fontSize: 16, fontWeight: 700 }}>{cls.name}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{q ? `${rows.length}/${total}` : `${total} inscrits`}</span>
              {entered > 0 && (
                <>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>· {present} présents</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--green-d)', fontWeight: 700 }}>· {admis} admis</span>
                </>
              )}
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 'auto' }}>{progress}% saisi</span>
            </div>
            <div className="scroll-x" style={{ border: '1px solid var(--line)', borderTop: 'none', borderRadius: '0 0 3px 3px' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 540 }}>
                <thead>
                  <tr style={{ background: 'var(--ink)' }}>
                    <th style={eleveThStyle(40, true)}>G/F</th>
                    <th style={eleveThStyle(120, true)}>Matricule</th>
                    <th style={{ ...eleveThStyle(undefined, true), textAlign: 'left', padding: '9px 12px', color: '#fff' }}>Nom &amp; Prénoms</th>
                    <th style={eleveThStyle(90, false)}>Points</th>
                    <th style={eleveThStyle(85, true)}>Statut</th>
                    <th style={{ ...eleveThStyle(72, true), borderRight: 'none' }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((eleve, i) => (
                    <EleveRow key={eleve.id} eleve={eleve} index={i} examType={session.examType} onCommit={updateEleve} onDelete={deleteEleve} onEdit={setEditingEleve} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {unmatched.length > 0 && (
        <div>
          <div style={{ padding: '8px 0', borderBottom: '2px solid var(--orange-d)' }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--orange-d)' }}>⚠ {unmatched.length} élève(s) sans classe correspondante dans cette session</span>
          </div>
          <div className="scroll-x" style={{ border: '1px solid var(--orange-d)', borderRadius: '0 0 3px 3px', borderTop: 'none' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 420, fontSize: 13 }}>
              <tbody>
                {unmatched.map((eleve, i) => (
                  <tr key={eleve.id} style={{ background: i % 2 ? 'var(--orange-w)' : 'var(--card)', borderBottom: '1px solid var(--line-2)' }}>
                    <td style={{ width: 40, textAlign: 'center', height: 38 }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: eleve.genre === 'M' ? 'var(--gar)' : 'var(--fil)' }} />
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', padding: '0 8px', width: 110 }}>{eleve.matricule || '—'}</td>
                    <td style={{ padding: '0 12px', fontWeight: 600 }}>{eleve.nom} <span style={{ fontWeight: 400, color: 'var(--ink-2)' }}>{eleve.prenoms}</span></td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--orange-d)', padding: '0 8px', whiteSpace: 'nowrap' }}>{eleve.classe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingEleve && (
        <EditEleveModal
          eleve={editingEleve}
          classes={session.classes.map((c) => c.name)}
          onSave={(updates) => { updateEleveInfo(editingEleve.id, updates); setEditingEleve(null); }}
          onClose={() => setEditingEleve(null)}
        />
      )}

      {/* Add modal */}
      {showAdd && (
        <AddEleveModal
          classes={session.classes.map((c) => c.name)}
          onSave={(eleve) => { addEleve(eleve); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function eleveThStyle(w: number | undefined, dim: boolean): React.CSSProperties {
  return {
    width: w, padding: '9px 10px',
    color: dim ? 'rgba(255,255,255,0.55)' : '#fff',
    fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em',
    textTransform: 'uppercase', fontWeight: 400, textAlign: 'center',
    borderRight: '1px solid rgba(255,255,255,0.1)',
  };
}

function EleveRow({ eleve, index, examType, onCommit, onDelete, onEdit }: {
  eleve: Eleve;
  index: number;
  examType: import('../types').ExamType;
  onCommit: (id: string, points: number | null) => void;
  onDelete: (id: string) => void;
  onEdit: (eleve: Eleve) => void;
}) {
  const [raw, setRaw] = useState(() => eleve.points === null ? '' : String(eleve.points));

  useEffect(() => {
    setRaw(eleve.points === null ? '' : String(eleve.points));
  }, [eleve.points]);

  const threshold = admisThreshold(examType);
  const pts = raw === '' ? null : parseInt(raw, 10);
  const isAdmis = pts !== null && !isNaN(pts) && pts >= threshold;
  const isAbsent = pts === 0;
  const isAjoure = pts !== null && !isNaN(pts) && pts > 0 && pts < threshold;

  const commit = () => {
    const p = raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0);
    onCommit(eleve.id, p);
  };

  const cell: React.CSSProperties = { borderRight: '1px solid var(--line-2)', borderBottom: '1px solid var(--line-2)' };

  return (
    <tr style={{ background: index % 2 ? 'var(--paper-2)' : 'var(--card)' }}>
      <td style={{ ...cell, width: 40, textAlign: 'center', height: 40 }}>
        <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: eleve.genre === 'M' ? 'var(--gar)' : 'var(--fil)' }} title={eleve.genre === 'M' ? 'Garçon' : 'Fille'} />
      </td>
      <td style={{ ...cell, width: 120, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', padding: '0 8px', whiteSpace: 'nowrap' }}>
        {eleve.matricule || '—'}
      </td>
      <td style={{ ...cell, padding: '0 12px', fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>{eleve.nom}</span>
        {eleve.prenoms && <span style={{ fontWeight: 400, color: 'var(--ink-2)', fontSize: 12 }}> {eleve.prenoms}</span>}
      </td>
      <td style={{ ...cell, width: 90, padding: 0 }}>
        <input
          type="number" min={0} max={400}
          value={raw} placeholder="—"
          data-points-input
          onChange={(e) => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit();
              const all = Array.from(document.querySelectorAll<HTMLInputElement>('[data-points-input]'));
              const next = all[all.indexOf(e.target as HTMLInputElement) + 1];
              if (next) next.focus(); else (e.target as HTMLInputElement).blur();
            }
          }}
          style={{
            width: '100%', height: 40, textAlign: 'center', border: 'none',
            background: isAdmis ? 'var(--green-w)' : isAbsent ? 'var(--paper-3)' : 'transparent',
            fontFamily: 'var(--mono)', fontSize: 13,
            fontWeight: isAdmis ? 700 : 400,
            color: isAdmis ? 'var(--green-d)' : 'var(--ink)',
            outline: 'none',
            boxShadow: isAdmis ? 'inset 0 0 0 1.5px var(--green-d)' : 'none',
          }}
        />
      </td>
      <td style={{ ...cell, width: 85, textAlign: 'center' }}>
        {isAdmis && <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--green-d)' }}>{eleve.genre === 'F' ? 'ADMISE' : 'ADMIS'}</span>}
        {isAbsent && <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{eleve.genre === 'F' ? 'ABSENTE' : 'ABSENT'}</span>}
        {isAjoure && <span className="mono" style={{ fontSize: 10, color: 'var(--orange-d)' }}>{eleve.genre === 'F' ? 'REFUSÉE' : 'REFUSÉ'}</span>}
      </td>
      <td style={{ borderBottom: '1px solid var(--line-2)', width: 72, textAlign: 'center' }}>
        <button onClick={() => onEdit(eleve)} title="Modifier"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13, padding: '0 5px' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-3)')}>
          ✎
        </button>
        <button onClick={() => onDelete(eleve.id)} title="Retirer cet élève"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 14, padding: '0 5px' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--orange-d)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-3)')}>
          ✕
        </button>
      </td>
    </tr>
  );
}

/* ───────────────────────── Edit eleve modal ───────────────────────── */

function EditEleveModal({ eleve, classes, onSave, onClose }: {
  eleve: Eleve;
  classes: string[];
  onSave: (updates: Partial<Omit<Eleve, 'id' | 'points'>>) => void;
  onClose: () => void;
}) {
  const [nom, setNom] = useState(eleve.nom);
  const [prenoms, setPrenoms] = useState(eleve.prenoms);
  const [matricule, setMatricule] = useState(eleve.matricule);
  const [genre, setGenre] = useState<'M' | 'F'>(eleve.genre);
  const [classe, setClasse] = useState(eleve.classe);

  const save = () => onSave({ nom: nom.trim().toUpperCase(), prenoms: prenoms.trim(), matricule: matricule.trim(), genre, classe: classe.trim().toUpperCase() });

  return (
    <Modal open title="Modifier l'élève" onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn--accent" onClick={save}>Enregistrer</button>
        </>
      }>
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Nom"><TextInput value={nom} upper onChange={setNom} /></Field>
          <Field label="Prénoms"><TextInput value={prenoms} onChange={setPrenoms} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Field label="Matricule"><TextInput value={matricule} onChange={setMatricule} /></Field>
          <Field label="Genre">
            <SelectInput value={genre} options={[{ value: 'M', label: 'Garçon (M)' }, { value: 'F', label: 'Fille (F)' }]} onChange={(v) => setGenre(v as 'M' | 'F')} />
          </Field>
          <Field label="Classe">
            <SelectInput value={classe} options={[...classes.map((c) => ({ value: c, label: c })), ...(classes.includes(classe) ? [] : [{ value: classe, label: classe }])]} onChange={setClasse} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Add eleve modal ───────────────────────── */

function AddEleveModal({ classes, onSave, onClose }: {
  classes: string[];
  onSave: (eleve: Omit<Eleve, 'id'>) => void;
  onClose: () => void;
}) {
  const [nom, setNom] = useState('');
  const [prenoms, setPrenoms] = useState('');
  const [matricule, setMatricule] = useState('');
  const [genre, setGenre] = useState<'M' | 'F'>('M');
  const [classe, setClasse] = useState(classes[0] ?? '');
  const [points, setPoints] = useState('');

  const save = () => {
    const trimmedNom = nom.trim().toUpperCase();
    if (!trimmedNom) return;
    onSave({
      nom: trimmedNom,
      prenoms: prenoms.trim(),
      matricule: matricule.trim(),
      genre,
      classe: classe.trim().toUpperCase(),
      points: points === '' ? null : Math.max(0, parseInt(points, 10) || 0),
    });
  };

  return (
    <Modal open title="Ajouter un élève" onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn--accent" onClick={save} disabled={!nom.trim()}>Ajouter</button>
        </>
      }>
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Nom *"><TextInput value={nom} upper onChange={setNom} /></Field>
          <Field label="Prénoms"><TextInput value={prenoms} onChange={setPrenoms} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Field label="Matricule"><TextInput value={matricule} onChange={setMatricule} /></Field>
          <Field label="Genre">
            <SelectInput value={genre} options={[{ value: 'M', label: 'Garçon (M)' }, { value: 'F', label: 'Fille (F)' }]} onChange={(v) => setGenre(v as 'M' | 'F')} />
          </Field>
          <Field label="Classe">
            <SelectInput value={classe} options={classes.map((c) => ({ value: c, label: c }))} onChange={setClasse} />
          </Field>
        </div>
        <Field label="Points (optionnel)">
          <TextInput value={points} onChange={setPoints} placeholder="Laisser vide si inconnu" />
        </Field>
      </div>
    </Modal>
  );
}

/* ──────────────── Manual class-level entry table (no eleves) ──────────────── */

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

/* ──────────────────────────── Shared table cells ──────────────────────────── */

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
