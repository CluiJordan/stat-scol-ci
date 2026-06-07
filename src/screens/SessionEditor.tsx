import { useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import type { Session, ClassRow, Centre } from '../types';
import { saveSession, getSession } from '../lib/storage';
import { importFromFile } from '../lib/importFile';
import { downloadTemplate } from '../lib/exportExcel';
import { computeRow, pct } from '../lib/calculations';
import { validateRow, countErrors } from '../lib/validation';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Logo from '../components/ui/Logo';

interface Props {
  sessionId: string;
  onBack: () => void;
  onReports: () => void;
}

type Tab = 'config' | 'classes' | 'saisie';

function emptyRow(centreId: string | null = null): ClassRow {
  return { id: uuid(), name: '', centreId, inscritsGarcon: 0, inscritsFille: 0, presentsTotal: 0, presentsGarcon: 0, presentsFille: 0, admisGarcon: 0, admisFille: 0 };
}

function getSchoolYearOptions(currentValue: string): { value: string; label: string }[] {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const currentStart = month >= 9 ? year : year - 1;
  const years = Array.from({ length: 6 }, (_, i) => {
    const start = currentStart - (5 - i);
    return `${start} - ${start + 1}`;
  });
  if (!years.includes(currentValue)) years.unshift(currentValue);
  return years.map((y) => ({ value: y, label: y }));
}

export default function SessionEditor({ sessionId, onBack, onReports }: Props) {
  const [session, setSession] = useState<Session>(() => getSession(sessionId)!);
  const [tab, setTab] = useState<Tab>('config');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [saved, setSaved] = useState(false);

  const persist = useCallback((s: Session) => {
    setSession(s);
    saveSession(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, []);

  function setField(key: keyof Session, value: string) {
    persist({ ...session, [key]: value });
  }

  function addCentre() {
    const centre: Centre = { id: uuid(), name: `CENTRE ${session.centres.length + 1}` };
    persist({ ...session, centres: [...session.centres, centre] });
  }

  function updateCentre(id: string, name: string) {
    persist({ ...session, centres: session.centres.map((c) => c.id === id ? { ...c, name } : c) });
  }

  function deleteCentre(id: string) {
    persist({
      ...session,
      centres: session.centres.filter((c) => c.id !== id),
      classes: session.classes.map((c) => c.centreId === id ? { ...c, centreId: null } : c),
    });
  }

  function addClass() {
    persist({ ...session, classes: [...session.classes, emptyRow()] });
  }

  function updateClass(id: string, field: keyof ClassRow, value: string | number | null) {
    persist({ ...session, classes: session.classes.map((c) => c.id === id ? { ...c, [field]: value } : c) });
  }

  function deleteClass(id: string) {
    persist({ ...session, classes: session.classes.filter((c) => c.id !== id) });
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { rows, errors } = await importFromFile(file, session.examType);
    setImportErrors(errors);
    if (rows.length > 0) {
      persist({ ...session, classes: [...session.classes, ...rows] });
      setShowImport(false);
    }
  }

  const centreOptions = [
    { value: '', label: '— Aucun centre —' },
    ...session.centres.map((c) => ({ value: c.id, label: c.name })),
  ];

  const isBac = session.examType === 'BAC';
  const totalErrors = countErrors(session.classes, session.examType);

  const tabLabels: Record<Tab, string> = {
    config: '① Configuration',
    classes: isBac ? '② Classes' : '② Classes & Centres',
    saisie: '③ Saisie',
  };

  return (
    <div className="min-h-screen bg-[#F5F0EB]">
      <header className="bg-[#0A0A0A] px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <button onClick={onBack} className="text-white/50 hover:text-white text-sm flex items-center gap-1 transition-colors shrink-0 mt-0.5" aria-label="Retour">
              ←<span className="hidden sm:inline"> Retour</span>
            </button>
            <Logo size={28} className="mt-0.5 shrink-0 text-white" />
            <div className="min-w-0 text-white">
              <h1 className="font-bold text-sm leading-tight">{session.etablissement || 'Session sans nom'}</h1>
              <p className="text-white/40 text-xs mt-0.5">{session.examType} — {session.anneeScolaire}{session.examSession ? ` — ${session.examSession}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {saved && <span className="text-emerald-400 text-xs font-medium">Enregistré ✓</span>}
            <Button size="sm" variant="accent" onClick={onReports} className="flex-1 sm:flex-none justify-center">Voir les rapports</Button>
          </div>
        </div>
      </header>

      <div className="bg-[#F5F0EB] border-b border-[#E5DDD5] px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center gap-1 py-2 overflow-x-auto">
          {(['config', 'classes', 'saisie'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all shrink-0 whitespace-nowrap ${
                tab === t ? 'bg-[#1C2B3A] text-white' : 'text-gray-500 hover:text-[#1C2B3A] hover:bg-white'
              }`}
            >
              {tabLabels[t]}
              {t === 'saisie' && totalErrors > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold align-middle">{totalErrors}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
        {tab === 'config' && (
          <div className="bg-white rounded-xl border border-[#E5DDD5] p-5 sm:p-6 max-w-2xl">
            <h2 className="font-bold text-[#0A0A0A] mb-5">Informations générales</h2>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Type d'examen" value={session.examType} disabled />
                <Select
                  label="Année scolaire"
                  options={getSchoolYearOptions(session.anneeScolaire)}
                  value={session.anneeScolaire}
                  onChange={(e) => setField('anneeScolaire', e.target.value)}
                />
              </div>
              <Input label="Établissement" value={session.etablissement} onChange={(e) => setField('etablissement', e.target.value)} uppercase />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Code établissement" value={session.code} onChange={(e) => setField('code', e.target.value)} uppercase />
                <Input label="DRENA" value={session.drena} onChange={(e) => setField('drena', e.target.value)} uppercase />
              </div>
              <Input label="Ministère" value={session.ministere} onChange={(e) => setField('ministere', e.target.value)} uppercase />
              <Input label="Session" value={session.examSession} onChange={(e) => setField('examSession', e.target.value)} placeholder="Ex: SESSION 2025" uppercase />
            </div>
          </div>
        )}

        {tab === 'classes' && (
          <div className="flex flex-col gap-5">
            {!isBac && (
              <div className="bg-white rounded-xl border border-[#E5DDD5] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="font-bold text-[#0A0A0A]">Centres d'examen</h2>
                  <Button size="sm" variant="primary" onClick={addCentre} className="shrink-0">+ Centre</Button>
                </div>
                {session.centres.length === 0 && (
                  <p className="text-sm text-gray-400 py-4 text-center">Aucun centre. Ajoutez des centres pour le rapport « par établissement ».</p>
                )}
                <div className="flex flex-col gap-2">
                  {session.centres.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Input value={c.name} onChange={(e) => updateCentre(c.id, e.target.value)} className="flex-1" uppercase />
                      <Button size="sm" variant="danger" onClick={() => deleteCentre(c.id)} className="shrink-0">✕</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-white rounded-xl border border-[#E5DDD5] p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="font-bold text-[#0A0A0A]">Classes</h2>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setShowImport(true)} className="flex-1 sm:flex-none justify-center">Importer Excel/CSV</Button>
                  <Button size="sm" variant="primary" onClick={addClass} className="flex-1 sm:flex-none justify-center">+ Classe</Button>
                </div>
              </div>
              {session.classes.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">Aucune classe. Ajoutez des classes ou importez depuis un fichier.</p>
              )}
              <div className="flex flex-col gap-2">
                {session.classes.map((cls) => (
                  <div key={cls.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Input value={cls.name} onChange={(e) => updateClass(cls.id, 'name', e.target.value)} placeholder="Ex: 3EME 1" className="flex-1" uppercase />
                    <div className="flex gap-2">
                      {!isBac && (
                        <Select options={centreOptions} value={cls.centreId ?? ''} onChange={(e) => updateClass(cls.id, 'centreId', e.target.value || null)} className="flex-1" />
                      )}
                      <Button size="sm" variant="danger" onClick={() => deleteClass(cls.id)} className="shrink-0">✕</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'saisie' && (
          <div className="bg-white rounded-xl border border-[#E5DDD5] overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[#E5DDD5]">
              <h2 className="font-bold text-[#0A0A0A]">Saisie des données</h2>
              <Button size="sm" onClick={() => setShowImport(true)} className="justify-center">Importer Excel/CSV</Button>
            </div>

            {totalErrors > 0 && (
              <div className="bg-red-50 border-b border-red-200 px-4 sm:px-5 py-3 flex items-start gap-3">
                <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
                <div>
                  <p className="text-sm font-semibold text-red-700">{totalErrors} valeur{totalErrors > 1 ? 's' : ''} incohérente{totalErrors > 1 ? 's' : ''} à corriger</p>
                  <p className="text-xs text-red-600 mt-0.5">Les cellules en rouge sont impossibles (admis &gt; présents, présents &gt; inscrits…). Survolez une cellule pour le détail. En attendant, les calculs et taux sont plafonnés automatiquement.</p>
                </div>
              </div>
            )}

            {session.classes.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">Ajoutez d'abord des classes dans l'onglet « Classes »</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#1C2B3A] text-white">
                      <th className="border border-[#2D4155] text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wider sticky left-0 bg-[#1C2B3A] min-w-[120px] z-10">
                        {isBac ? 'Classe & Série' : 'Classe'}
                      </th>
                      <th className="border border-[#2D4155] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-blue-200">Inscrits G</th>
                      <th className="border border-[#2D4155] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-pink-200">Inscrits F</th>
                      {isBac ? (
                        <>
                          <th className="border border-[#2D4155] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-blue-200">Présents G</th>
                          <th className="border border-[#2D4155] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-pink-200">Présents F</th>
                        </>
                      ) : (
                        <th className="border border-[#2D4155] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-[#F4732A]">Cand. Présents</th>
                      )}
                      <th className="border border-[#2D4155] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-blue-200">Admis G</th>
                      <th className="border border-[#2D4155] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-pink-200">Admis F</th>
                      <th className="border border-[#2D4155] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap bg-[#0F1E2C]">Tot. inscrits</th>
                      {isBac && <th className="border border-[#2D4155] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap bg-[#0F1E2C]">Absents</th>}
                      <th className="border border-[#2D4155] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap bg-[#0F1E2C]">Tot. admis</th>
                      <th className="border border-[#2D4155] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap bg-[#0F1E2C]">Taux</th>
                      <th className="border border-[#2D4155] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap bg-[#0F1E2C]">Taux G</th>
                      <th className="border border-[#2D4155] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap bg-[#0F1E2C]">Taux F</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.classes.map((cls, i) => {
                      const computed = computeRow(cls, session.examType);
                      const errs = validateRow(cls, session.examType);
                      return (
                        <tr key={cls.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-200 px-3 py-0 h-9 sticky left-0 bg-inherit font-semibold text-[#0A0A0A] text-xs z-10">{cls.name || '—'}</td>
                          <NumCell value={cls.inscritsGarcon} onChange={(v) => updateClass(cls.id, 'inscritsGarcon', v)} invalid={!!errs.inscritsGarcon} title={errs.inscritsGarcon} />
                          <NumCell value={cls.inscritsFille} onChange={(v) => updateClass(cls.id, 'inscritsFille', v)} invalid={!!errs.inscritsFille} title={errs.inscritsFille} />
                          {isBac ? (
                            <>
                              <NumCell value={cls.presentsGarcon} onChange={(v) => updateClass(cls.id, 'presentsGarcon', v)} invalid={!!errs.presentsGarcon} title={errs.presentsGarcon} />
                              <NumCell value={cls.presentsFille} onChange={(v) => updateClass(cls.id, 'presentsFille', v)} invalid={!!errs.presentsFille} title={errs.presentsFille} />
                            </>
                          ) : (
                            <NumCell value={cls.presentsTotal} onChange={(v) => updateClass(cls.id, 'presentsTotal', v)} invalid={!!errs.presentsTotal} title={errs.presentsTotal} />
                          )}
                          <NumCell value={cls.admisGarcon} onChange={(v) => updateClass(cls.id, 'admisGarcon', v)} invalid={!!errs.admisGarcon} title={errs.admisGarcon} />
                          <NumCell value={cls.admisFille} onChange={(v) => updateClass(cls.id, 'admisFille', v)} invalid={!!errs.admisFille} title={errs.admisFille} />
                          <td className="border border-gray-200 px-2 py-0 h-9 text-center text-xs text-[#1C2B3A] bg-[#F0F4F8] font-semibold">{computed.inscritsTotal}</td>
                          {isBac && <td className="border border-gray-200 px-2 py-0 h-9 text-center text-xs text-[#1C2B3A] bg-[#F0F4F8]">{computed.absents}</td>}
                          <td className="border border-gray-200 px-2 py-0 h-9 text-center text-xs text-[#1C2B3A] bg-[#F0F4F8] font-semibold">{computed.admisTotal}</td>
                          <td className="border border-gray-200 px-2 py-0 h-9 text-center text-xs font-semibold bg-[#F0F4F8] text-[#1C2B3A]">{pct(computed.tauxTotal)}</td>
                          <td className="border border-gray-200 px-2 py-0 h-9 text-center text-xs bg-[#F0F4F8] text-[#1C2B3A]">{pct(computed.tauxGarcon)}</td>
                          <td className="border border-gray-200 px-2 py-0 h-9 text-center text-xs bg-[#F0F4F8] text-[#1C2B3A]">{pct(computed.tauxFille)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      <Modal
        open={showImport}
        title="Importer des données"
        onClose={() => { setShowImport(false); setImportErrors([]); }}
        footer={<Button onClick={() => { setShowImport(false); setImportErrors([]); }}>Fermer</Button>}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500 leading-relaxed">Importez un fichier Excel (.xlsx) ou CSV avec les colonnes correctes.</p>
          <Button size="sm" variant="ghost" onClick={() => downloadTemplate(session.examType)}>Télécharger le modèle {session.examType}</Button>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#E5DDD5] rounded-xl p-8 cursor-pointer hover:border-[#1C2B3A] transition-colors group">
            <span className="text-sm text-gray-400 group-hover:text-[#1C2B3A] transition-colors text-center">Cliquez ou glissez un fichier Excel/CSV</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          </label>
          {importErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              {importErrors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function NumCell({ value, onChange, invalid, title }: { value: number; onChange: (v: number) => void; invalid?: boolean; title?: string }) {
  return (
    <td title={title} className={`p-0 h-9 border ${invalid ? 'border-red-400' : 'border-gray-200'}`} style={{ minWidth: '52px' }}>
      <input
        type="number"
        min={0}
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className={`w-full h-full text-center px-1 text-sm focus:outline-none transition-colors ${
          invalid ? 'bg-red-50 text-red-700 font-semibold focus:bg-red-100' : 'bg-transparent focus:bg-blue-50'
        }`}
      />
    </td>
  );
}
