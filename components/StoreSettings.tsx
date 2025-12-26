
import React, { useState } from 'react';
import { Palette, ShoppingBag, QrCode, ImageIcon, Save, CheckCircle2, Globe, Tag, ExternalLink, RotateCcw, Copy, ListChecks, MapPin, Plus, Trash2, HeartPulse } from 'lucide-react';
import { ClientConfig, SedeStore } from '../types';
import { saveClient } from '../services/clientManager';

interface StoreSettingsProps {
  config: ClientConfig;
  onUpdate: (newConfig: ClientConfig) => void;
}

const StoreSettings: React.FC<StoreSettingsProps> = ({ config, onUpdate }) => {
  const [currentConfig, setCurrentConfig] = useState<ClientConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const result = await saveClient(currentConfig, false);
    if (result.success) {
      onUpdate(currentConfig);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
    setIsSaving(false);
  };

  const addSede = () => {
    const newSede: SedeStore = { id: Date.now().toString(), nombre: '', direccion: '' };
    setCurrentConfig({...currentConfig, sedes_recojo: [...(currentConfig.sedes_recojo || []), newSede]});
  };

  const updateSede = (id: string, field: keyof SedeStore, val: string) => {
    setCurrentConfig({
      ...currentConfig,
      sedes_recojo: (currentConfig.sedes_recojo || []).map(s => s.id === id ? { ...s, [field]: val } : s)
    });
  };

  const removeSede = (id: string) => {
    setCurrentConfig({
      ...currentConfig,
      sedes_recojo: (currentConfig.sedes_recojo || []).filter(s => s.id !== id)
    });
  };

  const brandColor = currentConfig.colorPrimario || '#84cc16';

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Panel de Configuración Tienda</h2>
          <p className="text-slate-500 text-sm mt-1">Personaliza la experiencia de salud de tus clientes.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <MapPin className="w-6 h-6 text-blue-500" /> Puntos de Recojo (Sedes)
            </h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Registra las direcciones donde tus clientes pueden recoger sus pedidos.</p>
            
            <div className="space-y-4">
              {(currentConfig.sedes_recojo || []).map(sede => (
                <div key={sede.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4">
                   <div className="flex-1 space-y-2">
                     <input 
                       type="text" placeholder="Nombre de Sede (Ej: Sucursal Centro)" 
                       className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                       value={sede.nombre} onChange={e => updateSede(sede.id, 'nombre', e.target.value)}
                     />
                     <input 
                       type="text" placeholder="Dirección exacta" 
                       className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-[10px]"
                       value={sede.direccion} onChange={updateSede.bind(null, sede.id, 'direccion', (e:any) => e.target.value)}
                     />
                   </div>
                   <button type="button" onClick={() => removeSede(sede.id)} className="p-2 text-red-300 hover:text-red-500 transition-colors self-center"><Trash2 className="w-5 h-5"/></button>
                </div>
              ))}
              <button 
                type="button" onClick={addSede}
                className="w-full p-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold text-xs hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4"/> Añadir Nueva Sede
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <HeartPulse className="w-6 h-6 text-red-500" /> Ficha Técnica Médica
            </h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Selecciona qué datos técnicos quieres que vean los clientes.</p>
            
            <div className="space-y-3">
               {[
                 {id: 'registro', label: 'Registro Sanitario (R.S. / N.S.O.)'},
                 {id: 'laboratorio', label: 'Laboratorio o Fabricante'},
                 {id: 'principio', label: 'Principio Activo'}
               ].map(campo => (
                 <label key={campo.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <span className="text-xs font-bold text-slate-700">{campo.label}</span>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 accent-brand-500" 
                      checked={(currentConfig.campos_medicos_visibles || []).includes(campo.id)}
                      onChange={e => {
                        const current = currentConfig.campos_medicos_visibles || [];
                        const updated = e.target.checked ? [...current, campo.id] : current.filter(id => id !== campo.id);
                        setCurrentConfig({...currentConfig, campos_medicos_visibles: updated});
                      }}
                    />
                 </label>
               ))}
            </div>
          </div>

          <div className="pt-4 space-y-4">
             {showSuccess && (
               <div className="bg-emerald-50 text-emerald-700 px-6 py-4 rounded-2xl flex items-center gap-3 border border-emerald-100 animate-in zoom-in">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-black uppercase">¡Configuración Actualizada!</span>
               </div>
             )}
             
             <button 
               type="submit" 
               disabled={isSaving}
               className="w-full py-6 text-white rounded-[2rem] font-black shadow-2xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
               style={{backgroundColor: brandColor, boxShadow: `0 20px 30px -5px ${brandColor}40`}}
             >
                {isSaving ? <RotateCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                GUARDAR Y PUBLICAR CAMBIOS
             </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default StoreSettings;
