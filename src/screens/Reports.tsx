import React, { useState } from 'react';
import type { Session, Centre } from '../types';
import { getSession } from '../lib/storage';
import { computeRow, computeTotals, pct, admisThreshold } from '../lib/calculations';
import { countErrors } from '../lib/validation';
import { exportBEPCGeneral, exportBEPCParEtablissement, exportBACStatistique, exportListeAdmis } from '../lib/exportPdf';
import { exportExcel } from '../lib/exportExcel';
import { Masthead, Ticker, Donut, BarChart, SectionHead, useToast } from '../components/ui/design';

interface Props {
  sessionId: string;
  onBack: () => void;
  onEdit: () => void;
}

type ReportType = 'bepc-general' | 'bepc-etablissement' | 'bac';
type ColKind = 'gar' | 'fil' | undefined;

export default function Reports({ sessionId, onBack, onEdit }: Props) {
  const session = getSession(sessionId)!;
  const [report, setReport] = useState<ReportType>(session.examType === 'BAC' ? 'bac' : 'bepc-general');
  const [toast, showToast] = useToast();
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(() => new Set(session.classes.map((c) => c.id)));
  const [showFilter, setShowFilter] = useState(false);

  const isBac = session.examType === 'BAC';
  const allSelected = selectedClassIds.size === session.classes.length;

  const filteredClasses = session.classes.filter((c) => selectedClassIds.has(c.id));
  const filteredSession = { ...session, classes: filteredClasses };
  const computed = filteredClasses.map((c) => computeRow(c, session.examType));
  const totals = computeTotals(computed, session.examType);
  const errors = countErrors(filteredClasses, session.examType);
  const good = totals.tauxTotal >= 0.5;

  const toggleClass = (id: string) => setSelectedClassIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => setSelectedClassIds(allSelected ? new Set() : new Set(session.classes.map((c) => c.id)));

  const barRows = computed
    .filter((r) => r.admisTotal > 0)
    .sort((a, b) => b.admisTotal - a.admisTotal)
    .map((r, i) => ({ label: r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name, value: r.admisTotal, color: i === 0 ? 'var(--orange)' : 'var(--ink)' }));

  function handlePdf() {
    if (report === 'bepc-general') exportBEPCGeneral(filteredSession);
    else if (report === 'bepc-etablissement') exportBEPCParEtablissement(filteredSession);
    else exportBACStatistique(filteredSession);
  }

  return (
    <div className="screen-enter" style={{ minHeight: '100vh' }}>
      <Masthead back={onBack}
        title={session.etablissement}
        sub={`${session.examType} · ${session.anneeScolaire}${session.examSession ? ' · ' + session.examSession : ''}`}
        right={
          <>
            <button className="btn btn--sm" onClick={onEdit}>Modifier</button>
            <button className="btn btn--sm" onClick={() => { exportExcel(filteredSession); showToast('Export Excel en cours…'); }}>Excel</button>
            <button className="btn btn--sm btn--accent" onClick={handlePdf}>Export PDF ↓</button>
          </>
        }
      />

      <div className="shell" style={{ paddingTop: 40, paddingBottom: 90 }}>
        {errors > 0 && (
          <div style={{ display: 'flex', gap: 12, padding: '13px 16px', border: '1px solid var(--orange-d)', background: 'var(--orange-w)', borderRadius: 4, marginBottom: 30 }}>
            <span style={{ color: 'var(--orange-d)', fontSize: 17 }}>▲</span>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              <strong style={{ color: 'var(--orange-d)' }}>{errors} incohérence{errors > 1 ? 's' : ''} de saisie.</strong> Les taux sont plafonnés à 100 %. Corrigez via « Modifier » avant l’export officiel.
            </div>
          </div>
        )}

        {/* HERO */}
        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)', gap: 'clamp(24px, 5vw, 70px)', alignItems: 'end' }} className="report-hero">
          <div>
            <div className="eyebrow rise">{isBac ? 'Baccalauréat' : 'BEPC'} · {session.examSession}</div>
            <div className="rise" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 6, animationDelay: 'calc(.05s * var(--speed))' }}>
              <span className="display tnum" style={{ fontSize: 'clamp(96px, 19vw, 220px)', color: good ? 'var(--green-d)' : 'var(--orange-d)', lineHeight: 0.9 }}>
                <Ticker value={totals.tauxTotal * 100} decimals={1} duration={1300} />
              </span>
              <span className="display" style={{ fontSize: 'clamp(34px, 6vw, 64px)', color: good ? 'var(--green-d)' : 'var(--orange-d)', marginTop: 6 }}>%</span>
            </div>
            <div className="eyebrow rise" style={{ marginTop: 26, animationDelay: 'calc(.1s * var(--speed))' }}>
              taux d’admission global · {totals.admisTotal} admis sur {totals.presentsTotal} présents
            </div>
          </div>
          <div className="rise" style={{ animationDelay: 'calc(.15s * var(--speed))', borderLeft: '1px solid var(--line)', paddingLeft: 'clamp(20px, 4vw, 44px)' }}>
            <GenderFig color="var(--green-d)" dot="var(--gar)" label="Garçons" value={totals.tauxGarcon} sub={`${totals.admisGarcon} admis`} />
            <hr className="rule" style={{ margin: '18px 0' }} />
            <GenderFig color="var(--orange-d)" dot="var(--fil)" label="Filles" value={totals.tauxFille} sub={`${totals.admisFille} admises`} />
          </div>
        </section>

        <hr className="rule-ink" style={{ marginTop: 40 }} />

        {/* STAT STRIP */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--line)' }} className="stat-strip">
          <StatFig label="Inscrits" value={totals.inscritsTotal} />
          <StatFig label="Présents" value={totals.presentsTotal} />
          <StatFig label="Absents" value={totals.absents} />
          <StatFig label="Admis" value={totals.admisTotal} accent />
        </section>

        {/* CHARTS */}
        {computed.length > 0 && (
          <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 'clamp(24px, 5vw, 56px)', marginTop: 44 }} className="charts">
            <div>
              <h3 className="eyebrow" style={{ marginBottom: 18 }}>Admis · garçons / filles</h3>
              <Donut a={totals.admisGarcon} b={totals.admisFille} labelA="Garçons" labelB="Filles" />
            </div>
            <div>
              <h3 className="eyebrow" style={{ marginBottom: 18 }}>Admis par classe</h3>
              {barRows.length > 0
                ? <BarChart rows={barRows} />
                : <p className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>Aucun admis enregistré.</p>}
            </div>
          </section>
        )}

        {/* FILTER PANEL */}
        {session.classes.length > 1 && (
          <section style={{ marginTop: 44 }}>
            <button
              onClick={() => setShowFilter((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '9px 14px', cursor: 'pointer', width: '100%', justifyContent: 'space-between' }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>
                Filtrer l'export
              </span>
              <span className="mono" style={{ fontSize: 11, color: allSelected ? 'var(--ink-3)' : 'var(--orange-d)', fontWeight: allSelected ? 400 : 700 }}>
                {allSelected ? 'Toutes les classes' : `${selectedClassIds.size} / ${session.classes.length} classe${session.classes.length > 1 ? 's' : ''}`} {showFilter ? '▲' : '▼'}
              </span>
            </button>
            {showFilter && (
              <div style={{ border: '1px solid var(--line)', borderTop: 'none', borderRadius: '0 0 4px 4px', padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = !allSelected && selectedClassIds.size > 0; }} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--ink)' }} />
                    <span className="mono" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Tout sélectionner</span>
                  </label>
                </div>
                {isBac ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {session.classes.map((c) => (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '5px 10px', border: `1px solid ${selectedClassIds.has(c.id) ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 3, background: selectedClassIds.has(c.id) ? 'var(--ink)' : 'transparent', userSelect: 'none', transition: 'all .12s' }}>
                        <input type="checkbox" checked={selectedClassIds.has(c.id)} onChange={() => toggleClass(c.id)} style={{ display: 'none' }} />
                        <span className="mono" style={{ fontSize: 11, color: selectedClassIds.has(c.id) ? '#fff' : 'var(--ink-2)' }}>{c.name || '—'}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {session.centres.length > 0 ? (
                      <>
                        {session.centres.map((centre) => {
                          const centreClasses = session.classes.filter((c) => c.centreId === centre.id);
                          if (centreClasses.length === 0) return null;
                          const allCentreSelected = centreClasses.every((c) => selectedClassIds.has(c.id));
                          return (
                            <div key={centre.id}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none', marginBottom: 8 }}>
                                <input type="checkbox" checked={allCentreSelected}
                                  ref={(el) => { if (el) el.indeterminate = !allCentreSelected && centreClasses.some((c) => selectedClassIds.has(c.id)); }}
                                  onChange={() => {
                                    setSelectedClassIds((prev) => {
                                      const next = new Set(prev);
                                      centreClasses.forEach((c) => allCentreSelected ? next.delete(c.id) : next.add(c.id));
                                      return next;
                                    });
                                  }} style={{ cursor: 'pointer', accentColor: 'var(--ink)' }} />
                                <span className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--ink-2)' }}>{centre.name}</span>
                              </label>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 22 }}>
                                {centreClasses.map((c) => (
                                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '4px 9px', border: `1px solid ${selectedClassIds.has(c.id) ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 3, background: selectedClassIds.has(c.id) ? 'var(--ink)' : 'transparent', userSelect: 'none', transition: 'all .12s' }}>
                                    <input type="checkbox" checked={selectedClassIds.has(c.id)} onChange={() => toggleClass(c.id)} style={{ display: 'none' }} />
                                    <span className="mono" style={{ fontSize: 11, color: selectedClassIds.has(c.id) ? '#fff' : 'var(--ink-2)' }}>{c.name || '—'}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        {session.classes.filter((c) => !c.centreId || !session.centres.find((ct) => ct.id === c.centreId)).length > 0 && (
                          <div>
                            <span className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8, display: 'block' }}>Autres</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 22 }}>
                              {session.classes.filter((c) => !c.centreId || !session.centres.find((ct) => ct.id === c.centreId)).map((c) => (
                                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '4px 9px', border: `1px solid ${selectedClassIds.has(c.id) ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 3, background: selectedClassIds.has(c.id) ? 'var(--ink)' : 'transparent', userSelect: 'none', transition: 'all .12s' }}>
                                  <input type="checkbox" checked={selectedClassIds.has(c.id)} onChange={() => toggleClass(c.id)} style={{ display: 'none' }} />
                                  <span className="mono" style={{ fontSize: 11, color: selectedClassIds.has(c.id) ? '#fff' : 'var(--ink-2)' }}>{c.name || '—'}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {session.classes.map((c) => (
                          <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '5px 10px', border: `1px solid ${selectedClassIds.has(c.id) ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 3, background: selectedClassIds.has(c.id) ? 'var(--ink)' : 'transparent', userSelect: 'none', transition: 'all .12s' }}>
                            <input type="checkbox" checked={selectedClassIds.has(c.id)} onChange={() => toggleClass(c.id)} style={{ display: 'none' }} />
                            <span className="mono" style={{ fontSize: 11, color: selectedClassIds.has(c.id) ? '#fff' : 'var(--ink-2)' }}>{c.name || '—'}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* OFFICIAL TABLE */}
        <section style={{ marginTop: 56 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
            <SectionHead n="✶" title="Le relevé officiel" desc="Tableau prêt à l’export, fidèle au format administratif." />
            {!isBac && (
              <div style={{ display: 'flex', gap: 0, border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden' }}>
                {([['bepc-general', 'Générale'], ['bepc-etablissement', 'Par établissement']] as [ReportType, string][]).map(([k, l]) => (
                  <button key={k} onClick={() => setReport(k)} className="mono"
                    style={{ padding: '9px 14px', fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', background: report === k ? 'var(--ink)' : 'transparent', color: report === k ? 'var(--paper)' : 'var(--ink-2)' }}>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          <BulletinHeader session={session} />
          <div className="scroll-x" style={{ border: '1px solid var(--line)', borderTop: 'none' }}>
            {report === 'bepc-general' && <BEPCTable rows={computed} totals={totals} />}
            {report === 'bepc-etablissement' && <BEPCParEtabTable session={session} computed={computed} />}
            {report === 'bac' && <BACTable rows={computed} totals={totals} />}
          </div>
        </section>

        {/* LISTE DES ADMIS */}
        {session.eleves.length > 0 && (() => {
          const admisCount = session.eleves.filter((e) => e.points !== null && e.points >= admisThreshold(session.examType)).length;
          return (
            <section style={{ marginTop: 56 }}>
              <SectionHead n="★" title="Liste des admis" desc={`${admisCount} admis — triés alphabétiquement, toutes classes confondues.`} />
              <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220, border: '1px solid var(--line)', borderRadius: 6, padding: '20px 22px' }}>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>Grand format</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 14 }}>Grande police — pour affichage</div>
                  <button className="btn btn--sm btn--accent" style={{ width: '100%' }}
                    onClick={() => { exportListeAdmis(session, 'grand'); showToast('Export en cours…'); }}>
                    ↓ Télécharger (affichage)
                  </button>
                </div>
                <div style={{ flex: 1, minWidth: 220, border: '1px solid var(--line)', borderRadius: 6, padding: '20px 22px' }}>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>Format normal</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 14 }}>Police standard — pour conservation</div>
                  <button className="btn btn--sm" style={{ width: '100%' }}
                    onClick={() => { exportListeAdmis(session, 'normal'); showToast('Export en cours…'); }}>
                    ↓ Télécharger (conservation)
                  </button>
                </div>
              </div>
            </section>
          );
        })()}
      </div>

      {toast}
    </div>
  );
}

function GenderFig({ color, dot, label, value, sub }: { color: string; dot: string; label: string; value: number; sub: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 11, height: 11, background: dot, borderRadius: 2, display: 'inline-block' }} />
        <span className="mono" style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>{label}</span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span className="display tnum" style={{ fontSize: 'clamp(28px, 5vw, 42px)', color }}>
          <Ticker value={value * 100} decimals={1} duration={1300} />%
        </span>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function StatFig({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div style={{ padding: '24px 18px 24px 0', borderRight: '1px solid var(--line)' }}>
      <div className="display tnum" style={{ fontSize: 'clamp(30px, 5vw, 48px)', color: accent ? 'var(--orange-d)' : 'var(--ink)' }}>
        <Ticker value={value} duration={1100} />
      </div>
      <div className="eyebrow" style={{ marginTop: 5 }}>{label}</div>
    </div>
  );
}

function BulletinHeader({ session }: { session: Session }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderBottom: 'none', background: 'var(--card)', padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div className="mono" style={{ fontSize: 10.5, lineHeight: 1.7, color: 'var(--ink-2)', maxWidth: 360 }}>
          <div>{session.ministere}</div>
          <div style={{ marginTop: 6 }}>{session.drena}</div>
          <div style={{ color: 'var(--ink)', fontWeight: 700 }}>{session.etablissement}{session.code ? ` · ${session.code}` : ''}</div>
        </div>
        <div className="mono" style={{ fontSize: 10.5, lineHeight: 1.7, color: 'var(--ink-2)', textAlign: 'right' }}>
          <div>ANNÉE SCOLAIRE</div>
          <div style={{ color: 'var(--ink)' }}>{session.anneeScolaire}</div>
          {session.examSession && <div style={{ marginTop: 4 }}>{session.examSession}</div>}
        </div>
      </div>
    </div>
  );
}

function Th({ children, c }: { children: React.ReactNode; c?: ColKind }) {
  const color = c === 'gar' ? 'var(--green-w)' : c === 'fil' ? 'var(--orange-w)' : '#fff';
  return (
    <th style={{ background: 'var(--ink)', color, padding: '9px 8px', fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 400, borderRight: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap', textAlign: 'center' }}>
      {children}
    </th>
  );
}

function Td({ children, left, c, total }: { children: React.ReactNode; left?: boolean; c?: ColKind; total?: boolean }) {
  const bg = c === 'gar'
    ? (total ? 'var(--green-w)' : 'rgba(127,180,120,0.07)')
    : c === 'fil'
    ? (total ? 'var(--orange-w)' : 'rgba(226,105,31,0.06)')
    : total ? 'var(--paper-3)' : 'transparent';
  return (
    <td style={{ padding: '8px 9px', textAlign: left ? 'left' : 'center', background: bg, borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)', fontFamily: left ? 'var(--display)' : 'var(--mono)', fontWeight: left || total ? 700 : 400, fontSize: left ? 12.5 : 11.5, whiteSpace: 'nowrap', color: 'var(--ink)' }}>
      {children}
    </td>
  );
}

function BEPCTable({ rows, totals }: { rows: ReturnType<typeof computeRow>[]; totals: ReturnType<typeof computeTotals> }) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 860 }}>
      <thead><tr>
        <Th>Classe</Th><Th>Inscrits</Th><Th>Présents</Th><Th>Admis</Th><Th>Taux</Th>
        <Th c="gar">Inscr. G</Th><Th c="gar">Admis G</Th><Th c="gar">Taux G</Th>
        <Th c="fil">Inscr. F</Th><Th c="fil">Admis F</Th><Th c="fil">Taux F</Th>
      </tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td left>{r.name}</Td><Td>{r.inscritsTotal}</Td><Td>{r.presentsTotal}</Td><Td>{r.admisTotal}</Td><Td>{pct(r.tauxTotal)}</Td>
            <Td c="gar">{r.inscritsGarcon}</Td><Td c="gar">{r.admisGarcon}</Td><Td c="gar">{pct(r.tauxGarcon)}</Td>
            <Td c="fil">{r.inscritsFille}</Td><Td c="fil">{r.admisFille}</Td><Td c="fil">{pct(r.tauxFille)}</Td>
          </tr>
        ))}
        <tr>
          <Td left total>TOTAL</Td><Td total>{totals.inscritsTotal}</Td><Td total>{totals.presentsTotal}</Td><Td total>{totals.admisTotal}</Td><Td total>{pct(totals.tauxTotal)}</Td>
          <Td c="gar" total>{totals.inscritsGarcon}</Td><Td c="gar" total>{totals.admisGarcon}</Td><Td c="gar" total>{pct(totals.tauxGarcon)}</Td>
          <Td c="fil" total>{totals.inscritsFille}</Td><Td c="fil" total>{totals.admisFille}</Td><Td c="fil" total>{pct(totals.tauxFille)}</Td>
        </tr>
      </tbody>
    </table>
  );
}

function BACTable({ rows, totals }: { rows: ReturnType<typeof computeRow>[]; totals: ReturnType<typeof computeTotals> }) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1000 }}>
      <thead><tr>
        <Th>Classe</Th><Th>Inscrits</Th><Th>Présents</Th><Th>Absents</Th><Th>Admis</Th><Th>Taux</Th>
        <Th c="gar">Inscr. G</Th><Th c="gar">Prés. G</Th><Th c="gar">Admis G</Th><Th c="gar">Taux G</Th>
        <Th c="fil">Inscr. F</Th><Th c="fil">Prés. F</Th><Th c="fil">Admis F</Th><Th c="fil">Taux F</Th>
      </tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td left>{r.name}</Td><Td>{r.inscritsTotal}</Td><Td>{r.presentsTotal}</Td><Td>{r.absents}</Td><Td>{r.admisTotal}</Td><Td>{pct(r.tauxTotal)}</Td>
            <Td c="gar">{r.inscritsGarcon}</Td><Td c="gar">{r.presentsGarcon}</Td><Td c="gar">{r.admisGarcon}</Td><Td c="gar">{pct(r.tauxGarcon)}</Td>
            <Td c="fil">{r.inscritsFille}</Td><Td c="fil">{r.presentsFille}</Td><Td c="fil">{r.admisFille}</Td><Td c="fil">{pct(r.tauxFille)}</Td>
          </tr>
        ))}
        <tr>
          <Td left total>TOTAL</Td><Td total>{totals.inscritsTotal}</Td><Td total>{totals.presentsTotal}</Td><Td total>{totals.absents}</Td><Td total>{totals.admisTotal}</Td><Td total>{pct(totals.tauxTotal)}</Td>
          <Td c="gar" total>{totals.inscritsGarcon}</Td><Td c="gar" total>{totals.presentsGarcon}</Td><Td c="gar" total>{totals.admisGarcon}</Td><Td c="gar" total>{pct(totals.tauxGarcon)}</Td>
          <Td c="fil" total>{totals.inscritsFille}</Td><Td c="fil" total>{totals.presentsFille}</Td><Td c="fil" total>{totals.admisFille}</Td><Td c="fil" total>{pct(totals.tauxFille)}</Td>
        </tr>
      </tbody>
    </table>
  );
}

function BEPCParEtabTable({ session, computed }: { session: Session; computed: ReturnType<typeof computeRow>[] }) {
  const groups: { centre: Centre | null; rows: typeof computed }[] = [];
  session.centres.forEach((centre) => {
    const rows = computed.filter((r) => r.centreId === centre.id);
    if (rows.length > 0) groups.push({ centre, rows });
  });
  const unassigned = computed.filter((r) => !r.centreId || !session.centres.find((c) => c.id === r.centreId));
  if (unassigned.length > 0) groups.push({ centre: null, rows: unassigned });

  return (
    <div>
      {groups.map(({ centre, rows }, gi) => {
        const gt = computeTotals(rows, 'BEPC');
        return (
          <div key={gi}>
            <div className="mono" style={{ background: 'var(--paper-3)', padding: '8px 12px', fontSize: 11, letterSpacing: '0.1em', fontWeight: 700, borderBottom: '1px solid var(--line)' }}>{centre ? centre.name : 'AUTRES'}</div>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 860 }}>
              <thead><tr>
                <Th>Classe</Th><Th>Inscrits</Th><Th>Présents</Th><Th>Admis</Th><Th>Taux</Th>
                <Th c="gar">Inscr. G</Th><Th c="gar">Admis G</Th><Th c="gar">Taux G</Th>
                <Th c="fil">Inscr. F</Th><Th c="fil">Admis F</Th><Th c="fil">Taux F</Th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td left>{r.name}</Td><Td>{r.inscritsTotal}</Td><Td>{r.presentsTotal}</Td><Td>{r.admisTotal}</Td><Td>{pct(r.tauxTotal)}</Td>
                    <Td c="gar">{r.inscritsGarcon}</Td><Td c="gar">{r.admisGarcon}</Td><Td c="gar">{pct(r.tauxGarcon)}</Td>
                    <Td c="fil">{r.inscritsFille}</Td><Td c="fil">{r.admisFille}</Td><Td c="fil">{pct(r.tauxFille)}</Td>
                  </tr>
                ))}
                <tr>
                  <Td left total>TOTAL</Td><Td total>{gt.inscritsTotal}</Td><Td total>{gt.presentsTotal}</Td><Td total>{gt.admisTotal}</Td><Td total>{pct(gt.tauxTotal)}</Td>
                  <Td c="gar" total>{gt.inscritsGarcon}</Td><Td c="gar" total>{gt.admisGarcon}</Td><Td c="gar" total>{pct(gt.tauxGarcon)}</Td>
                  <Td c="fil" total>{gt.inscritsFille}</Td><Td c="fil" total>{gt.admisFille}</Td><Td c="fil" total>{pct(gt.tauxFille)}</Td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
