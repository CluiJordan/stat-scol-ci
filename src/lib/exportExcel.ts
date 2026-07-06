import * as XLSX from 'xlsx';
import type { Session } from '../types';
import { computeRow, computeTotals, pct, admisThreshold, applyElevesToClasses, computeSerieRows } from './calculations';

export function exportElevesResultats(session: Session) {
  const isBac = session.examType === 'BAC';
  const headers = isBac
    ? ['N°', 'Matricule', 'Nom', 'Prénoms', 'Genre', 'Classe', 'Série', 'Points', 'Statut']
    : ['N°', 'Matricule', 'Nom', 'Prénoms', 'Genre', 'Classe', 'Points', 'Statut'];
  const sorted = [...session.eleves].sort((a, b) => {
    const cls = a.classe.localeCompare(b.classe, 'fr');
    return cls !== 0 ? cls : a.nom.localeCompare(b.nom, 'fr');
  });
  const rows = sorted.map((e, i) => {
    const threshold = admisThreshold(session.examType);
    const statut = e.absent ? (e.genre === 'F' ? 'ABSENTE' : 'ABSENT')
      : e.points === null ? ''
      : e.points >= threshold ? (e.genre === 'F' ? 'ADMISE' : 'ADMIS')
      : (e.genre === 'F' ? 'REFUSÉE' : 'REFUSÉ');
    return isBac
      ? [i + 1, e.matricule || '', e.nom, e.prenoms, e.genre, e.classe, e.serie ?? '', e.points ?? '', statut]
      : [i + 1, e.matricule || '', e.nom, e.prenoms, e.genre, e.classe, e.points ?? '', statut];
  });
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Résultats Élèves');
  XLSX.writeFile(wb, `Resultats_${session.etablissement.replace(/\s+/g, '_')}_${session.anneeScolaire}.xlsx`);
}

export function exportExcel(session: Session) {
  const isBac = session.examType === 'BAC';
  const effectiveClasses = session.eleves.length > 0
    ? applyElevesToClasses(session.classes, session.eleves, session.examType)
    : session.classes;
  const computed = effectiveClasses.map((c) => computeRow(c, session.examType));
  const totals = computeTotals(computed, session.examType);

  const headers = isBac
    ? ['Classe & Série', 'Inscrits', 'Présents', 'Absents', 'Admis', "Taux d'admission",
       'Inscrits (G)', 'Présents (G)', 'Admis (G)', "Taux (G)",
       'Inscrits (F)', 'Présents (F)', 'Admis (F)', "Taux (F)"]
    : ['Classe', 'Inscrits', 'Présents', 'Admis', "Taux d'admission",
       'Inscrits Garçon', 'Présents Garçon', 'Admis Garçon', "Taux Garçon",
       'Inscrits Fille', 'Présents Fille', 'Admis Fille', "Taux Fille"];

  const rows = computed.map((r) =>
    isBac
      ? [r.name, r.inscritsTotal, r.presentsTotal, r.absents, r.admisTotal, pct(r.tauxTotal),
         r.inscritsGarcon, r.presentsGarcon, r.admisGarcon, pct(r.tauxGarcon),
         r.inscritsFille, r.presentsFille, r.admisFille, pct(r.tauxFille)]
      : [r.name, r.inscritsTotal, r.presentsTotal, r.admisTotal, pct(r.tauxTotal),
         r.inscritsGarcon, r.presentsGarcon, r.admisGarcon, pct(r.tauxGarcon),
         r.inscritsFille, r.presentsFille, r.admisFille, pct(r.tauxFille)]
  );

  const totalRow = isBac
    ? ['TOTAL', totals.inscritsTotal, totals.presentsTotal, totals.absents, totals.admisTotal, pct(totals.tauxTotal),
       totals.inscritsGarcon, totals.presentsGarcon, totals.admisGarcon, pct(totals.tauxGarcon),
       totals.inscritsFille, totals.presentsFille, totals.admisFille, pct(totals.tauxFille)]
    : ['TOTAL', totals.inscritsTotal, totals.presentsTotal, totals.admisTotal, pct(totals.tauxTotal),
       totals.inscritsGarcon, totals.presentsGarcon, totals.admisGarcon, pct(totals.tauxGarcon),
       totals.inscritsFille, totals.presentsFille, totals.admisFille, pct(totals.tauxFille)];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, totalRow]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Statistiques');

  // BAC : feuille récapitulative par série
  if (isBac) {
    const serieRows = computeSerieRows(session.eleves, 'BAC');
    if (serieRows.length > 0) {
      const serieTotals = computeTotals(serieRows, 'BAC');
      const serieHeaders = ['Série', ...headers.slice(1)];
      const serieData = serieRows.map((r) =>
        [r.name, r.inscritsTotal, r.presentsTotal, r.absents, r.admisTotal, pct(r.tauxTotal),
         r.inscritsGarcon, r.presentsGarcon, r.admisGarcon, pct(r.tauxGarcon),
         r.inscritsFille, r.presentsFille, r.admisFille, pct(r.tauxFille)]);
      const serieTotal = ['TOTAL', serieTotals.inscritsTotal, serieTotals.presentsTotal, serieTotals.absents, serieTotals.admisTotal, pct(serieTotals.tauxTotal),
        serieTotals.inscritsGarcon, serieTotals.presentsGarcon, serieTotals.admisGarcon, pct(serieTotals.tauxGarcon),
        serieTotals.inscritsFille, serieTotals.presentsFille, serieTotals.admisFille, pct(serieTotals.tauxFille)];
      const wsSerie = XLSX.utils.aoa_to_sheet([serieHeaders, ...serieData, serieTotal]);
      XLSX.utils.book_append_sheet(wb, wsSerie, 'Par série');
    }
  }

  XLSX.writeFile(wb, `Statistiques_${session.etablissement.replace(/\s+/g, '_')}_${session.anneeScolaire}.xlsx`);
}

export function downloadElevesTemplate(examType?: 'BEPC' | 'BAC') {
  const isBac = examType === 'BAC';
  const headers = isBac
    ? ['Matricule', 'Nom', 'Prenoms', 'Genre', 'Classe', 'Série']
    : ['Matricule', 'Nom', 'Prenoms', 'Genre', 'Classe'];
  const examples = isBac
    ? [
        ['CI-20250001', 'KOUASSI', 'Aya Marie', 'F', 'TLE A2-1', 'A2'],
        ['CI-20250002', 'BAMBA', 'Ibrahim Soro', 'M', 'TLE D1', 'D'],
        ['CI-20250003', 'KONAN', 'Jean-Paul', 'M', 'TLE C', 'C'],
      ]
    : [
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
