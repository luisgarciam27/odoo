
import React, { useState } from 'react';
import { 
  Palette, Save, CheckCircle2, RotateCcw, MapPin, Plus, Trash2, 
  Sparkles, Wallet, Phone, X, Facebook, Instagram, MessageCircle,
  RefreshCw, Share2, LayoutPanelTop, QrCode, Upload, Smartphone, AlertCircle,
  Eye, Image as ImageIcon, Paintbrush, Footprints, Layout, AlignLeft, Citrus,
  Video, Layers, User, Tag, Link as LinkIcon, MonitorPlay, Copy, ExternalLink,
  Globe, CreditCard, ShoppingCart
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
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Diseño, Pagos y Contacto</p>
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
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Tienda Online Activa</h3>
               </div>
               <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest max-w-md">Comparte este enlace con tus clientes para que puedan realizar pedidos por WhatsApp.</p>
            </div>
            <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4">
               <div className="bg-white/5 backdrop-blur-md px-8 py-5 rounded-[2rem] border border-white/10 flex items-center gap-6 group/link min-w-[300px]">
                  <div className="flex flex-col">
                     <span className="text-[9px] font-black text-brand-500 uppercase tracking-widest mb-1">Enlace Público</span>
                     <span className="text-white font-mono text-xs truncate max-w-[200px]">{storeUrl}</span>
                  </div>
                  <button onClick={handleCopyUrl} className={`ml-auto p-3 rounded-xl transition-all ${copyStatus ? 'bg-brand-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white hover:text-slate-900'}`}>
                    {copyStatus ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
               </div>
            </div>
         </div>
      </section>

      {/* CONFIGURACIÓN DE PAGOS */}
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
           {/* YAPE */}
           <div className="space-y-8 p-10 bg-purple-50/50 rounded-[3.5rem] border border-purple-100 group">
              <div className="flex items-center gap-4 mb-4">
                 <div className="w-14 h-14 bg-purple-600 rounded-[1.5rem] flex items-center justify-center text-white font-black text-xl shadow-xl shadow-purple-600/20">Y</div>
                 <h4 className="text-lg font-black text-purple-900 uppercase tracking-tighter">Cuenta Yape</h4>
              </div>
              <div className="space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-purple-900 uppercase tracking-widest block mb-2 ml-4">Nombre del Titular</label>
                    <div className="relative">
                       <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300"/>
                       <input type="text" placeholder="NOMBRE COMPLETO" className="w-full pl-14 pr-6 py-5 bg-white border border-purple-100 rounded-[1.5rem] text-[11px] font-bold uppercase outline-none focus:ring-4 focus:ring-purple-200/50" value={currentConfig.yapeName || ''} onChange={e => setCurrentConfig({...currentConfig, yapeName: e.target.value})} />
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-purple-900 uppercase tracking-widest block mb-2 ml-4">Número de Celular</label>
                    <div className="relative">
                       <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300"/>
                       <input type="tel" placeholder="9 DÍGITOS" className="w-full pl-14 pr-6 py-5 bg-white border border-purple-100 rounded-[1.5rem] text-[11px] font-bold outline-none focus:ring-4 focus:ring-purple-200/50" value={currentConfig.yapeNumber || ''} onChange={e => setCurrentConfig({...currentConfig, yapeNumber: e.target.value})} />
                    </div>
                 </div>
                 <div className="relative aspect-square bg-white rounded-[2.5rem] border border-dashed border-purple-200 flex items-center justify-center p-8 overflow-hidden shadow-inner">
                    {currentConfig.yapeQR ? <img src={currentConfig.yapeQR} className="w-full h-full object-contain" /> : <QrCode className="w-16 h-16 text-purple-100" />}
                    <label className="absolute inset-0 bg-purple-600/90 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all">
                       <Upload className="text-white w-10 h-10 mb-2 animate-bounce"/>
                       <span className="text-[10px] font-black text-white uppercase tracking-widest">Actualizar QR Yape</span>
                       <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('yapeQR')} />
                    </label>
                 </div>
              </div>
           </div>

           {/* PLIN */}
           <div className="space-y-8 p-10 bg-blue-50/50 rounded-[3.5rem] border border-blue-100 group">
              <div className="flex items-center gap-4 mb-4">
                 <div className="w-14 h-14 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white font-black text-xl shadow-xl shadow-blue-600/20">P</div>
                 <h4 className="text-lg font-black text-blue-900 uppercase tracking-tighter">Cuenta Plin</h4>
              </div>
              <div className="space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest block mb-2 ml-4">Nombre del Titular</label>
                    <div className="relative">
                       <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300"/>
                       <input type="text" placeholder="NOMBRE COMPLETO" className="w-full pl-14 pr-6 py-5 bg-white border border-blue-100 rounded-[1.5rem] text-[11px] font-bold uppercase outline-none focus:ring-4 focus:ring-blue-200/50" value={currentConfig.plinName || ''} onChange={e => setCurrentConfig({...currentConfig, plinName: e.target.value})} />
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest block mb-2 ml-4">Número de Celular</label>
                    <div className="relative">
                       <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300"/>
                       <input type="tel" placeholder="9 DÍGITOS" className="w-full pl-14 pr-6 py-5 bg-white border border-blue-100 rounded-[1.5rem] text-[11px] font-bold outline-none focus:ring-4 focus:ring-blue-200/50" value={currentConfig.plinNumber || ''} onChange={e => setCurrentConfig({...currentConfig, plinNumber: e.target.value})} />
                    </div>
                 </div>
                 <div className="relative aspect-square bg-white rounded-[2.5rem] border border-dashed border-blue-200 flex items-center justify-center p-8 overflow-hidden shadow-inner">
                    {currentConfig.plinQR ? <img src={currentConfig.plinQR} className="w-full h-full object-contain" /> : <QrCode className="w-16 h-16 text-blue-100" />}
                    <label className="absolute inset-0 bg-blue-600/90 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all">
                       <Upload className="text-white w-10 h-10 mb-2 animate-bounce"/>
                       <span className="text-[10px] font-black text-white uppercase tracking-widest">Actualizar QR Plin</span>
                       <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload('plinQR')} />
                    </label>
                 </div>
              </div>
           </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* IDENTIDAD VISUAL */}
        <div className="lg:col-span-8 space-y-10">
          <section className="bg-white p-10 md:p-14 rounded-[4rem] shadow-xl border border-slate-100">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-5 uppercase tracking-tighter mb-12">
              <ImageIcon className="w-8 h-8 text-brand-500"/> Logotipos e Identidad
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
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo Inferior (Footer)</label>
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
        </div>

        {/* CONTACTO Y REDES */}
        <div className="lg:col-span-4 space-y-10">
           <section className="bg-white p-10 rounded-[4rem] shadow-xl border border-slate-100 space-y-8">
             <h3 className="text-xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter">
               <Share2 className="w-7 h-7 text-blue-500"/> Contacto y Redes
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
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Frase / Lema del Footer</label>
                    <textarea 
                        className="w-full p-6 bg-slate-50 rounded-[2rem] text-[10px] font-bold uppercase outline-none shadow-inner resize-none h-32"
                        placeholder="Brindando bienestar y salud en cada pedido..."
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
            <span className="text-[10px] font-black uppercase tracking-widest">¡Tienda Actualizada!</span>
         </div>
      )}
    </div>
  );
};

export default StoreSettings;
