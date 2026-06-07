import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { Session, ExamType } from '../types';
import { getSessions, saveSession, deleteSession } from '../lib/storage';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Logo from '../components/ui/Logo';

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
    <div className="min-h-screen bg-[#F5F0EB]">
      <header className="bg-[#0A0A0A] px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <Logo size={34} />
            <div>
              <h1 className="text-base font-bold tracking-tight leading-none">StatScolCI</h1>
              <p className="text-white/40 text-xs mt-0.5">Statistiques scolaires — Côte d'Ivoire</p>
            </div>
          </div>
          <Button variant="accent" onClick={() => setShowCreate(true)}>
            + Nouvelle session
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {sessions.length === 0 ? (
          <div className="text-center py-28">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white border border-[#E5DDD5] mb-5 text-[#1C2B3A]">
              <Logo size={30} />
            </div>
            <p className="text-[#0A0A0A] font-bold text-lg">Aucune session</p>
            <p className="text-gray-400 text-sm mt-1.5">Cliquez sur « Nouvelle session » pour commencer</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-xl border border-[#E5DDD5] border-l-4 p-5 flex items-center justify-between gap-4 hover:shadow-md transition-shadow duration-200"
                style={{ borderLeftColor: s.examType === 'BEPC' ? '#F4732A' : '#1C2B3A' }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-[#0A0A0A] text-base truncate">{s.etablissement || 'Sans nom'}</h2>
                    <Badge color={s.examType === 'BEPC' ? 'orange' : 'navy'}>{s.examType}</Badge>
                    {s.code && <Badge color="gray">{s.code}</Badge>}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {s.drena} — {s.anneeScolaire}
                    {s.examType === 'BAC' && s.examSession ? ` — ${s.examSession}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {s.classes.length} classe{s.classes.length !== 1 ? 's' : ''}
                    {s.examType === 'BEPC' ? ` · ${s.centres.length} centre${s.centres.length !== 1 ? 's' : ''}` : ''}
                    {' · '}Modifié le {new Date(s.updatedAt).toLocaleDateString('fr-FR')}
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
              className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                form.examType === 'BEPC'
                  ? 'bg-[#F4732A] text-white border-[#F4732A]'
                  : 'border-[#E5DDD5] text-gray-400 hover:border-[#1C2B3A] hover:text-[#1C2B3A]'
              }`}
              onClick={() => setForm((f) => ({ ...f, examType: 'BEPC' }))}
            >BEPC</button>
            <button
              className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                form.examType === 'BAC'
                  ? 'bg-[#1C2B3A] text-white border-[#1C2B3A]'
                  : 'border-[#E5DDD5] text-gray-400 hover:border-[#1C2B3A] hover:text-[#1C2B3A]'
              }`}
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
        <p className="text-sm text-gray-500 leading-relaxed">
          Cette action est irréversible. Toutes les données de cette session seront effacées.
        </p>
      </Modal>
    </div>
  );
}
