import type { ClassRow, ExamType } from '../types';

/** Erreurs de cohérence par champ d'une ligne (clé = champ, valeur = message). */
export type FieldErrors = Partial<Record<keyof ClassRow, string>>;

/**
 * Vérifie qu'une ligne respecte les contraintes logiques d'un examen.
 * Ne corrige rien — retourne uniquement les champs fautifs et leur explication.
 * Les calculs (calculations.ts) plafonnent de leur côté ; ici on signale.
 */
export function validateRow(row: ClassRow, examType: ExamType): FieldErrors {
  const e: FieldErrors = {};
  const iG = row.inscritsGarcon || 0;
  const iF = row.inscritsFille || 0;
  const inscritsTotal = iG + iF;

  if (iG < 0) e.inscritsGarcon = 'Valeur négative impossible';
  if (iF < 0) e.inscritsFille = 'Valeur négative impossible';

  if (examType === 'BAC') {
    const pG = row.presentsGarcon || 0;
    const pF = row.presentsFille || 0;
    if (pG > iG) e.presentsGarcon = `Présents G (${pG}) > inscrits G (${iG})`;
    if (pF > iF) e.presentsFille = `Présents F (${pF}) > inscrites F (${iF})`;
    if ((row.admisGarcon || 0) > pG) e.admisGarcon = `Admis G (${row.admisGarcon}) > présents G (${pG})`;
    if ((row.admisFille || 0) > pF) e.admisFille = `Admis F (${row.admisFille}) > présentes F (${pF})`;
  } else {
    const presents = row.presentsTotal || 0;
    const admisTotal = (row.admisGarcon || 0) + (row.admisFille || 0);
    if (presents > inscritsTotal) e.presentsTotal = `Présents (${presents}) > inscrits (${inscritsTotal})`;
    if ((row.admisGarcon || 0) > iG) e.admisGarcon = `Admis G (${row.admisGarcon}) > inscrits G (${iG})`;
    if ((row.admisFille || 0) > iF) e.admisFille = `Admis F (${row.admisFille}) > inscrites F (${iF})`;
    if (admisTotal > presents) {
      const msg = `Total admis (${admisTotal}) > présents (${presents})`;
      if (!e.admisGarcon) e.admisGarcon = msg;
      if (!e.admisFille) e.admisFille = msg;
      if (!e.presentsTotal) e.presentsTotal = msg;
    }
  }

  return e;
}

/** Nombre total de champs fautifs sur l'ensemble des classes d'une session. */
export function countErrors(rows: ClassRow[], examType: ExamType): number {
  return rows.reduce((n, r) => n + Object.keys(validateRow(r, examType)).length, 0);
}
