
import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Layout from './components/Layout';
import AdminDashboard from './components/AdminDashboard';
import StoreView from './components/StoreView';
import StoreSettings from './components/StoreSettings';
import ProductManager from './components/ProductManager';
import ProfitabilityView from './components/ProfitabilityView';
import { OdooSession, ClientConfig, Venta } from './types';
import { getClientByCode } from './services/clientManager';
import { OdooClient } from './services/odoo';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [odooSession, setOdooSession] = useState<OdooSession | null>(null);
  const [clientConfig, setClientConfig] = useState<ClientConfig | null>(null);
  const [currentView, setCurrentView] = useState('general');
  const [isStoreMode, setIsStoreMode] = useState(false);
  const [isStoreLoading, setIsStoreLoading] = useState(false);
  const [ventasData, setVentasData] = useState<Venta[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopCode = params.get('shop');
    if (shopCode) {
      initStoreMode(shopCode.toUpperCase());
    }
  }, []);

  const initStoreMode = async (code: string) => {
    setIsStoreLoading(true);
    const config = await getClientByCode(code);
    if (config && config.isActive) {
      setClientConfig(config);
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
      }
    }
    setIsStoreLoading(false);
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
  };

  return (
    <div className="antialiased text-slate-800 bg-slate-50 min-h-screen">
      {!isAuthenticated ? (
         <Login onLogin={handleLogin} onAdminLogin={handleAdminLogin} />
      ) : isAdmin ? (
         <AdminDashboard onLogout={handleLogout} />
      ) : (
        <Layout 
          onLogout={handleLogout} 
          currentView={currentView} 
          onNavigate={setCurrentView} 
          showStoreLink={clientConfig?.showStore}
          clientCode={clientConfig?.code}
        >
          {currentView === 'store' && odooSession && clientConfig ? (
             <StoreView session={odooSession} config={clientConfig} onBack={() => setCurrentView('general')} />
          ) : currentView === 'product-manager' && odooSession && clientConfig ? (
             <ProductManager session={odooSession} config={clientConfig} onUpdate={setClientConfig} />
          ) : currentView === 'store-config' && clientConfig ? (
             <StoreSettings config={clientConfig} onUpdate={setClientConfig} session={odooSession} />
          ) : currentView === 'rentabilidad' ? (
             <ProfitabilityView 
                session={odooSession} 
                ventasData={ventasData} 
                loading={isDataLoading} 
                onRefresh={() => {}} 
             />
          ) : (
            <Dashboard 
              session={odooSession} 
              view={currentView} 
              onDataLoaded={setVentasData} 
              onLoadingStateChange={setIsDataLoading}
            />
          )}
        </Layout>
      )}
    </div>
  );
};

export default App;
