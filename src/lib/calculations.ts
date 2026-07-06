import type { ClassRow, ComputedRow, ComputedTotals, Eleve, ExamType } from '../types';

/** Dérive les stats de chaque ClassRow depuis les points des élèves importés. */
export function applyElevesToClasses(
  classes: ClassRow[],
  eleves: Eleve[],
  examType: ExamType,
): ClassRow[] {
  if (eleves.length === 0) return classes;
  return classes.map((cls) => {
    const ce = eleves.filter((e) => e.classe === cls.name);
    if (ce.length === 0) return {
      ...cls,
      inscritsGarcon: 0, inscritsFille: 0,
      presentsTotal: 0, presentsGarcon: 0, presentsFille: 0,
      admisGarcon: 0, admisFille: 0,
    };
    const g = ce.filter((e) => e.genre === 'M');
    const f = ce.filter((e) => e.genre === 'F');
    const present = (e: Eleve) => !e.absent && e.points !== null;
    const threshold = admisThreshold(examType);
    const admis = (e: Eleve) => !e.absent && e.points !== null && e.points >= threshold;
    return {
      ...cls,
      inscritsGarcon: g.length,
      inscritsFille: f.length,
      presentsTotal: examType === 'BEPC' ? ce.filter(present).length : 0,
      presentsGarcon: g.filter(present).length,
      presentsFille: f.filter(present).length,
      admisGarcon: g.filter(admis).length,
      admisFille: f.filter(admis).length,
    };
  });
}

/** Seuil d'admission selon l'examen : 180/360 pour le BEPC, 200/400 pour le BAC. */
export function admisThreshold(examType: ExamType): number {
  return examType === 'BAC' ? 200 : 180;
}

/** Total de points possible : 360 pour le BEPC, 400 pour le BAC. */
export function maxPoints(examType: ExamType): number {
  return examType === 'BAC' ? 400 : 360;
}

/** Borne une valeur dans [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(value, max));
}

/** Ratio borné à [0, 1] — un taux ne peut jamais dépasser 100%. */
function ratio(part: number, whole: number): number {
  return whole > 0 ? clamp(part / whole, 0, 1) : 0;
}

/**
 * Calcule une ligne en appliquant les bornes logiques :
 *  - présents ≤ inscrits
 *  - admis ≤ présents (BAC, par genre) / admis ≤ inscrits (BEPC, par genre)
 *  - tous les taux ∈ [0%, 100%]
 * Les valeurs brutes incohérentes saisies par l'utilisateur sont ainsi neutralisées
 * dans toutes les sorties (écran, PDF, Excel). La saisie elle-même les signale en rouge.
 */
export function computeRow(row: ClassRow, examType: ExamType): ComputedRow {
  const inscritsGarcon = Math.max(0, row.inscritsGarcon || 0);
  const inscritsFille = Math.max(0, row.inscritsFille || 0);
  const inscritsTotal = inscritsGarcon + inscritsFille;

  let presentsGarcon = 0;
  let presentsFille = 0;
  let presentsTotal = 0;

  if (examType === 'BAC') {
    presentsGarcon = clamp(row.presentsGarcon || 0, 0, inscritsGarcon);
    presentsFille = clamp(row.presentsFille || 0, 0, inscritsFille);
    presentsTotal = presentsGarcon + presentsFille;
  } else {
    presentsTotal = clamp(row.presentsTotal || 0, 0, inscritsTotal);
    presentsGarcon = clamp(row.presentsGarcon || 0, 0, inscritsGarcon);
    presentsFille = clamp(row.presentsFille || 0, 0, inscritsFille);
  }

  let admisGarcon: number;
  let admisFille: number;

  if (examType === 'BAC') {
    admisGarcon = clamp(row.admisGarcon || 0, 0, presentsGarcon);
    admisFille = clamp(row.admisFille || 0, 0, presentsFille);
  } else {
    // BEPC: clamp against présents when available (eleves mode), else inscrits (manuel mode)
    admisGarcon = clamp(row.admisGarcon || 0, 0, presentsGarcon > 0 ? presentsGarcon : inscritsGarcon);
    admisFille = clamp(row.admisFille || 0, 0, presentsFille > 0 ? presentsFille : inscritsFille);
  }

  const admisTotal = admisGarcon + admisFille;
  const absents = inscritsTotal - presentsTotal;

  const tauxTotal = ratio(admisTotal, presentsTotal);
  let tauxGarcon: number;
  let tauxFille: number;

  if (examType === 'BAC') {
    tauxGarcon = ratio(admisGarcon, presentsGarcon);
    tauxFille = ratio(admisFille, presentsFille);
  } else {
    // BEPC : use présents by gender when available (eleves mode), else inscrits (manuel mode)
    tauxGarcon = ratio(admisGarcon, presentsGarcon > 0 ? presentsGarcon : inscritsGarcon);
    tauxFille = ratio(admisFille, presentsFille > 0 ? presentsFille : inscritsFille);
  }

  return {
    id: row.id,
    name: row.name,
    centreId: row.centreId,
    inscritsTotal,
    inscritsGarcon,
    inscritsFille,
    presentsTotal,
    presentsGarcon,
    presentsFille,
    absents,
    admisTotal,
    admisGarcon,
    admisFille,
    tauxTotal,
    tauxGarcon,
    tauxFille,
  };
}

export function computeTotals(rows: ComputedRow[], examType: ExamType): ComputedTotals {
  const sum = (pick: (r: ComputedRow) => number) => rows.reduce((s, r) => s + pick(r), 0);

  const inscritsTotal = sum((r) => r.inscritsTotal);
  const inscritsGarcon = sum((r) => r.inscritsGarcon);
  const inscritsFille = sum((r) => r.inscritsFille);
  const presentsTotal = sum((r) => r.presentsTotal);
  const presentsGarcon = sum((r) => r.presentsGarcon);
  const presentsFille = sum((r) => r.presentsFille);
  const absents = inscritsTotal - presentsTotal;
  const admisTotal = sum((r) => r.admisTotal);
  const admisGarcon = sum((r) => r.admisGarcon);
  const admisFille = sum((r) => r.admisFille);

  const tauxTotal = ratio(admisTotal, presentsTotal);
  let tauxGarcon: number;
  let tauxFille: number;

  if (examType === 'BAC') {
    tauxGarcon = ratio(admisGarcon, presentsGarcon);
    tauxFille = ratio(admisFille, presentsFille);
  } else {
    // BEPC : use présents by gender when available (eleves mode), else inscrits (manuel mode)
    tauxGarcon = ratio(admisGarcon, presentsGarcon > 0 ? presentsGarcon : inscritsGarcon);
    tauxFille = ratio(admisFille, presentsFille > 0 ? presentsFille : inscritsFille);
  }

  return {
    inscritsTotal, inscritsGarcon, inscritsFille,
    presentsTotal, presentsGarcon, presentsFille,
    absents, admisTotal, admisGarcon, admisFille,
    tauxTotal, tauxGarcon, tauxFille,
  };
}

/**
 * Agrège les élèves par série (BAC) : une ligne par série renseignée,
 * plus une ligne « NON PRÉCISÉE » si certains élèves n'ont pas de série.
 * Renvoie [] si aucune série n'est renseignée.
 */
export function computeSerieRows(eleves: Eleve[], examType: ExamType): ComputedRow[] {
  const groups = new Map<string, Eleve[]>();
  for (const e of eleves) {
    const s = (e.serie ?? '').trim().toUpperCase();
    if (!s) continue;
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s)!.push(e);
  }
  if (groups.size === 0) return [];

  const threshold = admisThreshold(examType);
  const present = (e: Eleve) => !e.absent && e.points !== null;
  const admis = (e: Eleve) => !e.absent && e.points !== null && e.points >= threshold;

  const toRow = (name: string, list: Eleve[]): ComputedRow => {
    const g = list.filter((e) => e.genre === 'M');
    const f = list.filter((e) => e.genre === 'F');
    const row: ClassRow = {
      id: `serie-${name}`, name, centreId: null,
      inscritsGarcon: g.length, inscritsFille: f.length,
      presentsTotal: list.filter(present).length,
      presentsGarcon: g.filter(present).length,
      presentsFille: f.filter(present).length,
      admisGarcon: g.filter(admis).length,
      admisFille: f.filter(admis).length,
    };
    return computeRow(row, examType);
  };

  const rows = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'fr'))
    .map(([name, list]) => toRow(name, list));

  const sansSerie = eleves.filter((e) => !(e.serie ?? '').trim());
  if (sansSerie.length > 0) rows.push(toRow('NON PRÉCISÉE', sansSerie));

  return rows;
}

export function pct(value: number): string {
  return (value * 100).toFixed(2).replace('.', ',') + '%';
}
