
import React, { useState } from 'react';
import { 
  Palette, Save, CheckCircle2, RotateCcw, MapPin, Plus, Trash2, 
  Sparkles, Wallet, Phone, X, Facebook, Instagram, MessageCircle,
  RefreshCw, Share2, LayoutPanelTop, QrCode, Upload, Smartphone, AlertCircle,
  Eye, Image as ImageIcon, Paintbrush, Footprints, Layout, AlignLeft, Citrus,
  Video, Layers, User, Dog, Tag
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
    if (currentConfig.customCategories?.includes(cat)) {
        setNewCat('');
        return;
    }
    setCurrentConfig(prev => ({
      ...prev,
      customCategories: [...(prev.customCategories || []), cat]
    }));
    setNewCat('');
  };

  const removeCustomCategory = (cat: string) => {
    if (window.confirm(`¿Seguro que quieres eliminar la categoría "${cat}"? Esto no borrará los productos, pero ya no estarán agrupados bajo este nombre.`)) {
        setCurrentConfig(prev => ({
          ...prev,
          customCategories: (prev.customCategories || []).filter(c => c !== cat)
        }));
    }
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
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 pb-32 font-sans">
      
      {/* HEADER DINÁMICO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
           <div className="p-5 bg-white rounded-[2.5rem] shadow-xl border border-slate-100" style={{ color: brandColor }}>
              <Palette className="w-10 h-10" />
           </div>
           <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Estética & Marca</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Configuración integral Lemon BI</p>
           </div>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving} 
          className="px-12 py-6 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl flex items-center gap-4 transition-all hover:scale-105 active:scale-95 shadow-brand-500/20" 
          style={{backgroundColor: brandColor}}
        >
          {isSaving ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} Guardar Cambios
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* PANEL IZQUIERDO */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* IDENTIDAD VISUAL */}
          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter mb-8">
              <ImageIcon className="w-7 h-7 text-brand-500"/> Identidad Visual
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Logotipo Header</label>
                  <div className="flex gap-2">
                     <input type="text" placeholder="URL logo" className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none" value={currentConfig.logoUrl || ''} onChange={e => setCurrentConfig({...currentConfig, logoUrl: e.target.value})} />
                     <label className="cursor-pointer p-4 bg-slate-900 text-white rounded-2xl hover:bg-brand-500 transition-colors">
                        <Upload className="w-5 h-5"/>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('logoUrl')} />
                     </label>
                  </div>
               </div>
               <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Logotipo Footer</label>
                  <div className="flex gap-2">
                     <input type="text" placeholder="URL logo footer" className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none" value={currentConfig.footerLogoUrl || ''} onChange={e => setCurrentConfig({...currentConfig, footerLogoUrl: e.target.value})} />
                     <label className="cursor-pointer p-4 bg-slate-900 text-white rounded-2xl hover:bg-brand-500 transition-colors">
                        <Upload className="w-5 h-5"/>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('footerLogoUrl')} />
                     </label>
                  </div>
               </div>
            </div>
          </section>

          {/* GESTOR DE CATEGORÍAS VIRTUALES */}
          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-slate-100">
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter">
                  <Layers className="w-7 h-7 text-orange-500"/> Categorías Virtuales
                </h3>
                <span className="bg-orange-50 text-orange-600 px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Filtros Tienda</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 leading-relaxed">Estas categorías aparecerán como pestañas en tu tienda para organizar mejor tus productos (ej: PERROS, GATOS, ACCESORIOS).</p>
            
            <div className="flex gap-3 mb-10">
               <input 
                  type="text" 
                  placeholder="NOMBRE DE LA CATEGORÍA (Ej: PERROS)" 
                  className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs uppercase shadow-inner outline-none focus:ring-4 focus:ring-orange-500/10"
                  value={newCat}
                  onChange={e => setNewCat(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomCategory()}
               />
               <button onClick={addCustomCategory} className="px-8 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase transition-all hover:bg-orange-600 shadow-xl shadow-orange-500/20"><Plus className="w-6 h-6"/></button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
               {(currentConfig.customCategories || []).length === 0 ? (
                  <div className="col-span-full py-10 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200 text-center">
                     <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest">No hay categorías virtuales creadas</p>
                  </div>
               ) : (
                  currentConfig.customCategories?.map(cat => (
                     <div key={cat} className="flex items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-orange-200 transition-all group">
                        <div className="flex items-center gap-3">
                           {cat.toLowerCase().includes('perro') ? <Dog className="w-4 h-4 text-orange-500"/> : <Tag className="w-4 h-4 text-slate-300"/>}
                           <span className="text-[10px] font-black uppercase text-slate-700 tracking-tighter">{cat}</span>
                        </div>
                        <button onClick={() => removeCustomCategory(cat)} className="text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button>
                     </div>
                  ))
               )}
            </div>
          </section>

          {/* COLORES CORPORATIVOS */}
          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-slate-100">
             <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-10">Colores de Marca</h3>
             <div className="grid grid-cols-3 gap-8">
                <div className="flex flex-col items-center gap-4">
                   <div className="relative">
                      <input type="color" className="w-20 h-20 rounded-[2rem] cursor-pointer border-4 border-white shadow-2xl relative z-10" value={currentConfig.colorPrimario} onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})} />
                      <div className="absolute inset-0 blur-2xl opacity-20" style={{backgroundColor: currentConfig.colorPrimario}}></div>
                   </div>
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Color Primario</span>
                </div>
                <div className="flex flex-col items-center gap-4">
                   <div className="relative">
                      <input type="color" className="w-20 h-20 rounded-[2rem] cursor-pointer border-4 border-white shadow-2xl relative z-10" value={currentConfig.colorSecundario} onChange={e => setCurrentConfig({...currentConfig, colorSecundario: e.target.value})} />
                      <div className="absolute inset-0 blur-2xl opacity-20" style={{backgroundColor: currentConfig.colorSecundario}}></div>
                   </div>
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fondo Footer</span>
                </div>
                <div className="flex flex-col items-center gap-4">
                   <div className="relative">
                      <input type="color" className="w-20 h-20 rounded-[2rem] cursor-pointer border-4 border-white shadow-2xl relative z-10" value={currentConfig.colorAcento} onChange={e => setCurrentConfig({...currentConfig, colorAcento: e.target.value})} />
                      <div className="absolute inset-0 blur-2xl opacity-20" style={{backgroundColor: currentConfig.colorAcento}}></div>
                   </div>
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Color Acento</span>
                </div>
             </div>
          </section>
        </div>

        {/* PANEL DERECHO */}
        <div className="lg:col-span-5 space-y-8 font-sans">
           
           {/* QR Y PAGOS DIGITALES */}
           <section className="bg-white p-8 md:p-10 rounded-[3.5rem] shadow-xl border border-slate-100 space-y-8">
             <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter">
               <QrCode className="w-7 h-7 text-purple-600"/> Pasarela QR
             </h3>
             <div className="space-y-10">
                {/* YAPE */}
                <div className="p-8 bg-slate-50 rounded-[2.5rem] space-y-6 border border-slate-100 shadow-inner">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-600 rounded-2xl flex items-center justify-center text-white font-black text-xs shadow-lg">Y</div>
                      <span className="text-xs font-black uppercase text-slate-700 tracking-widest">Configuración Yape</span>
                   </div>
                   <div className="flex flex-col items-center gap-6">
                      <div className="relative group w-44 h-44 bg-white rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center border-4 border-white">
                         {currentConfig.yapeQR ? <img src={currentConfig.yapeQR} className="w-full h-full object-cover" /> : <QrCode className="w-12 h-12 text-slate-100" />}
                         <label className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all duration-300">
                            <Upload className="text-white w-8 h-8 mb-2"/>
                            <span className="text-[8px] font-black text-white uppercase tracking-widest">Subir QR Yape</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('yapeQR')} />
                         </label>
                      </div>
                      <div className="w-full space-y-4">
                         <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                            <input type="text" placeholder="Nombre Completo del Titular" className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-tight outline-none focus:ring-4 focus:ring-purple-500/10 shadow-sm" value={currentConfig.yapeName || ''} onChange={e => setCurrentConfig({...currentConfig, yapeName: e.target.value})} />
                         </div>
                         <div className="relative">
                            <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                            <input type="text" placeholder="Número de Celular Yape" className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-purple-500/10 shadow-sm" value={currentConfig.yapeNumber || ''} onChange={e => setCurrentConfig({...currentConfig, yapeNumber: e.target.value})} />
                         </div>
                      </div>
                   </div>
                </div>

                {/* PLIN */}
                <div className="p-8 bg-slate-50 rounded-[2.5rem] space-y-6 border border-slate-100 shadow-inner">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-2xl flex items-center justify-center text-white font-black text-xs shadow-lg">P</div>
                      <span className="text-xs font-black uppercase text-slate-700 tracking-widest">Configuración Plin</span>
                   </div>
                   <div className="flex flex-col items-center gap-6">
                      <div className="relative group w-44 h-44 bg-white rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center border-4 border-white">
                         {currentConfig.plinQR ? <img src={currentConfig.plinQR} className="w-full h-full object-cover" /> : <QrCode className="w-12 h-12 text-slate-100" />}
                         <label className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all duration-300">
                            <Upload className="text-white w-8 h-8 mb-2"/>
                            <span className="text-[8px] font-black text-white uppercase tracking-widest">Subir QR Plin</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('plinQR')} />
                         </label>
                      </div>
                      <div className="w-full space-y-4">
                         <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                            <input type="text" placeholder="Nombre Completo del Titular" className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-tight outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm" value={currentConfig.plinName || ''} onChange={e => setCurrentConfig({...currentConfig, plinName: e.target.value})} />
                         </div>
                         <div className="relative">
                            <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                            <input type="text" placeholder="Número de Celular Plin" className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm" value={currentConfig.plinNumber || ''} onChange={e => setCurrentConfig({...currentConfig, plinNumber: e.target.value})} />
                         </div>
                      </div>
                   </div>
                </div>
             </div>
           </section>

           {/* REDES SOCIALES */}
           <section className="bg-white p-8 md:p-10 rounded-[3.5rem] shadow-xl border border-slate-100 space-y-8">
             <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter">
               <Share2 className="w-7 h-7 text-blue-500"/> Presencia Social
             </h3>
             <div className="space-y-4">
                <div className="flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 group transition-all hover:bg-white hover:shadow-md">
                   <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg"><Facebook className="w-5 h-5"/></div>
                   <input type="text" placeholder="URL Facebook" className="flex-1 bg-transparent outline-none text-[10px] font-black uppercase tracking-tight" value={currentConfig.facebook_url || ''} onChange={e => setCurrentConfig({...currentConfig, facebook_url: e.target.value})} />
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 group transition-all hover:bg-white hover:shadow-md">
                   <div className="p-3 bg-pink-500 rounded-xl text-white shadow-lg"><Instagram className="w-5 h-5"/></div>
                   <input type="text" placeholder="URL Instagram" className="flex-1 bg-transparent outline-none text-[10px] font-black uppercase tracking-tight" value={currentConfig.instagram_url || ''} onChange={e => setCurrentConfig({...currentConfig, instagram_url: e.target.value})} />
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 group transition-all hover:bg-white hover:shadow-md">
                   <div className="p-3 bg-black rounded-xl text-white shadow-lg"><Video className="w-5 h-5"/></div>
                   <input type="text" placeholder="URL TikTok" className="flex-1 bg-transparent outline-none text-[10px] font-black uppercase tracking-tight" value={currentConfig.tiktok_url || ''} onChange={e => setCurrentConfig({...currentConfig, tiktok_url: e.target.value})} />
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 group transition-all hover:bg-white hover:shadow-md">
                   <div className="p-3 bg-emerald-500 rounded-xl text-white shadow-lg"><MessageCircle className="w-5 h-5"/></div>
                   <input type="text" placeholder="WhatsApp Ayuda" className="flex-1 bg-transparent outline-none text-[10px] font-black uppercase tracking-tight" value={currentConfig.whatsappHelpNumber || ''} onChange={e => setCurrentConfig({...currentConfig, whatsappHelpNumber: e.target.value})} />
                </div>
             </div>
           </section>
        </div>
      </div>

      {showSuccess && (
         <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-12 py-7 rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-12 flex items-center gap-6 border border-white/10">
            <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center text-white shadow-2xl animate-bounce">
                <CheckCircle2 className="w-7 h-7"/>
            </div>
            <div className="flex flex-col">
                <span className="text-base font-black uppercase tracking-tighter leading-none">¡Éxito Lemon BI!</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Tus cambios ya son públicos</span>
            </div>
         </div>
      )}
    </div>
  );
};

export default StoreSettings;
