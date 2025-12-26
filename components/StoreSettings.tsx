
import React, { useState } from 'react';
// Added RotateCcw to the imports
import { Palette, ShoppingBag, QrCode, ImageIcon, Save, CheckCircle2, Globe, Tag, ExternalLink, RotateCcw } from 'lucide-react';
import { ClientConfig } from '../types';
import { saveClient } from '../services/clientManager';

interface StoreSettingsProps {
  config: ClientConfig;
  onUpdate: (newConfig: ClientConfig) => void;
}

const StoreSettings: React.FC<StoreSettingsProps> = ({ config, onUpdate }) => {
  const [currentConfig, setCurrentConfig] = useState<ClientConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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

  const copyPublicLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?shop=${currentConfig.code}`;
    navigator.clipboard.writeText(url);
    alert("Enlace copiado: " + url);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Configuración de Catálogo Digital</h2>
          <p className="text-slate-500 text-sm mt-1">Personaliza cómo tus clientes ven y compran tus productos.</p>
        </div>
        <button 
          onClick={copyPublicLink}
          className="flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-600 rounded-xl font-bold text-sm border border-brand-100 hover:bg-brand-100 transition-all"
        >
          <ExternalLink className="w-4 h-4" /> Ver Link Público
        </button>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Identidad de Marca */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Palette className="w-5 h-5 text-indigo-500" /> Identidad Visual
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Nombre Comercial de la Tienda</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-200 transition-all font-bold"
                  value={currentConfig.nombreComercial}
                  onChange={e => setCurrentConfig({...currentConfig, nombreComercial: e.target.value})}
                  placeholder="Ej: Botica Multifarmas S.A.C."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Color de Marca</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      className="w-12 h-12 rounded-xl overflow-hidden border-none p-0 cursor-pointer"
                      value={currentConfig.colorPrimario}
                      onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})}
                    />
                    <input 
                      type="text" 
                      className="flex-1 p-3.5 bg-slate-50 border-none rounded-xl text-xs font-mono"
                      value={currentConfig.colorPrimario}
                      onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">URL del Logo</label>
                  <div className="relative group">
                    <ImageIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input 
                      type="url" 
                      className="w-full pl-10 pr-3.5 py-3.5 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 text-xs"
                      value={currentConfig.logoUrl}
                      onChange={e => setCurrentConfig({...currentConfig, logoUrl: e.target.value})}
                      placeholder="https://i.imgur.com/..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-500" /> Sincronización de Productos
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900 leading-none">Estado de la Tienda</p>
                    <p className="text-[10px] text-emerald-600 mt-1 uppercase font-bold">Visible al Público</p>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={currentConfig.showStore} 
                  onChange={e => setCurrentConfig({...currentConfig, showStore: e.target.checked})}
                  className="w-6 h-6 accent-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Nombre de Categoría en Odoo</label>
                <div className="relative">
                  <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input 
                    type="text" 
                    className="w-full pl-10 pr-4 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-200 font-bold text-emerald-800"
                    value={currentConfig.tiendaCategoriaNombre}
                    onChange={e => setCurrentConfig({...currentConfig, tiendaCategoriaNombre: e.target.value})}
                    placeholder="Ej: Catalogo Digital"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-2 px-1">Solo los productos marcados con esta categoría en Odoo aparecerán en el catálogo.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Métodos de Pago */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-purple-500" /> Métodos de Pago
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4 p-5 bg-[#742d8a10] rounded-3xl border border-[#742d8a20]">
                <p className="text-[10px] font-bold text-[#742d8a] uppercase tracking-widest flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-[#742d8a]"></div> Configurar Yape
                </p>
                <input 
                  type="text" placeholder="Número Celular" 
                  className="w-full p-3 bg-white border-none rounded-xl text-sm"
                  value={currentConfig.yapeNumber}
                  onChange={e => setCurrentConfig({...currentConfig, yapeNumber: e.target.value})}
                />
                <input 
                  type="text" placeholder="URL Imagen QR" 
                  className="w-full p-3 bg-white border-none rounded-xl text-[10px]"
                  value={currentConfig.yapeQR}
                  onChange={e => setCurrentConfig({...currentConfig, yapeQR: e.target.value})}
                />
              </div>

              <div className="space-y-4 p-5 bg-[#00adef10] rounded-3xl border border-[#00adef20]">
                <p className="text-[10px] font-bold text-[#00adef] uppercase tracking-widest flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-[#00adef]"></div> Configurar Plin
                </p>
                <input 
                  type="text" placeholder="Número Celular" 
                  className="w-full p-3 bg-white border-none rounded-xl text-sm"
                  value={currentConfig.plinNumber}
                  onChange={e => setCurrentConfig({...currentConfig, plinNumber: e.target.value})}
                />
                <input 
                  type="text" placeholder="URL Imagen QR" 
                  className="w-full p-3 bg-white border-none rounded-xl text-[10px]"
                  value={currentConfig.plinQR}
                  onChange={e => setCurrentConfig({...currentConfig, plinQR: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-4">
             {showSuccess && (
               <div className="bg-emerald-50 text-emerald-700 px-6 py-4 rounded-2xl flex items-center gap-3 border border-emerald-100 animate-in zoom-in duration-300">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-bold">¡Configuración actualizada con éxito!</span>
               </div>
             )}
             
             <button 
               type="submit" 
               disabled={isSaving}
               className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-bold shadow-2xl hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-3"
             >
                {/* Fixed: Added RotateCcw to lucide-react imports */}
                {isSaving ? <RotateCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
             </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default StoreSettings;
