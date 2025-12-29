
import React, { useState } from 'react';
import { 
  Palette, Save, CheckCircle2, RotateCcw, MapPin, Plus, Trash2, 
  Sparkles, Wallet, Phone, X, Facebook, Instagram, MessageCircle,
  RefreshCw, Share2, LayoutPanelTop, QrCode, Upload, Smartphone, AlertCircle,
  Eye, Image as ImageIcon, Paintbrush, Footprints, Layout, AlignLeft, Citrus,
  Video
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

  const handleSuggestPalette = async () => {
    if (!currentConfig.logoUrl) {
        alert("Primero ingresa la URL o carga un logo principal.");
        return;
    }
    setIsGenerating(true);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analiza este logo. Sugiere 3 colores hex (primario, secundario para footer, y acento) y un slogan profesional de salud/bienestar. Responde en JSON.`,
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
        alert("No se pudo generar la sugerencia.");
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
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Diseño & Marca</h2>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">Logo, Pagos y Redes Sociales</p>
           </div>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving} 
          className="px-12 py-6 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl flex items-center gap-4 transition-all hover:scale-105 active:scale-95" 
          style={{backgroundColor: brandColor}}
        >
          {isSaving ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} Guardar Todo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* PANEL IZQUIERDO: LOGOS Y FOOTER */}
        <div className="lg:col-span-7 space-y-8">
          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter mb-8">
              <ImageIcon className="w-7 h-7 text-brand-500"/> Logotipos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo Principal</label>
                  <div className="flex gap-2">
                     <input type="text" placeholder="URL logo" className="flex-1 p-4 bg-slate-50 rounded-2xl text-xs font-bold" value={currentConfig.logoUrl || ''} onChange={e => setCurrentConfig({...currentConfig, logoUrl: e.target.value})} />
                     <label className="cursor-pointer p-4 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors">
                        <Upload className="w-5 h-5 text-slate-500"/>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('logoUrl')} />
                     </label>
                  </div>
               </div>
               <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo Footer</label>
                  <div className="flex gap-2">
                     <input type="text" placeholder="URL logo footer" className="flex-1 p-4 bg-slate-50 rounded-2xl text-xs font-bold" value={currentConfig.footerLogoUrl || ''} onChange={e => setCurrentConfig({...currentConfig, footerLogoUrl: e.target.value})} />
                     <label className="cursor-pointer p-4 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors">
                        <Upload className="w-5 h-5 text-slate-500"/>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('footerLogoUrl')} />
                     </label>
                  </div>
               </div>
            </div>
          </section>

          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter mb-8">
              <AlignLeft className="w-7 h-7 text-indigo-500"/> Slogan & Footer
            </h3>
            <div className="space-y-6">
               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Descripción de Marca</label>
               <textarea 
                  className="w-full p-6 bg-slate-50 rounded-3xl border-none shadow-inner text-xs font-bold h-28 resize-none" 
                  placeholder="Escribe el mensaje de confianza para tus clientes..."
                  value={currentConfig.footer_description || ''}
                  onChange={e => setCurrentConfig({...currentConfig, footer_description: e.target.value})}
               />
               <div className="p-6 rounded-3xl text-center" style={{ backgroundColor: secondaryColor }}>
                  <p className="text-[10px] text-white font-black uppercase tracking-widest mb-2">Previsualización Footer</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{currentConfig.footer_description || 'Sin descripción...'}</p>
               </div>
            </div>
          </section>

          {/* COLORES */}
          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-slate-100">
             <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Paleta de Colores</h3>
                <button onClick={handleSuggestPalette} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest">
                   {isGenerating ? <RefreshCw className="animate-spin w-3 h-3"/> : <Sparkles className="w-3 h-3"/>} Sugerir Colores
                </button>
             </div>
             <div className="grid grid-cols-3 gap-6">
                <div className="flex flex-col items-center gap-2">
                   <input type="color" className="w-16 h-16 rounded-2xl cursor-pointer shadow-lg" value={currentConfig.colorPrimario} onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})} />
                   <span className="text-[8px] font-black text-slate-400 uppercase">Primario</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                   <input type="color" className="w-16 h-16 rounded-2xl cursor-pointer shadow-lg" value={currentConfig.colorSecundario} onChange={e => setCurrentConfig({...currentConfig, colorSecundario: e.target.value})} />
                   <span className="text-[8px] font-black text-slate-400 uppercase">Fondo Footer</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                   <input type="color" className="w-16 h-16 rounded-2xl cursor-pointer shadow-lg" value={currentConfig.colorAcento} onChange={e => setCurrentConfig({...currentConfig, colorAcento: e.target.value})} />
                   <span className="text-[8px] font-black text-slate-400 uppercase">Acento</span>
                </div>
             </div>
          </section>
        </div>

        {/* PANEL DERECHO: QR Y REDES */}
        <div className="lg:col-span-5 space-y-8">
           
           {/* QR DE PAGOS - RESTAURADO */}
           <section className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 space-y-6">
             <h3 className="text-lg font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
               <QrCode className="w-6 h-6 text-purple-600"/> Billeteras QR
             </h3>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                   <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Yape QR</label>
                   <div className="relative group aspect-square bg-slate-50 rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 flex items-center justify-center">
                      {currentConfig.yapeQR ? (
                         <img src={currentConfig.yapeQR} className="w-full h-full object-cover" />
                      ) : (
                         <QrCode className="w-10 h-10 text-slate-200" />
                      )}
                      <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                         <Upload className="text-white w-8 h-8" />
                         <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('yapeQR')} />
                      </label>
                   </div>
                   <input type="text" placeholder="Num Yape" className="w-full p-2.5 bg-slate-50 rounded-xl text-[10px] font-black text-center" value={currentConfig.yapeNumber || ''} onChange={e => setCurrentConfig({...currentConfig, yapeNumber: e.target.value})} />
                </div>

                <div className="space-y-3">
                   <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Plin QR</label>
                   <div className="relative group aspect-square bg-slate-50 rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 flex items-center justify-center">
                      {currentConfig.plinQR ? (
                         <img src={currentConfig.plinQR} className="w-full h-full object-cover" />
                      ) : (
                         <QrCode className="w-10 h-10 text-slate-200" />
                      )}
                      <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                         <Upload className="text-white w-8 h-8" />
                         <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('plinQR')} />
                      </label>
                   </div>
                   <input type="text" placeholder="Num Plin" className="w-full p-2.5 bg-slate-50 rounded-xl text-[10px] font-black text-center" value={currentConfig.plinNumber || ''} onChange={e => setCurrentConfig({...currentConfig, plinNumber: e.target.value})} />
                </div>
             </div>
           </section>

           {/* REDES SOCIALES - ASEGURADAS */}
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

           {/* PORTADA SLIDER */}
           <section className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 space-y-6">
             <h3 className="text-lg font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
               <LayoutPanelTop className="w-6 h-6 text-orange-500"/> Banners de Portada
             </h3>
             <div className="space-y-3">
                {(currentConfig.slide_images || []).map((url, idx) => (
                   <div key={idx} className="flex gap-2 items-center bg-slate-50 p-3 rounded-2xl">
                      <input type="url" placeholder="URL imagen" className="flex-1 bg-transparent text-[9px] font-bold outline-none" value={url} onChange={e => updateSlide(idx, e.target.value)} />
                      <button onClick={() => removeSlide(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                   </div>
                ))}
                <button onClick={addSlide} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:border-brand-500 hover:text-brand-500 transition-all font-black uppercase text-[10px]">
                   <Plus className="w-4 h-4" /> Añadir Banner
                </button>
             </div>
           </section>
        </div>
      </div>

      {showSuccess && (
         <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-12 py-6 rounded-full shadow-2xl animate-in slide-in-from-bottom-12 flex items-center gap-6 border border-white/10">
            <CheckCircle2 className="text-brand-400 w-10 h-10"/>
            <div className="flex flex-col">
                <span className="text-sm font-black uppercase tracking-widest leading-none">¡Configuración Guardada!</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Los cambios ya están en vivo</span>
            </div>
         </div>
      )}
    </div>
  );
};

export default StoreSettings;
