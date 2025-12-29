
import React, { useState } from 'react';
import { 
  Palette, Save, CheckCircle2, RotateCcw, MapPin, Plus, Trash2, 
  Sparkles, Wallet, Phone, X, Facebook, Instagram, Music2, MessageCircle,
  RefreshCw, Share2, LayoutPanelTop, QrCode, Upload, Smartphone, AlertCircle
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
            contents: `Analiza el logo (${currentConfig.logoUrl}). Sugiere 2 colores hex (primario y acento) y un slogan profesional. Responde en JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        primary: { type: Type.STRING },
                        accent: { type: Type.STRING },
                        footerDescription: { type: Type.STRING }
                    },
                    required: ["primary", "accent", "footerDescription"]
                }
            }
        });
        const data = JSON.parse(response.text);
        setCurrentConfig(prev => ({
            ...prev,
            colorPrimario: data.primary || prev.colorPrimario,
            colorAcento: data.accent || prev.colorAcento,
            footer_description: data.footerDescription || prev.footer_description
        }));
    } catch (e) {
        console.error(e);
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

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 pb-32">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
           <div className="p-4 bg-brand-50 rounded-[2.5rem] border border-brand-100 shadow-sm"><Palette className="w-10 h-10 text-brand-600" /></div>
           <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Configurar Tienda</h2>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">Identidad Visual & Métodos de Pago</p>
           </div>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="px-12 py-6 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl flex items-center gap-4 transition-all hover:scale-105 active:scale-95 hover:shadow-brand-500/30" style={{backgroundColor: brandColor}}>
          {isSaving ? <RotateCcw className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} Guardar Tienda
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* IDENTIDAD VISUAL */}
        <div className="space-y-8">
          <section className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full" style={{backgroundColor: brandColor}}></div>
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4"><Palette className="w-7 h-7 text-indigo-500"/> Logo & Colores</h3>
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre Comercial</label>
                <input type="text" className="w-full p-5 bg-slate-50 border-none rounded-2xl font-black uppercase text-sm shadow-inner focus:ring-2" style={{'--tw-ring-color': brandColor} as any} value={currentConfig.nombreComercial || ''} onChange={e => setCurrentConfig({...currentConfig, nombreComercial: e.target.value})} />
              </div>
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo Principal (Header)</label>
                <div className="flex gap-2">
                    <input type="url" placeholder="URL Logo PNG" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold shadow-inner" value={currentConfig.logoUrl || ''} onChange={e => setCurrentConfig({...currentConfig, logoUrl: e.target.value})} />
                    <button type="button" onClick={handleSuggestPalette} className="p-4 bg-brand-500 text-white rounded-2xl shadow-lg transition-all hover:rotate-3 active:scale-95">{isGenerating ? <RefreshCw className="animate-spin w-5 h-5"/> : <Sparkles className="w-5 h-5"/>}</button>
                </div>
              </div>
              <div className="flex gap-4">
                 <div className="flex-1 space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Primario</label>
                    <input type="color" className="w-full h-16 rounded-[1.5rem] cursor-pointer shadow-sm border-4 border-slate-50" value={currentConfig.colorPrimario} onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})} />
                 </div>
                 <div className="flex-1 space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Acento</label>
                    <input type="color" className="w-full h-16 rounded-[1.5rem] cursor-pointer shadow-sm border-4 border-slate-50" value={currentConfig.colorAcento} onChange={e => setCurrentConfig({...currentConfig, colorAcento: e.target.value})} />
                 </div>
              </div>
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-8 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-2 h-full bg-orange-500"></div>
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4"><LayoutPanelTop className="w-7 h-7 text-orange-500"/> Imágenes Cabecera</h3>
            <div className="space-y-4">
               {(currentConfig.slide_images || []).map((url, idx) => (
                  <div key={idx} className="flex gap-2 group">
                     <input type="url" placeholder="URL Imagen Slide" className="flex-1 p-3 bg-slate-50 border-none rounded-xl text-[10px] font-bold shadow-inner" value={url} onChange={e => updateSlide(idx, e.target.value)} />
                     <button onClick={() => removeSlide(idx)} className="p-3 text-red-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                  </div>
               ))}
               <button onClick={addSlide} className="w-full p-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-[9px] uppercase tracking-widest hover:border-orange-200 hover:text-orange-500 transition-all">
                  + Agregar Nueva Imagen
               </button>
            </div>
          </section>
        </div>

        {/* REDES & MARKETING */}
        <div className="space-y-8">
          <section className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4"><Share2 className="w-7 h-7 text-blue-500"/> Redes Sociales</h3>
            <div className="space-y-5">
               <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl shadow-inner border border-slate-100">
                  <Facebook className="w-5 h-5 text-blue-600"/>
                  <input type="text" placeholder="Facebook URL" className="w-full bg-transparent outline-none text-xs font-bold" value={currentConfig.facebook_url || ''} onChange={e => setCurrentConfig({...currentConfig, facebook_url: e.target.value})} />
               </div>
               <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl shadow-inner border border-slate-100">
                  <Instagram className="w-5 h-5 text-pink-500"/>
                  <input type="text" placeholder="Instagram URL" className="w-full bg-transparent outline-none text-xs font-bold" value={currentConfig.instagram_url || ''} onChange={e => setCurrentConfig({...currentConfig, instagram_url: e.target.value})} />
               </div>
               <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl shadow-inner border border-emerald-100">
                  <MessageCircle className="w-5 h-5 text-emerald-500"/>
                  <input type="text" placeholder="WhatsApp Consultas" className="w-full bg-transparent outline-none text-xs font-bold" value={currentConfig.whatsappHelpNumber || ''} onChange={e => setCurrentConfig({...currentConfig, whatsappHelpNumber: e.target.value})} />
               </div>
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-8 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-2 h-full bg-emerald-600"></div>
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4"><MessageCircle className="w-7 h-7 text-emerald-600" /> Info del Pie</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">WhatsApp Pedidos</label>
                <input type="text" placeholder="51975615244" className="w-full p-5 bg-slate-50 border-none rounded-2xl text-sm font-black shadow-inner" value={currentConfig.whatsappNumbers || ''} onChange={e => setCurrentConfig({...currentConfig, whatsappNumbers: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Frase de Marca</label>
                <textarea className="w-full p-5 bg-slate-50 border-none rounded-2xl text-xs font-bold h-32 shadow-inner" placeholder="Ej: Especialistas cuidando tu salud las 24 horas." value={currentConfig.footer_description || ''} onChange={e => setCurrentConfig({...currentConfig, footer_description: e.target.value})}></textarea>
              </div>
            </div>
          </section>
        </div>

        {/* PAGOS & QR */}
        <div className="space-y-8">
           <section className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-[#742284]"></div>
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4"><Wallet className="w-7 h-7 text-brand-600" /> Cobros Digitales</h3>
            
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
               <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-1" />
               <p className="text-[9px] font-bold text-amber-800 uppercase leading-relaxed">Sube fotos claras de tus códigos QR para que los clientes puedan pagar escaneando desde su celular.</p>
            </div>

            <div className="space-y-8">
               {/* YAPE */}
               <div className="p-8 bg-[#742284]/5 rounded-[3rem] border border-[#742284]/10 space-y-5">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-[#742284] rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg">Y</div>
                        <span className="text-[11px] font-black uppercase text-[#742284] tracking-widest">Yape</span>
                     </div>
                     <label className="cursor-pointer p-4 bg-white rounded-[1.5rem] shadow-lg hover:scale-110 active:scale-95 transition-all">
                        <Upload className="w-5 h-5 text-[#742284]" />
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('yapeQR')} />
                     </label>
                  </div>
                  {currentConfig.yapeQR ? (
                     <div className="relative group w-48 h-48 mx-auto rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl">
                        <img src={currentConfig.yapeQR} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <button onClick={() => setCurrentConfig({...currentConfig, yapeQR: ''})} className="p-3 bg-red-500 rounded-2xl text-white shadow-xl hover:scale-110 transition-transform"><Trash2 className="w-6 h-6"/></button>
                        </div>
                     </div>
                  ) : (
                     <div className="w-48 h-48 mx-auto bg-white/50 border-4 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-2 text-slate-300">
                        <QrCode className="w-10 h-10" />
                        <span className="text-[8px] font-black uppercase">Sin QR cargado</span>
                     </div>
                  )}
                  <input type="text" placeholder="Número Celular Yape" className="w-full p-4 bg-white border-none rounded-2xl text-sm font-black text-center shadow-inner tracking-widest" value={currentConfig.yapeNumber || ''} onChange={e => setCurrentConfig({...currentConfig, yapeNumber: e.target.value})} />
               </div>

               {/* PLIN */}
               <div className="p-8 bg-[#00A9E0]/5 rounded-[3rem] border border-[#00A9E0]/10 space-y-5">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-[#00A9E0] rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg">P</div>
                        <span className="text-[11px] font-black uppercase text-[#00A9E0] tracking-widest">Plin</span>
                     </div>
                     <label className="cursor-pointer p-4 bg-white rounded-[1.5rem] shadow-lg hover:scale-110 active:scale-95 transition-all">
                        <Upload className="w-5 h-5 text-[#00A9E0]" />
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('plinQR')} />
                     </label>
                  </div>
                  {currentConfig.plinQR ? (
                     <div className="relative group w-48 h-48 mx-auto rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl">
                        <img src={currentConfig.plinQR} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <button onClick={() => setCurrentConfig({...currentConfig, plinQR: ''})} className="p-3 bg-red-500 rounded-2xl text-white shadow-xl hover:scale-110 transition-transform"><Trash2 className="w-6 h-6"/></button>
                        </div>
                     </div>
                  ) : (
                     <div className="w-48 h-48 mx-auto bg-white/50 border-4 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-2 text-slate-300">
                        <QrCode className="w-10 h-10" />
                        <span className="text-[8px] font-black uppercase">Sin QR cargado</span>
                     </div>
                  )}
                  <input type="text" placeholder="Número Celular Plin" className="w-full p-4 bg-white border-none rounded-2xl text-sm font-black text-center shadow-inner tracking-widest" value={currentConfig.plinNumber || ''} onChange={e => setCurrentConfig({...currentConfig, plinNumber: e.target.value})} />
               </div>
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-6 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4"><MapPin className="w-7 h-7 text-blue-500" /> Sedes de Recojo</h3>
            <div className="space-y-4">
              {(currentConfig.sedes_recojo || []).map(sede => (
                <div key={sede.id} className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 flex gap-3 shadow-inner">
                   <div className="flex-1 space-y-2">
                     <input type="text" placeholder="Nombre Sede" className="w-full p-2 bg-white border-none rounded-xl text-[11px] font-black uppercase" value={sede.nombre} onChange={e => updateSede(sede.id, 'nombre', e.target.value)} />
                     <input type="text" placeholder="Dirección Exacta" className="w-full p-2 bg-white border-none rounded-xl text-[10px] font-bold" value={sede.direccion} onChange={e => updateSede(sede.id, 'direccion', e.target.value)} />
                   </div>
                   <button type="button" onClick={() => removeSede(sede.id)} className="p-3 text-red-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
                </div>
              ))}
              <button type="button" onClick={addSede} className="w-full p-5 border-2 border-dashed border-slate-200 rounded-[2rem] text-slate-400 font-black text-[10px] uppercase flex items-center justify-center gap-3 hover:border-blue-300 hover:text-blue-600 transition-all hover:bg-blue-50/30">
                <Plus className="w-5 h-5"/> Añadir Sede de Entrega
              </button>
            </div>
          </section>
        </div>

      </div>

      {showSuccess && (
         <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-14 py-7 rounded-full shadow-[0_20px_60px_rgba(0,0,0,0.4)] animate-in slide-in-from-bottom-12 flex items-center gap-6 border border-white/10">
            <CheckCircle2 className="text-brand-400 w-10 h-10"/>
            <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-widest leading-none">¡Configuración Guardada!</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Los cambios se verán en tu tienda al instante.</span>
            </div>
         </div>
      )}
    </div>
  );
};

export default StoreSettings;
