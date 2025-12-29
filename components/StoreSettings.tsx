
import React, { useState } from 'react';
import { 
  Palette, Save, CheckCircle2, MapPin, Plus, Trash2, 
  Wallet, X, Facebook, Instagram, MessageCircle,
  RefreshCw, Share2, QrCode, Upload, Smartphone,
  ImageIcon, Paintbrush, Citrus, Layers, User, Link as LinkIcon, 
  ExternalLink, Globe, ShoppingCart
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

  const addSede = () => {
    const newSede: SedeStore = { id: Date.now().toString(), nombre: '', direccion: '', googleMapsUrl: '' };
    setCurrentConfig({ ...currentConfig, sedes_recojo: [...(currentConfig.sedes_recojo || []), newSede] });
  };

  const removeSede = (id: string) => {
    setCurrentConfig({ ...currentConfig, sedes_recojo: (currentConfig.sedes_recojo || []).filter(s => s.id !== id) });
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
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Personalización Visual y Logística</p>
           </div>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving} 
          className="px-12 py-6 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl flex items-center gap-4 transition-all hover:scale-105 active:scale-95" 
          style={{backgroundColor: brandColor}}
        >
          {isSaving ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} Guardar Cambios
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* COLUMNA IZQUIERDA: DISEÑO Y PAGOS */}
        <div className="lg:col-span-8 space-y-10">
          
          {/* SEDES DE RECOJO */}
          <section className="bg-white p-10 md:p-14 rounded-[4rem] shadow-xl border border-slate-100">
             <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter">
                   <MapPin className="w-8 h-8 text-red-500"/> Sedes de Recojo
                </h3>
                <button onClick={addSede} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-brand-500 transition-all">
                   <Plus className="w-4 h-4"/> Nueva Sede
                </button>
             </div>
             
             <div className="space-y-6">
                {(currentConfig.sedes_recojo || []).length === 0 ? (
                   <div className="py-12 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center flex flex-col items-center gap-3">
                      <MapPin className="w-12 h-12 text-slate-200" />
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">No has configurado locales de recojo</p>
                   </div>
                ) : (
                   currentConfig.sedes_recojo?.map((sede, idx) => (
                      <div key={sede.id} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 group">
                         <div className="flex justify-between items-start mb-6">
                            <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Sede #{idx + 1}</span>
                            <button onClick={() => removeSede(sede.id)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4"/></button>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input 
                               type="text" 
                               placeholder="NOMBRE DEL LOCAL (EJ: SUCURSAL NORTE)" 
                               className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-brand-500/10"
                               value={sede.nombre}
                               onChange={e => {
                                  const sedes = [...(currentConfig.sedes_recojo || [])];
                                  sedes[idx].nombre = e.target.value;
                                  setCurrentConfig({...currentConfig, sedes_recojo: sedes});
                               }}
                            />
                            <input 
                               type="text" 
                               placeholder="DIRECCIÓN FÍSICA" 
                               className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-brand-500/10"
                               value={sede.direccion}
                               onChange={e => {
                                  const sedes = [...(currentConfig.sedes_recojo || [])];
                                  sedes[idx].direccion = e.target.value;
                                  setCurrentConfig({...currentConfig, sedes_recojo: sedes});
                               }}
                            />
                            <div className="md:col-span-2 relative">
                               <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"/>
                               <input 
                                  type="text" 
                                  placeholder="LINK DE GOOGLE MAPS" 
                                  className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-brand-500/10"
                                  value={sede.googleMapsUrl || ''}
                                  onChange={e => {
                                     const sedes = [...(currentConfig.sedes_recojo || [])];
                                     sedes[idx].googleMapsUrl = e.target.value;
                                     setCurrentConfig({...currentConfig, sedes_recojo: sedes});
                                  }}
                               />
                            </div>
                         </div>
                      </div>
                   ))
                )}
             </div>
          </section>

          {/* LOGOS E IDENTIDAD */}
          <section className="bg-white p-10 md:p-14 rounded-[4rem] shadow-xl border border-slate-100">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-5 uppercase tracking-tighter mb-12">
              <ImageIcon className="w-8 h-8 text-brand-500"/> Logotipos y Colores
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
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo Footer</label>
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
            
            <div className="mt-12 pt-10 border-t grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="p-6 bg-slate-50 rounded-3xl flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Color Primario</span>
                  <input type="color" className="w-14 h-14 rounded-2xl cursor-pointer border-4 border-white shadow-lg" value={currentConfig.colorPrimario || '#84cc16'} onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})} />
               </div>
               <div className="p-6 bg-slate-50 rounded-3xl flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Color del Footer</span>
                  <input type="color" className="w-14 h-14 rounded-2xl cursor-pointer border-4 border-white shadow-lg" value={currentConfig.colorSecundario || '#1e293b'} onChange={e => setCurrentConfig({...currentConfig, colorSecundario: e.target.value})} />
               </div>
            </div>
          </section>

          {/* PAGOS QR */}
          <section className="bg-white p-10 md:p-14 rounded-[4rem] shadow-xl border border-slate-100 space-y-12">
             <h3 className="text-2xl font-black text-slate-800 flex items-center gap-5 uppercase tracking-tighter">
                <Wallet className="w-8 h-8 text-purple-600"/> Pasarelas de Pago
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                   <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-2xl border border-purple-100">
                      <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white font-black text-lg">Y</div>
                      <p className="text-[11px] font-black uppercase text-purple-900">Configuración Yape</p>
                   </div>
                   <input type="text" placeholder="TITULAR YAPE" className="w-full p-4 border rounded-xl text-xs font-bold uppercase" value={currentConfig.yapeName || ''} onChange={e => setCurrentConfig({...currentConfig, yapeName: e.target.value})} />
                   <input type="tel" placeholder="NÚMERO YAPE" className="w-full p-4 border rounded-xl text-xs font-bold" value={currentConfig.yapeNumber || ''} onChange={e => setCurrentConfig({...currentConfig, yapeNumber: e.target.value})} />
                   <div className="relative aspect-square bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center p-4 overflow-hidden group">
                      {currentConfig.yapeQR ? <img src={currentConfig.yapeQR} className="max-h-full" /> : <QrCode className="w-12 h-12 text-slate-200"/>}
                      <label className="absolute inset-0 bg-purple-600/90 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all">
                        <Upload className="text-white w-8 h-8 mb-2 animate-bounce"/>
                        <span className="text-[10px] font-black text-white uppercase">Cargar QR</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('yapeQR')} />
                      </label>
                   </div>
                </div>
                <div className="space-y-6">
                   <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg">P</div>
                      <p className="text-[11px] font-black uppercase text-blue-900">Configuración Plin</p>
                   </div>
                   <input type="text" placeholder="TITULAR PLIN" className="w-full p-4 border rounded-xl text-xs font-bold uppercase" value={currentConfig.plinName || ''} onChange={e => setCurrentConfig({...currentConfig, plinName: e.target.value})} />
                   <input type="tel" placeholder="NÚMERO PLIN" className="w-full p-4 border rounded-xl text-xs font-bold" value={currentConfig.plinNumber || ''} onChange={e => setCurrentConfig({...currentConfig, plinNumber: e.target.value})} />
                   <div className="relative aspect-square bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center p-4 overflow-hidden group">
                      {currentConfig.plinQR ? <img src={currentConfig.plinQR} className="max-h-full" /> : <QrCode className="w-12 h-12 text-slate-200"/>}
                      <label className="absolute inset-0 bg-blue-600/90 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all">
                        <Upload className="text-white w-8 h-8 mb-2 animate-bounce"/>
                        <span className="text-[10px] font-black text-white uppercase">Cargar QR</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('plinQR')} />
                      </label>
                   </div>
                </div>
             </div>
          </section>
        </div>

        {/* COLUMNA DERECHA: CONTACTO */}
        <div className="lg:col-span-4 space-y-10">
           <section className="bg-white p-10 rounded-[4rem] shadow-xl border border-slate-100 space-y-8">
             <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter">
               <Share2 className="w-7 h-7 text-blue-500"/> Redes y Enlaces
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
                      <label className="block text-[10px] font-black text-brand-600 uppercase tracking-widest mb-2 ml-4">WhatsApp para Recibir Pedidos</label>
                      <div className="relative">
                         <ShoppingCart className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-500"/>
                         <input type="text" placeholder="CELULAR PARA VENTAS" className="w-full pl-14 pr-5 py-5 bg-brand-50 border border-brand-100 rounded-[1.5rem] text-[11px] font-bold outline-none" value={currentConfig.whatsappNumbers || ''} onChange={e => setCurrentConfig({...currentConfig, whatsappNumbers: e.target.value})} />
                      </div>
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 ml-4">WhatsApp de Ayuda (Footer)</label>
                      <div className="relative">
                         <MessageCircle className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500"/>
                         <input type="text" placeholder="CELULAR DE SOPORTE" className="w-full pl-14 pr-5 py-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-[11px] font-bold outline-none" value={currentConfig.whatsappHelpNumber || ''} onChange={e => setCurrentConfig({...currentConfig, whatsappHelpNumber: e.target.value})} />
                      </div>
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
         <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-12 py-6 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-12">
            <CheckCircle2 className="w-6 h-6 text-brand-400"/>
            <span className="text-[10px] font-black uppercase tracking-widest">¡Configuración Guardada!</span>
         </div>
      )}
    </div>
  );
};

export default StoreSettings;
