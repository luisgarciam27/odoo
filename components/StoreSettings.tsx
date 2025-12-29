
import React, { useState } from 'react';
import { 
  Palette, Save, CheckCircle2, RotateCcw, MapPin, Plus, Trash2, 
  Sparkles, Wallet, Phone, X, Facebook, Instagram, MessageCircle,
  RefreshCw, Share2, LayoutPanelTop, QrCode, Upload, Smartphone, AlertCircle,
  Eye, Image as ImageIcon, Paintbrush, Footprints, Layout, AlignLeft, Citrus,
  Video, Layers, User, Tag, Link as LinkIcon, MonitorPlay, Copy, ExternalLink,
  Globe, CreditCard
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
  const [copyStatus, setCopyStatus] = useState(false);

  const storeUrl = `${window.location.origin}/?shop=${config.code}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

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

  const removeSlide = (index: number) => {
    const slides = (currentConfig.slide_images || []).filter((_, i) => i !== index);
    setCurrentConfig({...currentConfig, slide_images: slides});
  };

  const brandColor = currentConfig.colorPrimario || '#84cc16';

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 pb-32 font-sans">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-6">
           <div className="p-5 bg-brand-50 rounded-[2.5rem] shadow-inner text-brand-600">
              <Palette className="w-10 h-10" />
           </div>
           <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Personalizar Tienda</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Diseño y Pagos Online</p>
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

      {/* SECCIÓN DE URL PÚBLICA */}
      <section className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 md:p-12 rounded-[4rem] shadow-2xl border border-white/5 relative overflow-hidden group">
         <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-500/10 blur-[80px] rounded-full group-hover:scale-150 transition-transform duration-1000"></div>
         
         <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="space-y-4 text-center md:text-left">
               <div className="flex items-center gap-3 justify-center md:justify-start">
                  <Globe className="w-6 h-6 text-brand-400" />
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Tu Tienda Online está Activa</h3>
               </div>
               <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest max-w-md">Comparte este enlace con tus clientes para que puedan realizar pedidos directamente por WhatsApp.</p>
            </div>

            <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4">
               <div className="bg-white/5 backdrop-blur-md px-8 py-5 rounded-[2rem] border border-white/10 flex items-center gap-6 group/link min-w-[300px]">
                  <div className="flex flex-col">
                     <span className="text-[9px] font-black text-brand-500 uppercase tracking-widest mb-1">Enlace Público</span>
                     <span className="text-white font-mono text-xs truncate max-w-[200px]">{storeUrl}</span>
                  </div>
                  <button 
                    onClick={handleCopyUrl}
                    className={`ml-auto p-3 rounded-xl transition-all ${copyStatus ? 'bg-brand-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white hover:text-slate-900'}`}
                  >
                    {copyStatus ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
               </div>
               <a 
                 href={storeUrl} 
                 target="_blank" 
                 rel="noreferrer"
                 className="px-8 py-5 bg-white text-slate-900 rounded-[2rem] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-brand-500 hover:text-white transition-all shadow-xl"
               >
                  Probar Tienda <ExternalLink className="w-4 h-4" />
               </a>
            </div>
         </div>
      </section>

      {/* CONFIGURACIÓN DE PAGOS (YAPE / PLIN) - AHORA MÁS ARRIBA Y CLARA */}
      <section className="bg-white p-10 md:p-14 rounded-[4rem] shadow-xl border border-slate-100 overflow-hidden relative">
        <div className="flex items-center gap-5 mb-12">
           <div className="p-4 bg-purple-50 text-purple-600 rounded-3xl">
             <Wallet className="w-8 h-8"/>
           </div>
           <div>
             <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Configuración de Pagos</h3>
             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">Detalles de la Cuenta (Nombre, Celular y QR)</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
           {/* TARJETA YAPE */}
           <div className="space-y-8 p-10 bg-purple-50/50 rounded-[3.5rem] border border-purple-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5"><QrCode className="w-32 h-32 text-purple-600" /></div>
              <div className="flex items-center gap-4 mb-4 relative z-10">
                 <div className="w-14 h-14 bg-purple-600 rounded-[1.5rem] flex items-center justify-center text-white font-black text-xl shadow-xl shadow-purple-600/20">Y</div>
                 <div>
                    <h4 className="text-lg font-black text-purple-900 uppercase tracking-tighter">Cuenta Yape</h4>
                    <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">Acepta pagos móviles Yape</p>
                 </div>
              </div>
              
              <div className="space-y-6 relative z-10">
                 <div>
                    <label className="text-[10px] font-black text-purple-900 uppercase tracking-widest block mb-2 ml-4">Nombre del Titular de Cuenta</label>
                    <div className="relative">
                       <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300"/>
                       <input 
                          type="text" 
                          placeholder="NOMBRE COMPLETO" 
                          className="w-full pl-14 pr-6 py-5 bg-white border border-purple-100 rounded-[1.5rem] text-[11px] font-bold uppercase outline-none focus:ring-4 focus:ring-purple-200/50 transition-all" 
                          value={currentConfig.yapeName || ''} 
                          onChange={e => setCurrentConfig({...currentConfig, yapeName: e.target.value})} 
                       />
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-purple-900 uppercase tracking-widest block mb-2 ml-4">Número de Celular Vinculado</label>
                    <div className="relative">
                       <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300"/>
                       <input 
                          type="tel" 
                          placeholder="NÚMERO DE 9 DÍGITOS" 
                          className="w-full pl-14 pr-6 py-5 bg-white border border-purple-100 rounded-[1.5rem] text-[11px] font-bold outline-none focus:ring-4 focus:ring-purple-200/50 transition-all" 
                          value={currentConfig.yapeNumber || ''} 
                          onChange={e => setCurrentConfig({...currentConfig, yapeNumber: e.target.value})} 
                       />
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                 <label className="text-[10px] font-black text-purple-900 uppercase tracking-widest block mb-2 ml-4">Código QR Yape</label>
                 <div className="relative aspect-square bg-white rounded-[2.5rem] border border-dashed border-purple-200 flex items-center justify-center p-8 overflow-hidden group shadow-inner">
                    {currentConfig.yapeQR ? (
                       <img src={currentConfig.yapeQR} className="w-full h-full object-contain" />
                    ) : (
                       <div className="flex flex-col items-center gap-4 text-purple-200">
                          <QrCode className="w-16 h-16" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Subir Imagen del QR</span>
                       </div>
                    )}
                    <label className="absolute inset-0 bg-purple-600/90 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all duration-300">
                       <Upload className="text-white w-10 h-10 mb-2 animate-bounce"/>
                       <span className="text-[10px] font-black text-white uppercase tracking-widest">Actualizar Código QR</span>
                       <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('yapeQR')} />
                    </label>
                 </div>
              </div>
           </div>

           {/* TARJETA PLIN */}
           <div className="space-y-8 p-10 bg-blue-50/50 rounded-[3.5rem] border border-blue-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5"><QrCode className="w-32 h-32 text-blue-600" /></div>
              <div className="flex items-center gap-4 mb-4 relative z-10">
                 <div className="w-14 h-14 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white font-black text-xl shadow-xl shadow-blue-600/20">P</div>
                 <div>
                    <h4 className="text-lg font-black text-blue-900 uppercase tracking-tighter">Cuenta Plin</h4>
                    <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Acepta pagos móviles Plin</p>
                 </div>
              </div>
              
              <div className="space-y-6 relative z-10">
                 <div>
                    <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest block mb-2 ml-4">Nombre del Titular de Cuenta</label>
                    <div className="relative">
                       <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300"/>
                       <input 
                          type="text" 
                          placeholder="NOMBRE COMPLETO" 
                          className="w-full pl-14 pr-6 py-5 bg-white border border-blue-100 rounded-[1.5rem] text-[11px] font-bold uppercase outline-none focus:ring-4 focus:ring-blue-200/50 transition-all" 
                          value={currentConfig.plinName || ''} 
                          onChange={e => setCurrentConfig({...currentConfig, plinName: e.target.value})} 
                       />
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest block mb-2 ml-4">Número de Celular Vinculado</label>
                    <div className="relative">
                       <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300"/>
                       <input 
                          type="tel" 
                          placeholder="NÚMERO DE 9 DÍGITOS" 
                          className="w-full pl-14 pr-6 py-5 bg-white border border-blue-100 rounded-[1.5rem] text-[11px] font-bold outline-none focus:ring-4 focus:ring-blue-200/50 transition-all" 
                          value={currentConfig.plinNumber || ''} 
                          onChange={e => setCurrentConfig({...currentConfig, plinNumber: e.target.value})} 
                       />
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                 <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest block mb-2 ml-4">Código QR Plin</label>
                 <div className="relative aspect-square bg-white rounded-[2.5rem] border border-dashed border-blue-200 flex items-center justify-center p-8 overflow-hidden group shadow-inner">
                    {currentConfig.plinQR ? (
                       <img src={currentConfig.plinQR} className="w-full h-full object-contain" />
                    ) : (
                       <div className="flex flex-col items-center gap-4 text-blue-200">
                          <QrCode className="w-16 h-16" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Subir Imagen del QR</span>
                       </div>
                    )}
                    <label className="absolute inset-0 bg-blue-600/90 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all duration-300">
                       <Upload className="text-white w-10 h-10 mb-2 animate-bounce"/>
                       <span className="text-[10px] font-black text-white uppercase tracking-widest">Actualizar Código QR</span>
                       <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('plinQR')} />
                    </label>
                 </div>
              </div>
           </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* COLUMNA IZQUIERDA: BANNERS Y LOGOS */}
        <div className="lg:col-span-8 space-y-10">
          
          {/* SECCIÓN DE SLIDER / DIAPOSITIVAS */}
          <section className="bg-white p-10 md:p-14 rounded-[4rem] shadow-xl border border-slate-100 relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between mb-12 relative z-10 gap-6">
               <div className="flex items-center gap-5">
                  <div className="p-4 bg-brand-50 text-brand-600 rounded-3xl">
                    <MonitorPlay className="w-8 h-8"/>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Banners de Portada</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Imágenes principales de tu tienda</p>
                  </div>
               </div>
               <button onClick={addSlide} className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-brand-500 transition-all shadow-xl">
                  <Plus className="w-5 h-5"/> Agregar Banner
               </button>
            </div>
            
            <div className="grid grid-cols-1 gap-6 relative z-10">
               {(currentConfig.slide_images || []).length === 0 ? (
                  <div className="py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 text-center flex flex-col items-center gap-5">
                     <ImageIcon className="w-16 h-16 text-slate-200" />
                     <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em]">Sube banners publicitarios para impactar a tus clientes</p>
                  </div>
               ) : (
                  currentConfig.slide_images?.map((slide, idx) => (
                    <div key={idx} className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100 hover:border-brand-500 transition-all group">
                       <div className="flex flex-col md:flex-row gap-8">
                          <div className="w-full md:w-56 h-32 bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 shrink-0 relative">
                             {slide ? (
                                <img src={slide} className="w-full h-full object-cover" />
                             ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-200"><ImageIcon className="w-12 h-12"/></div>
                             )}
                             <label className="absolute inset-0 bg-brand-500/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all duration-300">
                                <Upload className="text-white w-8 h-8 mb-2 animate-bounce"/>
                                <span className="text-[9px] font-black text-white uppercase">Cambiar Foto</span>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload('slide')(e, idx)} />
                             </label>
                          </div>
                          
                          <div className="flex-1 flex flex-col justify-center space-y-4">
                             <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-brand-500 uppercase tracking-[0.4em]">Diapositiva #{idx + 1}</span>
                                <button onClick={() => removeSlide(idx)} className="p-3 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"><Trash2 className="w-4 h-4"/></button>
                             </div>
                             <div className="relative">
                                <LinkIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"/>
                                <input 
                                   type="text" 
                                   placeholder="URL de la imagen..." 
                                   className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-2xl text-[10px] font-bold outline-none focus:ring-4 focus:ring-brand-500/10"
                                   value={slide}
                                   onChange={e => {
                                      const slides = [...(currentConfig.slide_images || [])];
                                      slides[idx] = e.target.value;
                                      setCurrentConfig({...currentConfig, slide_images: slides});
                                   }}
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
          <section className="bg-white p-10 md:p-14 rounded-[4rem] shadow-xl border border-slate-100">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-5 uppercase tracking-tighter mb-12">
              <ImageIcon className="w-8 h-8 text-brand-500"/> Logotipos de Empresa
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
               <div className="space-y-6">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo Superior (Encabezado)</label>
                  <div className="aspect-[3/1] bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200 flex items-center justify-center p-8 mb-4">
                     {currentConfig.logoUrl ? <img src={currentConfig.logoUrl} className="max-h-full object-contain" /> : <Citrus className="w-12 h-12 text-slate-200" />}
                  </div>
                  <div className="flex gap-3">
                     <input type="text" placeholder="URL del logo" className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" value={currentConfig.logoUrl || ''} onChange={e => setCurrentConfig({...currentConfig, logoUrl: e.target.value})} />
                     <label className="cursor-pointer p-5 bg-slate-900 text-white rounded-2xl hover:bg-brand-500 transition-colors shadow-lg">
                        <Upload className="w-6 h-6"/>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('logoUrl')} />
                     </label>
                  </div>
               </div>
               <div className="space-y-6">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo Inferior (Pie de Página)</label>
                  <div className="aspect-[3/1] bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200 flex items-center justify-center p-8 mb-4">
                     {currentConfig.footerLogoUrl ? <img src={currentConfig.footerLogoUrl} className="max-h-full object-contain" /> : <Citrus className="w-12 h-12 text-slate-200" />}
                  </div>
                  <div className="flex gap-3">
                     <input type="text" placeholder="URL logo footer" className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" value={currentConfig.footerLogoUrl || ''} onChange={e => setCurrentConfig({...currentConfig, footerLogoUrl: e.target.value})} />
                     <label className="cursor-pointer p-5 bg-slate-900 text-white rounded-2xl hover:bg-brand-500 transition-colors shadow-lg">
                        <Upload className="w-6 h-6"/>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('footerLogoUrl')} />
                     </label>
                  </div>
               </div>
            </div>
          </section>
        </div>

        {/* COLUMNA DERECHA: COLORES Y REDES */}
        <div className="lg:col-span-4 space-y-10">
           
           {/* COLORES */}
           <section className="bg-white p-10 rounded-[4rem] shadow-xl border border-slate-100">
             <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-10 flex items-center gap-4">
               <Paintbrush className="w-7 h-7 text-brand-500"/> Colores Web
             </h3>
             <div className="space-y-6">
                <div className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-slate-100">
                   <div className="flex items-center gap-4">
                      <input type="color" className="w-14 h-14 rounded-2xl cursor-pointer border-4 border-white shadow-lg" value={currentConfig.colorPrimario} onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Color Primario</span>
                   </div>
                </div>
                <div className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-slate-100">
                   <div className="flex items-center gap-4">
                      <input type="color" className="w-14 h-14 rounded-2xl cursor-pointer border-4 border-white shadow-lg" value={currentConfig.colorSecundario} onChange={e => setCurrentConfig({...currentConfig, colorSecundario: e.target.value})} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Color Footer</span>
                   </div>
                </div>
             </div>
           </section>

           {/* REDES SOCIALES Y AYUDA */}
           <section className="bg-white p-10 rounded-[4rem] shadow-xl border border-slate-100 space-y-10">
             <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter">
               <Share2 className="w-7 h-7 text-blue-500"/> Enlaces y Redes
             </h3>
             <div className="space-y-4">
                <div className="relative">
                   <Facebook className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600"/>
                   <input type="text" placeholder="URL de Facebook" className="w-full pl-14 pr-5 py-5 bg-slate-50 rounded-[1.5rem] text-[11px] font-bold uppercase outline-none focus:ring-4 focus:ring-blue-100" value={currentConfig.facebook_url || ''} onChange={e => setCurrentConfig({...currentConfig, facebook_url: e.target.value})} />
                </div>
                <div className="relative">
                   <span className="absolute left-5 top-1/2 -translate-y-1/2"><span className="absolute left-5 top-1/2 -translate-y-1/2"><Instagram className="w-5 h-5 text-pink-500"/></span></span>
                   <input type="text" placeholder="URL de Instagram" className="w-full pl-14 pr-5 py-5 bg-slate-50 rounded-[1.5rem] text-[11px] font-bold uppercase outline-none focus:ring-4 focus:ring-pink-100" value={currentConfig.instagram_url || ''} onChange={e => setCurrentConfig({...currentConfig, instagram_url: e.target.value})} />
                </div>
                <div className="relative">
                   <MessageCircle className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500"/>
                   <input type="text" placeholder="WhatsApp para Ayuda" className="w-full pl-14 pr-5 py-5 bg-slate-50 rounded-[1.5rem] text-[11px] font-bold uppercase outline-none focus:ring-4 focus:ring-emerald-100" value={currentConfig.whatsappHelpNumber || ''} onChange={e => setCurrentConfig({...currentConfig, whatsappHelpNumber: e.target.value})} />
                </div>
                <div className="space-y-4 pt-4 border-t border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Lema de la Compañía (Footer)</label>
                    <textarea 
                        className="w-full p-6 bg-slate-50 rounded-[2rem] text-[10px] font-bold uppercase outline-none shadow-inner resize-none h-32 focus:ring-4 focus:ring-brand-100"
                        placeholder="Escribe el lema o descripción corta..."
                        value={currentConfig.footer_description || ''}
                        onChange={e => setCurrentConfig({...currentConfig, footer_description: e.target.value})}
                    />
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
