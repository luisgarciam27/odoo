
import React, { useState } from 'react';
// Added PawPrint to the list of icons imported from lucide-react
import { Palette, ImageIcon, Save, CheckCircle2, RotateCcw, MapPin, Plus, Trash2, HeartPulse, Sparkles, MessageSquareText, Stethoscope, Footprints, Pill, Briefcase, PawPrint } from 'lucide-react';
import { ClientConfig, SedeStore, BusinessType } from '../types';
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
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Configuración de Tienda</h2>
          <p className="text-slate-500 text-sm mt-1">Define la identidad de tu negocio y puntos de entrega.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* TIPO DE NEGOCIO */}
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <Briefcase className="w-6 h-6 text-brand-500" /> Giro de Negocio
            </h3>
            <div className="grid grid-cols-3 gap-3">
               {[
                 {id: 'pharmacy', icon: Pill, label: 'Farmacia'},
                 {id: 'veterinary', icon: PawPrint, label: 'Veterinaria'},
                 {id: 'podiatry', icon: Footprints, label: 'Podología'}
               ].map(type => (
                 <button 
                  key={type.id} type="button" 
                  onClick={() => setCurrentConfig({...currentConfig, businessType: type.id as BusinessType})}
                  className={`flex flex-col items-center gap-3 p-5 rounded-[2.5rem] border-2 transition-all ${currentConfig.businessType === type.id ? 'border-brand-500 bg-brand-50' : 'border-slate-50 bg-white hover:border-slate-200'}`}
                 >
                   <type.icon className={`w-6 h-6 ${currentConfig.businessType === type.id ? 'text-brand-600' : 'text-slate-400'}`} />
                   <span className="text-[10px] font-black uppercase tracking-tighter">{type.label}</span>
                 </button>
               ))}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <MapPin className="w-6 h-6 text-blue-500" /> Puntos de Recojo (Sedes)
            </h3>
            <div className="space-y-4">
              {(currentConfig.sedes_recojo || []).map(sede => (
                <div key={sede.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4">
                   <div className="flex-1 space-y-3">
                     <input type="text" placeholder="Nombre Sede" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold uppercase" value={sede.nombre} onChange={e => updateSede(sede.id, 'nombre', e.target.value)} />
                     <input type="text" placeholder="Dirección" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs" value={sede.direccion} onChange={e => updateSede(sede.id, 'direccion', e.target.value)} />
                   </div>
                   <button type="button" onClick={() => removeSede(sede.id)} className="p-2 text-red-300 hover:text-red-500 self-center"><Trash2 className="w-5 h-5"/></button>
                </div>
              ))}
              <button type="button" onClick={addSede} className="w-full p-5 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-bold text-xs hover:border-blue-300 transition-all">+ Añadir Punto de Recojo</button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3"><Sparkles className="w-6 h-6 text-indigo-500"/> Identidad Visual</h3>
            <div className="space-y-5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Comercial</label>
              <input type="text" placeholder="Nombre Comercial" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black uppercase outline-none focus:ring-2 focus:ring-brand-500" value={currentConfig.nombreComercial} onChange={e => setCurrentConfig({...currentConfig, nombreComercial: e.target.value})} />
              <div className="flex gap-4">
                <input type="color" className="w-16 h-16 rounded-[1.5rem] border-none cursor-pointer shadow-lg" value={currentConfig.colorPrimario} onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})} />
                <input type="text" placeholder="URL Logo" className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs" value={currentConfig.logoUrl} onChange={e => setCurrentConfig({...currentConfig, logoUrl: e.target.value})} />
              </div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción / Slogan</label>
              <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium h-24" placeholder="Escribe algo sobre tu negocio..." value={currentConfig.footer_description} onChange={e => setCurrentConfig({...currentConfig, footer_description: e.target.value})} />
            </div>
          </div>

          <div className="pt-4">
             {showSuccess && (
               <div className="bg-slate-900 text-white px-8 py-5 rounded-[2rem] flex items-center justify-center gap-4 animate-in slide-in-from-bottom-6 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-black uppercase tracking-[0.2em]">¡Configuración Actualizada!</span>
               </div>
             )}
             <button type="submit" disabled={isSaving} className="w-full py-7 text-white rounded-[2.5rem] font-black shadow-2xl hover:brightness-110 transition-all flex items-center justify-center gap-4 text-sm uppercase tracking-[0.2em]" style={{backgroundColor: brandColor}}>
                {isSaving ? <RotateCcw className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                Guardar Configuración Premium
             </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default StoreSettings;
