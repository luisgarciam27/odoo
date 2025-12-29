
import React, { useState } from 'react';
import { 
  Palette, Save, CheckCircle2, RotateCcw, MapPin, Plus, Trash2, 
  Sparkles, Wallet, Phone, X, Facebook, Instagram, MessageCircle,
  RefreshCw, Share2, LayoutPanelTop, QrCode, Upload, Smartphone, AlertCircle,
  Eye, Image as ImageIcon, Paintbrush, Footprints, Layout, AlignLeft, Citrus,
  Video, Layers, User
} from 'lucide-react';
import { ClientConfig, SedeStore } from '../types';
import { saveClient } from '../services/clientManager';
import { GoogleGenAI, Type } from "@google/genai";

interface StoreSettingsProps {
  config: ClientConfig;
  onUpdate: (newConfig: ClientConfig) => void;
  session?: any;
}

const StoreSettings: React.FC<StoreSettingsProps> = ({ config, onUpdate }) => {
  const [currentConfig, setCurrentConfig] = useState<ClientConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [newCat, setNewCat] = useState('');

  const handleFileUpload = (field: 'yapeQR' | 'plinQR' | 'logoUrl' | 'footerLogoUrl') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
          alert("La imagen es muy pesada (máx 2MB).");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentConfig(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const addCustomCategory = () => {
    if (!newCat.trim()) return;
    const cat = newCat.trim().toUpperCase();
    if (currentConfig.customCategories?.includes(cat)) return;
    setCurrentConfig(prev => ({
      ...prev,
      customCategories: [...(prev.customCategories || []), cat]
    }));
    setNewCat('');
  };

  const removeCustomCategory = (cat: string) => {
    setCurrentConfig(prev => ({
      ...prev,
      customCategories: (prev.customCategories || []).filter(c => c !== cat)
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const result = await saveClient(currentConfig, false);
    if (result.success) {
      onUpdate(currentConfig);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } else {
      alert(result.message || "Error al guardar");
    }
    setIsSaving(false);
  };

  const addSlide = () => {
    setCurrentConfig({...currentConfig, slide_images: [...(currentConfig.slide_images || []), '']});
  };

  const updateSlide = (index: number, val: string) => {
    const slides = [...(currentConfig.slide_images || [])];
    slides[index] = val;
    setCurrentConfig({...currentConfig, slide_images: slides});
  };

  const removeSlide = (index: number) => {
    const slides = (currentConfig.slide_images || []).filter((_, i) => i !== index);
    setCurrentConfig({...currentConfig, slide_images: slides});
  };

  const brandColor = currentConfig.colorPrimario || '#84cc16';
  const secondaryColor = currentConfig.colorSecundario || '#1e293b';

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 pb-32">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
           <div className="p-4 bg-white rounded-[2.5rem] shadow-xl border border-slate-100" style={{ color: brandColor }}>
              <Palette className="w-10 h-10" />
           </div>
           <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Estética & Configuración</h2>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">Logo, Pagos, Redes y Categorías</p>
           </div>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving} 
          className="px-12 py-6 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl flex items-center gap-4 transition-all hover:scale-105 active:scale-95" 
          style={{backgroundColor: brandColor}}
        >
          {isSaving ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} Guardar Diseño
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* PANEL IZQUIERDO */}
        <div className="lg:col-span-7 space-y-8">
          {/* IDENTIDAD VISUAL */}
          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter mb-8">
              <ImageIcon className="w-7 h-7 text-brand-500"/> Logotipos e Imagen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo Principal (Header)</label>
                  <div className="flex gap-2">
                     <input type="text" placeholder="URL logo" className="flex-1 p-4 bg-slate-50 rounded-2xl text-xs font-bold" value={currentConfig.logoUrl || ''} onChange={e => setCurrentConfig({...currentConfig, logoUrl: e.target.value})} />
                     <label className="cursor-pointer p-4 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors">
                        <Upload className="w-5 h-5 text-slate-500"/>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('logoUrl')} />
                     </label>
                  </div>
               </div>
               <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo Footer (Opcional)</label>
                  <div className="flex gap-2">
                     <input type="text" placeholder="URL logo footer" className="flex-1 p-4 bg-slate-50 rounded-2xl text-xs font-bold" value={currentConfig.footerLogoUrl || ''} onChange={e => setCurrentConfig({...currentConfig, footerLogoUrl: e.target.value})} />
                     <label className="cursor-pointer p-4 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors">
                        <Upload className="w-5 h-5 text-slate-500"/>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('footerLogoUrl')} />
                     </label>
                  </div>
               </div>
            </div>
            
            <div className="mt-8 space-y-3">
               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Descripción de Marca (Footer)</label>
               <textarea 
                  className="w-full p-6 bg-slate-50 rounded-3xl border-none shadow-inner text-xs font-bold h-24 resize-none" 
                  placeholder="Escribe el mensaje de confianza que verán tus clientes en el pie de página..."
                  value={currentConfig.footer_description || ''}
                  onChange={e => setCurrentConfig({...currentConfig, footer_description: e.target.value})}
               />
            </div>
          </section>

          {/* GESTOR DE CATEGORÍAS VIRTUALES (PARA PERROS, ETC) */}
          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-slate-100">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter mb-8">
              <Layers className="w-7 h-7 text-orange-500"/> Categorías Virtuales (Filtros)
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Crea categorías personalizadas para organizar tu tienda (ej: PERROS, GATOS, OFERTAS)</p>
            
            <div className="flex gap-3 mb-8">
               <input 
                  type="text" 
                  placeholder="Nueva categoría..." 
                  className="flex-1 p-4 bg-slate-50 rounded-2xl border-none font-black text-xs uppercase"
                  value={newCat}
                  onChange={e => setNewCat(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomCategory()}
               />
               <button onClick={addCustomCategory} className="px-6 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase transition-all hover:bg-orange-500"><Plus className="w-5 h-5"/></button>
            </div>

            <div className="flex flex-wrap gap-3">
               {(currentConfig.customCategories || []).length === 0 ? (
                  <p className="text-[10px] font-bold text-slate-300 uppercase py-4">Aún no has creado categorías virtuales.</p>
               ) : (
                  currentConfig.customCategories?.map(cat => (
                     <div key={cat} className="flex items-center gap-2 bg-slate-50 px-5 py-2.5 rounded-full border border-slate-100 shadow-sm animate-in zoom-in">
                        <span className="text-[10px] font-black uppercase text-slate-700 tracking-widest">{cat}</span>
                        <button onClick={() => removeCustomCategory(cat)} className="text-red-400 hover:text-red-600 transition-colors"><X className="w-4 h-4"/></button>
                     </div>
                  ))
               )}
            </div>
          </section>

          {/* COLORES */}
          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-slate-100">
             <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-8">Colores Corporativos</h3>
             <div className="grid grid-cols-3 gap-6">
                <div className="flex flex-col items-center gap-3">
                   <input type="color" className="w-16 h-16 rounded-3xl cursor-pointer border-4 border-white shadow-xl" value={currentConfig.colorPrimario} onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})} />
                   <span className="text-[8px] font-black text-slate-400 uppercase">Principal</span>
                </div>
                <div className="flex flex-col items-center gap-3">
                   <input type="color" className="w-16 h-16 rounded-3xl cursor-pointer border-4 border-white shadow-xl" value={currentConfig.colorSecundario} onChange={e => setCurrentConfig({...currentConfig, colorSecundario: e.target.value})} />
                   <span className="text-[8px] font-black text-slate-400 uppercase">Footer/Fondo</span>
                </div>
                <div className="flex flex-col items-center gap-3">
                   <input type="color" className="w-16 h-16 rounded-3xl cursor-pointer border-4 border-white shadow-xl" value={currentConfig.colorAcento} onChange={e => setCurrentConfig({...currentConfig, colorAcento: e.target.value})} />
                   <span className="text-[8px] font-black text-slate-400 uppercase">Acento</span>
                </div>
             </div>
          </section>
        </div>

        {/* PANEL DERECHO */}
        <div className="lg:col-span-5 space-y-8">
           
           {/* QR Y PAGOS DIGITALES */}
           <section className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 space-y-6">
             <h3 className="text-lg font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
               <QrCode className="w-6 h-6 text-purple-600"/> Pagos con Yape / Plin
             </h3>
             <div className="space-y-8">
                {/* YAPE */}
                <div className="p-6 bg-slate-50 rounded-3xl space-y-4 border border-slate-100">
                   <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white font-black text-[10px]">Y</div>
                      <span className="text-[10px] font-black uppercase text-slate-700 tracking-widest">Configuración Yape</span>
                   </div>
                   <div className="flex gap-4">
                      <div className="relative group w-24 h-24 bg-white rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border-2 border-dashed border-slate-200 shrink-0">
                         {currentConfig.yapeQR ? <img src={currentConfig.yapeQR} className="w-full h-full object-cover" /> : <QrCode className="w-8 h-8 text-slate-200" />}
                         <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                            <Upload className="text-white w-6 h-6"/>
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('yapeQR')} />
                         </label>
                      </div>
                      <div className="flex-1 space-y-3">
                         <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300"/>
                            <input type="text" placeholder="Titular de cuenta" className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-100 rounded-xl text-[10px] font-bold outline-none" value={currentConfig.yapeName || ''} onChange={e => setCurrentConfig({...currentConfig, yapeName: e.target.value})} />
                         </div>
                         <div className="relative">
                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300"/>
                            <input type="text" placeholder="Número Yape" className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-100 rounded-xl text-[10px] font-bold outline-none" value={currentConfig.yapeNumber || ''} onChange={e => setCurrentConfig({...currentConfig, yapeNumber: e.target.value})} />
                         </div>
                      </div>
                   </div>
                </div>

                {/* PLIN */}
                <div className="p-6 bg-slate-50 rounded-3xl space-y-4 border border-slate-100">
                   <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-black text-[10px]">P</div>
                      <span className="text-[10px] font-black uppercase text-slate-700 tracking-widest">Configuración Plin</span>
                   </div>
                   <div className="flex gap-4">
                      <div className="relative group w-24 h-24 bg-white rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border-2 border-dashed border-slate-200 shrink-0">
                         {currentConfig.plinQR ? <img src={currentConfig.plinQR} className="w-full h-full object-cover" /> : <QrCode className="w-8 h-8 text-slate-200" />}
                         <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                            <Upload className="text-white w-6 h-6"/>
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('plinQR')} />
                         </label>
                      </div>
                      <div className="flex-1 space-y-3">
                         <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300"/>
                            <input type="text" placeholder="Titular de cuenta" className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-100 rounded-xl text-[10px] font-bold outline-none" value={currentConfig.plinName || ''} onChange={e => setCurrentConfig({...currentConfig, plinName: e.target.value})} />
                         </div>
                         <div className="relative">
                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300"/>
                            <input type="text" placeholder="Número Plin" className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-100 rounded-xl text-[10px] font-bold outline-none" value={currentConfig.plinNumber || ''} onChange={e => setCurrentConfig({...currentConfig, plinNumber: e.target.value})} />
                         </div>
                      </div>
                   </div>
                </div>
             </div>
           </section>

           {/* REDES SOCIALES */}
           <section className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 space-y-6">
             <h3 className="text-lg font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
               <Share2 className="w-6 h-6 text-blue-500"/> Redes Sociales
             </h3>
             <div className="space-y-3">
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <Facebook className="w-5 h-5 text-blue-600"/>
                   <input type="text" placeholder="URL Facebook" className="w-full bg-transparent outline-none text-[10px] font-bold" value={currentConfig.facebook_url || ''} onChange={e => setCurrentConfig({...currentConfig, facebook_url: e.target.value})} />
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <Instagram className="w-5 h-5 text-pink-500"/>
                   <input type="text" placeholder="URL Instagram" className="w-full bg-transparent outline-none text-[10px] font-bold" value={currentConfig.instagram_url || ''} onChange={e => setCurrentConfig({...currentConfig, instagram_url: e.target.value})} />
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <Video className="w-5 h-5 text-black"/>
                   <input type="text" placeholder="URL TikTok" className="w-full bg-transparent outline-none text-[10px] font-bold" value={currentConfig.tiktok_url || ''} onChange={e => setCurrentConfig({...currentConfig, tiktok_url: e.target.value})} />
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <MessageCircle className="w-5 h-5 text-emerald-500"/>
                   <input type="text" placeholder="WhatsApp Consultas" className="w-full bg-transparent outline-none text-[10px] font-bold" value={currentConfig.whatsappHelpNumber || ''} onChange={e => setCurrentConfig({...currentConfig, whatsappHelpNumber: e.target.value})} />
                </div>
             </div>
           </section>
        </div>
      </div>

      {showSuccess && (
         <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-12 py-6 rounded-full shadow-2xl animate-in slide-in-from-bottom-12 flex items-center gap-6 border border-white/10">
            <CheckCircle2 className="text-brand-400 w-10 h-10"/>
            <div className="flex flex-col">
                <span className="text-sm font-black uppercase tracking-widest leading-none">¡Diseño Guardado!</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Los cambios ya están en vivo</span>
            </div>
         </div>
      )}
    </div>
  );
};

export default StoreSettings;
