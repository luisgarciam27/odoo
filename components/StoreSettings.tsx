
import React, { useState, useEffect } from 'react';
import { 
  Palette, ImageIcon, Save, CheckCircle2, RotateCcw, MapPin, Plus, Trash2, 
  Sparkles, Pill, Briefcase, PawPrint, Footprints, Wallet, QrCode, Phone, 
  User, X, Globe, Share2, Info, ShieldCheck, Music2, Layers, EyeOff, Eye,
  RefreshCw, ChevronRight, Tag, AlertTriangle, Copy, Terminal, ShieldAlert, DatabaseZap,
  ExternalLink
} from 'lucide-react';
import { ClientConfig, SedeStore, BusinessType, OdooSession } from '../types';
import { saveClient } from '../services/clientManager';
import { OdooClient } from '../services/odoo';

interface StoreSettingsProps {
  config: ClientConfig;
  onUpdate: (newConfig: ClientConfig) => void;
  session?: OdooSession | null;
}

const StoreSettings: React.FC<StoreSettingsProps> = ({ config, onUpdate, session }) => {
  const [currentConfig, setCurrentConfig] = useState<ClientConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [odooCategories, setOdooCategories] = useState<{id: number, name: string}[]>([]);
  const [isLoadingCats, setIsLoadingCats] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchOdooCategories = async () => {
    if (!session && !config.url) return;
    setIsLoadingCats(true);
    try {
      const url = session?.url || config.url;
      const db = session?.db || config.db;
      const user = session?.username || config.username;
      const key = session?.apiKey || config.apiKey;

      const client = new OdooClient(url, db, true);
      const uid = session?.uid || await client.authenticate(user, key);
      
      const cats = await client.searchRead(
        uid, 
        key, 
        'product.category', 
        [], 
        ['name'], 
        { order: 'name asc' }
      );
      setOdooCategories(cats.map((c: any) => ({ id: c.id, name: c.name })));
    } catch (e) {
      console.error("Error al traer categorías", e);
    } finally {
      setIsLoadingCats(false);
    }
  };

  useEffect(() => {
    fetchOdooCategories();
  }, [session, config.code]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);
    const result = await saveClient(currentConfig, false);
    if (result.success) {
      onUpdate(currentConfig);
      setShowSuccess(true);
      if (result.message) {
          setErrorMessage(result.message);
      }
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
NOTIFY pgrst, 'reload schema';`;
    navigator.clipboard.writeText(sql);
    alert("Script SQL copiado. Pégalo en el SQL Editor de Supabase y ejecútalo para habilitar todas las funciones.");
  };

  const toggleCategoryVisibility = (catName: string) => {
    const hidden = currentConfig.hiddenCategories || [];
    if (hidden.includes(catName)) {
      setCurrentConfig({...currentConfig, hiddenCategories: hidden.filter(c => c !== catName)});
    } else {
      setCurrentConfig({...currentConfig, hiddenCategories: [...hidden, catName]});
    }
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
        <div className={`p-8 rounded-[3rem] border-4 flex flex-col md:flex-row items-center gap-8 shadow-2xl animate-in zoom-in-95 ${errorMessage.includes('compatibilidad') || errorMessage.includes('Modo Básico') ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
           <div className={`p-4 rounded-3xl ${errorMessage.includes('compatibilidad') ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
             {errorMessage.includes('compatibilidad') ? <DatabaseZap className="w-12 h-12 shrink-0 animate-pulse" /> : <ShieldAlert className="w-12 h-12 shrink-0" />}
           </div>
           <div className="flex-1 text-center md:text-left space-y-2">
             <h4 className="font-black uppercase text-lg tracking-tight">Aviso de Configuración</h4>
             <p className="text-sm font-bold leading-relaxed opacity-80">{errorMessage}</p>
             <div className="flex flex-wrap gap-4 pt-4">
                <button onClick={copyFixSQL} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase flex items-center gap-3 hover:bg-black transition-all shadow-lg">
                  <Terminal className="w-4 h-4" /> Copiar Script de Reparación SQL
                </button>
                <button onClick={() => window.open('https://app.supabase.com', '_blank')} className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl text-[11px] font-black uppercase flex items-center gap-3 hover:bg-slate-50 transition-all">
                  Ir a Supabase <ExternalLink className="w-4 h-4" />
                </button>
             </div>
           </div>
           <button onClick={() => setErrorMessage(null)} className="p-3 hover:bg-black/5 rounded-full"><X className="w-6 h-6"/></button>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Gestión de Tienda</h2>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
             <Sparkles className="w-4 h-4 text-brand-500"/> Personalización Avanzada Lemon BI
          </p>
        </div>
        <div className="flex gap-4">
          <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-12 py-6 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:brightness-110 transition-all flex items-center gap-4 disabled:opacity-50"
              style={{backgroundColor: brandColor}}
          >
              {isSaving ? <RotateCcw className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
              Guardar Configuración
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="space-y-8">
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-4">
                <Layers className="w-7 h-7 text-brand-500" /> Categorías
              </h3>
              <button type="button" onClick={fetchOdooCategories} className="px-5 py-2.5 bg-brand-50 text-brand-600 rounded-2xl flex items-center gap-3 hover:bg-brand-100 transition-all font-black text-[10px] uppercase tracking-widest">
                <RefreshCw className={`w-4 h-4 ${isLoadingCats ? 'animate-spin' : ''}`} /> Sincronizar
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                Selecciona qué categorías de Odoo serán visibles para tus clientes en la navegación de la tienda.
              </p>
              <div className="max-h-80 overflow-y-auto space-y-2 pr-3 custom-scrollbar border-2 border-slate-50 rounded-[2rem] p-4 bg-slate-50/30">
                {odooCategories.length === 0 && !isLoadingCats && (
                  <div className="text-center py-16 opacity-30 flex flex-col items-center gap-4">
                    <Tag className="w-12 h-12" />
                    <p className="text-[11px] font-black uppercase tracking-widest">Presiona Sincronizar Odoo</p>
                  </div>
                )}
                {odooCategories.map(cat => {
                  const isHidden = (currentConfig.hiddenCategories || []).includes(cat.name);
                  return (
                    <div key={cat.id} className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${isHidden ? 'bg-white border-slate-100 opacity-50' : 'bg-white border-slate-200 shadow-sm hover:border-brand-300 active:scale-[0.98]'}`}>
                      <span className={`text-[12px] font-black uppercase tracking-tight ${isHidden ? 'text-slate-400' : 'text-slate-900'}`}>{cat.name}</span>
                      <button 
                        type="button" 
                        onClick={() => toggleCategoryVisibility(cat.name)} 
                        className={`p-3 rounded-xl transition-all shadow-sm ${isHidden ? 'bg-slate-100 text-slate-400' : 'bg-brand-500 text-white shadow-brand-200'}`}
                      >
                        {isHidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4">
              <Phone className="w-7 h-7 text-emerald-500" /> Comunicación
            </h3>
            <div className="space-y-5">
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">WhatsApp de Pedidos</label>
                <input type="text" placeholder="Ej: 51987654321" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-brand-500/10" value={currentConfig.whatsappNumbers || ''} onChange={e => setCurrentConfig({...currentConfig, whatsappNumbers: e.target.value})} />
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4">
              <Palette className="w-7 h-7 text-indigo-500"/> Personalización
            </h3>
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nombre Comercial</label>
                <input type="text" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black uppercase text-sm outline-none focus:ring-4 focus:ring-brand-500/10" value={currentConfig.nombreComercial || ''} onChange={e => setCurrentConfig({...currentConfig, nombreComercial: e.target.value})} />
              </div>
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Color Corporativo</label>
                <div className="flex items-center gap-6 p-2 bg-slate-50 rounded-3xl border border-slate-100">
                    <input type="color" className="w-20 h-14 rounded-2xl cursor-pointer border-none bg-transparent" value={currentConfig.colorPrimario || '#84cc16'} onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})} />
                    <span className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest">{currentConfig.colorPrimario || '#84CC16'}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4">
              <MapPin className="w-7 h-7 text-blue-500" /> Puntos de Recojo
            </h3>
            <div className="space-y-4">
              {(currentConfig.sedes_recojo || []).map(sede => (
                <div key={sede.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex gap-5 animate-in slide-in-from-right">
                   <div className="flex-1 space-y-3">
                     <input type="text" placeholder="NOMBRE SEDE" className="w-full p-3 bg-white border border-slate-100 rounded-xl text-[11px] font-black uppercase tracking-widest outline-none" value={sede.nombre} onChange={e => updateSede(sede.id, 'nombre', e.target.value)} />
                     <input type="text" placeholder="DIRECCIÓN" className="w-full p-3 bg-white border border-slate-100 rounded-xl text-[11px] font-bold outline-none" value={sede.direccion} onChange={e => updateSede(sede.id, 'direccion', e.target.value)} />
                   </div>
                   <button type="button" onClick={() => removeSede(sede.id)} className="p-3 text-red-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
                </div>
              ))}
              <button type="button" onClick={addSede} className="w-full p-6 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-black text-[10px] uppercase tracking-widest hover:border-blue-300 hover:text-blue-600 transition-all flex items-center justify-center gap-3 active:scale-[0.98]">
                <Plus className="w-5 h-5"/> Añadir Nueva Sede
              </button>
            </div>
          </section>
        </div>

        <div className="space-y-8">
           <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-4">
              <Wallet className="w-7 h-7 text-brand-600" /> Cobros Digitales
            </h3>
            <div className="space-y-6">
               <div className="p-8 bg-[#742284]/5 rounded-[2.5rem] border-2 border-[#742284]/10 space-y-5 shadow-inner">
                  <div className="flex items-center gap-3 mb-2">
                     <div className="w-10 h-10 bg-[#742284] rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-[#742284]/20">Y</div>
                     <span className="text-[11px] font-black uppercase tracking-widest text-[#742284]">Configurar Yape</span>
                  </div>
                  <input type="text" placeholder="Número Celular" className="w-full p-4 bg-white border border-[#742284]/10 rounded-2xl text-xs font-black outline-none focus:ring-4 focus:ring-[#742284]/10" value={currentConfig.yapeNumber || ''} onChange={e => setCurrentConfig({...currentConfig, yapeNumber: e.target.value})} />
                  <input type="text" placeholder="Nombre Titular" className="w-full p-4 bg-white border border-[#742284]/10 rounded-2xl text-[10px] font-black uppercase outline-none" value={currentConfig.yapeName || ''} onChange={e => setCurrentConfig({...currentConfig, yapeName: e.target.value})} />
               </div>
               
               <div className="p-8 bg-[#00A9E0]/5 rounded-[2.5rem] border-2 border-[#00A9E0]/10 space-y-5 shadow-inner">
                  <div className="flex items-center gap-3 mb-2">
                     <div className="w-10 h-10 bg-[#00A9E0] rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-[#00A9E0]/20">P</div>
                     <span className="text-[11px] font-black uppercase tracking-widest text-[#00A9E0]">Configurar Plin</span>
                  </div>
                  <input type="text" placeholder="Número Celular" className="w-full p-4 bg-white border border-[#00A9E0]/10 rounded-2xl text-xs font-black outline-none focus:ring-4 focus:ring-[#00A9E0]/10" value={currentConfig.plinNumber || ''} onChange={e => setCurrentConfig({...currentConfig, plinNumber: e.target.value})} />
                  <input type="text" placeholder="Nombre Titular" className="w-full p-4 bg-white border border-[#00A9E0]/10 rounded-2xl text-[10px] font-black uppercase outline-none" value={currentConfig.plinName || ''} onChange={e => setCurrentConfig({...currentConfig, plinName: e.target.value})} />
               </div>
            </div>
          </section>
        </div>
      </div>

      {showSuccess && (
         <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-12 py-6 rounded-full shadow-2xl animate-in slide-in-from-top-12 flex items-center gap-5 border border-white/10">
            <CheckCircle2 className="text-brand-400 w-8 h-8"/>
            <span className="text-sm font-black uppercase tracking-widest">¡Guardado Exitosamente!</span>
         </div>
      )}
    </div>
  );
};

export default StoreSettings;
