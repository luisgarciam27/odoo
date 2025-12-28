
import React, { useState } from 'react';
import { 
  Palette, ImageIcon, Save, CheckCircle2, RotateCcw, MapPin, Plus, Trash2, 
  Sparkles, Pill, Briefcase, PawPrint, Footprints, Wallet, QrCode, Phone, 
  User, X, Globe, Share2, Info, ShieldCheck, Music2
} from 'lucide-react';
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

  const updateSlide = (index: number, val: string) => {
    const slides = [...(currentConfig.slide_images || [])];
    while (slides.length <= index) slides.push('');
    slides[index] = val;
    setCurrentConfig({...currentConfig, slide_images: slides.filter(s => s !== undefined)});
  };

  const brandColor = currentConfig.colorPrimario || '#84cc16';

  const ImageInput = ({ label, value, onChange, placeholder, icon: Icon }: any) => (
    <div className="space-y-3">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
        <Icon className="w-3 h-3"/> {label}
      </label>
      <div className="flex gap-4 items-start">
        <div className="relative group w-20 h-20 shrink-0">
          <div className="w-full h-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden transition-all group-hover:border-brand-500">
            {value ? (
              <img src={value} className="w-full h-full object-contain" alt="Preview"/>
            ) : (
              <ImageIcon className="w-6 h-6 text-slate-200"/>
            )}
          </div>
          {value && (
            <button 
              type="button"
              onClick={() => onChange('')}
              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
            >
              <X className="w-3 h-3"/>
            </button>
          )}
        </div>
        <input 
          type="text" 
          placeholder={placeholder} 
          className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-brand-500 shadow-inner" 
          value={value} 
          onChange={e => onChange(e.target.value)} 
        />
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 pb-32">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Panel de Marca</h2>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
             <Sparkles className="w-4 h-4 text-brand-500"/> Personalización de Experiencia de Cliente
          </p>
        </div>
        <button 
            onClick={handleSave}
            className="px-10 py-5 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:brightness-110 transition-all flex items-center gap-3"
            style={{backgroundColor: brandColor}}
        >
            {isSaving ? <RotateCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Guardar Configuración
        </button>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        <div className="space-y-8">
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <Phone className="w-6 h-6 text-emerald-500" /> Canales y Redes
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp de Pedidos</label>
                <input type="text" placeholder="Ej: 51987654321" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" value={currentConfig.whatsappNumbers} onChange={e => setCurrentConfig({...currentConfig, whatsappNumbers: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp de Ayuda (Botón Flotante)</label>
                <input type="text" placeholder="Ej: 51912345678" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" value={currentConfig.whatsappHelpNumber} onChange={e => setCurrentConfig({...currentConfig, whatsappHelpNumber: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 gap-4">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase">TikTok URL</label>
                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                      <Music2 className="w-5 h-5 ml-3 text-slate-400" />
                      <input type="text" className="flex-1 p-3 bg-transparent border-none outline-none text-[10px]" value={currentConfig.tiktok_url} onChange={e => setCurrentConfig({...currentConfig, tiktok_url: e.target.value})} />
                    </div>
                 </div>
              </div>
            </div>
          </section>

          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <ImageIcon className="w-6 h-6 text-indigo-500" /> Banner Tienda (Diapositivas)
            </h3>
            <div className="space-y-4">
               {[0, 1, 2].map(i => (
                 <div key={i} className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase">Imagen Slide {i + 1}</label>
                   <input 
                    type="text" 
                    placeholder="URL de la imagen..." 
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold" 
                    value={currentConfig.slide_images?.[i] || ''} 
                    onChange={e => updateSlide(i, e.target.value)} 
                   />
                 </div>
               ))}
               <p className="text-[8px] text-slate-400 uppercase font-bold italic">Se recomiendan imágenes de 1200x400px.</p>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <Palette className="w-6 h-6 text-indigo-500"/> Branding e Identidad
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Comercial</label>
                <input type="text" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black uppercase text-sm outline-none" value={currentConfig.nombreComercial} onChange={e => setCurrentConfig({...currentConfig, nombreComercial: e.target.value})} />
              </div>
              <ImageInput label="Logo de Marca" value={currentConfig.logoUrl} onChange={(val: string) => setCurrentConfig({...currentConfig, logoUrl: val})} placeholder="URL del logo..." icon={ImageIcon}/>
            </div>
          </section>

          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <MapPin className="w-6 h-6 text-blue-500" /> Sedes
            </h3>
            <div className="space-y-4">
              {(currentConfig.sedes_recojo || []).map(sede => (
                <div key={sede.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4">
                   <div className="flex-1 space-y-2">
                     <input type="text" placeholder="NOMBRE SEDE" className="w-full p-2 bg-white border border-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest outline-none" value={sede.nombre} onChange={e => updateSede(sede.id, 'nombre', e.target.value)} />
                     <input type="text" placeholder="DIRECCIÓN" className="w-full p-2 bg-white border border-slate-100 rounded-lg text-[10px] font-bold outline-none" value={sede.direccion} onChange={e => updateSede(sede.id, 'direccion', e.target.value)} />
                   </div>
                   <button type="button" onClick={() => removeSede(sede.id)} className="p-2 text-red-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
              <button type="button" onClick={addSede} className="w-full p-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-[9px] uppercase tracking-widest hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4"/> Añadir Sede
              </button>
            </div>
          </section>
        </div>

        <div className="space-y-8">
           <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <Wallet className="w-6 h-6 text-brand-600" /> Pagos Digitales
            </h3>
            <div className="space-y-6">
               <div className="p-6 bg-[#742284]/5 rounded-3xl border border-[#742284]/10 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                     <div className="w-8 h-8 bg-[#742284] rounded-lg flex items-center justify-center text-white font-black text-xs">Y</div>
                     <span className="text-[10px] font-black uppercase text-[#742284]">Yape</span>
                  </div>
                  <input type="text" placeholder="Número" className="w-full p-3 bg-white border border-[#742284]/10 rounded-xl text-xs font-bold" value={currentConfig.yapeNumber} onChange={e => setCurrentConfig({...currentConfig, yapeNumber: e.target.value})} />
                  <input type="text" placeholder="Titular" className="w-full p-3 bg-white border border-[#742284]/10 rounded-xl text-[9px] font-black uppercase" value={currentConfig.yapeName} onChange={e => setCurrentConfig({...currentConfig, yapeName: e.target.value})} />
                  <input type="text" placeholder="URL QR Yape" className="w-full p-3 bg-white border border-[#742284]/10 rounded-xl text-[9px]" value={currentConfig.yapeQR} onChange={e => setCurrentConfig({...currentConfig, yapeQR: e.target.value})} />
               </div>

               <div className="p-6 bg-[#00A9E0]/5 rounded-3xl border border-[#00A9E0]/10 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                     <div className="w-8 h-8 bg-[#00A9E0] rounded-lg flex items-center justify-center text-white font-black text-xs">P</div>
                     <span className="text-[10px] font-black uppercase text-[#00A9E0]">Plin</span>
                  </div>
                  <input type="text" placeholder="Número" className="w-full p-3 bg-white border border-[#00A9E0]/10 rounded-xl text-xs font-bold" value={currentConfig.plinNumber} onChange={e => setCurrentConfig({...currentConfig, plinNumber: e.target.value})} />
                  <input type="text" placeholder="Titular" className="w-full p-3 bg-white border border-[#00A9E0]/10 rounded-xl text-[9px] font-black uppercase" value={currentConfig.plinName} onChange={e => setCurrentConfig({...currentConfig, plinName: e.target.value})} />
                  <input type="text" placeholder="URL QR Plin" className="w-full p-3 bg-white border border-[#00A9E0]/10 rounded-xl text-[9px]" value={currentConfig.plinQR} onChange={e => setCurrentConfig({...currentConfig, plinQR: e.target.value})} />
               </div>
            </div>
          </section>
        </div>
      </form>

      {showSuccess && (
         <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-10 py-5 rounded-full shadow-2xl animate-in slide-in-from-top-10 flex items-center gap-4">
            <CheckCircle2 className="text-brand-400 w-6 h-6"/>
            <span className="text-xs font-black uppercase tracking-widest">¡Configuración Guardada!</span>
         </div>
      )}
    </div>
  );
};

export default StoreSettings;
