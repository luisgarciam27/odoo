import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Layout from './components/Layout';
import { OdooSession } from './types';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [odooSession, setOdooSession] = useState<OdooSession | null>(null);
  const [currentView, setCurrentView] = useState('general');

  const handleLogin = (session: OdooSession | null) => {
    setOdooSession(session);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setOdooSession(null);
    setIsAuthenticated(false);
    setCurrentView('general');
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="antialiased text-slate-800 bg-slate-50 min-h-screen">
      <Layout onLogout={handleLogout} currentView={currentView} onNavigate={setCurrentView}>
        <Dashboard session={odooSession} view={currentView} />
      </Layout>
    </div>
  );
};

export default App;