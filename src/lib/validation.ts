import type { ClassRow, ExamType } from '../types';

export interface RowErrors {
  inscritsGarcon?: string;
  inscritsFille?: string;
  presentsTotal?: string;
  presentsGarcon?: string;
  presentsFille?: string;
  admisGarcon?: string;
  admisFille?: string;
}

export function validateRow(row: ClassRow, examType: ExamType): RowErrors {
  const errs: RowErrors = {};
  const inscritsTotal = row.inscritsGarcon + row.inscritsFille;

  if (examType === 'BAC') {
    if (row.presentsGarcon > row.inscritsGarcon) errs.presentsGarcon = 'Présents > inscrits garçons';
    if (row.presentsFille > row.inscritsFille) errs.presentsFille = 'Présents > inscrits filles';
    if (!errs.presentsGarcon && !errs.presentsFille && row.presentsGarcon + row.presentsFille > inscritsTotal) {
      errs.presentsGarcon = 'Total présents > inscrits';
    }
    if (row.admisGarcon > row.presentsGarcon) errs.admisGarcon = 'Admis > présents garçons';
    if (row.admisFille > row.presentsFille) errs.admisFille = 'Admis > présents filles';
  } else {
    if (row.presentsTotal > inscritsTotal) errs.presentsTotal = 'Présents > inscrits';
    if (row.admisGarcon > row.inscritsGarcon) errs.admisGarcon = 'Admis > inscrits garçons';
    if (row.admisFille > row.inscritsFille) errs.admisFille = 'Admis > inscrits filles';
    if (!errs.admisGarcon && !errs.admisFille && row.admisGarcon + row.admisFille > row.presentsTotal) {
      errs.admisGarcon = 'Total admis > présents';
    }
  }

  return errs;
}

export function countErrors(classes: ClassRow[], examType: ExamType): number {
  return classes.reduce((total, cls) => {
    const errs = validateRow(cls, examType);
    return total + Object.values(errs).filter(Boolean).length;
  }, 0);
}
