export type ExamType = 'BEPC' | 'BAC';

export interface Centre {
  id: string;
  name: string;
}

export interface ClassRow {
  id: string;
  name: string;
  centreId: string | null;
  inscritsGarcon: number;
  inscritsFille: number;
  // BEPC: user enters directly; BAC: auto = presentsGarcon + presentsFille
  presentsTotal: number;
  // BAC only (kept 0 for BEPC)
  presentsGarcon: number;
  presentsFille: number;
  admisGarcon: number;
  admisFille: number;
}

export interface Session {
  id: string;
  ministere: string;
  drena: string;
  etablissement: string;
  code: string;
  anneeScolaire: string;
  examType: ExamType;
  examSession: string;
  centres: Centre[];
  classes: ClassRow[];
  createdAt: string;
  updatedAt: string;
}

export interface ComputedRow {
  id: string;
  name: string;
  centreId: string | null;
  inscritsTotal: number;
  inscritsGarcon: number;
  inscritsFille: number;
  presentsTotal: number;
  presentsGarcon: number;
  presentsFille: number;
  absents: number;
  admisTotal: number;
  admisGarcon: number;
  admisFille: number;
  tauxTotal: number;
  tauxGarcon: number;
  tauxFille: number;
}

export interface ComputedTotals {
  inscritsTotal: number;
  inscritsGarcon: number;
  inscritsFille: number;
  presentsTotal: number;
  presentsGarcon: number;
  presentsFille: number;
  absents: number;
  admisTotal: number;
  admisGarcon: number;
  admisFille: number;
  tauxTotal: number;
  tauxGarcon: number;
  tauxFille: number;
}
