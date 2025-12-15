import React, { useState } from 'react';
import { X, Server, Database, User, Key, Save, AlertCircle, HelpCircle } from 'lucide-react';

interface OdooConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OdooConfigModal: React.FC<OdooConfigModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState({
    url: '',
    db: '',
    username: '',
    apiKey: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Aquí iría la lógica para probar la conexión XML-RPC
    alert("Configuración guardada (Simulación). En producción, esto validaría las credenciales contra el endpoint /xmlrpc/2/common");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-emerald-400" />
              Conexión Odoo XML-RPC
            </h2>
            <p className="text-slate-400 text-xs mt-1 font-light">Configura el acceso a tu instancia ERP</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Requisitos de Conexión</p>
              <p className="font-light">Para conectar, genera una <strong>API Key</strong> en tu perfil de Odoo (Preferencias {'>'} Seguridad de la Cuenta). No uses tu contraseña de inicio de sesión habitual.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">URL del Servidor</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Server className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="url"
                  placeholder="https://mi-empresa.odoo.com"
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                  value={config.url}
                  onChange={e => setConfig({...config, url: e.target.value})}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Base de Datos</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Database className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="nombre_db_produccion"
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                  value={config.db}
                  onChange={e => setConfig({...config, db: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Usuario (Email)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    placeholder="admin@empresa.com"
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                    value={config.username}
                    onChange={e => setConfig({...config, username: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  API Key
                  <span className="text-slate-400 font-normal ml-1 text-xs font-light">(o Contraseña)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    placeholder="••••••••••••••"
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                    value={config.apiKey}
                    onChange={e => setConfig({...config, apiKey: e.target.value})}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors text-sm"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 text-sm"
              >
                <Save className="w-4 h-4" />
                Guardar y Conectar
              </button>
            </div>
          </form>
        </div>
        
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200">
           <a href="#" className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 font-light">
             <HelpCircle className="w-3 h-3" />
             ¿Dónde encuentro estos datos en mi Odoo?
           </a>
        </div>
      </div>
    </div>
  );
};

export default OdooConfigModal;