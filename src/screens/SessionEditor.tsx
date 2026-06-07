import { useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import type { Session, ClassRow, Centre } from '../types';
import { saveSession, getSession } from '../lib/storage';
import { importFromFile } from '../lib/importFile';
import { downloadTemplate } from '../lib/exportExcel';
import { computeRow, pct } from '../lib/calculations';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';

interface Props {
  sessionId: string;
  onBack: () => void;
  onReports: () => void;
}

type Tab = 'config' | 'classes' | 'saisie';

function emptyRow(centreId: string | null = null): ClassRow {
  return { id: uuid(), name: '', centreId, inscritsGarcon: 0, inscritsFille: 0, presentsTotal: 0, presentsGarcon: 0, presentsFille: 0, admisGarcon: 0, admisFille: 0 };
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

  // ── CONFIG ──────────────────────────────────────────────────────────
  function setField(key: keyof Session, value: string) {
    persist({ ...session, [key]: value });
  }

  // ── CENTRES ─────────────────────────────────────────────────────────
  function addCentre() {
    const centre: Centre = { id: uuid(), name: `Centre ${session.centres.length + 1}` };
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

  // ── CLASSES ─────────────────────────────────────────────────────────
  function addClass() {
    persist({ ...session, classes: [...session.classes, emptyRow()] });
  }

  function updateClass(id: string, field: keyof ClassRow, value: string | number | null) {
    persist({ ...session, classes: session.classes.map((c) => c.id === id ? { ...c, [field]: value } : c) });
  }

  function deleteClass(id: string) {
    persist({ ...session, classes: session.classes.filter((c) => c.id !== id) });
  }

  // ── IMPORT ──────────────────────────────────────────────────────────
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-800 text-white px-6 py-4 shadow">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <button onClick={onBack} className="text-green-200 hover:text-white text-sm flex items-center gap-1">
            ← Retour
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold truncate">{session.etablissement || 'Session sans nom'}</h1>
            <p className="text-green-200 text-xs">{session.examType} — {session.anneeScolaire}</p>
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="text-green-300 text-xs">Enregistré ✓</span>}
            <Button size="sm" className="bg-white text-green-800 hover:bg-green-50" onClick={onReports}>
              Voir les rapports
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="max-w-6xl mx-auto flex gap-0">
          {(['config', 'classes', 'saisie'] as Tab[]).map((t) => {
            const labels = { config: '1. Configuration', classes: isBac ? '2. Classes' : '2. Classes & Centres', saisie: '3. Saisie des données' };
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-green-700 text-green-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* ── TAB: CONFIG ── */}
        {tab === 'config' && (
          <div className="bg-white rounded-xl border p-6 max-w-2xl">
            <h2 className="font-semibold text-gray-800 mb-4">Informations générales</h2>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Type d'examen" value={session.examType} disabled className="bg-gray-50" />
                <Input label="Année scolaire" value={session.anneeScolaire} onChange={(e) => setField('anneeScolaire', e.target.value)} />
              </div>
              <Input label="Établissement" value={session.etablissement} onChange={(e) => setField('etablissement', e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Code établissement" value={session.code} onChange={(e) => setField('code', e.target.value)} />
                <Input label="DRENA" value={session.drena} onChange={(e) => setField('drena', e.target.value)} />
              </div>
              <Input label="Ministère" value={session.ministere} onChange={(e) => setField('ministere', e.target.value)} />
              {isBac && (
                <Input label="Session" value={session.examSession} onChange={(e) => setField('examSession', e.target.value)} placeholder="Ex: session 2025" />
              )}
            </div>
          </div>
        )}

        {/* ── TAB: CLASSES ── */}
        {tab === 'classes' && (
          <div className="flex flex-col gap-6">
            {/* Centres (BEPC only) */}
            {!isBac && (
              <div className="bg-white rounded-xl border p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-800">Centres d'examen</h2>
                  <Button size="sm" variant="primary" onClick={addCentre}>+ Ajouter un centre</Button>
                </div>
                {session.centres.length === 0 && (
                  <p className="text-sm text-gray-400 py-4 text-center">Aucun centre. Ajoutez des centres pour le rapport « par établissement ».</p>
                )}
                <div className="flex flex-col gap-2">
                  {session.centres.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Input value={c.name} onChange={(e) => updateCentre(c.id, e.target.value)} className="flex-1" />
                      <Button size="sm" variant="danger" onClick={() => deleteCentre(c.id)}>✕</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Classes list */}
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-800">Classes</h2>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setShowImport(true)}>Importer Excel/CSV</Button>
                  <Button size="sm" variant="primary" onClick={addClass}>+ Ajouter une classe</Button>
                </div>
              </div>
              {session.classes.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">Aucune classe. Ajoutez des classes ou importez depuis un fichier.</p>
              )}
              <div className="flex flex-col gap-2">
                {session.classes.map((cls) => (
                  <div key={cls.id} className="flex items-center gap-2">
                    <Input
                      value={cls.name}
                      onChange={(e) => updateClass(cls.id, 'name', e.target.value)}
                      placeholder="Ex: 3EME 1"
                      className="flex-1"
                    />
                    {!isBac && (
                      <Select
                        options={centreOptions}
                        value={cls.centreId ?? ''}
                        onChange={(e) => updateClass(cls.id, 'centreId', e.target.value || null)}
                        className="flex-1"
                      />
                    )}
                    <Button size="sm" variant="danger" onClick={() => deleteClass(cls.id)}>✕</Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: SAISIE ── */}
        {tab === 'saisie' && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="font-semibold text-gray-800">Saisie des données</h2>
              <Button size="sm" onClick={() => setShowImport(true)}>Importer Excel/CSV</Button>
            </div>
            {session.classes.length === 0 ? (
              <p className="text-center text-gray-400 py-10">Ajoutez d'abord des classes dans l'onglet « Classes »</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-700 sticky left-0 bg-gray-50 min-w-[120px]">
                        {isBac ? 'Classe & Série' : 'Classe'}
                      </th>
                      <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">Inscrits G</th>
                      <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">Inscrits F</th>
                      {isBac ? (
                        <>
                          <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">Présents G</th>
                          <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">Présents F</th>
                        </>
                      ) : (
                        <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">Cand. Présents</th>
                      )}
                      <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">Admis G</th>
                      <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">Admis F</th>
                      {/* Computed */}
                      <th className="px-3 py-2 font-medium text-blue-600 whitespace-nowrap bg-blue-50">Total inscrits</th>
                      {isBac && <th className="px-3 py-2 font-medium text-blue-600 whitespace-nowrap bg-blue-50">Absents</th>}
                      <th className="px-3 py-2 font-medium text-blue-600 whitespace-nowrap bg-blue-50">Total admis</th>
                      <th className="px-3 py-2 font-medium text-blue-600 whitespace-nowrap bg-blue-50">Taux</th>
                      <th className="px-3 py-2 font-medium text-blue-600 whitespace-nowrap bg-blue-50">Taux G</th>
                      <th className="px-3 py-2 font-medium text-blue-600 whitespace-nowrap bg-blue-50">Taux F</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.classes.map((cls, i) => {
                      const computed = computeRow(cls, session.examType);
                      return (
                        <tr key={cls.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-1.5 sticky left-0 bg-inherit font-medium text-gray-800">{cls.name || '—'}</td>
                          <NumCell value={cls.inscritsGarcon} onChange={(v) => updateClass(cls.id, 'inscritsGarcon', v)} />
                          <NumCell value={cls.inscritsFille} onChange={(v) => updateClass(cls.id, 'inscritsFille', v)} />
                          {isBac ? (
                            <>
                              <NumCell value={cls.presentsGarcon} onChange={(v) => updateClass(cls.id, 'presentsGarcon', v)} />
                              <NumCell value={cls.presentsFille} onChange={(v) => updateClass(cls.id, 'presentsFille', v)} />
                            </>
                          ) : (
                            <NumCell value={cls.presentsTotal} onChange={(v) => updateClass(cls.id, 'presentsTotal', v)} />
                          )}
                          <NumCell value={cls.admisGarcon} onChange={(v) => updateClass(cls.id, 'admisGarcon', v)} />
                          <NumCell value={cls.admisFille} onChange={(v) => updateClass(cls.id, 'admisFille', v)} />
                          <td className="px-3 py-1.5 text-center text-blue-700 bg-blue-50/50 font-medium">{computed.inscritsTotal}</td>
                          {isBac && <td className="px-3 py-1.5 text-center text-blue-700 bg-blue-50/50">{computed.absents}</td>}
                          <td className="px-3 py-1.5 text-center text-blue-700 bg-blue-50/50 font-medium">{computed.admisTotal}</td>
                          <td className="px-3 py-1.5 text-center text-blue-700 bg-blue-50/50 font-medium">{pct(computed.tauxTotal)}</td>
                          <td className="px-3 py-1.5 text-center text-blue-700 bg-blue-50/50">{pct(computed.tauxGarcon)}</td>
                          <td className="px-3 py-1.5 text-center text-blue-700 bg-blue-50/50">{pct(computed.tauxFille)}</td>
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

      {/* Import modal */}
      <Modal
        open={showImport}
        title="Importer des données"
        onClose={() => { setShowImport(false); setImportErrors([]); }}
        footer={<Button onClick={() => { setShowImport(false); setImportErrors([]); }}>Fermer</Button>}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Importez un fichier Excel (.xlsx) ou CSV avec les colonnes correctes.
          </p>
          <Button size="sm" variant="ghost" onClick={() => downloadTemplate(session.examType)}>
            Télécharger le modèle {session.examType}
          </Button>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-green-500 transition-colors">
            <span className="text-sm text-gray-500">Cliquez ou glissez un fichier Excel/CSV</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          </label>
          {importErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              {importErrors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function NumCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <td className="px-1 py-1">
      <input
        type="number"
        min={0}
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="w-16 text-center border border-gray-200 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
      />
    </td>
  );
}
