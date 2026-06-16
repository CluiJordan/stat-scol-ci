import type { Eleve, Session } from '../types';

const KEY = 'stat_scol_sessions';

export function getSessions(): Session[] {
  try {
    const raw = localStorage.getItem(KEY);
    const sessions: Array<Session & { eleves?: Eleve[] }> = raw ? JSON.parse(raw) : [];
    return sessions.map((s) => ({ ...s, eleves: s.eleves ?? [], saisieMode: s.saisieMode ?? null, zeroIsAbsent: s.zeroIsAbsent ?? true }));
  } catch {
    return [];
  }
}

export function saveSession(session: Session): void {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = { ...session, updatedAt: new Date().toISOString() };
  } else {
    sessions.push({ ...session, updatedAt: new Date().toISOString() });
  }
  localStorage.setItem(KEY, JSON.stringify(sessions));
}

export function deleteSession(id: string): void {
  const sessions = getSessions().filter((s) => s.id !== id);
  localStorage.setItem(KEY, JSON.stringify(sessions));
}

export function getSession(id: string): Session | undefined {
  return getSessions().find((s) => s.id === id);
}
