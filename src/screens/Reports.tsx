import { useState } from 'react';
import {
  PieChart, Pie, Cell,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { Session, Centre } from '../types';
import { getSession } from '../lib/storage';
import { computeRow, computeTotals, pct } from '../lib/calculations';
import { countErrors } from '../lib/validation';
import { exportBEPCGeneral, exportBEPCParEtablissement, exportBACStatistique } from '../lib/exportPdf';
import { exportExcel } from '../lib/exportExcel';
import Button from '../components/ui/Button';
import Logo from '../components/ui/Logo';

interface Props {
  sessionId: string;
  onBack: () => void;
  onEdit: () => void;
}

type ReportType = 'bepc-general' | 'bepc-etablissement' | 'bac';
type ColColor = 'g' | 'f' | undefined;

const PIE_COLORS = ['#1C2B3A', '#F4732A', '#2D4155', '#D95F18', '#3D5468', '#B04E12', '#4D6678', '#8C3B0C', '#0F1E2C', '#C05514'];

export default function Reports({ sessionId, onBack, onEdit }: Props) {
  const session = getSession(sessionId)!;
  const [activeReport, setActiveReport] = useState<ReportType>(
    session.examType === 'BAC' ? 'bac' : 'bepc-general'
  );

  const isBac = session.examType === 'BAC';
  const computed = session.classes.map((c) => computeRow(c, session.examType));
  const totals = computeTotals(computed, session.examType);
  const errors = countErrors(session.classes, session.examType);

  const truncate = (s: string) => s.length > 14 ? s.slice(0, 13) + '…' : s;

  const admisData = computed
    .filter((r) => r.admisTotal > 0)
    .map((r) => ({ name: truncate(r.name), value: r.admisTotal }));

  const genderData = [
    { name: 'Garçons', value: totals.admisGarcon },
    { name: 'Filles', value: totals.admisFille },
  ].filter((d) => d.value > 0);

  function handleExportPdf() {
    if (activeReport === 'bepc-general') exportBEPCGeneral(session);
    else if (activeReport === 'bepc-etablissement') exportBEPCParEtablissement(session);
    else exportBACStatistique(session);
  }

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
              <h1 className="font-bold text-sm leading-tight">{session.etablissement}</h1>
              <p className="text-white/40 text-xs mt-0.5">{session.examType} — {session.anneeScolaire}{session.examSession ? ` — ${session.examSession}` : ''}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button size="sm" variant="secondary" onClick={onEdit} className="flex-1 sm:flex-none justify-center">Modifier</Button>
            <Button size="sm" variant="secondary" onClick={() => exportExcel(session)} className="flex-1 sm:flex-none justify-center">Excel</Button>
            <Button size="sm" variant="accent" onClick={handleExportPdf} className="flex-1 sm:flex-none justify-center">Export PDF</Button>
          </div>
        </div>
      </header>

      {!isBac && (
        <div className="bg-[#F5F0EB] border-b border-[#E5DDD5] px-4 sm:px-6">
          <div className="max-w-6xl mx-auto flex items-center gap-1 py-2 overflow-x-auto">
            {([
              ['bepc-general', 'Statistique générale'],
              ['bepc-etablissement', 'Statistique par établissement'],
            ] as [ReportType, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveReport(key)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all shrink-0 whitespace-nowrap ${
                  activeReport === key ? 'bg-[#1C2B3A] text-white' : 'text-gray-500 hover:text-[#1C2B3A] hover:bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5">
        {errors > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
            <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
            <p className="text-sm text-red-700">
              <span className="font-semibold">{errors} incohérence{errors > 1 ? 's' : ''} de saisie détectée{errors > 1 ? 's' : ''}.</span>{' '}
              Les taux sont plafonnés à 100%, mais corrigez les données via « Modifier » avant d'exporter le document officiel.
            </p>
          </div>
        )}

        <div className="bg-white border border-[#E5DDD5] rounded-lg overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-[#E5DDD5]">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-3 text-xs text-gray-600 mb-2">
              <div className="min-w-0">
                <p className="font-medium">{session.ministere}</p>
                <div className="border-b border-gray-300 my-1 w-40 sm:w-48" />
                <p>{session.drena}</p>
                <div className="border-b border-gray-300 my-1 w-40 sm:w-48" />
                <p>{session.etablissement}</p>
                {session.code && <p>{session.code}</p>}
              </div>
              <div className="sm:text-right shrink-0">
                <p className="font-medium">ANNEE SCOLAIRE</p>
                <p>{session.anneeScolaire}</p>
                {session.examSession && (
                  <>
                    <p className="font-medium mt-1">SESSION</p>
                    <p>{session.examSession}</p>
                  </>
                )}
              </div>
            </div>
            {activeReport === 'bepc-general' && <h2 className="text-lg sm:text-xl font-bold text-center mt-4">Statistique générale</h2>}
            {activeReport === 'bepc-etablissement' && <h2 className="text-lg sm:text-xl font-bold text-center mt-4">Statistique par établissement</h2>}
            {activeReport === 'bac' && (
              <div className="text-center mt-4">
                <h2 className="text-base sm:text-lg font-bold uppercase">{`STATISTIQUE ${session.etablissement.toUpperCase()}`}</h2>
                <div className="inline-block bg-[#1C2B3A] text-white rounded-lg px-4 py-1.5 mt-2">
                  <span className="font-semibold text-sm">Baccalauréat {session.examSession}</span>
                </div>
              </div>
            )}
          </div>
          <div className="overflow-x-auto p-3 sm:p-4">
            {activeReport === 'bepc-general' && <BEPCGeneralTable rows={computed} totals={totals} />}
            {activeReport === 'bepc-etablissement' && <BEPCParEtablissementTable session={session} computed={computed} />}
            {activeReport === 'bac' && <BACTable rows={computed} totals={totals} />}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
          <StatCard label="Inscrits" value={totals.inscritsTotal} />
          <StatCard label="Présents" value={totals.presentsTotal} />
          <StatCard label="Admis" value={totals.admisTotal} />
          <StatCard label="Taux global" value={pct(totals.tauxTotal)} highlight={totals.tauxTotal >= 0.5 ? 'success' : 'warn'} />
          <StatCard label="Taux garçons" value={pct(totals.tauxGarcon)} />
          <StatCard label="Taux filles" value={pct(totals.tauxFille)} />
        </div>

        {computed.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-[#E5DDD5] rounded-lg p-4 sm:p-5">
              <h3 className="font-bold text-[#0A0A0A] text-sm mb-1">Répartition des admis par classe</h3>
              <p className="text-xs text-gray-400 mb-2">Nombre d'admis par classe</p>
              {admisData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={admisData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2} dataKey="value">
                      {admisData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, 'Admis']} contentStyle={{ borderRadius: '8px', border: '1px solid #E5DDD5', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-400 text-sm py-16">Aucun admis enregistré</p>
              )}
            </div>
            <div className="bg-white border border-[#E5DDD5] rounded-lg p-4 sm:p-5">
              <h3 className="font-bold text-[#0A0A0A] text-sm mb-1">Garçons vs Filles</h3>
              <p className="text-xs text-gray-400 mb-2">Parmi les admis</p>
              {genderData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={genderData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value">
                      <Cell fill="#1C2B3A" />
                      <Cell fill="#F4732A" />
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, 'Admis']} contentStyle={{ borderRadius: '8px', border: '1px solid #E5DDD5', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-400 text-sm py-16">Aucune donnée</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: 'success' | 'warn' }) {
  const style = highlight === 'success' ? 'bg-emerald-50 border-emerald-200' : highlight === 'warn' ? 'bg-orange-50 border-orange-200' : 'bg-white border-[#E5DDD5]';
  const valueStyle = highlight === 'success' ? 'text-emerald-700' : highlight === 'warn' ? 'text-[#F4732A]' : 'text-[#0A0A0A]';
  return (
    <div className={`rounded-lg px-4 sm:px-5 py-4 text-center sm:min-w-[120px] border ${style}`}>
      <p className={`text-xl sm:text-2xl font-bold ${valueStyle}`}>{value}</p>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

function BEPCGeneralTable({ rows, totals }: { rows: ReturnType<typeof computeRow>[]; totals: ReturnType<typeof computeTotals> }) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead><tr>
        <Th>Classe</Th>
        <Th>Candidats inscrits</Th>
        <Th>Candidats Présents</Th>
        <Th>Admis</Th>
        <Th>Taux d'admission</Th>
        <Th color="g">Inscrits Garçon</Th>
        <Th color="g">Admis Garçon</Th>
        <Th color="g">Taux d'admission Garçon</Th>
        <Th color="f">Inscrits Fille</Th>
        <Th color="f">Admis Fille</Th>
        <Th color="f">Taux d'admission Fille</Th>
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
            <Td left>{r.name}</Td>
            <Td>{r.inscritsTotal}</Td><Td>{r.presentsTotal}</Td><Td>{r.admisTotal}</Td><Td>{pct(r.tauxTotal)}</Td>
            <Td color="g">{r.inscritsGarcon}</Td><Td color="g">{r.admisGarcon}</Td><Td color="g">{pct(r.tauxGarcon)}</Td>
            <Td color="f">{r.inscritsFille}</Td><Td color="f">{r.admisFille}</Td><Td color="f">{pct(r.tauxFille)}</Td>
          </tr>
        ))}
        <tr className="font-bold">
          <Td left total>TOTAL</Td>
          <Td total>{totals.inscritsTotal}</Td><Td total>{totals.presentsTotal}</Td><Td total>{totals.admisTotal}</Td><Td total>{pct(totals.tauxTotal)}</Td>
          <Td color="g" total>{totals.inscritsGarcon}</Td><Td color="g" total>{totals.admisGarcon}</Td><Td color="g" total>{pct(totals.tauxGarcon)}</Td>
          <Td color="f" total>{totals.inscritsFille}</Td><Td color="f" total>{totals.admisFille}</Td><Td color="f" total>{pct(totals.tauxFille)}</Td>
        </tr>
      </tbody>
    </table>
  );
}

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
            <div className="bg-[#1C2B3A] text-white px-3 py-2 font-bold text-sm rounded-t tracking-wide">{centre ? centre.name : 'AUTRE'}</div>
            <table className="w-full text-xs border-collapse border border-gray-300">
              <thead><tr>
                <Th>Classe</Th><Th>Cand. inscrits</Th><Th>Cand. Présents</Th><Th>Admis</Th><Th>Taux</Th>
                <Th color="g">Inscrits G</Th><Th color="g">Admis G</Th><Th color="g">Taux G</Th>
                <Th color="f">Inscrits F</Th><Th color="f">Admis F</Th><Th color="f">Taux F</Th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <Td left>{r.name}</Td><Td>{r.inscritsTotal}</Td><Td>{r.presentsTotal}</Td><Td>{r.admisTotal}</Td><Td>{pct(r.tauxTotal)}</Td>
                    <Td color="g">{r.inscritsGarcon}</Td><Td color="g">{r.admisGarcon}</Td><Td color="g">{pct(r.tauxGarcon)}</Td>
                    <Td color="f">{r.inscritsFille}</Td><Td color="f">{r.admisFille}</Td><Td color="f">{pct(r.tauxFille)}</Td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <Td left total>TOTAL</Td><Td total>{groupTotals.inscritsTotal}</Td><Td total>{groupTotals.presentsTotal}</Td><Td total>{groupTotals.admisTotal}</Td><Td total>{pct(groupTotals.tauxTotal)}</Td>
                  <Td color="g" total>{groupTotals.inscritsGarcon}</Td><Td color="g" total>{groupTotals.admisGarcon}</Td><Td color="g" total>{pct(groupTotals.tauxGarcon)}</Td>
                  <Td color="f" total>{groupTotals.inscritsFille}</Td><Td color="f" total>{groupTotals.admisFille}</Td><Td color="f" total>{pct(groupTotals.tauxFille)}</Td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
      <table className="w-full text-xs border-collapse"><tbody>
        <tr className="font-bold text-sm">
          <Td left total>TOTAL GÉNÉRAL</Td><Td total>{allTotals.inscritsTotal}</Td><Td total>{allTotals.presentsTotal}</Td><Td total>{allTotals.admisTotal}</Td><Td total>{pct(allTotals.tauxTotal)}</Td>
          <Td color="g" total>{allTotals.inscritsGarcon}</Td><Td color="g" total>{allTotals.admisGarcon}</Td><Td color="g" total>{pct(allTotals.tauxGarcon)}</Td>
          <Td color="f" total>{allTotals.inscritsFille}</Td><Td color="f" total>{allTotals.admisFille}</Td><Td color="f" total>{pct(allTotals.tauxFille)}</Td>
        </tr>
      </tbody></table>
    </div>
  );
}

function BACTable({ rows, totals }: { rows: ReturnType<typeof computeRow>[]; totals: ReturnType<typeof computeTotals> }) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead><tr>
        <Th>Classe & Série</Th><Th>Cand. inscrits</Th><Th>Cand. Présents</Th><Th>Cand. absents</Th><Th>Admis</Th><Th>Taux d'admission</Th>
        <Th color="g">Inscrits (G)</Th><Th color="g">Présents (G)</Th><Th color="g">Admis (G)</Th><Th color="g">Taux (G)</Th>
        <Th color="f">Inscrits (F)</Th><Th color="f">Présents (F)</Th><Th color="f">Admis (F)</Th><Th color="f">Taux (F)</Th>
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
            <Td left>{r.name}</Td>
            <Td>{r.inscritsTotal}</Td><Td>{r.presentsTotal}</Td><Td>{r.absents}</Td><Td>{r.admisTotal}</Td><Td>{pct(r.tauxTotal)}</Td>
            <Td color="g">{r.inscritsGarcon}</Td><Td color="g">{r.presentsGarcon}</Td><Td color="g">{r.admisGarcon}</Td><Td color="g">{pct(r.tauxGarcon)}</Td>
            <Td color="f">{r.inscritsFille}</Td><Td color="f">{r.presentsFille}</Td><Td color="f">{r.admisFille}</Td><Td color="f">{pct(r.tauxFille)}</Td>
          </tr>
        ))}
        <tr className="font-bold">
          <Td left total>TOTAL</Td>
          <Td total>{totals.inscritsTotal}</Td><Td total>{totals.presentsTotal}</Td><Td total>{totals.absents}</Td><Td total>{totals.admisTotal}</Td><Td total>{pct(totals.tauxTotal)}</Td>
          <Td color="g" total>{totals.inscritsGarcon}</Td><Td color="g" total>{totals.presentsGarcon}</Td><Td color="g" total>{totals.admisGarcon}</Td><Td color="g" total>{pct(totals.tauxGarcon)}</Td>
          <Td color="f" total>{totals.inscritsFille}</Td><Td color="f" total>{totals.presentsFille}</Td><Td color="f" total>{totals.admisFille}</Td><Td color="f" total>{pct(totals.tauxFille)}</Td>
        </tr>
      </tbody>
    </table>
  );
}

function Th({ children, color }: { children: React.ReactNode; color?: ColColor }) {
  const bg = color === 'g' ? 'bg-blue-100 text-blue-900' : color === 'f' ? 'bg-pink-100 text-pink-900' : 'bg-gray-100 text-gray-700';
  return <th className={`border border-gray-300 px-2 py-1.5 font-semibold text-center ${bg}`}>{children}</th>;
}
function Td({ children, left, color, total }: { children: React.ReactNode; left?: boolean; color?: ColColor; total?: boolean }) {
  const bg = color === 'g' ? (total ? 'bg-blue-100' : 'bg-blue-50') : color === 'f' ? (total ? 'bg-pink-100' : 'bg-pink-50') : total ? 'bg-gray-200' : '';
  return <td className={`border border-gray-200 px-2 py-1.5 ${left ? 'text-left font-medium' : 'text-center'} ${bg}`}>{children}</td>;
}
