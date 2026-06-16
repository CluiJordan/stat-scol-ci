import React, { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import type { Session, ClassRow, Centre, Eleve } from '../types';
import { saveSession, getSession } from '../lib/storage';
import { importFromFile } from '../lib/importFile';
import { downloadTemplate, downloadElevesTemplate, exportElevesResultats } from '../lib/exportExcel';
import { computeRow, computeTotals, pct, applyElevesToClasses, admisThreshold, maxPoints } from '../lib/calculations';
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
  const [pendingDeleteCentreId, setPendingDeleteCentreId] = useState<string | null>(null);
  const [pendingDeleteClassId, setPendingDeleteClassId] = useState<string | null>(null);
  const [showClearEleves, setShowClearEleves] = useState(false);
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
  const setSaisieMode = (mode: Session['saisieMode']) => persist({ ...session, saisieMode: mode });
  const addCentre = () => { const c: Centre = { id: uuid(), name: `COLLÈGE ${session.centres.length + 1}` }; persist({ ...session, centres: [...session.centres, c] }); };
  const updateCentre = (id: string, name: string) => persist({ ...session, centres: session.centres.map((c) => c.id === id ? { ...c, name } : c) });
  const deleteCentre = (id: string) => persist({ ...session, centres: session.centres.filter((c) => c.id !== id), classes: session.classes.map((c) => c.centreId === id ? { ...c, centreId: null } : c) });
  const addClass = () => persist({ ...session, classes: [...session.classes, emptyRow()] });
  const updateClass = (id: string, field: keyof ClassRow, value: string | number | null) => persist({ ...session, classes: session.classes.map((c) => c.id === id ? { ...c, [field]: value } : c) });
  const deleteClass = (id: string) => persist({ ...session, classes: session.classes.filter((c) => c.id !== id) });

  const addEleve = useCallback((eleve: Omit<Eleve, 'id'>) => {
    const newEleve: Eleve = { absent: false, ...eleve, id: uuid() };
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

  const deleteEleves = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    const newEleves = session.eleves.filter((e) => !idSet.has(e.id));
    const newClasses = applyElevesToClasses(session.classes, newEleves, session.examType);
    persist({ ...session, eleves: newEleves, classes: newClasses });
  }, [session, persist]);

  const updateEleveInfo = useCallback((id: string, updates: Partial<Omit<Eleve, 'id' | 'points'>>) => {
    const newEleves = session.eleves.map((e) => e.id === id ? { ...e, ...updates } : e);
    const newClasses = applyElevesToClasses(session.classes, newEleves, session.examType);
    persist({ ...session, eleves: newEleves, classes: newClasses });
  }, [session, persist]);

  const clearEleves = () => {
    const resetClasses = session.classes.map((c) => ({
      ...c, inscritsGarcon: 0, inscritsFille: 0,
      presentsTotal: 0, presentsGarcon: 0, presentsFille: 0,
      admisGarcon: 0, admisFille: 0,
    }));
    persist({ ...session, eleves: [], classes: resetClasses });
    setShowClearEleves(false);
  };

  async function processFile(file: File) {
    const result = await importFromFile(file, session.examType);
    setImportErrors(result.errors);

    if (result.eleves.length > 0) {
      const existingMatricules = new Set(session.eleves.filter((e) => e.matricule).map((e) => e.matricule));
      const toAdd = result.eleves
        .filter((e) => !e.matricule || !existingMatricules.has(e.matricule))
        .map((e) => ({ absent: false as boolean, ...e }));
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
  const totalErrors = session.saisieMode === 'manuel' ? countErrors(session.classes, session.examType) : 0;
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
                      <button className="btn btn--ghost btn--sm btn--danger" onClick={() => setPendingDeleteCentreId(c.id)}>✕</button>
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
                      <button className="btn btn--ghost btn--sm btn--danger" onClick={() => setPendingDeleteClassId(cls.id)}>✕</button>
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
                desc={
                  session.saisieMode === 'eleves'
                    ? `Entrez les points de chaque élève. Points ≥ ${admisThreshold(session.examType)} = Admis · 0 = Refusé · Cochez Absent pour marquer un absent.`
                    : session.saisieMode === 'manuel'
                    ? 'Les colonnes grisées sont calculées en direct. Les valeurs impossibles sont signalées en orange.'
                    : 'Choisissez comment vous souhaitez saisir les données.'
                }
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {session.saisieMode !== null && session.eleves.length === 0 && (
                  <button className="btn btn--ghost btn--sm" style={{ color: 'var(--ink-3)' }} onClick={() => setSaisieMode(null)}>← Changer de mode</button>
                )}
                {session.saisieMode !== null && (
                  <button className="btn btn--sm" onClick={() => setShowImport(true)}>Importer</button>
                )}
                {session.saisieMode === 'eleves' && hasEleves && (
                  <button className="btn btn--sm" onClick={() => exportElevesResultats(session)}>↓ Résultats Excel</button>
                )}
              </div>
            </div>

            {/* Error banner — manual mode only */}
            {session.saisieMode === 'manuel' && totalErrors > 0 && (
              <div style={{ display: 'flex', gap: 12, padding: '14px 16px', border: '1px solid var(--orange-d)', background: 'var(--orange-w)', borderRadius: 4, marginBottom: 16 }}>
                <span style={{ color: 'var(--orange-d)', fontSize: 18, lineHeight: 1 }}>▲</span>
                <div>
                  <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange-d)', letterSpacing: '0.04em' }}>{totalErrors} VALEUR{totalErrors > 1 ? 'S' : ''} INCOHÉRENTE{totalErrors > 1 ? 'S' : ''}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 3 }}>Les cellules en orange sont impossibles. Les taux restent plafonnés à 100 %.</div>
                </div>
              </div>
            )}

            {/* Content */}
            {session.saisieMode === null ? (
              <SaisieChoix onChoose={setSaisieMode} />
            ) : session.saisieMode === 'eleves' ? (
              <EleveSaisie session={session} addEleve={addEleve} updateEleve={updateEleve} deleteEleve={deleteEleve} deleteEleves={deleteEleves} onClearEleves={() => setShowClearEleves(true)} onImport={() => setShowImport(true)} updateEleveInfo={updateEleveInfo} />
            ) : (
              session.classes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '70px 0' }}>
                  <p className="display" style={{ fontSize: 24, margin: 0 }}>Rien à saisir</p>
                  <p className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>Ajoutez d'abord des classes dans l'onglet Classes ou importez un fichier.</p>
                  <div style={{ marginTop: 20 }}><button className="btn btn--solid" onClick={() => setTab('classes')}>← Aller aux classes</button></div>
                </div>
              ) : (
                <SaisieTable session={session} isBac={isBac} updateClass={updateClass} />
              )
            )}
          </div>
        )}
      </div>

      {/* Confirm delete college */}
      <ConfirmModal
        open={!!pendingDeleteCentreId}
        title={`Supprimer « ${session.centres.find((c) => c.id === pendingDeleteCentreId)?.name ?? 'ce collège'} » ?`}
        message="Les classes rattachées à ce collège seront dissociées mais pas supprimées."
        onConfirm={() => { deleteCentre(pendingDeleteCentreId!); setPendingDeleteCentreId(null); }}
        onClose={() => setPendingDeleteCentreId(null)}
      />

      {/* Confirm delete class */}
      <ConfirmModal
        open={!!pendingDeleteClassId}
        title={`Supprimer la classe « ${session.classes.find((c) => c.id === pendingDeleteClassId)?.name || 'Sans nom'} » ?`}
        message="Les données saisies pour cette classe seront définitivement perdues."
        onConfirm={() => { deleteClass(pendingDeleteClassId!); setPendingDeleteClassId(null); }}
        onClose={() => setPendingDeleteClassId(null)}
      />

      {/* Confirm clear eleves */}
      <ConfirmModal
        open={showClearEleves}
        title={`Effacer les ${session.eleves.length} élèves importés ?`}
        message="Toutes les notes et les statistiques calculées depuis les élèves seront supprimées. La saisie manuelle redeviendra disponible."
        confirmLabel="Effacer les élèves"
        onConfirm={clearEleves}
        onClose={() => setShowClearEleves(false)}
      />

      {/* Import modal */}
      <Modal open={showImport} title="Importer des données" onClose={() => { setShowImport(false); setImportErrors([]); }}
        footer={<button className="btn" onClick={() => { setShowImport(false); setImportErrors([]); }}>Fermer</button>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.6 }}>
            {session.saisieMode === 'eleves'
              ? 'Importez une liste d\'élèves au format Excel (.xlsx) ou CSV.'
              : session.saisieMode === 'manuel'
              ? `Importez un fichier de statistiques par classe au format ${session.examType} (.xlsx ou CSV).`
              : 'Importez un fichier Excel (.xlsx) ou CSV.'}
          </p>

          {session.saisieMode === 'eleves' && (
            <div style={{ padding: '14px', border: '1px solid var(--green-d)', borderRadius: 4, background: 'var(--green-w)' }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--green-d)', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Format attendu</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 10, lineHeight: 1.5 }}>Colonnes&nbsp;: Matricule · Nom · Prenoms · Genre (M/F) · Classe</div>
              <button className="btn btn--ghost btn--sm" onClick={downloadElevesTemplate}>↓ Télécharger le modèle</button>
            </div>
          )}

          {session.saisieMode === 'manuel' && (
            <div style={{ padding: '14px', border: '1px solid var(--line)', borderRadius: 4 }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Format attendu — {session.examType}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 10, lineHeight: 1.5 }}>Colonnes&nbsp;: Classe · Inscrits Garçon · Inscrits Fille · {session.examType === 'BAC' ? 'Présents Garçon · Présents Fille · ' : 'Candidats Présents · '}Admis Garçon · Admis Fille</div>
              <button className="btn btn--ghost btn--sm" onClick={() => downloadTemplate(session.examType)}>↓ Télécharger le modèle {session.examType}</button>
            </div>
          )}

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

function EleveSaisie({ session, addEleve, updateEleve, deleteEleve, deleteEleves, onClearEleves, onImport, updateEleveInfo }: {
  session: Session;
  addEleve: (eleve: Omit<Eleve, 'id'>) => void;
  updateEleve: (id: string, points: number | null) => void;
  deleteEleve: (id: string) => void;
  deleteEleves: (ids: string[]) => void;
  onClearEleves: () => void;
  onImport: () => void;
  updateEleveInfo: (id: string, updates: Partial<Omit<Eleve, 'id' | 'points'>>) => void;
}) {
  const [search, setSearch] = useState('');
  const [editingEleve, setEditingEleve] = useState<Eleve | null>(null);
  const [pendingDeleteEleve, setPendingDeleteEleve] = useState<Eleve | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [sortMode, setSortMode] = useState<'classe' | 'alpha' | 'points-desc' | 'points-asc'>('classe');

  const toggleSelect = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleGroupAll = (ids: string[]) => setSelected((prev) => {
    const next = new Set(prev);
    const allSelected = ids.every((id) => next.has(id));
    ids.forEach((id) => allSelected ? next.delete(id) : next.add(id));
    return next;
  });
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

  const allSortedBase = [...groups.flatMap((g) => g.rows), ...unmatched];
  const allSorted = sortMode === 'points-desc'
    ? [...allSortedBase].sort((a, b) => (b.points ?? -1) - (a.points ?? -1))
    : sortMode === 'points-asc'
    ? [...allSortedBase].sort((a, b) => (a.points ?? -1) - (b.points ?? -1))
    : [...allSortedBase].sort((a, b) => { const n = a.nom.localeCompare(b.nom, 'fr'); return n !== 0 ? n : a.prenoms.localeCompare(b.prenoms, 'fr'); });

  const noEleves = session.eleves.length === 0;
  const noResults = !noEleves && groups.length === 0 && unmatched.length === 0 && !q;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {noEleves ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <p className="display" style={{ fontSize: 22, margin: 0 }}>Aucun élève importé</p>
          <p className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>Importez un fichier ou ajoutez un élève manuellement pour commencer.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
            <button className="btn btn--solid" onClick={onImport}>Importer un fichier</button>
            <button className="btn" onClick={() => setShowAdd(true)}>+ Ajouter manuellement</button>
          </div>
        </div>
      ) : (
        <>
          {/* Search bar + actions */}
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
            <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
              {([['classe', 'Par classe'], ['alpha', 'A → Z'], ['points-desc', 'Points ↓'], ['points-asc', 'Points ↑']] as const).map(([mode, label]) => (
                <button key={mode} onClick={() => setSortMode(mode)} style={{ padding: '0 11px', height: 34, fontSize: 11, background: sortMode === mode ? 'var(--ink)' : 'transparent', color: sortMode === mode ? '#fff' : 'var(--ink-2)', border: 'none', borderLeft: mode !== 'classe' ? '1px solid var(--line)' : 'none', cursor: 'pointer', fontFamily: 'var(--mono)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{label}</button>
              ))}
            </div>
            <button className="btn btn--sm btn--solid" style={{ whiteSpace: 'nowrap' }} onClick={() => setShowAdd(true)}>+ Ajouter un élève</button>
            {selected.size > 0 ? (
              <button className="btn btn--sm btn--danger" style={{ whiteSpace: 'nowrap' }} onClick={() => setShowBulkDelete(true)}>
                Effacer la sélection ({selected.size})
              </button>
            ) : (
              <button className="btn btn--sm btn--danger" style={{ whiteSpace: 'nowrap' }} onClick={onClearEleves}>
                Effacer les élèves
              </button>
            )}
          </div>

          {sortMode !== 'classe' ? (
            allSorted.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>Aucun résultat.</p>
              </div>
            ) : (
              <div className="scroll-x" style={{ border: '1px solid var(--line)', borderRadius: 4 }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 680 }}>
                  <thead>
                    <tr style={{ background: 'var(--ink)' }}>
                      <th style={{ ...eleveThStyle(36, true), padding: '9px 0' }}>
                        <input
                          type="checkbox"
                          checked={allSorted.length > 0 && allSorted.every((e) => selected.has(e.id))}
                          ref={(el) => { if (el) el.indeterminate = allSorted.some((e) => selected.has(e.id)) && !allSorted.every((e) => selected.has(e.id)); }}
                          onChange={() => toggleGroupAll(allSorted.map((e) => e.id))}
                          style={{ cursor: 'pointer', accentColor: 'var(--orange-d)' }}
                        />
                      </th>
                      <th style={eleveThStyle(40, true)}>G/F</th>
                      <th style={eleveThStyle(110, true)}>Matricule</th>
                      <th style={eleveThStyle(130, true)}>Classe</th>
                      <th style={{ ...eleveThStyle(undefined, true), textAlign: 'left', padding: '9px 12px', color: '#fff' }}>Nom &amp; Prénoms</th>
                      <th style={eleveThStyle(90, false)}>Points</th>
                      <th style={eleveThStyle(50, true)}>Abs.</th>
                      <th style={eleveThStyle(85, true)}>Statut</th>
                      <th style={{ ...eleveThStyle(72, true), borderRight: 'none' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {allSorted.map((eleve, i) => (
                      <EleveRow key={eleve.id} eleve={eleve} index={i} examType={session.examType} onCommit={updateEleve} onDelete={setPendingDeleteEleve} onEdit={setEditingEleve} isSelected={selected.has(eleve.id)} onToggle={() => toggleSelect(eleve.id)} onToggleAbsent={() => updateEleveInfo(eleve.id, { absent: !eleve.absent })} showClasse />
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <>
              {noResults && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>Aucun élève correspondant aux classes déclarées. Vérifiez les noms de classe.</p>
                </div>
              )}

              {groups.map(({ cls, rows, total }) => {
                const entered = rows.filter((e) => e.points !== null || e.absent).length;
                const present = rows.filter((e) => !e.absent && e.points !== null).length;
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
                      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 576 }}>
                        <thead>
                          <tr style={{ background: 'var(--ink)' }}>
                            <th style={{ ...eleveThStyle(36, true), padding: '9px 0' }}>
                              <input
                                type="checkbox"
                                checked={rows.length > 0 && rows.every((e) => selected.has(e.id))}
                                ref={(el) => { if (el) el.indeterminate = rows.some((e) => selected.has(e.id)) && !rows.every((e) => selected.has(e.id)); }}
                                onChange={() => toggleGroupAll(rows.map((e) => e.id))}
                                style={{ cursor: 'pointer', accentColor: 'var(--orange-d)' }}
                              />
                            </th>
                            <th style={eleveThStyle(40, true)}>G/F</th>
                            <th style={eleveThStyle(120, true)}>Matricule</th>
                            <th style={{ ...eleveThStyle(undefined, true), textAlign: 'left', padding: '9px 12px', color: '#fff' }}>Nom &amp; Prénoms</th>
                            <th style={eleveThStyle(90, false)}>Points</th>
                            <th style={eleveThStyle(50, true)}>Abs.</th>
                            <th style={eleveThStyle(85, true)}>Statut</th>
                            <th style={{ ...eleveThStyle(72, true), borderRight: 'none' }} />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((eleve, i) => (
                            <EleveRow key={eleve.id} eleve={eleve} index={i} examType={session.examType} onCommit={updateEleve} onDelete={setPendingDeleteEleve} onEdit={setEditingEleve} isSelected={selected.has(eleve.id)} onToggle={() => toggleSelect(eleve.id)} onToggleAbsent={() => updateEleveInfo(eleve.id, { absent: !eleve.absent })} />
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
            </>
          )}
        </>
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

      {/* Confirm delete eleve */}
      <ConfirmModal
        open={!!pendingDeleteEleve}
        title="Retirer cet élève ?"
        message={<>Voulez-vous retirer <strong>{pendingDeleteEleve?.nom} {pendingDeleteEleve?.prenoms}</strong> de la liste ? Cette action est irréversible.</>}
        confirmLabel="Retirer"
        onConfirm={() => { deleteEleve(pendingDeleteEleve!.id); setPendingDeleteEleve(null); }}
        onClose={() => setPendingDeleteEleve(null)}
      />

      {/* Confirm bulk delete */}
      <ConfirmModal
        open={showBulkDelete}
        title={`Retirer ${selected.size} élève${selected.size > 1 ? 's' : ''} ?`}
        message={`Voulez-vous retirer les ${selected.size} élève${selected.size > 1 ? 's' : ''} sélectionné${selected.size > 1 ? 's' : ''} de la liste ? Cette action est irréversible.`}
        confirmLabel={`Retirer ${selected.size} élève${selected.size > 1 ? 's' : ''}`}
        onConfirm={() => { deleteEleves([...selected]); setSelected(new Set()); setShowBulkDelete(false); }}
        onClose={() => setShowBulkDelete(false)}
      />
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

function EleveRow({ eleve, index, examType, onCommit, onDelete, onEdit, onToggleAbsent, isSelected, onToggle, showClasse }: {
  eleve: Eleve;
  index: number;
  examType: import('../types').ExamType;
  onCommit: (id: string, points: number | null) => void;
  onDelete: (eleve: Eleve) => void;
  onEdit: (eleve: Eleve) => void;
  onToggleAbsent: () => void;
  isSelected: boolean;
  onToggle: () => void;
  showClasse?: boolean;
}) {
  const [raw, setRaw] = useState(() => eleve.points === null ? '' : String(eleve.points));

  useEffect(() => {
    setRaw(eleve.points === null ? '' : String(eleve.points));
  }, [eleve.points]);

  const threshold = admisThreshold(examType);
  const max = maxPoints(examType);

  const isValid = (val: string): boolean => {
    if (val.trim() === '') return true;
    const normalized = val.trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(normalized)) return false;
    const n = parseFloat(normalized);
    return n >= 0 && n <= max;
  };

  const hasError = !isValid(raw);
  const pts = hasError ? null : (raw.trim() === '' ? null : parseFloat(raw.trim().replace(',', '.')));
  const isAbsent = eleve.absent;
  const isAdmis = !isAbsent && pts !== null && pts >= threshold;
  const isAjoure = !isAbsent && pts !== null && pts < threshold;

  const commit = () => {
    if (hasError) return;
    onCommit(eleve.id, pts);
  };

  const cell: React.CSSProperties = { borderRight: '1px solid var(--line-2)', borderBottom: '1px solid var(--line-2)' };

  return (
    <tr style={{ background: isSelected ? 'var(--orange-w)' : isAbsent ? 'var(--paper-3)' : index % 2 ? 'var(--paper-2)' : 'var(--card)' }}>
      <td style={{ ...cell, width: 36, textAlign: 'center', height: 40 }}>
        <input type="checkbox" checked={isSelected} onChange={onToggle} style={{ cursor: 'pointer', accentColor: 'var(--orange-d)' }} />
      </td>
      <td style={{ ...cell, width: 40, textAlign: 'center', height: 40 }}>
        <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: eleve.genre === 'M' ? 'var(--gar)' : 'var(--fil)', opacity: isAbsent ? 0.4 : 1 }} title={eleve.genre === 'M' ? 'Garçon' : 'Fille'} />
      </td>
      <td style={{ ...cell, width: 120, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', padding: '0 8px', whiteSpace: 'nowrap', opacity: isAbsent ? 0.5 : 1 }}>
        {eleve.matricule || '—'}
      </td>
      {showClasse && (
        <td style={{ ...cell, width: 130, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', padding: '0 8px', whiteSpace: 'nowrap', opacity: isAbsent ? 0.5 : 1 }}>
          {eleve.classe}
        </td>
      )}
      <td style={{ ...cell, padding: '0 12px', fontSize: 13, opacity: isAbsent ? 0.5 : 1 }}>
        <span style={{ fontWeight: 600 }}>{eleve.nom}</span>
        {eleve.prenoms && <span style={{ fontWeight: 400, color: 'var(--ink-2)', fontSize: 12 }}> {eleve.prenoms}</span>}
      </td>
      <td style={{ ...cell, width: 90, padding: 0 }}>
        <input
          type="text" inputMode="numeric"
          value={isAbsent ? '' : raw} placeholder="—"
          disabled={isAbsent}
          data-points-input
          onChange={(e) => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (hasError) return;
              commit();
              const all = Array.from(document.querySelectorAll<HTMLInputElement>('[data-points-input]:not(:disabled)'));
              const next = all[all.indexOf(e.target as HTMLInputElement) + 1];
              if (next) next.focus(); else (e.target as HTMLInputElement).blur();
            }
          }}
          style={{
            width: '100%', height: 40, textAlign: 'center', border: 'none',
            background: isAbsent ? 'transparent' : hasError ? 'var(--orange-w)' : isAdmis ? 'var(--green-w)' : 'transparent',
            fontFamily: 'var(--mono)', fontSize: 13,
            fontWeight: isAdmis ? 700 : 400,
            color: hasError ? 'var(--orange-d)' : isAdmis ? 'var(--green-d)' : 'var(--ink)',
            outline: 'none',
            boxShadow: hasError && !isAbsent ? 'inset 0 0 0 1.5px var(--orange-d)' : isAdmis ? 'inset 0 0 0 1.5px var(--green-d)' : 'none',
            cursor: isAbsent ? 'not-allowed' : 'text',
            opacity: isAbsent ? 0.35 : 1,
          }}
        />
      </td>
      <td style={{ ...cell, width: 50, textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={isAbsent}
          onChange={onToggleAbsent}
          title="Marquer absent"
          style={{ cursor: 'pointer', accentColor: 'var(--ink)', width: 14, height: 14 }}
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
        <button onClick={() => onDelete(eleve)} title="Retirer cet élève"
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
      absent: false,
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

/* ─────────────────────────── Mode choice screen ─────────────────────────── */

function SaisieChoix({ onChoose }: { onChoose: (mode: 'eleves' | 'manuel') => void }) {
  const card: React.CSSProperties = {
    textAlign: 'left', background: 'var(--card)', border: '2px dashed var(--line)',
    borderRadius: 6, padding: '40px 32px', cursor: 'pointer', transition: 'border-color .15s',
    display: 'flex', flexDirection: 'column', gap: 14,
  };
  return (
    <div style={{ maxWidth: 860, margin: '32px auto 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <button style={card}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ink)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
          onClick={() => onChoose('eleves')}>
          <span className="display" style={{ fontSize: 26, fontWeight: 700 }}>Liste des élèves</span>
          <span style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            Tu as les noms et notes de chaque élève. Les stats sont calculées automatiquement.
          </span>
        </button>
        <button style={card}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ink)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
          onClick={() => onChoose('manuel')}>
          <span className="display" style={{ fontSize: 26, fontWeight: 700 }}>Stats par classe</span>
          <span style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            Tu as uniquement les totaux par classe (inscrits, présents, admis). Saisie directe ou import.
          </span>
        </button>
      </div>
    </div>
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

/* ─────────────────────────── Confirm modal ─────────────────────────── */

function ConfirmModal({ open, title, message, confirmLabel = 'Supprimer', onConfirm, onClose }: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn--accent btn--danger" onClick={onConfirm}>{confirmLabel}</button>
        </>
      }>
      <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}
