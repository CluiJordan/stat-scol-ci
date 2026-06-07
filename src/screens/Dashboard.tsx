import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { Session, ExamType } from '../types';
import { getSessions, saveSession, deleteSession } from '../lib/storage';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Logo from '../components/ui/Logo';

interface Props {
  onOpen: (id: string) => void;
  onReports: (id: string) => void;
}

const DEFAULT_MINISTERE =
  "MINISTÈRE DE L'ÉDUCATION NATIONALE, DE L'ALPHABÉTISATION, DE L'ENSEIGNEMENT TECHNIQUE ET DE LA FORMATION PROFESSIONNEL";

function getCurrentSchoolYear(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const start = month >= 9 ? year : year - 1;
  return `${start} - ${start + 1}`;
}

function getSchoolYearOptions(): { value: string; label: string }[] {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const currentStart = month >= 9 ? year : year - 1;
  return Array.from({ length: 6 }, (_, i) => {
    const start = currentStart - (5 - i);
    const label = `${start} - ${start + 1}`;
    return { value: label, label };
  });
}

export default function Dashboard({ onOpen, onReports }: Props) {
  const [sessions, setSessions] = useState<Session[]>(getSessions);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    etablissement: '',
    code: '',
    drena: '',
    anneeScolaire: getCurrentSchoolYear(),
    examType: 'BEPC' as ExamType,
    examSession: 'SESSION 2025',
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
          <div className="bg-white border border-[#E5DDD5] rounded-lg overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E5DDD5] bg-[#F5F0EB] px-5 py-2.5">
              <span className="text-xs font-semibold text-[#1C2B3A] uppercase tracking-wider">Établissement</span>
              <span className="text-xs font-semibold text-[#1C2B3A] uppercase tracking-wider">Actions</span>
            </div>
            {sessions.map((s, i) => (
              <div
                key={s.id}
                className={`flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#F5F0EB]/60 transition-colors ${
                  i < sessions.length - 1 ? 'border-b border-[#E5DDD5]' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-[#0A0A0A] text-sm">{s.etablissement || 'Sans nom'}</h2>
                    <Badge color={s.examType === 'BEPC' ? 'orange' : 'navy'}>{s.examType}</Badge>
                    {s.code && <Badge color="gray">{s.code}</Badge>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.drena}{s.drena && ' — '}{s.anneeScolaire}
                    {s.examSession ? ` — ${s.examSession}` : ''}
                    {' · '}{s.classes.length} classe{s.classes.length !== 1 ? 's' : ''}
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
          <Input
            label="Établissement *"
            value={form.etablissement}
            onChange={(e) => setForm((f) => ({ ...f, etablissement: e.target.value }))}
            placeholder="Ex: COLLEGE LA BONNE SEMENCE TAGO GAGNOA"
            uppercase
          />
          <div className="flex gap-3">
            <Input
              label="Code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="Ex: 013077"
              className="flex-1"
              uppercase
            />
            <Select
              label="Année scolaire"
              options={getSchoolYearOptions()}
              value={form.anneeScolaire}
              onChange={(e) => setForm((f) => ({ ...f, anneeScolaire: e.target.value }))}
              className="flex-1"
            />
          </div>
          <Input
            label="DRENA"
            value={form.drena}
            onChange={(e) => setForm((f) => ({ ...f, drena: e.target.value }))}
            placeholder="Ex: DRENA DE GAGNOA"
            uppercase
          />
          <Input
            label="Session"
            value={form.examSession}
            onChange={(e) => setForm((f) => ({ ...f, examSession: e.target.value }))}
            placeholder="Ex: SESSION 2025"
            uppercase
          />
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
