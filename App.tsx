import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Layout from './components/Layout';
import { OdooSession } from './types';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [odooSession, setOdooSession] = useState<OdooSession | null>(null);

  const handleLogin = (session: OdooSession | null) => {
    setOdooSession(session);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setOdooSession(null);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="antialiased text-slate-900 bg-slate-50 min-h-screen">
      <Layout onLogout={handleLogout}>
        <Dashboard session={odooSession} />
      </Layout>
    </div>
  );
};

export default App;
