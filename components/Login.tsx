import React, { useState } from 'react';
import { LayoutDashboard, User, ArrowRight, Server, Database, Key, AlertTriangle, Globe, ShieldCheck } from 'lucide-react';
import { OdooClient } from '../services/odoo';
import { OdooSession } from '../types';

interface LoginProps {
  onLogin: (session: OdooSession | null) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  // Pre-filled with user provided credentials
  const [url, setUrl] = useState('https://igp.facturaclic.pe/');
  const [db, setDb] = useState('igp_master');
  const [email, setEmail] = useState('soporte@facturaclic.pe');
  // Defaulting to API Key as password for XML-RPC stability
  const [password, setPassword] = useState('6761eabe769db8795b3817000bd649cad0970d0f'); 
  const [useProxy, setUseProxy] = useState(true); // Default true to bypass CORS
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Initialize client with proxy setting
      const client = new OdooClient(url, db, useProxy);
      const uid = await client.authenticate(email, password);
      
      console.log("Authentication successful, UID:", uid);
      
      onLogin({
        url,
        db,
        username: email,
        apiKey: password,
        uid,
        useProxy
      });
    } catch (err: any) {
      console.error(err);
      let msg = "Error de conexión.";
      if (err.message.includes("Failed to fetch")) {
        msg = "Error de Red/CORS. Intenta activar la opción 'Usar Proxy CORS' en configuración avanzada.";
      } else if (err.message.includes("Authentication failed")) {
        msg = "Credenciales inválidas. Verifica usuario y contraseña/API Key.";
      } else {
        msg = err.message;
      }
      
      // Fallback for demo purposes if connection fails (typical in browser environments without proxy)
      const confirmed = window.confirm(`${msg}\n\n¿Deseas entrar en modo DEMO/Simulación con estos datos?`);
      if (confirmed) {
         onLogin(null); // Null session triggers mock mode in Dashboard
      } else {
         setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-emerald-600 p-8 text-center relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-full bg-emerald-700/20 backdrop-blur-sm z-0"></div>
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4 shadow-lg backdrop-blur-md">
                <LayoutDashboard className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Odoo Analytics</h1>
            <p className="text-emerald-100 mt-2 text-sm">Conexión Directa XML-RPC</p>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex gap-2 items-start">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className={`space-y-4 transition-all duration-300 ${showAdvanced ? 'block' : 'hidden'}`}>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">URL Instancia Odoo</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Server className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Base de Datos</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Database className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                        type="text"
                        value={db}
                        onChange={(e) => setDb(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        required
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <input 
                      type="checkbox" 
                      id="useProxy" 
                      checked={useProxy} 
                      onChange={(e) => setUseProxy(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="useProxy" className="text-xs text-slate-600 flex items-center gap-1 cursor-pointer select-none">
                       <Globe className="w-3 h-3" />
                       Usar Proxy CORS (Requerido para Web)
                    </label>
                </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Usuario / Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">API Key o Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 ml-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                API Key recomendada para seguridad
              </p>
            </div>

            <div className="pt-2">
                <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-4 rounded-lg transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                {loading ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Conectando...</span>
                    </>
                ) : (
                    <>
                    Ingresar a la Plataforma
                    <ArrowRight className="w-4 h-4" />
                    </>
                )}
                </button>
            </div>
            
            <div className="text-center">
                 <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                     {showAdvanced ? 'Ocultar configuración avanzada' : 'Mostrar configuración de servidor'}
                 </button>
            </div>
          </form>
        </div>
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">v1.3.0 &bull; FacturaClic Integration</p>
        </div>
      </div>
    </div>
  );
};

export default Login;