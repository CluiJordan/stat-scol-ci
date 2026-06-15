import * as XLSX from 'xlsx';
import type { Session } from '../types';
import { computeRow, computeTotals, pct, admisThreshold } from './calculations';

export function exportElevesResultats(session: Session) {
  const headers = ['N°', 'Matricule', 'Nom', 'Prénoms', 'Genre', 'Classe', 'Points', 'Statut'];
  const sorted = [...session.eleves].sort((a, b) => {
    const cls = a.classe.localeCompare(b.classe, 'fr');
    return cls !== 0 ? cls : a.nom.localeCompare(b.nom, 'fr');
  });
  const rows = sorted.map((e, i) => {
    const threshold = admisThreshold(session.examType);
    const statut = e.points === null ? ''
      : e.points >= threshold ? (e.genre === 'F' ? 'ADMISE' : 'ADMIS')
      : e.points === 0 ? (e.genre === 'F' ? 'ABSENTE' : 'ABSENT')
      : (e.genre === 'F' ? 'REFUSÉE' : 'REFUSÉ');
    return [i + 1, e.matricule || '', e.nom, e.prenoms, e.genre, e.classe, e.points ?? '', statut];
  });
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Résultats Élèves');
  XLSX.writeFile(wb, `Resultats_${session.etablissement.replace(/\s+/g, '_')}_${session.anneeScolaire}.xlsx`);
}

export function exportExcel(session: Session) {
  const isBac = session.examType === 'BAC';
  const computed = session.classes.map((c) => computeRow(c, session.examType));
  const totals = computeTotals(computed, session.examType);

  const headers = isBac
    ? ['Classe & Série', 'Inscrits', 'Présents', 'Absents', 'Admis', "Taux d'admission",
       'Inscrits (G)', 'Présents (G)', 'Admis (G)', "Taux (G)",
       'Inscrits (F)', 'Présents (F)', 'Admis (F)', "Taux (F)"]
    : ['Classe', 'Inscrits', 'Présents', 'Admis', "Taux d'admission",
       'Inscrits Garçon', 'Admis Garçon', "Taux Garçon",
       'Inscrits Fille', 'Admis Fille', "Taux Fille"];

  const rows = computed.map((r) =>
    isBac
      ? [r.name, r.inscritsTotal, r.presentsTotal, r.absents, r.admisTotal, pct(r.tauxTotal),
         r.inscritsGarcon, r.presentsGarcon, r.admisGarcon, pct(r.tauxGarcon),
         r.inscritsFille, r.presentsFille, r.admisFille, pct(r.tauxFille)]
      : [r.name, r.inscritsTotal, r.presentsTotal, r.admisTotal, pct(r.tauxTotal),
         r.inscritsGarcon, r.admisGarcon, pct(r.tauxGarcon),
         r.inscritsFille, r.admisFille, pct(r.tauxFille)]
  );

  const totalRow = isBac
    ? ['TOTAL', totals.inscritsTotal, totals.presentsTotal, totals.absents, totals.admisTotal, pct(totals.tauxTotal),
       totals.inscritsGarcon, totals.presentsGarcon, totals.admisGarcon, pct(totals.tauxGarcon),
       totals.inscritsFille, totals.presentsFille, totals.admisFille, pct(totals.tauxFille)]
    : ['TOTAL', totals.inscritsTotal, totals.presentsTotal, totals.admisTotal, pct(totals.tauxTotal),
       totals.inscritsGarcon, totals.admisGarcon, pct(totals.tauxGarcon),
       totals.inscritsFille, totals.admisFille, pct(totals.tauxFille)];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, totalRow]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Statistiques');
  XLSX.writeFile(wb, `Statistiques_${session.etablissement.replace(/\s+/g, '_')}_${session.anneeScolaire}.xlsx`);
}

export function downloadElevesTemplate() {
  const headers = ['Matricule', 'Nom', 'Prenoms', 'Genre', 'Classe'];
  const examples = [
    ['CI-20250001', 'KOUASSI', 'Aya Marie', 'F', '3EME A'],
    ['CI-20250002', 'BAMBA', 'Ibrahim Soro', 'M', '3EME A'],
    ['CI-20250003', 'KONAN', 'Jean-Paul', 'M', '3EME B'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modèle Élèves');
  XLSX.writeFile(wb, 'Modele_Import_Eleves.xlsx');
}

export function downloadTemplate(examType: 'BEPC' | 'BAC') {
  const headers = examType === 'BAC'
    ? ['Classe & Série', 'Inscrits Garçon', 'Inscrits Fille', 'Présents Garçon', 'Présents Fille', 'Admis Garçon', 'Admis Fille']
    : ['Classe', 'Inscrits Garçon', 'Inscrits Fille', 'Candidats Présents', 'Admis Garçon', 'Admis Fille'];

  const example = examType === 'BAC'
    ? ['TLE A2', 38, 23, 37, 23, 7, 6]
    : ['3EME 1', 33, 25, 58, 14, 13];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modèle');
  XLSX.writeFile(wb, `Modele_Import_${examType}.xlsx`);
}
