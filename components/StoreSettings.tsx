
import React, { useState } from 'react';
import { Palette, ImageIcon, Save, CheckCircle2, RotateCcw, MapPin, Plus, Trash2, HeartPulse, Sparkles, MessageSquareText } from 'lucide-react';
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
    setCurrentConfig(prev => ({
      ...prev,
      sedes_recojo: (prev.sedes_recojo || []).map(s => s.id === id ? { ...s, [field]: val } : s)
    }));
  };

  const removeSede = (id: string) => {
    setCurrentConfig(prev => ({
      ...prev,
      sedes_recojo: (prev.sedes_recojo || []).filter(s => s.id !== id)
    }));
  };

  const brandColor = currentConfig.colorPrimario || '#84cc16';

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Configuración Premium</h2>
          <p className="text-slate-500 text-sm mt-1">Personaliza la experiencia de tu marca y la confianza del cliente.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LOGÍSTICA DE SEDES */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <MapPin className="w-6 h-6 text-blue-500" /> Puntos de Recojo (Sedes)
            </h3>
            
            <div className="space-y-4">
              {(currentConfig.sedes_recojo || []).map(sede => (
                <div key={sede.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4">
                   <div className="flex-1 space-y-3">
                     <input 
                       type="text" placeholder="Nombre (Ej: Sucursal Principal)" 
                       className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                       value={sede.nombre} onChange={e => updateSede(sede.id, 'nombre', e.target.value)}
                     />
                     <input 
                       type="text" placeholder="Dirección Exacta" 
                       className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs"
                       value={sede.direccion} onChange={e => updateSede(sede.id, 'direccion', e.target.value)}
                     />
                   </div>
                   <button type="button" onClick={() => removeSede(sede.id)} className="p-2 text-red-300 hover:text-red-500 transition-colors self-center"><Trash2 className="w-5 h-5"/></button>
                </div>
              ))}
              <button 
                type="button" onClick={addSede}
                className="w-full p-5 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-bold text-xs hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4"/> Añadir Nueva Sucursal
              </button>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <MessageSquareText className="w-6 h-6 text-emerald-500" /> Mensajes de Confianza
            </h3>
            <div className="space-y-4">
               <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Texto Calidad (Footer)</label>
                  <textarea 
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-medium h-24"
                    placeholder="Ej: Todos nuestros medicamentos cuentan con registro sanitario..."
                    value={currentConfig.quality_text}
                    onChange={e => setCurrentConfig({...currentConfig, quality_text: e.target.value})}
                  />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Texto Soporte (Footer)</label>
                  <textarea 
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-medium h-24"
                    placeholder="Ej: Atención personalizada por farmacéuticos titulados..."
                    value={currentConfig.support_text}
                    onChange={e => setCurrentConfig({...currentConfig, support_text: e.target.value})}
                  />
               </div>
            </div>
          </div>
        </div>

        {/* MARCA Y VISIBILIDAD */}
        <div className="space-y-6">
           <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <HeartPulse className="w-6 h-6 text-red-500" /> Visibilidad Técnica (Pharma)
            </h3>
            
            <div className="grid grid-cols-1 gap-3">
               {[
                 {id: 'registro', label: 'Registro Sanitario (RS/NSO)'},
                 {id: 'laboratorio', label: 'Laboratorio / Fabricante'},
                 {id: 'principio', label: 'Principio Activo'}
               ].map(campo => (
                 <label key={campo.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-[2rem] cursor-pointer hover:bg-slate-100 transition-colors">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{campo.label}</span>
                    <input 
                      type="checkbox" 
                      className="w-6 h-6 accent-brand-500" 
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

          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3"><Sparkles className="w-6 h-6 text-indigo-500"/> Identidad Visual</h3>
            <div className="space-y-5">
              <input type="text" placeholder="Nombre Comercial Premium" className="w-full p-4 bg-slate-50 rounded-2xl font-black uppercase tracking-tight" value={currentConfig.nombreComercial} onChange={e => setCurrentConfig({...currentConfig, nombreComercial: e.target.value})} />
              <div className="flex gap-4">
                <input type="color" className="w-16 h-16 rounded-[1.5rem] border-none cursor-pointer shadow-lg shadow-slate-200" value={currentConfig.colorPrimario} onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})} />
                <div className="flex-1 relative">
                  <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input type="text" placeholder="URL Logo (PNG/SVG)" className="w-full pl-12 p-4 bg-slate-50 rounded-2xl text-xs font-medium" value={currentConfig.logoUrl} onChange={e => setCurrentConfig({...currentConfig, logoUrl: e.target.value})} />
                </div>
              </div>
              <textarea 
                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-medium h-20"
                placeholder="Descripción corta de marca..."
                value={currentConfig.footer_description}
                onChange={e => setCurrentConfig({...currentConfig, footer_description: e.target.value})}
              />
            </div>
          </div>

          <div className="pt-4 space-y-4">
             {showSuccess && (
               <div className="bg-slate-900 text-white px-8 py-5 rounded-[2rem] flex items-center justify-center gap-4 border border-slate-800 animate-in slide-in-from-bottom-6 duration-500">
                  <CheckCircle2 className="w-5 h-5 text-brand-400" />
                  <span className="text-xs font-black uppercase tracking-[0.2em]">¡Experiencia Actualizada!</span>
               </div>
             )}
             
             <button 
               type="submit" 
               disabled={isSaving}
               className="w-full py-7 text-white rounded-[2.5rem] font-black shadow-2xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-4 text-sm uppercase tracking-[0.2em]"
               style={{backgroundColor: brandColor, boxShadow: `0 25px 50px -12px ${brandColor}60`}}
             >
                {isSaving ? <RotateCcw className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                Publicar Cambios Premium
             </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default StoreSettings;
