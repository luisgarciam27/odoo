
import React, { useState, useEffect } from 'react';
import { 
  Palette, Save, CheckCircle2, MapPin, Plus, Trash2, 
  Wallet, X, Facebook, Instagram, MessageCircle,
  RefreshCw, Share2, QrCode, Upload, Smartphone,
  ImageIcon, Paintbrush, Citrus, Layers, User, Link as LinkIcon, 
  ExternalLink, Globe, ShoppingCart, MonitorPlay, Tag, Image as LucideImage
} from 'lucide-react';
import { ClientConfig, SedeStore } from '../types';
import { saveClient } from '../services/clientManager';
import { OdooClient } from '../services/odoo';

interface StoreSettingsProps {
  config: ClientConfig;
  onUpdate: (newConfig: ClientConfig) => void;
  session?: any;
}

const StoreSettings: React.FC<StoreSettingsProps> = ({ config, onUpdate, session }) => {
  const [currentConfig, setCurrentConfig] = useState<ClientConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [allCategories, setAllCategories] = useState<string[]>(['Todas']);

  useEffect(() => {
    const loadAllCategories = async () => {
      if (!session) return;
      const client = new OdooClient(session.url, session.db, session.useProxy);
      try {
        const odooCats = await client.searchRead(session.uid, session.apiKey, 'product.category', [], ['name']);
        const names = odooCats.map((c: any) => c.name);
        const combined = Array.from(new Set(['Todas', ...names, ...(currentConfig.customCategories || [])]));
        setAllCategories(combined);
      } catch (e) {
        setAllCategories(['Todas', ...(currentConfig.customCategories || [])]);
      }
    };
    loadAllCategories();
  }, [session, currentConfig.customCategories]);

  const handleFileUpload = (field: string, subKey?: string) => (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
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
        } else if (field === 'category_metadata' && subKey) {
           const metadata = { ...(currentConfig.category_metadata || {}) };
           metadata[subKey] = { ...metadata[subKey], imageUrl: result };
           setCurrentConfig(prev => ({ ...prev, category_metadata: metadata }));
        } else {
           setCurrentConfig(prev => ({ ...prev, [field]: result }));
        }
      };
      reader.readAsDataURL(file);
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
      alert(result.message || "Error al guardar. Verifica las columnas en Supabase.");
    }
    setIsSaving(false);
  };

  const addSlide = () => {
    setCurrentConfig({...currentConfig, slide_images: [...(currentConfig.slide_images || []), '']});
  };

  const removeSlide = (idx: number) => {
    setCurrentConfig({...currentConfig, slide_images: (currentConfig.slide_images || []).filter((_, i) => i !== idx)});
  };

  const addSede = () => {
    const newSede: SedeStore = { id: Date.now().toString(), nombre: '', direccion: '', googleMapsUrl: '' };
    setCurrentConfig({ ...currentConfig, sedes_recojo: [...(currentConfig.sedes_recojo || []), newSede] });
  };

  const removeSede = (id: string) => {
    setCurrentConfig({ ...currentConfig, sedes_recojo: (currentConfig.sedes_recojo || []).filter(s => s.id !== id) });
  };

  const addCustomCat = () => {
    if(!newCat) return;
    setCurrentConfig({...currentConfig, customCategories: [...(currentConfig.customCategories || []), newCat.toUpperCase()]});
    setNewCat('');
  };

  const removeCustomCat = (cat: string) => {
    setCurrentConfig({...currentConfig, customCategories: (currentConfig.customCategories || []).filter(c => c !== cat)});
  };

  const brandColor = currentConfig.colorPrimario || '#84cc16';

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 pb-32 font-sans text-slate-700">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-6">
           <div className="p-5 bg-brand-50 rounded-[2.5rem] shadow-inner text-brand-600">
              <Palette className="w-10 h-10" />
           </div>
           <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Configurar Tienda</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Identidad y Gestión Logística</p>
           </div>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving} 
          className="px-12 py-6 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl flex items-center gap-4 transition-all hover:scale-105 active:scale-95 shadow-brand-500/30" 
          style={{backgroundColor: brandColor}}
        >
          {isSaving ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} Guardar Cambios
        </button>
      </div>

      {/* BRANDING DE CATEGORÍAS */}
      <section className="bg-white p-10 md:p-14 rounded-[4rem] shadow-xl border border-slate-100">
         <h3 className="text-2xl font-black text-slate-800 flex items-center gap-5 uppercase tracking-tighter mb-10">
           <LucideImage className="w-8 h-8 text-emerald-500"/> Fotos de Categorías (Botones)
         </h3>
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">Sube una imagen para cada pestaña de tu tienda para que se vea más profesional.</p>
         
         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {allCategories.map(cat => (
               <div key={cat} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 text-center flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-white mb-4 border border-slate-200 overflow-hidden flex items-center justify-center relative group">
                     {currentConfig.category_metadata?.[cat]?.imageUrl ? (
                        <img src={currentConfig.category_metadata[cat].imageUrl} className="w-full h-full object-cover" />
                     ) : (
                        <Citrus className="w-8 h-8 text-slate-100" />
                     )}
                     <label className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all">
                        <Upload className="text-white w-6 h-6"/>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload('category_metadata', cat)(e)} />
                     </label>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-tighter text-slate-900 truncate w-full">{cat}</span>
                  {currentConfig.category_metadata?.[cat]?.imageUrl && (
                     <button 
                       onClick={() => {
                          const metadata = { ...currentConfig.category_metadata };
                          delete metadata[cat];
                          setCurrentConfig({...currentConfig, category_metadata: metadata});
                       }}
                       className="mt-2 text-[8px] font-black uppercase text-red-400 hover:text-red-600"
                     >
                       Eliminar
                     </button>
                  )}
               </div>
            ))}
         </div>
      </section>

      {/* DIAPOSITIVAS (SLIDES) */}
      <section className="bg-white p-10 md:p-14 rounded-[4rem] shadow-xl border border-slate-100">
         <div className="flex justify-between items-center mb-10">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-5 uppercase tracking-tighter">
              <MonitorPlay className="w-8 h-8 text-blue-500"/> Banner Principal (Slides)
            </h3>
            <button onClick={addSlide} className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-blue-700 transition-all">
              <Plus className="w-4 h-4"/> Añadir Slide
            </button>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(currentConfig.slide_images || []).map((img, idx) => (
               <div key={idx} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-200 group relative">
                  <div className="aspect-[16/9] bg-white rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center relative shadow-inner">
                     {img ? <img src={img} className="w-full h-full object-cover" /> : <ImageIcon className="w-10 h-10 text-slate-200" />}
                     <label className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all">
                        <Upload className="text-white w-8 h-8"/>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload('slide')(e, idx)} />
                     </label>
                  </div>
                  <div className="flex gap-2 mt-4">
                     <input type="text" placeholder="URL imagen" className="flex-1 p-3 bg-white border rounded-xl text-[10px] font-bold" value={img} onChange={(e) => {
                        const slides = [...(currentConfig.slide_images || [])];
                        slides[idx] = e.target.value;
                        setCurrentConfig({...currentConfig, slide_images: slides});
                     }} />
                     <button onClick={() => removeSlide(idx)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4"/></button>
                  </div>
               </div>
            ))}
         </div>
      </section>

      {/* CATEGORÍAS PERSONALIZADAS */}
      <section className="bg-white p-10 md:p-14 rounded-[4rem] shadow-xl border border-slate-100">
         <h3 className="text-2xl font-black text-slate-800 flex items-center gap-5 uppercase tracking-tighter mb-10">
           <Tag className="w-8 h-8 text-orange-500"/> Pestañas de la Tienda (Tabs)
         </h3>
         <div className="flex gap-3 mb-8">
            <input type="text" placeholder="EJ: OFERTAS, PERROS, GATOS..." className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black uppercase outline-none focus:ring-4 focus:ring-orange-500/10" value={newCat} onChange={e => setNewCat(e.target.value)} />
            <button onClick={addCustomCat} className="px-8 py-5 bg-orange-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-600 transition-all">Añadir Pestaña</button>
         </div>
         <div className="flex flex-wrap gap-3">
            {(currentConfig.customCategories || []).map(cat => (
               <div key={cat} className="bg-slate-100 pl-6 pr-2 py-2 rounded-full flex items-center gap-4 border border-slate-200 group">
                  <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">{cat}</span>
                  <button onClick={() => removeCustomCat(cat)} className="p-2 bg-white text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-sm"><X className="w-3 h-3"/></button>
               </div>
            ))}
         </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          
          {/* PUNTOS DE ENTREGA */}
          <section className="bg-white p-10 md:p-14 rounded-[4rem] shadow-xl border border-slate-100">
             <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter">
                   <MapPin className="w-8 h-8 text-red-500"/> Puntos de Entrega / Recojo
                </h3>
                <button onClick={addSede} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-brand-500 transition-all">
                   <Plus className="w-4 h-4"/> Nuevo Punto
                </button>
             </div>
             <div className="space-y-6">
                {(currentConfig.sedes_recojo || []).map((sede, idx) => (
                   <div key={sede.id} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 group">
                      <div className="flex justify-between items-start mb-6">
                         <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Punto #{idx + 1}</span>
                         <button onClick={() => removeSede(sede.id)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4"/></button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <input type="text" placeholder="NOMBRE DEL PUNTO / LOCAL" className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-[11px] font-bold uppercase" value={sede.nombre} onChange={e => {
                            const sedes = [...(currentConfig.sedes_recojo || [])];
                            sedes[idx].nombre = e.target.value;
                            setCurrentConfig({...currentConfig, sedes_recojo: sedes});
                         }} />
                         <input type="text" placeholder="DIRECCIÓN FÍSICA DETALLADA" className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-[11px] font-bold uppercase" value={sede.direccion} onChange={e => {
                            const sedes = [...(currentConfig.sedes_recojo || [])];
                            sedes[idx].direccion = e.target.value;
                            setCurrentConfig({...currentConfig, sedes_recojo: sedes});
                         }} />
                         <div className="md:col-span-2 relative">
                            <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"/>
                            <input type="text" placeholder="LINK DE GOOGLE MAPS (OPCIONAL)" className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-[11px] font-bold" value={sede.googleMapsUrl || ''} onChange={e => {
                               const sedes = [...(currentConfig.sedes_recojo || [])];
                               sedes[idx].googleMapsUrl = e.target.value;
                               setCurrentConfig({...currentConfig, sedes_recojo: sedes});
                            }} />
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </section>

          {/* LOGOS E IDENTIDAD */}
          <section className="bg-white p-10 md:p-14 rounded-[4rem] shadow-xl border border-slate-100">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-5 uppercase tracking-tighter mb-12">
              <ImageIcon className="w-8 h-8 text-brand-500"/> Logotipos e Identidad
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
               <div className="space-y-6">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo Superior</label>
                  <div className="aspect-[3/1] bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200 flex items-center justify-center p-8">
                     {currentConfig.logoUrl ? <img src={currentConfig.logoUrl} className="max-h-full object-contain" /> : <Citrus className="w-12 h-12 text-slate-200" />}
                  </div>
                  <div className="flex gap-3">
                     <input type="text" placeholder="URL logo" className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" value={currentConfig.logoUrl || ''} onChange={e => setCurrentConfig({...currentConfig, logoUrl: e.target.value})} />
                     <label className="cursor-pointer p-5 bg-slate-900 text-white rounded-2xl hover:bg-brand-500 transition-colors">
                        <Upload className="w-6 h-6"/>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('logoUrl')} />
                     </label>
                  </div>
               </div>
               <div className="space-y-6">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4 text-brand-600">Logo del Footer (Pie de Página)</label>
                  <div className="aspect-[3/1] bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200 flex items-center justify-center p-8">
                     {currentConfig.footerLogoUrl ? <img src={currentConfig.footerLogoUrl} className="max-h-full object-contain" /> : <Citrus className="w-12 h-12 text-slate-200" />}
                  </div>
                  <div className="flex gap-3">
                     <input type="text" placeholder="URL logo footer" className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" value={currentConfig.footerLogoUrl || ''} onChange={e => setCurrentConfig({...currentConfig, footerLogoUrl: e.target.value})} />
                     <label className="cursor-pointer p-5 bg-slate-900 text-white rounded-2xl hover:bg-brand-500 transition-colors">
                        <Upload className="w-6 h-6"/>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('footerLogoUrl')} />
                     </label>
                  </div>
               </div>
            </div>
          </section>
        </div>

        <div className="lg:col-span-4 space-y-10">
           <section className="bg-white p-10 rounded-[4rem] shadow-xl border border-slate-100 space-y-8">
             <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter">
               <Share2 className="w-7 h-7 text-blue-500"/> Redes y Contacto
             </h3>
             <div className="space-y-6">
                <div className="relative">
                   <Facebook className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600"/>
                   <input type="text" placeholder="URL FACEBOOK" className="w-full pl-14 pr-5 py-5 bg-slate-50 rounded-[1.5rem] text-[11px] font-bold outline-none" value={currentConfig.facebook_url || ''} onChange={e => setCurrentConfig({...currentConfig, facebook_url: e.target.value})} />
                </div>
                <div className="relative">
                   <Instagram className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-500"/>
                   <input type="text" placeholder="URL INSTAGRAM" className="w-full pl-14 pr-5 py-5 bg-slate-50 rounded-[1.5rem] text-[11px] font-bold outline-none" value={currentConfig.instagram_url || ''} onChange={e => setCurrentConfig({...currentConfig, instagram_url: e.target.value})} />
                </div>
                
                <div className="pt-8 border-t border-slate-100 space-y-6">
                   <div>
                      <label className="block text-[10px] font-black text-brand-600 uppercase tracking-widest mb-2 ml-4">WhatsApp Ventas</label>
                      <input type="text" placeholder="975615XXX" className="w-full p-5 bg-brand-50 border border-brand-100 rounded-[1.5rem] text-[11px] font-bold outline-none" value={currentConfig.whatsappNumbers || ''} onChange={e => setCurrentConfig({...currentConfig, whatsappNumbers: e.target.value})} />
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 ml-4">WhatsApp Ayuda (Footer)</label>
                      <input type="text" placeholder="975615XXX" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-[11px] font-bold outline-none" value={currentConfig.whatsappHelpNumber || ''} onChange={e => setCurrentConfig({...currentConfig, whatsappHelpNumber: e.target.value})} />
                   </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Frase del Footer</label>
                    <textarea 
                        className="w-full p-6 bg-slate-50 rounded-[2rem] text-[10px] font-bold uppercase outline-none shadow-inner resize-none h-32"
                        placeholder="Brindando bienestar y salud..."
                        value={currentConfig.footer_description || ''}
                        onChange={e => setCurrentConfig({...currentConfig, footer_description: e.target.value})}
                    />
                </div>
             </div>
           </section>
        </div>
      </div>

      {showSuccess && (
         <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-12 py-6 rounded-full shadow-2xl flex items-center gap-4 animate-in border border-white/10">
            <CheckCircle2 className="w-6 h-6 text-brand-400"/>
            <span className="text-[10px] font-black uppercase tracking-widest">¡Tienda Actualizada!</span>
         </div>
      )}
    </div>
  );
};

export default StoreSettings;
