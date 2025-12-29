
import React, { useState, useEffect } from 'react';
import { 
  Palette, ImageIcon, Save, CheckCircle2, RotateCcw, MapPin, Plus, Trash2, 
  Sparkles, Pill, Briefcase, PawPrint, Footprints, Wallet, QrCode, Phone, 
  User, X, Globe, Share2, Info, ShieldCheck, Music2, Layers, EyeOff, Eye,
  RefreshCw, ChevronRight, Tag, AlertTriangle, Copy, Terminal, ShieldAlert
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
          setErrorMessage(result.message); // Usar para mostrar advertencia de compatibilidad
      }
      setTimeout(() => setShowSuccess(false), 3000);
    } else {
      setErrorMessage(result.message || "Error al guardar");
    }
    setIsSaving(false);
  };

  // Fix: Corrected navigator.clipboard.WriteText to writeText lowercase
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
NOTIFY pgrst, 'reload schema';`;
    navigator.clipboard.writeText(sql);
    alert("Script SQL copiado. Pégalo en el SQL Editor de Supabase y ejecútalo.");
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
        <div className={`p-6 rounded-[2rem] border-2 flex items-center gap-6 shadow-xl animate-in slide-in-from-top-4 ${errorMessage.includes('Compatibilidad') ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
           {/* Fix: Added ShieldAlert to lucide-react imports and resolved name error on line 128 */}
           {errorMessage.includes('Compatibilidad') ? <AlertTriangle className="w-10 h-10 shrink-0" /> : <ShieldAlert className="w-10 h-10 shrink-0" />}
           <div className="flex-1">
             <h4 className="font-black uppercase text-sm tracking-tight">{errorMessage.includes('Compatibilidad') ? 'Aviso de Actualización' : 'Error de Conexión'}</h4>
             <p className="text-xs font-bold leading-relaxed">{errorMessage}</p>
             {errorMessage.includes('Falta la columna') && (
               <button onClick={copyFixSQL} className="mt-3 px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-black transition-all">
                 <Terminal className="w-3.5 h-3.5" /> Copiar Script para arreglar Supabase
               </button>
             )}
           </div>
           <button onClick={() => setErrorMessage(null)} className="p-2 hover:bg-black/5 rounded-full"><X className="w-5 h-5"/></button>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Panel de Marca</h2>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
             <Sparkles className="w-4 h-4 text-brand-500"/> Personalización de Experiencia de Cliente
          </p>
        </div>
        <div className="flex gap-4">
          <button onClick={copyFixSQL} className="p-5 bg-slate-100 text-slate-400 rounded-[2rem] hover:bg-slate-200 transition-all" title="Copiar SQL de reparación">
            <Copy className="w-5 h-5" />
          </button>
          <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-10 py-5 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:brightness-110 transition-all flex items-center gap-3 disabled:opacity-50"
              style={{backgroundColor: brandColor}}
          >
              {isSaving ? <RotateCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Guardar Configuración
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="space-y-8">
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <Layers className="w-6 h-6 text-brand-500" /> Categorías de la Tienda
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizado con Odoo</p>
                <button type="button" onClick={fetchOdooCategories} className="px-4 py-2 bg-brand-50 text-brand-600 rounded-xl flex items-center gap-2 hover:bg-brand-100 transition-all font-black text-[9px] uppercase tracking-widest">
                  <RefreshCw className={`w-3 h-3 ${isLoadingCats ? 'animate-spin' : ''}`} /> Sincronizar
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar border-2 border-slate-50 rounded-2xl p-2">
                {odooCategories.length === 0 && !isLoadingCats && (
                  <div className="text-center py-10 opacity-30 flex flex-col items-center gap-3">
                    <Tag className="w-10 h-10" />
                    <p className="text-[10px] font-black uppercase">Presiona Sincronizar</p>
                  </div>
                )}
                {odooCategories.map(cat => {
                  const isHidden = (currentConfig.hiddenCategories || []).includes(cat.name);
                  return (
                    <div key={cat.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isHidden ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm hover:border-brand-300'}`}>
                      <span className={`text-[11px] font-black uppercase ${isHidden ? 'text-slate-400' : 'text-slate-800'}`}>{cat.name}</span>
                      <button type="button" onClick={() => toggleCategoryVisibility(cat.name)} className={`p-2.5 rounded-xl transition-all ${isHidden ? 'bg-slate-200 text-slate-500' : 'bg-brand-500 text-white shadow-lg shadow-brand-200'}`}>
                        {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <Phone className="w-6 h-6 text-emerald-500" /> Canales de Pedidos
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp Principal</label>
                <input type="text" placeholder="Ej: 51987654321" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" value={currentConfig.whatsappNumbers || ''} onChange={e => setCurrentConfig({...currentConfig, whatsappNumbers: e.target.value})} />
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <Palette className="w-6 h-6 text-indigo-500"/> Branding
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Comercial</label>
                <input type="text" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black uppercase text-sm outline-none" value={currentConfig.nombreComercial || ''} onChange={e => setCurrentConfig({...currentConfig, nombreComercial: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Color de Marca</label>
                <input type="color" className="w-full h-12 p-1 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer" value={currentConfig.colorPrimario || '#84cc16'} onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})} />
              </div>
            </div>
          </section>

          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <MapPin className="w-6 h-6 text-blue-500" /> Sedes de Recojo
            </h3>
            <div className="space-y-4">
              {(currentConfig.sedes_recojo || []).map(sede => (
                <div key={sede.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4 animate-in slide-in-from-right">
                   <div className="flex-1 space-y-2">
                     <input type="text" placeholder="NOMBRE SEDE" className="w-full p-2 bg-white border border-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest outline-none" value={sede.nombre} onChange={e => updateSede(sede.id, 'nombre', e.target.value)} />
                     <input type="text" placeholder="DIRECCIÓN" className="w-full p-2 bg-white border border-slate-100 rounded-lg text-[10px] font-bold outline-none" value={sede.direccion} onChange={e => updateSede(sede.id, 'direccion', e.target.value)} />
                   </div>
                   <button type="button" onClick={() => removeSede(sede.id)} className="p-2 text-red-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
              <button type="button" onClick={addSede} className="w-full p-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-[9px] uppercase tracking-widest hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4"/> Añadir Sede
              </button>
            </div>
          </section>
        </div>

        <div className="space-y-8">
           <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <Wallet className="w-6 h-6 text-brand-600" /> Pagos Digitales
            </h3>
            <div className="space-y-6">
               <div className="p-6 bg-[#742284]/5 rounded-3xl border border-[#742284]/10 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                     <div className="w-8 h-8 bg-[#742284] rounded-lg flex items-center justify-center text-white font-black text-xs">Y</div>
                     <span className="text-[10px] font-black uppercase text-[#742284]">Yape</span>
                  </div>
                  <input type="text" placeholder="Número" className="w-full p-3 bg-white border border-[#742284]/10 rounded-xl text-xs font-bold" value={currentConfig.yapeNumber || ''} onChange={e => setCurrentConfig({...currentConfig, yapeNumber: e.target.value})} />
               </div>
               <div className="p-6 bg-[#00A9E0]/5 rounded-3xl border border-[#00A9E0]/10 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                     <div className="w-8 h-8 bg-[#00A9E0] rounded-lg flex items-center justify-center text-white font-black text-xs">P</div>
                     <span className="text-[10px] font-black uppercase text-[#00A9E0]">Plin</span>
                  </div>
                  <input type="text" placeholder="Número" className="w-full p-3 bg-white border border-[#00A9E0]/10 rounded-xl text-xs font-bold" value={currentConfig.plinNumber || ''} onChange={e => setCurrentConfig({...currentConfig, plinNumber: e.target.value})} />
               </div>
            </div>
          </section>
        </div>
      </div>

      {showSuccess && (
         <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-10 py-5 rounded-full shadow-2xl animate-in slide-in-from-top-10 flex items-center gap-4">
            <CheckCircle2 className="text-brand-400 w-6 h-6"/>
            <span className="text-xs font-black uppercase tracking-widest">¡Guardado Correctamente!</span>
         </div>
      )}
    </div>
  );
};

export default StoreSettings;
