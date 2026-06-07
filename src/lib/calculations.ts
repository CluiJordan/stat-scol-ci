import type { ClassRow, ComputedRow, ComputedTotals, ExamType } from '../types';

export function computeRow(row: ClassRow, examType: ExamType): ComputedRow {
  const inscritsTotal = row.inscritsGarcon + row.inscritsFille;

  let presentsTotal: number;
  let presentsGarcon: number;
  let presentsFille: number;

  if (examType === 'BAC') {
    presentsGarcon = row.presentsGarcon;
    presentsFille = row.presentsFille;
    presentsTotal = presentsGarcon + presentsFille;
  } else {
    presentsTotal = row.presentsTotal;
    presentsGarcon = 0;
    presentsFille = 0;
  }

  const absents = inscritsTotal - presentsTotal;
  const admisTotal = row.admisGarcon + row.admisFille;
  const tauxTotal = presentsTotal > 0 ? admisTotal / presentsTotal : 0;

  let tauxGarcon: number;
  let tauxFille: number;

  if (examType === 'BAC') {
    tauxGarcon = presentsGarcon > 0 ? row.admisGarcon / presentsGarcon : 0;
    tauxFille = presentsFille > 0 ? row.admisFille / presentsFille : 0;
  } else {
    // BEPC: présents garçon/fille non saisis → taux = admis / inscrits
    tauxGarcon = row.inscritsGarcon > 0 ? row.admisGarcon / row.inscritsGarcon : 0;
    tauxFille = row.inscritsFille > 0 ? row.admisFille / row.inscritsFille : 0;
  }

  return {
    id: row.id,
    name: row.name,
    centreId: row.centreId,
    inscritsTotal,
    inscritsGarcon: row.inscritsGarcon,
    inscritsFille: row.inscritsFille,
    presentsTotal,
    presentsGarcon,
    presentsFille,
    absents,
    admisTotal,
    admisGarcon: row.admisGarcon,
    admisFille: row.admisFille,
    tauxTotal,
    tauxGarcon,
    tauxFille,
  };
}

export function computeTotals(rows: ComputedRow[], examType: ExamType): ComputedTotals {
  const inscritsTotal = rows.reduce((s, r) => s + r.inscritsTotal, 0);
  const inscritsGarcon = rows.reduce((s, r) => s + r.inscritsGarcon, 0);
  const inscritsFille = rows.reduce((s, r) => s + r.inscritsFille, 0);
  const presentsTotal = rows.reduce((s, r) => s + r.presentsTotal, 0);
  const presentsGarcon = rows.reduce((s, r) => s + r.presentsGarcon, 0);
  const presentsFille = rows.reduce((s, r) => s + r.presentsFille, 0);
  const absents = inscritsTotal - presentsTotal;
  const admisTotal = rows.reduce((s, r) => s + r.admisTotal, 0);
  const admisGarcon = rows.reduce((s, r) => s + r.admisGarcon, 0);
  const admisFille = rows.reduce((s, r) => s + r.admisFille, 0);

  const tauxTotal = presentsTotal > 0 ? admisTotal / presentsTotal : 0;
  let tauxGarcon: number;
  let tauxFille: number;

  if (examType === 'BAC') {
    tauxGarcon = presentsGarcon > 0 ? admisGarcon / presentsGarcon : 0;
    tauxFille = presentsFille > 0 ? admisFille / presentsFille : 0;
  } else {
    tauxGarcon = inscritsGarcon > 0 ? admisGarcon / inscritsGarcon : 0;
    tauxFille = inscritsFille > 0 ? admisFille / inscritsFille : 0;
  }

  return {
    inscritsTotal, inscritsGarcon, inscritsFille,
    presentsTotal, presentsGarcon, presentsFille,
    absents, admisTotal, admisGarcon, admisFille,
    tauxTotal, tauxGarcon, tauxFille,
  };
}

export function pct(value: number): string {
  return (value * 100).toFixed(2).replace('.', ',') + '%';
}
