
import React, { useState } from 'react';
import { 
  Palette, Save, CheckCircle2, RotateCcw, MapPin, Plus, Trash2, 
  Sparkles, Wallet, Phone, X, Facebook, Instagram, MessageCircle,
  RefreshCw, Share2, LayoutPanelTop, QrCode, Upload, Smartphone, AlertCircle,
  Eye, Image as ImageIcon, Paintbrush, Footprints, Layout, AlignLeft, Citrus,
  Video, Layers, User, Dog, Tag, Link as LinkIcon
} from 'lucide-react';
import { ClientConfig, SedeStore } from '../types';
import { saveClient } from '../services/clientManager';

interface StoreSettingsProps {
  config: ClientConfig;
  onUpdate: (newConfig: ClientConfig) => void;
  session?: any;
}

const StoreSettings: React.FC<StoreSettingsProps> = ({ config, onUpdate }) => {
  const [currentConfig, setCurrentConfig] = useState<ClientConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [newCat, setNewCat] = useState('');

  const handleFileUpload = (field: 'yapeQR' | 'plinQR' | 'logoUrl' | 'footerLogoUrl' | 'slide') => (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
          alert("La imagen es muy pesada (máx 2MB).");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (field === 'slide' && typeof index === 'number') {
           const slides = [...(currentConfig.slide_images || [])];
           slides[index] = result;
           setCurrentConfig(prev => ({ ...prev, slide_images: slides }));
        } else if (field !== 'slide') {
           setCurrentConfig(prev => ({ ...prev, [field]: result }));
        }
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
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Personalización visual Lemon BI</p>
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
          
          {/* GESTIÓN DE BANNERS (SLIDER HERO) - NUEVA SECCIÓN */}
          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter">
                 <ImageIcon className="w-7 h-7 text-brand-500"/> Banners de Portada (Slider)
               </h3>
               <button onClick={addSlide} className="px-6 py-3 bg-brand-50 text-brand-700 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-brand-500 hover:text-white transition-all">
                  <Plus className="w-4 h-4"/> Añadir Diapositiva
               </button>
            </div>
            
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8 leading-relaxed">
              Las imágenes aquí configuradas aparecerán en la cabecera principal de tu tienda. Recomendamos formato horizontal (16:9).
            </p>

            <div className="space-y-6">
               {(currentConfig.slide_images || []).length === 0 ? (
                  <div className="py-12 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200 text-center flex flex-col items-center gap-4">
                     <ImageIcon className="w-12 h-12 text-slate-200" />
                     <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em]">No hay imágenes configuradas para el slider</p>
                  </div>
               ) : (
                  currentConfig.slide_images?.map((slide, idx) => (
                    <div key={idx} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner group animate-in slide-in-from-right duration-300">
                       <div className="flex flex-col md:flex-row gap-6">
                          <div className="w-full md:w-44 h-24 bg-white rounded-2xl overflow-hidden shadow-lg border-2 border-white shrink-0 relative">
                             {slide ? (
                                <img src={slide} className="w-full h-full object-cover" />
                             ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-100"><ImageIcon className="w-10 h-10"/></div>
                             )}
                             <label className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                <Upload className="text-white w-6 h-6"/>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload('slide')(e, idx)} />
                             </label>
                          </div>
                          
                          <div className="flex-1 space-y-4">
                             <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diapositiva #{idx + 1}</span>
                                <button onClick={() => removeSlide(idx)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
                             </div>
                             <div className="relative">
                                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"/>
                                <input 
                                   type="text" 
                                   placeholder="URL de la imagen o base64..." 
                                   className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-4 focus:ring-brand-500/10"
                                   value={slide}
                                   onChange={e => updateSlide(idx, e.target.value)}
                                />
                             </div>
                          </div>
                       </div>
                    </div>
                  ))
               )}
            </div>
          </section>

          {/* IDENTIDAD VISUAL */}
          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-slate-100">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter mb-10">
              <ImageIcon className="w-7 h-7 text-brand-500"/> Logotipos de Marca
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo Principal (Header)</label>
                  <div className="flex gap-2">
                     <input type="text" placeholder="URL logo" className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none" value={currentConfig.logoUrl || ''} onChange={e => setCurrentConfig({...currentConfig, logoUrl: e.target.value})} />
                     <label className="cursor-pointer p-4 bg-slate-900 text-white rounded-2xl hover:bg-brand-500 transition-colors">
                        <Upload className="w-5 h-5"/>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('logoUrl')} />
                     </label>
                  </div>
               </div>
               <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo Secundario (Footer)</label>
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
            
            <div className="flex gap-3 mb-10">
               <input 
                  type="text" 
                  placeholder="NUEVA CATEGORÍA (EJ: PERROS)" 
                  className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs uppercase shadow-inner outline-none focus:ring-4 focus:ring-orange-500/10"
                  value={newCat}
                  onChange={e => setNewCat(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomCategory()}
               />
               <button onClick={addCustomCategory} className="px-8 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase transition-all hover:bg-orange-600 shadow-xl shadow-orange-500/20"><Plus className="w-6 h-6"/></button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
               {currentConfig.customCategories?.map(cat => (
                  <div key={cat} className="flex items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-orange-200 transition-all group">
                     <div className="flex items-center gap-3">
                        <Tag className="w-4 h-4 text-slate-300 group-hover:text-orange-500"/>
                        <span className="text-[10px] font-black uppercase text-slate-700 tracking-tighter">{cat}</span>
                     </div>
                     <button onClick={() => removeCustomCategory(cat)} className="text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button>
                  </div>
               ))}
            </div>
          </section>
        </div>

        {/* PANEL DERECHO */}
        <div className="lg:col-span-5 space-y-8 font-sans">
           
           {/* COLORES CORPORATIVOS */}
           <section className="bg-white p-8 md:p-10 rounded-[3.5rem] shadow-xl border border-slate-100">
             <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-10 flex items-center gap-3">
               <Paintbrush className="w-6 h-6 text-brand-500"/> Paleta Global
             </h3>
             <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center gap-4 p-4 bg-slate-50 rounded-3xl border border-slate-100">
                   <input type="color" className="w-14 h-14 rounded-2xl cursor-pointer border-4 border-white shadow-lg" value={currentConfig.colorPrimario} onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})} />
                   <span className="text-[8px] font-black text-slate-400 uppercase text-center leading-tight">Primario Tienda</span>
                </div>
                <div className="flex flex-col items-center gap-4 p-4 bg-slate-50 rounded-3xl border border-slate-100">
                   <input type="color" className="w-14 h-14 rounded-2xl cursor-pointer border-4 border-white shadow-lg" value={currentConfig.colorSecundario} onChange={e => setCurrentConfig({...currentConfig, colorSecundario: e.target.value})} />
                   <span className="text-[8px] font-black text-slate-400 uppercase text-center leading-tight">Fondo Footer</span>
                </div>
                <div className="flex flex-col items-center gap-4 p-4 bg-slate-50 rounded-3xl border border-slate-100">
                   <input type="color" className="w-14 h-14 rounded-2xl cursor-pointer border-4 border-white shadow-lg" value={currentConfig.colorAcento} onChange={e => setCurrentConfig({...currentConfig, colorAcento: e.target.value})} />
                   <span className="text-[8px] font-black text-slate-400 uppercase text-center leading-tight">Detalles Acento</span>
                </div>
             </div>
           </section>

           {/* QR Y PAGOS DIGITALES */}
           <section className="bg-white p-8 md:p-10 rounded-[3.5rem] shadow-xl border border-slate-100 space-y-8">
             <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter">
               <QrCode className="w-7 h-7 text-purple-600"/> Pasarela QR
             </h3>
             <div className="space-y-6">
                {/* YAPE & PLIN */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* YAPE */}
                   <div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col items-center text-center space-y-4">
                      <div className="relative group w-32 h-32 bg-white rounded-3xl overflow-hidden shadow-lg border-4 border-white">
                         {currentConfig.yapeQR ? <img src={currentConfig.yapeQR} className="w-full h-full object-cover" /> : <QrCode className="w-10 h-10 text-slate-100 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                         <label className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                            <Upload className="text-white w-6 h-6"/>
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('yapeQR')} />
                         </label>
                      </div>
                      <p className="text-[9px] font-black uppercase text-purple-600 tracking-widest">QR YAPE</p>
                      <input type="text" placeholder="Número Yape" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none text-center" value={currentConfig.yapeNumber || ''} onChange={e => setCurrentConfig({...currentConfig, yapeNumber: e.target.value})} />
                   </div>
                   {/* PLIN */}
                   <div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col items-center text-center space-y-4">
                      <div className="relative group w-32 h-32 bg-white rounded-3xl overflow-hidden shadow-lg border-4 border-white">
                         {currentConfig.plinQR ? <img src={currentConfig.plinQR} className="w-full h-full object-cover" /> : <QrCode className="w-10 h-10 text-slate-100 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                         <label className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                            <Upload className="text-white w-6 h-6"/>
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('plinQR')} />
                         </label>
                      </div>
                      <p className="text-[9px] font-black uppercase text-blue-500 tracking-widest">QR PLIN</p>
                      <input type="text" placeholder="Número Plin" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none text-center" value={currentConfig.plinNumber || ''} onChange={e => setCurrentConfig({...currentConfig, plinNumber: e.target.value})} />
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
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <Facebook className="w-5 h-5 text-blue-600"/>
                   <input type="text" placeholder="Facebook URL" className="flex-1 bg-transparent outline-none text-[10px] font-black uppercase" value={currentConfig.facebook_url || ''} onChange={e => setCurrentConfig({...currentConfig, facebook_url: e.target.value})} />
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <Instagram className="w-5 h-5 text-pink-500"/>
                   <input type="text" placeholder="Instagram URL" className="flex-1 bg-transparent outline-none text-[10px] font-black uppercase" value={currentConfig.instagram_url || ''} onChange={e => setCurrentConfig({...currentConfig, instagram_url: e.target.value})} />
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <MessageCircle className="w-5 h-5 text-emerald-500"/>
                   <input type="text" placeholder="WhatsApp Ayuda" className="flex-1 bg-transparent outline-none text-[10px] font-black uppercase" value={currentConfig.whatsappHelpNumber || ''} onChange={e => setCurrentConfig({...currentConfig, whatsappHelpNumber: e.target.value})} />
                </div>
             </div>
           </section>
        </div>
      </div>

      {showSuccess && (
         <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-12 py-7 rounded-[2.5rem] shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-12 border border-white/10">
            <CheckCircle2 className="w-8 h-8 text-brand-400"/>
            <div className="flex flex-col">
                <span className="text-base font-black uppercase tracking-tighter leading-none">¡Configuración Guardada!</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Los cambios ya son visibles en tu tienda</span>
            </div>
         </div>
      )}
    </div>
  );
};

export default StoreSettings;
