
import React, { useState } from 'react';
import { 
  Palette, Save, CheckCircle2, RotateCcw, MapPin, Plus, Trash2, 
  Sparkles, Wallet, Phone, X, Facebook, Instagram, Music2, MessageCircle,
  RefreshCw, Share2, LayoutPanelTop, QrCode, Upload, Smartphone, AlertCircle,
  Eye, Image as ImageIcon, Paintbrush, Footprints
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

  const handleFileUpload = (field: 'yapeQR' | 'plinQR') => (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleSuggestPalette = async () => {
    if (!currentConfig.logoUrl) {
        alert("Primero ingresa la URL de un logo.");
        return;
    }
    setIsGenerating(true);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analiza el logo (${currentConfig.logoUrl}). Sugiere 3 colores hex (primario, secundario y acento) y un slogan profesional para el footer. Responde en JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        primary: { type: Type.STRING },
                        secondary: { type: Type.STRING },
                        accent: { type: Type.STRING },
                        footerDescription: { type: Type.STRING }
                    },
                    required: ["primary", "secondary", "accent", "footerDescription"]
                }
            }
        });
        const data = JSON.parse(response.text);
        setCurrentConfig(prev => ({
            ...prev,
            colorPrimario: data.primary || prev.colorPrimario,
            colorSecundario: data.secondary || prev.colorSecundario,
            colorAcento: data.accent || prev.colorAcento,
            footer_description: data.footerDescription || prev.footer_description
        }));
    } catch (e) {
        console.error(e);
        alert("No se pudo generar la sugerencia. Revisa tu API KEY.");
    } finally {
        setIsGenerating(false);
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
  const secondaryColor = currentConfig.colorSecundario || '#1e293b';

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 pb-32">
      
      {/* HEADER DINÁMICO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
           <div className="p-4 bg-brand-50 rounded-[2.5rem] border border-brand-100 shadow-sm" style={{ color: brandColor }}>
              <Palette className="w-10 h-10" />
           </div>
           <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Personalizar Tienda</h2>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">Configura la identidad visual de tu marca</p>
           </div>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving} 
          className="px-12 py-6 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl flex items-center gap-4 transition-all hover:scale-105 active:scale-95 hover:shadow-brand-500/30" 
          style={{backgroundColor: brandColor}}
        >
          {isSaving ? <RotateCcw className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} Guardar Cambios
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* IDENTIDAD VISUAL Y LOGOS */}
        <div className="space-y-8 lg:col-span-2">
          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full" style={{backgroundColor: brandColor}}></div>
            
            <div className="flex items-center justify-between mb-10">
               <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter">
                 <ImageIcon className="w-7 h-7 text-indigo-500"/> Identidad & Logos
               </h3>
               <button 
                 onClick={handleSuggestPalette} 
                 className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-500 transition-all shadow-lg"
               >
                 {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>} Sugerir con IA
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre de la Empresa</label>
                  <input 
                    type="text" 
                    className="w-full p-5 bg-slate-50 border-none rounded-3xl font-black uppercase text-sm shadow-inner focus:ring-2 transition-all" 
                    style={{'--tw-ring-color': brandColor} as any}
                    value={currentConfig.nombreComercial || ''} 
                    onChange={e => setCurrentConfig({...currentConfig, nombreComercial: e.target.value})} 
                  />
                </div>
                
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo Principal (Header)</label>
                  <input 
                    type="url" 
                    placeholder="URL del logo (Fondo transparente recomendado)" 
                    className="w-full p-5 bg-slate-50 border-none rounded-3xl text-xs font-bold shadow-inner" 
                    value={currentConfig.logoUrl || ''} 
                    onChange={e => setCurrentConfig({...currentConfig, logoUrl: e.target.value})} 
                  />
                  {currentConfig.logoUrl && (
                    <div className="mt-2 p-4 bg-slate-100 rounded-2xl flex items-center justify-center h-20">
                      <img src={currentConfig.logoUrl} className="max-h-full object-contain" alt="Vista previa" />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo Secundario (Footer)</label>
                  <input 
                    type="url" 
                    placeholder="URL del logo para el pie de página" 
                    className="w-full p-5 bg-slate-50 border-none rounded-3xl text-xs font-bold shadow-inner" 
                    value={currentConfig.footerLogoUrl || ''} 
                    onChange={e => setCurrentConfig({...currentConfig, footerLogoUrl: e.target.value})} 
                  />
                </div>
              </div>

              <div className="space-y-8">
                 <div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Paleta de Colores de Marca</p>
                    <div className="grid grid-cols-3 gap-4">
                       <div className="space-y-2 flex flex-col items-center">
                          <input type="color" className="w-16 h-16 rounded-2xl cursor-pointer border-4 border-white shadow-xl" value={currentConfig.colorPrimario} onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})} />
                          <span className="text-[8px] font-black uppercase text-slate-400">Primario</span>
                       </div>
                       <div className="space-y-2 flex flex-col items-center">
                          <input type="color" className="w-16 h-16 rounded-2xl cursor-pointer border-4 border-white shadow-xl" value={currentConfig.colorSecundario} onChange={e => setCurrentConfig({...currentConfig, colorSecundario: e.target.value})} />
                          <span className="text-[8px] font-black uppercase text-slate-400">Secundario</span>
                       </div>
                       <div className="space-y-2 flex flex-col items-center">
                          <input type="color" className="w-16 h-16 rounded-2xl cursor-pointer border-4 border-white shadow-xl" value={currentConfig.colorAcento} onChange={e => setCurrentConfig({...currentConfig, colorAcento: e.target.value})} />
                          <span className="text-[8px] font-black uppercase text-slate-400">Acento</span>
                       </div>
                    </div>
                 </div>

                 {/* PREVISUALIZACIÓN DE FOOTER */}
                 <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Previsualización Footer</label>
                    <div className="p-6 rounded-[2.5rem] shadow-xl border border-white/10 relative overflow-hidden" style={{ backgroundColor: secondaryColor }}>
                       <div className="relative z-10 space-y-3">
                          <div className="flex items-center gap-2">
                             <div className="w-6 h-6 rounded bg-brand-500 flex items-center justify-center">
                                <ImageIcon className="w-3 h-3 text-white" />
                             </div>
                             <span className="text-[10px] font-black uppercase text-white tracking-tighter">{currentConfig.nombreComercial || 'Tu Marca'}</span>
                          </div>
                          <p className="text-[8px] text-slate-400 leading-tight line-clamp-2 uppercase font-bold">{currentConfig.footer_description || 'Descripción de tu marca aquí...'}</p>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </section>

          {/* BANNER SLIDER */}
          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-slate-100 space-y-8 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-2 h-full bg-orange-500"></div>
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter">
              <LayoutPanelTop className="w-7 h-7 text-orange-500"/> Imágenes del Slider (Hero)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {(currentConfig.slide_images || []).map((url, idx) => (
                  <div key={idx} className="relative group p-4 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col gap-3">
                     <div className="h-24 bg-white rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                        {url ? <img src={url} className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-slate-200" />}
                     </div>
                     <input 
                       type="url" 
                       placeholder="URL Imagen" 
                       className="w-full p-2 bg-white border-none rounded-xl text-[9px] font-bold shadow-sm" 
                       value={url} 
                       onChange={e => updateSlide(idx, e.target.value)} 
                     />
                     <button onClick={() => removeSlide(idx)} className="absolute -top-2 -right-2 p-2 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3"/>
                     </button>
                  </div>
               ))}
               <button onClick={addSlide} className="h-44 border-4 border-dashed border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 text-slate-300 hover:border-orange-200 hover:text-orange-500 hover:bg-orange-50/20 transition-all group">
                  <Plus className="w-8 h-8 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Añadir Banner</span>
               </button>
            </div>
          </section>
        </div>

        {/* SIDEBAR DE CONFIGURACIÓN RÁPIDA */}
        <div className="space-y-8">
           {/* REDES SOCIALES */}
           <section className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 space-y-6 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
             <h3 className="text-lg font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
               <Share2 className="w-6 h-6 text-blue-500"/> Presencia Social
             </h3>
             <div className="space-y-4">
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 group focus-within:border-blue-200 transition-all">
                   <Facebook className="w-5 h-5 text-blue-600"/>
                   <input type="text" placeholder="Facebook URL" className="w-full bg-transparent outline-none text-xs font-bold" value={currentConfig.facebook_url || ''} onChange={e => setCurrentConfig({...currentConfig, facebook_url: e.target.value})} />
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 group focus-within:border-pink-200 transition-all">
                   <Instagram className="w-5 h-5 text-pink-500"/>
                   <input type="text" placeholder="Instagram URL" className="w-full bg-transparent outline-none text-xs font-bold" value={currentConfig.instagram_url || ''} onChange={e => setCurrentConfig({...currentConfig, instagram_url: e.target.value})} />
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 group focus-within:border-emerald-200 transition-all">
                   <MessageCircle className="w-5 h-5 text-emerald-500"/>
                   <input type="text" placeholder="WhatsApp Consultas" className="w-full bg-transparent outline-none text-xs font-bold" value={currentConfig.whatsappHelpNumber || ''} onChange={e => setCurrentConfig({...currentConfig, whatsappHelpNumber: e.target.value})} />
                </div>
             </div>
           </section>

           {/* PAGOS DIGITALES */}
           <section className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-purple-600"></div>
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
              <QrCode className="w-6 h-6 text-purple-600" /> Billeteras QR
            </h3>
            
            <div className="space-y-10">
               {/* YAPE */}
               <div className="text-center space-y-4">
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-[10px] font-black uppercase text-purple-600 tracking-widest">Yape QR</span>
                     <label className="cursor-pointer p-2 bg-purple-50 rounded-xl text-purple-600 hover:bg-purple-600 hover:text-white transition-all">
                        <Upload className="w-4 h-4" />
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('yapeQR')} />
                     </label>
                  </div>
                  {currentConfig.yapeQR ? (
                     <div className="relative group w-full aspect-square bg-white rounded-3xl overflow-hidden border-2 border-slate-100 shadow-lg">
                        <img src={currentConfig.yapeQR} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <button onClick={() => setCurrentConfig({...currentConfig, yapeQR: ''})} className="p-4 bg-red-500 text-white rounded-2xl shadow-xl hover:scale-110"><Trash2 className="w-6 h-6"/></button>
                        </div>
                     </div>
                  ) : (
                     <div className="w-full aspect-square border-4 border-dashed border-slate-100 rounded-3xl flex items-center justify-center text-slate-200">
                        <QrCode className="w-16 h-16 opacity-20" />
                     </div>
                  )}
                  <input type="text" placeholder="Número Yape" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-black text-center shadow-inner tracking-[0.2em]" value={currentConfig.yapeNumber || ''} onChange={e => setCurrentConfig({...currentConfig, yapeNumber: e.target.value})} />
               </div>

               {/* PLIN */}
               <div className="text-center space-y-4">
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-[10px] font-black uppercase text-blue-500 tracking-widest">Plin QR</span>
                     <label className="cursor-pointer p-2 bg-blue-50 rounded-xl text-blue-500 hover:bg-blue-500 hover:text-white transition-all">
                        <Upload className="w-4 h-4" />
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('plinQR')} />
                     </label>
                  </div>
                  {currentConfig.plinQR ? (
                     <div className="relative group w-full aspect-square bg-white rounded-3xl overflow-hidden border-2 border-slate-100 shadow-lg">
                        <img src={currentConfig.plinQR} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <button onClick={() => setCurrentConfig({...currentConfig, plinQR: ''})} className="p-4 bg-red-500 text-white rounded-2xl shadow-xl hover:scale-110"><Trash2 className="w-6 h-6"/></button>
                        </div>
                     </div>
                  ) : (
                     <div className="w-full aspect-square border-4 border-dashed border-slate-100 rounded-3xl flex items-center justify-center text-slate-200">
                        <QrCode className="w-16 h-16 opacity-20" />
                     </div>
                  )}
                  <input type="text" placeholder="Número Plin" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-black text-center shadow-inner tracking-[0.2em]" value={currentConfig.plinNumber || ''} onChange={e => setCurrentConfig({...currentConfig, plinNumber: e.target.value})} />
               </div>
            </div>
          </section>
        </div>
      </div>

      {showSuccess && (
         <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-12 py-6 rounded-full shadow-2xl animate-in slide-in-from-bottom-12 flex items-center gap-6 border border-white/10">
            <CheckCircle2 className="text-brand-400 w-10 h-10"/>
            <div className="flex flex-col">
                <span className="text-sm font-black uppercase tracking-widest leading-none">¡Configuración Guardada!</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Tu tienda se ha actualizado correctamente</span>
            </div>
         </div>
      )}
    </div>
  );
};

export default StoreSettings;
