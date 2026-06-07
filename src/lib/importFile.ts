import * as XLSX from 'xlsx';
import { v4 as uuid } from 'uuid';
import type { ClassRow, ExamType } from '../types';

interface ImportResult {
  rows: ClassRow[];
  errors: string[];
}

export function importFromFile(file: File, examType: ExamType): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const errors: string[] = [];
      const rows: ClassRow[] = [];

      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        data.forEach((row, i) => {
          const name = String(row['Classe'] ?? row['Classe & Série'] ?? '').trim();
          if (!name) {
            errors.push(`Ligne ${i + 2}: nom de classe manquant`);
            return;
          }

          const num = (key: string) => {
            const val = row[key];
            return typeof val === 'number' ? val : parseInt(String(val ?? '0'), 10) || 0;
          };

          if (examType === 'BAC') {
            rows.push({
              id: uuid(),
              name,
              centreId: null,
              inscritsGarcon: num('Inscrits Garçon'),
              inscritsFille: num('Inscrits Fille'),
              presentsTotal: 0,
              presentsGarcon: num('Présents Garçon'),
              presentsFille: num('Présents Fille'),
              admisGarcon: num('Admis Garçon'),
              admisFille: num('Admis Fille'),
            });
          } else {
            rows.push({
              id: uuid(),
              name,
              centreId: null,
              inscritsGarcon: num('Inscrits Garçon'),
              inscritsFille: num('Inscrits Fille'),
              presentsTotal: num('Candidats Présents'),
              presentsGarcon: 0,
              presentsFille: 0,
              admisGarcon: num('Admis Garçon'),
              admisFille: num('Admis Fille'),
            });
          }
        });
      } catch (err) {
        errors.push('Erreur de lecture du fichier. Vérifiez le format.');
      }

      resolve({ rows, errors });
    };
    reader.readAsBinaryString(file);
  });
}
