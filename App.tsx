
import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Layout from './components/Layout';
import AdminDashboard from './components/AdminDashboard';
import StoreView from './components/StoreView';
import { OdooSession, ClientConfig } from './types';
import { getClientByCode } from './services/clientManager';
import { OdooClient } from './services/odoo';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [odooSession, setOdooSession] = useState<OdooSession | null>(null);
  const [clientConfig, setClientConfig] = useState<ClientConfig | null>(null);
  const [currentView, setCurrentView] = useState('general');
  const [isStoreMode, setIsStoreMode] = useState(false);

  // Verificar modo tienda por URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopCode = params.get('shop');
    if (shopCode) {
      initStoreMode(shopCode.toUpperCase());
    }
  }, []);

  const initStoreMode = async (code: string) => {
    const config = await getClientByCode(code);
    if (config && config.isActive) {
      setClientConfig(config);
      // Autenticación técnica para la tienda
      try {
        const client = new OdooClient(config.url, config.db, true);
        const uid = await client.authenticate(config.username, config.apiKey);
        const companiesData: any[] = await client.searchRead(uid, config.apiKey, 'res.company', [], ['name']);
        const found = config.companyFilter === 'ALL' ? companiesData[0] : companiesData.find(c => c.name.toUpperCase().includes(config.companyFilter.toUpperCase()));
        
        setOdooSession({
          url: config.url,
          db: config.db,
          username: config.username,
          apiKey: config.apiKey,
          uid: uid,
          useProxy: true,
          companyId: found ? found.id : companiesData[0].id,
          companyName: found ? found.name : companiesData[0].name
        });
        setIsStoreMode(true);
      } catch (e) {
        console.error("Store Auth Error", e);
        alert("Error al conectar con la tienda. Intente más tarde.");
      }
    }
  };

  const handleLogin = (session: OdooSession | null, config: ClientConfig) => {
    setOdooSession(session);
    setClientConfig(config);
    setIsAdmin(false);
    setIsAuthenticated(true);
  };

  const handleAdminLogin = () => {
    setOdooSession(null);
    setIsAdmin(true);
    setIsAuthenticated(true);
  }

  const handleLogout = () => {
    setOdooSession(null);
    setClientConfig(null);
    setIsAdmin(false);
    setIsAuthenticated(false);
    setIsStoreMode(false);
    setCurrentView('general');
    // Limpiar parámetro de URL si existe
    window.history.pushState({}, '', window.location.pathname);
  };

  // Modo Tienda Pública Directa
  if (isStoreMode && clientConfig && odooSession) {
    return <StoreView session={odooSession} config={clientConfig} />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} onAdminLogin={handleAdminLogin} />;
  }

  if (isAdmin) {
      return <AdminDashboard onLogout={handleLogout} />;
  }

  return (
    <div className="antialiased text-slate-800 bg-slate-50 min-h-screen">
      <Layout onLogout={handleLogout} currentView={currentView} onNavigate={setCurrentView} showStoreLink={clientConfig?.showStore}>
        {currentView === 'store' && odooSession && clientConfig ? (
           <StoreView session={odooSession} config={clientConfig} onBack={() => setCurrentView('general')} />
        ) : (
          <Dashboard session={odooSession} view={currentView} />
        )}
      </Layout>
    </div>
  );
};

export default App;
