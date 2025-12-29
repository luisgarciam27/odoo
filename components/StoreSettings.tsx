
import React, { useState } from 'react';
import { 
  Palette, ImageIcon, Save, CheckCircle2, RotateCcw, MapPin, Plus, Trash2, 
  Sparkles, Wallet, Phone, X, Facebook, Instagram, Music2, MessageCircle,
  Terminal, ExternalLink, DatabaseZap, ShieldAlert, RefreshCw, Share2
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSuggestPalette = async () => {
    if (!currentConfig.logoUrl) {
        alert("Primero ingresa la URL de un logo.");
        return;
    }
    setIsGenerating(true);
    try {
        // Correct initialization of GoogleGenAI as per guidelines
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analiza el logo (${currentConfig.logoUrl}). Sugiere 3 colores hex que armonicen y un slogan de footer. Responde estrictamente en JSON.`,
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
        // Accessing the .text property directly as recommended in the guidelines
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
    setErrorMessage(null);
    setIsSaving(true);
    const result = await saveClient(currentConfig, false);
    if (result.success) {
      onUpdate(currentConfig);
      setShowSuccess(true);
      if (result.message) setErrorMessage(result.message);
      setTimeout(() => setShowSuccess(false), 3000);
    } else {
      setErrorMessage(result.message || "Error al guardar");
    }
    setIsSaving(false);
  };

  const copyFixSQL = () => {
    const sql = `ALTER TABLE empresas ADD COLUMN IF NOT EXISTS business_type text DEFAULT 'pharmacy';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS facebook_url text;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS instagram_url text;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tiktok_url text;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS footer_description text;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS slide_images jsonb DEFAULT '[]'::jsonb;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS quality_text text;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS support_text text;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS categorias_ocultas jsonb DEFAULT '[]'::jsonb;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS whatsapp_help_number text;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS productos_ocultos jsonb DEFAULT '[]'::jsonb;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tienda_habilitada boolean DEFAULT true;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tienda_categoria_nombre text DEFAULT 'Catalogo';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS sedes_recojo jsonb DEFAULT '[]'::jsonb;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS campos_medicos_visibles jsonb DEFAULT '["registro", "laboratorio", "principio"]'::jsonb;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS footer_logo_url text;
NOTIFY pgrst, 'reload schema';`;
    navigator.clipboard.writeText(sql);
    alert("Script SQL copiado.");
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
      
      {errorMessage && (
        <div className="p-8 rounded-[3rem] border-4 flex flex-col md:flex-row items-center gap-8 shadow-2xl bg-amber-50 border-amber-200 text-amber-900">
           <div className="p-4 rounded-3xl bg-amber-100 text-amber-600"><DatabaseZap className="w-12 h-12 shrink-0" /></div>
           <div className="flex-1 space-y-2">
             <h4 className="font-black uppercase text-lg">Aviso Técnico</h4>
             <p className="text-sm font-bold opacity-80">{errorMessage}</p>
             <button onClick={copyFixSQL} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase flex items-center gap-3"><Terminal className="w-4 h-4" /> Ejecutar Fix SQL</button>
           </div>
           <button onClick={() => setErrorMessage(null)} className="p-3"><X className="w-6 h-6"/></button>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Configurar Tienda</h2>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-2">Personalización de Marca y Presencia Digital</p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="px-12 py-6 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl flex items-center gap-4" style={{backgroundColor: brandColor}}>
          {isSaving ? <RotateCcw className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} Guardar Tienda
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* IDENTIDAD VISUAL */}
        <div className="space-y-8">
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4"><Palette className="w-7 h-7 text-indigo-500"/> Identidad Visual</h3>
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Comercial</label>
                <input type="text" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black uppercase text-sm" value={currentConfig.nombreComercial || ''} onChange={e => setCurrentConfig({...currentConfig, nombreComercial: e.target.value})} />
              </div>
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Logo Principal (Header)</label>
                <div className="flex gap-2">
                    <input type="url" placeholder="https://imagen.png" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs" value={currentConfig.logoUrl || ''} onChange={e => setCurrentConfig({...currentConfig, logoUrl: e.target.value})} />
                    <button type="button" onClick={handleSuggestPalette} className="p-4 bg-brand-500 text-white rounded-2xl">{isGenerating ? <RefreshCw className="animate-spin w-5 h-5"/> : <Sparkles className="w-5 h-5"/>}</button>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Logo Footer (Pie de Página)</label>
                <input type="url" placeholder="https://logo-footer.jpg" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs" value={currentConfig.footerLogoUrl || ''} onChange={e => setCurrentConfig({...currentConfig, footerLogoUrl: e.target.value})} />
              </div>
              <div className="flex gap-4">
                 <div className="flex-1 space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Primario</label>
                    <input type="color" className="w-full h-12 rounded-xl cursor-pointer" value={currentConfig.colorPrimario} onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})} />
                 </div>
                 <div className="flex-1 space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Acento</label>
                    <input type="color" className="w-full h-12 rounded-xl cursor-pointer" value={currentConfig.colorAcento} onChange={e => setCurrentConfig({...currentConfig, colorAcento: e.target.value})} />
                 </div>
              </div>
            </div>
          </section>
        </div>

        {/* REDES SOCIALES */}
        <div className="space-y-8">
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4"><Share2 className="w-7 h-7 text-blue-500"/> Redes & Contacto</h3>
            <div className="space-y-5">
               <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border">
                  <Facebook className="w-5 h-5 text-blue-600"/>
                  <input type="text" placeholder="URL Facebook" className="w-full bg-transparent outline-none text-xs font-bold" value={currentConfig.facebook_url || ''} onChange={e => setCurrentConfig({...currentConfig, facebook_url: e.target.value})} />
               </div>
               <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border">
                  <Instagram className="w-5 h-5 text-pink-500"/>
                  <input type="text" placeholder="URL Instagram" className="w-full bg-transparent outline-none text-xs font-bold" value={currentConfig.instagram_url || ''} onChange={e => setCurrentConfig({...currentConfig, instagram_url: e.target.value})} />
               </div>
               <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border">
                  <Music2 className="w-5 h-5 text-slate-900"/>
                  <input type="text" placeholder="URL TikTok" className="w-full bg-transparent outline-none text-xs font-bold" value={currentConfig.tiktok_url || ''} onChange={e => setCurrentConfig({...currentConfig, tiktok_url: e.target.value})} />
               </div>
               <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border">
                  <MessageCircle className="w-5 h-5 text-emerald-500"/>
                  <input type="text" placeholder="WhatsApp Soporte" className="w-full bg-transparent outline-none text-xs font-bold" value={currentConfig.whatsappHelpNumber || ''} onChange={e => setCurrentConfig({...currentConfig, whatsappHelpNumber: e.target.value})} />
               </div>
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4"><MessageCircle className="w-7 h-7 text-emerald-600" /> Marketing & Pedidos</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase">WhatsApp de Pedidos</label>
                <input type="text" placeholder="51975615244" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black" value={currentConfig.whatsappNumbers || ''} onChange={e => setCurrentConfig({...currentConfig, whatsappNumbers: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase">Slogan / Descripción Footer</label>
                <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs h-24 font-bold" value={currentConfig.footer_description || ''} onChange={e => setCurrentConfig({...currentConfig, footer_description: e.target.value})}></textarea>
              </div>
            </div>
          </section>
        </div>

        {/* COBROS Y SEDES */}
        <div className="space-y-8">
           <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4"><Wallet className="w-7 h-7 text-brand-600" /> Cobros Digitales</h3>
            <div className="space-y-4">
               <div className="p-6 bg-[#742284]/5 rounded-[2.5rem] border border-[#742284]/10 space-y-3">
                  <div className="flex items-center gap-3"><div className="w-8 h-8 bg-[#742284] rounded-lg flex items-center justify-center text-white font-black text-xs">Y</div><span className="text-[10px] font-black uppercase text-[#742284]">Yape</span></div>
                  <input type="text" placeholder="Número Celular" className="w-full p-3 bg-white border border-[#742284]/10 rounded-xl text-xs font-black" value={currentConfig.yapeNumber || ''} onChange={e => setCurrentConfig({...currentConfig, yapeNumber: e.target.value})} />
                  <input type="text" placeholder="Nombre Titular" className="w-full p-3 bg-white border border-[#742284]/10 rounded-xl text-[9px] font-black uppercase" value={currentConfig.yapeName || ''} onChange={e => setCurrentConfig({...currentConfig, yapeName: e.target.value})} />
               </div>
               <div className="p-6 bg-[#00A9E0]/5 rounded-[2.5rem] border border-[#00A9E0]/10 space-y-3">
                  <div className="flex items-center gap-3"><div className="w-8 h-8 bg-[#00A9E0] rounded-lg flex items-center justify-center text-white font-black text-xs">P</div><span className="text-[10px] font-black uppercase text-[#00A9E0]">Plin</span></div>
                  <input type="text" placeholder="Número Celular" className="w-full p-3 bg-white border border-[#00A9E0]/10 rounded-xl text-xs font-black" value={currentConfig.plinNumber || ''} onChange={e => setCurrentConfig({...currentConfig, plinNumber: e.target.value})} />
                  <input type="text" placeholder="Nombre Titular" className="w-full p-3 bg-white border border-[#00A9E0]/10 rounded-xl text-[9px] font-black uppercase" value={currentConfig.plinName || ''} onChange={e => setCurrentConfig({...currentConfig, plinName: e.target.value})} />
               </div>
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4"><MapPin className="w-7 h-7 text-blue-500" /> Sedes de Recojo</h3>
            <div className="space-y-4">
              {(currentConfig.sedes_recojo || []).map(sede => (
                <div key={sede.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-2">
                   <div className="flex-1 space-y-2">
                     <input type="text" placeholder="NOMBRE SEDE" className="w-full p-2 bg-white border rounded-lg text-[10px] font-black uppercase" value={sede.nombre} onChange={e => updateSede(sede.id, 'nombre', e.target.value)} />
                     <input type="text" placeholder="DIRECCIÓN" className="w-full p-2 bg-white border rounded-lg text-[10px] font-bold" value={sede.direccion} onChange={e => updateSede(sede.id, 'direccion', e.target.value)} />
                   </div>
                   <button type="button" onClick={() => removeSede(sede.id)} className="p-2 text-red-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
              <button type="button" onClick={addSede} className="w-full p-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-[10px] uppercase flex items-center justify-center gap-2">
                <Plus className="w-4 h-4"/> Añadir Sede
              </button>
            </div>
          </section>
        </div>

      </div>

      {showSuccess && (
         <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-12 py-6 rounded-full shadow-2xl flex items-center gap-5">
            <CheckCircle2 className="text-brand-400 w-8 h-8"/>
            <span className="text-sm font-black uppercase tracking-widest">¡Tienda Actualizada!</span>
         </div>
      )}
    </div>
  );
};

export default StoreSettings;
