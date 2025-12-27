
import React, { useState, useEffect } from 'react';
import { X, Server, Database, User, Key, Save, AlertCircle, HelpCircle, RotateCcw } from 'lucide-react';

export interface ConnectionConfig {
  url: string;
  db: string;
  username: string;
  apiKey: string;
}

interface OdooConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConfig: ConnectionConfig;
  onSave: (config: ConnectionConfig) => void;
}

const OdooConfigModal: React.FC<OdooConfigModalProps> = ({ isOpen, onClose, initialConfig, onSave }) => {
  const [config, setConfig] = useState<ConnectionConfig>(initialConfig);

  // Reset config when modal opens with new initialConfig
  useEffect(() => {
    if (isOpen) {
      setConfig(initialConfig);
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
    onClose();
  };

  const handleReset = () => {
    if(confirm('¿Restaurar configuración por defecto?')) {
        setConfig({
            url: 'https://igp.facturaclic.pe/',
            db: 'vida_master',
            username: 'soporte@facturaclic.pe',
            apiKey: '7a823daf061832dd8f01876a714da94f7e9c9355'
        });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Server className="w-5 h-5 text-brand-500" />
              Configurar Servidor
            </h2>
            <p className="text-slate-500 text-xs mt-1 font-medium">Conexión Odoo XML-RPC</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors bg-white p-1 rounded-full hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
            <div className="text-sm text-brand-800">
              <p className="font-bold mb-1">Datos de Conexión</p>
              <p className="font-light leading-relaxed text-brand-900/80">
                Estos datos se guardarán localmente en tu navegador. Asegúrate de tener una <strong>API Key</strong> válida generada en Odoo.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">URL del Servidor</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Server className="h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                </div>
                <input
                  type="url"
                  placeholder="https://mi-empresa.odoo.com"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-100 focus:border-brand-500 outline-none text-sm text-slate-700 transition-all"
                  value={config.url}
                  onChange={e => setConfig({...config, url: e.target.value})}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Base de Datos</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Database className="h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="nombre_db"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-100 focus:border-brand-500 outline-none text-sm text-slate-700 transition-all"
                  value={config.db}
                  onChange={e => setConfig({...config, db: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Usuario (Email)</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                  </div>
                  <input
                    type="email"
                    placeholder="admin@empresa.com"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-100 focus:border-brand-500 outline-none text-sm text-slate-700 transition-all"
                    value={config.username}
                    onChange={e => setConfig({...config, username: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  API Key
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                  </div>
                  <input
                    type="password"
                    placeholder="••••••••••••••"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-100 focus:border-brand-500 outline-none text-sm text-slate-700 transition-all font-mono tracking-widest"
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
                className="px-4 py-2.5 border border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-slate-50 transition-colors text-xs uppercase tracking-wide flex items-center gap-2"
                onClick={handleReset}
                title="Restaurar valores por defecto"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors text-xs uppercase tracking-wide"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600 transition-all shadow-lg shadow-brand-200 flex items-center justify-center gap-2 text-xs uppercase tracking-wide transform active:scale-[0.98]"
              >
                <Save className="w-4 h-4" />
                Guardar
              </button>
            </div>
          </form>
        </div>
        
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100">
           <a href="https://www.odoo.com/documentation/17.0/developer/reference/external_api.html" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-600 font-medium transition-colors">
             <HelpCircle className="w-3 h-3" />
             ¿Cómo obtener mi API Key de Odoo?
           </a>
        </div>
      </div>
    </div>
  );
};

export default OdooConfigModal;
