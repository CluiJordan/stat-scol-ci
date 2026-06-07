import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { Session, ExamType } from '../types';
import { getSessions, saveSession, deleteSession } from '../lib/storage';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';

interface Props {
  onOpen: (id: string) => void;
  onReports: (id: string) => void;
}

const DEFAULT_MINISTERE = "MINISTERE DE L'EDUCATION NATIONALE ET DE L'ALPHABETISATION";

export default function Dashboard({ onOpen, onReports }: Props) {
  const [sessions, setSessions] = useState<Session[]>(getSessions);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    etablissement: '',
    code: '',
    drena: '',
    anneeScolaire: '2024 - 2025',
    examType: 'BEPC' as ExamType,
    examSession: 'session 2025',
    ministere: DEFAULT_MINISTERE,
  });

  function refresh() { setSessions(getSessions()); }

  function handleCreate() {
    const session: Session = {
      id: uuid(),
      ministere: form.ministere,
      drena: form.drena,
      etablissement: form.etablissement,
      code: form.code,
      anneeScolaire: form.anneeScolaire,
      examType: form.examType,
      examSession: form.examSession,
      centres: [],
      classes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveSession(session);
    refresh();
    setShowCreate(false);
    onOpen(session.id);
  }

  function handleDelete() {
    if (deleteId) { deleteSession(deleteId); refresh(); setDeleteId(null); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-800 text-white px-6 py-4 shadow">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">StatScolCI</h1>
            <p className="text-green-200 text-sm">Statistiques scolaires — Côte d'Ivoire</p>
          </div>
          <Button variant="primary" className="bg-white text-green-800 hover:bg-green-50" onClick={() => setShowCreate(true)}>
            + Nouvelle session
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {sessions.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-lg font-medium">Aucune session</p>
            <p className="text-sm mt-1">Cliquez sur « Nouvelle session » pour commencer</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-gray-900 truncate">{s.etablissement || 'Sans nom'}</h2>
                    <Badge color={s.examType === 'BEPC' ? 'green' : 'blue'}>{s.examType}</Badge>
                    {s.code && <Badge color="gray">{s.code}</Badge>}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {s.drena} — {s.anneeScolaire}
                    {s.examType === 'BAC' && s.examSession ? ` — ${s.examSession}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {s.classes.length} classe{s.classes.length !== 1 ? 's' : ''}
                    {s.examType === 'BEPC' ? ` • ${s.centres.length} centre${s.centres.length !== 1 ? 's' : ''}` : ''}
                    {' • '}Modifié le {new Date(s.updatedAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" onClick={() => onReports(s.id)}>Rapports</Button>
                  <Button size="sm" variant="primary" onClick={() => onOpen(s.id)}>Modifier</Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteId(s.id)}>Suppr.</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal: Create session */}
      <Modal
        open={showCreate}
        title="Nouvelle session"
        onClose={() => setShowCreate(false)}
        footer={
          <>
            <Button onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleCreate} disabled={!form.etablissement}>Créer</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <button
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${form.examType === 'BEPC' ? 'bg-green-700 text-white border-green-700' : 'border-gray-300 text-gray-600'}`}
              onClick={() => setForm((f) => ({ ...f, examType: 'BEPC' }))}
            >BEPC</button>
            <button
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${form.examType === 'BAC' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}
              onClick={() => setForm((f) => ({ ...f, examType: 'BAC' }))}
            >BAC</button>
          </div>
          <Input label="Établissement *" value={form.etablissement} onChange={(e) => setForm((f) => ({ ...f, etablissement: e.target.value }))} placeholder="Ex: COLLEGE LA BONNE SEMENCE TAGO GAGNOA" />
          <div className="flex gap-3">
            <Input label="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="Ex: 013077" className="flex-1" />
            <Input label="Année scolaire" value={form.anneeScolaire} onChange={(e) => setForm((f) => ({ ...f, anneeScolaire: e.target.value }))} className="flex-1" />
          </div>
          <Input label="DRENA" value={form.drena} onChange={(e) => setForm((f) => ({ ...f, drena: e.target.value }))} placeholder="Ex: DRENA GAGNOA" />
          {form.examType === 'BAC' && (
            <Input label="Session" value={form.examSession} onChange={(e) => setForm((f) => ({ ...f, examSession: e.target.value }))} placeholder="Ex: session 2025" />
          )}
        </div>
      </Modal>

      {/* Modal: Confirm delete */}
      <Modal
        open={!!deleteId}
        title="Supprimer la session ?"
        onClose={() => setDeleteId(null)}
        footer={
          <>
            <Button onClick={() => setDeleteId(null)}>Annuler</Button>
            <Button variant="danger" onClick={handleDelete}>Supprimer</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">Cette action est irréversible. Toutes les données de cette session seront effacées.</p>
      </Modal>
    </div>
  );
}
