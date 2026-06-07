import { useState } from 'react';
import type { Session, Centre } from '../types';
import { getSession } from '../lib/storage';
import { computeRow, computeTotals, pct } from '../lib/calculations';
import { exportBEPCGeneral, exportBEPCParEtablissement, exportBACStatistique } from '../lib/exportPdf';
import { exportExcel } from '../lib/exportExcel';
import Button from '../components/ui/Button';


interface Props {
  sessionId: string;
  onBack: () => void;
  onEdit: () => void;
}

type ReportType = 'bepc-general' | 'bepc-etablissement' | 'bac';

export default function Reports({ sessionId, onBack, onEdit }: Props) {
  const session = getSession(sessionId)!;
  const [activeReport, setActiveReport] = useState<ReportType>(
    session.examType === 'BAC' ? 'bac' : 'bepc-general'
  );

  const isBac = session.examType === 'BAC';
  const computed = session.classes.map((c) => computeRow(c, session.examType));
  const totals = computeTotals(computed, session.examType);

  function handleExportPdf() {
    if (activeReport === 'bepc-general') exportBEPCGeneral(session);
    else if (activeReport === 'bepc-etablissement') exportBEPCParEtablissement(session);
    else exportBACStatistique(session);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-800 text-white px-6 py-4 shadow">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <button onClick={onBack} className="text-green-200 hover:text-white text-sm">← Retour</button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold truncate">{session.etablissement}</h1>
            <p className="text-green-200 text-xs">{session.examType} — {session.anneeScolaire}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="bg-white text-green-800 hover:bg-green-50" onClick={onEdit}>Modifier</Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white" onClick={() => exportExcel(session)}>Export Excel</Button>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleExportPdf}>Export PDF</Button>
          </div>
        </div>
      </header>

      {/* Report tabs */}
      {!isBac && (
        <div className="bg-white border-b px-6">
          <div className="max-w-6xl mx-auto flex gap-0">
            {([['bepc-general', 'Statistique générale'], ['bepc-etablissement', 'Statistique par établissement']] as [ReportType, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveReport(key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeReport === key ? 'border-green-700 text-green-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* Official document preview */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          {/* Document header */}
          <div className="p-6 border-b">
            <div className="flex justify-between text-xs text-gray-600 mb-2">
              <div>
                <p className="font-medium">{session.ministere}</p>
                <div className="border-b border-gray-300 my-1 w-48" />
                <p>{session.drena}</p>
                <div className="border-b border-gray-300 my-1 w-48" />
                <p>{session.etablissement}</p>
                {session.code && <p>{session.code}</p>}
              </div>
              <div className="text-right">
                <p className="font-medium">ANNEE SCOLAIRE</p>
                <p>{session.anneeScolaire}</p>
              </div>
            </div>
            {activeReport === 'bepc-general' && (
              <h2 className="text-xl font-bold text-center mt-4">Statistique générale</h2>
            )}
            {activeReport === 'bepc-etablissement' && (
              <h2 className="text-xl font-bold text-center mt-4">Statistique par établissement</h2>
            )}
            {activeReport === 'bac' && (
              <div className="text-center mt-4">
                <h2 className="text-lg font-bold uppercase">{`STATISTIQUE ${session.etablissement.toUpperCase()}`}</h2>
                <div className="inline-block bg-gray-200 rounded px-4 py-1 mt-1">
                  <span className="font-semibold text-sm">Baccalauréat {session.examSession}</span>
                </div>
              </div>
            )}
          </div>

          {/* Tables */}
          <div className="overflow-x-auto p-4">
            {activeReport === 'bepc-general' && <BEPCGeneralTable rows={computed} totals={totals} />}
            {activeReport === 'bepc-etablissement' && <BEPCParEtablissementTable session={session} computed={computed} />}
            {activeReport === 'bac' && <BACTable rows={computed} totals={totals} />}
          </div>
        </div>

        {/* Summary badges */}
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="bg-white border rounded-lg px-4 py-3 text-center min-w-[120px]">
            <p className="text-2xl font-bold text-gray-800">{totals.inscritsTotal}</p>
            <p className="text-xs text-gray-500">Inscrits</p>
          </div>
          <div className="bg-white border rounded-lg px-4 py-3 text-center min-w-[120px]">
            <p className="text-2xl font-bold text-gray-800">{totals.admisTotal}</p>
            <p className="text-xs text-gray-500">Admis</p>
          </div>
          <div className={`border rounded-lg px-4 py-3 text-center min-w-[120px] ${totals.tauxTotal >= 0.5 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
            <p className={`text-2xl font-bold ${totals.tauxTotal >= 0.5 ? 'text-green-700' : 'text-orange-600'}`}>{pct(totals.tauxTotal)}</p>
            <p className="text-xs text-gray-500">Taux global</p>
          </div>
          <div className="bg-white border rounded-lg px-4 py-3 text-center min-w-[120px]">
            <p className="text-2xl font-bold text-gray-800">{pct(totals.tauxGarcon)}</p>
            <p className="text-xs text-gray-500">Taux garçons</p>
          </div>
          <div className="bg-white border rounded-lg px-4 py-3 text-center min-w-[120px]">
            <p className="text-2xl font-bold text-gray-800">{pct(totals.tauxFille)}</p>
            <p className="text-xs text-gray-500">Taux filles</p>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── BEPC General Table ───────────────────────────────────────────────

function BEPCGeneralTable({ rows, totals }: { rows: ReturnType<typeof computeRow>[]; totals: ReturnType<typeof computeTotals> }) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-gray-100">
          <Th>Classe</Th>
          <Th>Candidats inscrits</Th>
          <Th>Candidats Présents</Th>
          <Th>Admis</Th>
          <Th>Taux d'admission</Th>
          <Th>Inscrits Garçon</Th>
          <Th>Admis Garçon</Th>
          <Th>Taux d'admission Garçon</Th>
          <Th>Inscrits Fille</Th>
          <Th>Admis Fille</Th>
          <Th>Taux d'admission Fille</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
            <Td left>{r.name}</Td>
            <Td>{r.inscritsTotal}</Td>
            <Td>{r.presentsTotal}</Td>
            <Td>{r.admisTotal}</Td>
            <Td>{pct(r.tauxTotal)}</Td>
            <Td>{r.inscritsGarcon}</Td>
            <Td>{r.admisGarcon}</Td>
            <Td>{pct(r.tauxGarcon)}</Td>
            <Td>{r.inscritsFille}</Td>
            <Td>{r.admisFille}</Td>
            <Td>{pct(r.tauxFille)}</Td>
          </tr>
        ))}
        <tr className="bg-gray-200 font-bold">
          <Td left>TOTAL</Td>
          <Td>{totals.inscritsTotal}</Td>
          <Td>{totals.presentsTotal}</Td>
          <Td>{totals.admisTotal}</Td>
          <Td>{pct(totals.tauxTotal)}</Td>
          <Td>{totals.inscritsGarcon}</Td>
          <Td>{totals.admisGarcon}</Td>
          <Td>{pct(totals.tauxGarcon)}</Td>
          <Td>{totals.inscritsFille}</Td>
          <Td>{totals.admisFille}</Td>
          <Td>{pct(totals.tauxFille)}</Td>
        </tr>
      </tbody>
    </table>
  );
}

// ── BEPC Par Établissement ──────────────────────────────────────────

function BEPCParEtablissementTable({ session, computed }: { session: Session; computed: ReturnType<typeof computeRow>[] }) {
  const groups: { centre: Centre | null; rows: typeof computed }[] = [];

  session.centres.forEach((centre) => {
    const rows = computed.filter((r) => r.centreId === centre.id);
    if (rows.length > 0) groups.push({ centre, rows });
  });

  const unassigned = computed.filter((r) => !r.centreId || !session.centres.find((c) => c.id === r.centreId));
  if (unassigned.length > 0) groups.push({ centre: null, rows: unassigned });

  const allTotals = computeTotals(computed, 'BEPC');

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ centre, rows }, gi) => {
        const groupTotals = computeTotals(rows, 'BEPC');
        return (
          <div key={gi}>
            <div className="bg-gray-300 px-3 py-1.5 font-bold text-sm rounded-t">{centre ? centre.name : 'AUTRE'}</div>
            <table className="w-full text-xs border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <Th>Classe</Th><Th>Cand. inscrits</Th><Th>Cand. Présents</Th><Th>Admis</Th><Th>Taux</Th>
                  <Th>Inscrits G</Th><Th>Admis G</Th><Th>Taux G</Th>
                  <Th>Inscrits F</Th><Th>Admis F</Th><Th>Taux F</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <Td left>{r.name}</Td><Td>{r.inscritsTotal}</Td><Td>{r.presentsTotal}</Td><Td>{r.admisTotal}</Td><Td>{pct(r.tauxTotal)}</Td>
                    <Td>{r.inscritsGarcon}</Td><Td>{r.admisGarcon}</Td><Td>{pct(r.tauxGarcon)}</Td>
                    <Td>{r.inscritsFille}</Td><Td>{r.admisFille}</Td><Td>{pct(r.tauxFille)}</Td>
                  </tr>
                ))}
                <tr className="bg-gray-200 font-bold">
                  <Td left>TOTAL</Td><Td>{groupTotals.inscritsTotal}</Td><Td>{groupTotals.presentsTotal}</Td><Td>{groupTotals.admisTotal}</Td><Td>{pct(groupTotals.tauxTotal)}</Td>
                  <Td>{groupTotals.inscritsGarcon}</Td><Td>{groupTotals.admisGarcon}</Td><Td>{pct(groupTotals.tauxGarcon)}</Td>
                  <Td>{groupTotals.inscritsFille}</Td><Td>{groupTotals.admisFille}</Td><Td>{pct(groupTotals.tauxFille)}</Td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Total général */}
      <table className="w-full text-xs border-collapse">
        <tbody>
          <tr className="bg-gray-300 font-bold text-sm">
            <Td left>TOTAL GÉNÉRAL</Td><Td>{allTotals.inscritsTotal}</Td><Td>{allTotals.presentsTotal}</Td><Td>{allTotals.admisTotal}</Td><Td>{pct(allTotals.tauxTotal)}</Td>
            <Td>{allTotals.inscritsGarcon}</Td><Td>{allTotals.admisGarcon}</Td><Td>{pct(allTotals.tauxGarcon)}</Td>
            <Td>{allTotals.inscritsFille}</Td><Td>{allTotals.admisFille}</Td><Td>{pct(allTotals.tauxFille)}</Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── BAC Table ───────────────────────────────────────────────────────

function BACTable({ rows, totals }: { rows: ReturnType<typeof computeRow>[]; totals: ReturnType<typeof computeTotals> }) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-gray-100">
          <Th>Classe & Série</Th>
          <Th>Cand. inscrits</Th>
          <Th>Cand. Présents</Th>
          <Th>Cand. absents</Th>
          <Th>Admis</Th>
          <Th>Taux d'admission</Th>
          <Th>Inscrits (G)</Th>
          <Th>Présents (G)</Th>
          <Th>Admis (G)</Th>
          <Th>Taux (G)</Th>
          <Th>Inscrits (F)</Th>
          <Th>Présents (F)</Th>
          <Th>Admis (F)</Th>
          <Th>Taux (F)</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
            <Td left>{r.name}</Td>
            <Td>{r.inscritsTotal}</Td><Td>{r.presentsTotal}</Td><Td>{r.absents}</Td><Td>{r.admisTotal}</Td><Td>{pct(r.tauxTotal)}</Td>
            <Td>{r.inscritsGarcon}</Td><Td>{r.presentsGarcon}</Td><Td>{r.admisGarcon}</Td><Td>{pct(r.tauxGarcon)}</Td>
            <Td>{r.inscritsFille}</Td><Td>{r.presentsFille}</Td><Td>{r.admisFille}</Td><Td>{pct(r.tauxFille)}</Td>
          </tr>
        ))}
        <tr className="bg-gray-200 font-bold">
          <Td left>TOTAL</Td>
          <Td>{totals.inscritsTotal}</Td><Td>{totals.presentsTotal}</Td><Td>{totals.absents}</Td><Td>{totals.admisTotal}</Td><Td>{pct(totals.tauxTotal)}</Td>
          <Td>{totals.inscritsGarcon}</Td><Td>{totals.presentsGarcon}</Td><Td>{totals.admisGarcon}</Td><Td>{pct(totals.tauxGarcon)}</Td>
          <Td>{totals.inscritsFille}</Td><Td>{totals.presentsFille}</Td><Td>{totals.admisFille}</Td><Td>{pct(totals.tauxFille)}</Td>
        </tr>
      </tbody>
    </table>
  );
}

// ── Shared cell components ──────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border border-gray-300 px-2 py-1.5 font-semibold text-center text-gray-700">{children}</th>;
}
function Td({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return <td className={`border border-gray-200 px-2 py-1.5 ${left ? 'text-left font-medium' : 'text-center'}`}>{children}</td>;
}
