
import React, { useState } from 'react';
import { 
  Palette, Save, CheckCircle2, RotateCcw, MapPin, Plus, Trash2, 
  Sparkles, Wallet, Phone, X, Facebook, Instagram, Music2, MessageCircle,
  RefreshCw, Share2, LayoutPanelTop, QrCode, Upload, Smartphone, AlertCircle,
  Eye, Image as ImageIcon, Paintbrush, Footprints, Layout, AlignLeft, Citrus
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
      
      {/* HEADER DE CONTROL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
           <div className="p-4 bg-white rounded-[2.5rem] shadow-xl border border-slate-100" style={{ color: brandColor }}>
              <Palette className="w-10 h-10" />
           </div>
           <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Estética de la Tienda</h2>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">Logo, Colores y Pie de Página</p>
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
        
        {/* PANEL IZQUIERDO: LOGOS Y COLORES */}
        <div className="lg:col-span-7 space-y-8">
          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
            <div className="flex items-center justify-between mb-10">
               <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter">
                 <ImageIcon className="w-7 h-7 text-brand-500"/> Identidad Visual
               </h3>
               <button onClick={handleSuggestPalette} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-500 transition-all">
                 {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>} IA Color Sync
               </button>
            </div>

            <div className="space-y-10">
              {/* Logo Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                 <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo Principal (Header)</label>
                    <div className="flex gap-2">
                       <input type="text" placeholder="URL del logo" className="flex-1 p-4 bg-slate-50 rounded-2xl text-xs font-bold shadow-inner border-none" value={currentConfig.logoUrl || ''} onChange={e => setCurrentConfig({...currentConfig, logoUrl: e.target.value})} />
                       <label className="cursor-pointer p-4 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors">
                          <Upload className="w-5 h-5 text-slate-500"/>
                          <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('logoUrl')} />
                       </label>
                    </div>
                 </div>
                 <div className="h-24 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200 flex items-center justify-center overflow-hidden p-4">
                    {currentConfig.logoUrl ? <img src={currentConfig.logoUrl} className="max-h-full object-contain" /> : <p className="text-[10px] font-black text-slate-300 uppercase">Vista Previa Header</p>}
                 </div>
              </div>

              {/* Colores */}
              <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-8">Paleta de Colores Corporativa</p>
                 <div className="grid grid-cols-3 gap-6">
                    <div className="flex flex-col items-center gap-3">
                       <input type="color" className="w-16 h-16 rounded-3xl cursor-pointer border-4 border-white shadow-xl" value={currentConfig.colorPrimario} onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})} />
                       <span className="text-[9px] font-black uppercase text-slate-500">Primario (Botones)</span>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                       <input type="color" className="w-16 h-16 rounded-3xl cursor-pointer border-4 border-white shadow-xl" value={currentConfig.colorSecundario} onChange={e => setCurrentConfig({...currentConfig, colorSecundario: e.target.value})} />
                       <span className="text-[9px] font-black uppercase text-slate-500">Secundario (Footer)</span>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                       <input type="color" className="w-16 h-16 rounded-3xl cursor-pointer border-4 border-white shadow-xl" value={currentConfig.colorAcento} onChange={e => setCurrentConfig({...currentConfig, colorAcento: e.target.value})} />
                       <span className="text-[9px] font-black uppercase text-slate-500">Acento</span>
                    </div>
                 </div>
              </div>
            </div>
          </section>

          {/* NUEVA SECCIÓN: CONFIGURACIÓN ESPECÍFICA DEL FOOTER */}
          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-slate-900 rounded-bl-[5rem] flex items-start justify-end p-6">
               <Layout className="w-6 h-6 text-white" />
            </div>
            
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter mb-10">
              <AlignLeft className="w-7 h-7 text-slate-900"/> Personalización del Footer
            </h3>

            <div className="space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                     <div className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo del Footer</label>
                        <div className="flex gap-2">
                           <input type="text" placeholder="URL logo footer" className="flex-1 p-4 bg-slate-50 rounded-2xl text-xs font-bold shadow-inner border-none" value={currentConfig.footerLogoUrl || ''} onChange={e => setCurrentConfig({...currentConfig, footerLogoUrl: e.target.value})} />
                           <label className="cursor-pointer p-4 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors">
                              <Upload className="w-5 h-5 text-slate-500"/>
                              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('footerLogoUrl')} />
                           </label>
                        </div>
                        <p className="text-[9px] text-slate-400 font-bold ml-4">Se recomienda logo en blanco o con transparencia.</p>
                     </div>
                     <div className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Descripción / Slogan Footer</label>
                        <textarea 
                           className="w-full p-5 bg-slate-50 rounded-3xl border-none shadow-inner text-xs font-bold h-28 resize-none" 
                           placeholder="Escribe un mensaje que inspire confianza..."
                           value={currentConfig.footer_description || ''}
                           onChange={e => setCurrentConfig({...currentConfig, footer_description: e.target.value})}
                        />
                     </div>
                  </div>

                  <div className="space-y-4">
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Previsualización Real</label>
                     <div className="rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden flex flex-col items-center text-center gap-4 border border-white/10" style={{ backgroundColor: secondaryColor }}>
                        <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: brandColor }}></div>
                        {currentConfig.footerLogoUrl ? (
                           <img src={currentConfig.footerLogoUrl} className="h-10 object-contain" />
                        ) : (
                           /* Fix: Citrus icon now imported correctly */
                           <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: brandColor }}><Citrus className="w-6 h-6"/></div>
                        )}
                        <h4 className="text-white text-xs font-black uppercase tracking-tighter">{currentConfig.nombreComercial || 'Tu Marca'}</h4>
                        <p className="text-[8px] text-slate-400 font-bold uppercase leading-tight line-clamp-3">{currentConfig.footer_description || 'Aquí aparecerá la descripción de tu empresa en el pie de página.'}</p>
                        <div className="flex gap-2 mt-2 opacity-50">
                           <div className="w-6 h-6 bg-white/10 rounded-lg"></div>
                           <div className="w-6 h-6 bg-white/10 rounded-lg"></div>
                           <div className="w-6 h-6 bg-white/10 rounded-lg"></div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </section>
        </div>

        {/* PANEL DERECHO: SLIDER Y REDES */}
        <div className="lg:col-span-5 space-y-8">
           {/* REDES SOCIALES */}
           <section className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 space-y-6">
             <h3 className="text-lg font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
               <Share2 className="w-6 h-6 text-blue-500"/> Enlaces Sociales
             </h3>
             <div className="space-y-4">
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <Facebook className="w-5 h-5 text-blue-600"/>
                   <input type="text" placeholder="https://facebook.com/..." className="w-full bg-transparent outline-none text-[10px] font-bold" value={currentConfig.facebook_url || ''} onChange={e => setCurrentConfig({...currentConfig, facebook_url: e.target.value})} />
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <Instagram className="w-5 h-5 text-pink-500"/>
                   <input type="text" placeholder="https://instagram.com/..." className="w-full bg-transparent outline-none text-[10px] font-bold" value={currentConfig.instagram_url || ''} onChange={e => setCurrentConfig({...currentConfig, instagram_url: e.target.value})} />
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <MessageCircle className="w-5 h-5 text-emerald-500"/>
                   <input type="text" placeholder="WhatsApp (999000111)" className="w-full bg-transparent outline-none text-[10px] font-bold" value={currentConfig.whatsappHelpNumber || ''} onChange={e => setCurrentConfig({...currentConfig, whatsappHelpNumber: e.target.value})} />
                </div>
             </div>
           </section>

           {/* BANNER SLIDER */}
           <section className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 space-y-6">
             <h3 className="text-lg font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
               <LayoutPanelTop className="w-6 h-6 text-orange-500"/> Carrusel de Portada
             </h3>
             <div className="grid grid-cols-1 gap-4">
                {(currentConfig.slide_images || []).map((url, idx) => (
                   <div key={idx} className="relative group p-4 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-4">
                      <div className="w-16 h-16 bg-white rounded-2xl overflow-hidden shadow-sm flex items-center justify-center shrink-0">
                         {url ? <img src={url} className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-slate-200" />}
                      </div>
                      <input type="url" placeholder="URL de la imagen" className="flex-1 bg-transparent outline-none text-[9px] font-bold" value={url} onChange={e => updateSlide(idx, e.target.value)} />
                      <button onClick={() => removeSlide(idx)} className="p-2 bg-red-100 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4"/></button>
                   </div>
                ))}
                <button onClick={addSlide} className="w-full py-4 border-4 border-dashed border-slate-100 rounded-3xl flex items-center justify-center gap-3 text-slate-300 hover:border-brand-200 hover:text-brand-500 transition-all font-black uppercase text-[10px] tracking-widest">
                   <Plus className="w-5 h-5" /> Añadir Imagen
                </button>
             </div>
           </section>
        </div>
      </div>

      {showSuccess && (
         <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-12 py-6 rounded-full shadow-2xl animate-in slide-in-from-bottom-12 flex items-center gap-6 border border-white/10">
            <CheckCircle2 className="text-brand-400 w-10 h-10"/>
            <div className="flex flex-col">
                <span className="text-sm font-black uppercase tracking-widest leading-none">¡Diseño Guardado!</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Los cambios se verán reflejados en tu tienda</span>
            </div>
         </div>
      )}
    </div>
  );
};

export default StoreSettings;
