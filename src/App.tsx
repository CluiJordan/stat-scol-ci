import { useState } from 'react';
import Dashboard from './screens/Dashboard';
import SessionEditor from './screens/SessionEditor';
import Reports from './screens/Reports';

type Screen = 'dashboard' | 'editor' | 'reports';

export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  function openEditor(id: string) {
    setActiveSessionId(id);
    setScreen('editor');
  }

  function openReports(id: string) {
    setActiveSessionId(id);
    setScreen('reports');
  }

  if (screen === 'editor' && activeSessionId) {
    return (
      <SessionEditor
        sessionId={activeSessionId}
        onBack={() => setScreen('dashboard')}
        onReports={() => openReports(activeSessionId)}
      />
    );
  }

  if (screen === 'reports' && activeSessionId) {
    return (
      <Reports
        sessionId={activeSessionId}
        onBack={() => setScreen('dashboard')}
        onEdit={() => openEditor(activeSessionId)}
      />
    );
  }

  return <Dashboard onOpen={openEditor} onReports={openReports} />;
}
