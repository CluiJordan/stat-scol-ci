import * as XLSX from 'xlsx';
import { v4 as uuid } from 'uuid';
import type { ClassRow, Eleve, ExamType } from '../types';

interface ImportResult {
  rows: ClassRow[];
  eleves: Eleve[];
  errors: string[];
}

function norm(h: string): string {
  return h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function getCol(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of Object.keys(row)) {
    if (keys.includes(norm(key))) return String(row[key] ?? '').trim();
  }
  return '';
}

export function importFromFile(file: File, examType: ExamType): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const errors: string[] = [];
      const rows: ClassRow[] = [];
      const eleves: Eleve[] = [];

      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

        if (data.length === 0) {
          resolve({ rows, eleves, errors: ['Le fichier est vide.'] });
          return;
        }

        // Detect file type: student list has "matricule" or "genre" column
        const headers = Object.keys(data[0]).map(norm);
        const isStudentList = headers.some((h) => h === 'matricule' || h === 'genre' || h === 'sexe');

        if (isStudentList) {
          data.forEach((row, i) => {
            const matricule = getCol(row, 'matricule');
            const nom = getCol(row, 'nom');
            const prenoms = getCol(row, 'prenoms', 'prenom');
            const genreRaw = getCol(row, 'genre', 'sexe').toUpperCase();
            const classe = getCol(row, 'classe').toUpperCase();

            if (!nom && !matricule) {
              errors.push(`Ligne ${i + 2} : nom et matricule manquants`);
              return;
            }
            if (!classe) {
              errors.push(`Ligne ${i + 2} : classe manquante`);
              return;
            }

            const genre: 'M' | 'F' =
              genreRaw === 'F' || genreRaw === 'FILLE' || genreRaw === 'FEMININ' || genreRaw === 'FÉMININ' ? 'F' : 'M';

            eleves.push({
              id: uuid(),
              matricule,
              nom: nom.toUpperCase(),
              prenoms,
              genre,
              classe,
              points: null,
            });
          });
        } else {
          // Class stats (existing format)
          data.forEach((row, i) => {
            const name = String(row['Classe'] ?? row['Classe & Série'] ?? '').trim();
            if (!name) { errors.push(`Ligne ${i + 2} : nom de classe manquant`); return; }

            const num = (key: string) => {
              const val = row[key];
              return typeof val === 'number' ? val : parseInt(String(val ?? '0'), 10) || 0;
            };

            if (examType === 'BAC') {
              rows.push({
                id: uuid(), name, centreId: null,
                inscritsGarcon: num('Inscrits Garçon'), inscritsFille: num('Inscrits Fille'),
                presentsTotal: 0,
                presentsGarcon: num('Présents Garçon'), presentsFille: num('Présents Fille'),
                admisGarcon: num('Admis Garçon'), admisFille: num('Admis Fille'),
              });
            } else {
              rows.push({
                id: uuid(), name, centreId: null,
                inscritsGarcon: num('Inscrits Garçon'), inscritsFille: num('Inscrits Fille'),
                presentsTotal: num('Candidats Présents'),
                presentsGarcon: 0, presentsFille: 0,
                admisGarcon: num('Admis Garçon'), admisFille: num('Admis Fille'),
              });
            }
          });
        }
      } catch {
        errors.push('Erreur de lecture du fichier. Vérifiez le format.');
      }

      resolve({ rows, eleves, errors });
    };
    reader.readAsBinaryString(file);
  });
}
