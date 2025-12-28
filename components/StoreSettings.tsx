
import React, { useState } from 'react';
import { 
  Palette, ImageIcon, Save, CheckCircle2, RotateCcw, MapPin, Plus, Trash2, 
  Sparkles, Pill, Briefcase, PawPrint, Footprints, Wallet, QrCode, Phone, 
  User, X, Globe, Share2, Info, ShieldCheck
} from 'lucide-react';
import { ClientConfig, SedeStore, BusinessType } from '../types';
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
    }
    setIsSaving(false);
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
  const accentColor = currentConfig.colorAcento || '#0ea5e9';

  const ImageInput = ({ label, value, onChange, placeholder, icon: Icon }: any) => (
    <div className="space-y-3">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
        <Icon className="w-3 h-3"/> {label}
      </label>
      <div className="flex gap-4 items-start">
        <div className="relative group w-20 h-20 shrink-0">
          <div className="w-full h-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden transition-all group-hover:border-brand-500">
            {value ? (
              <img src={value} className="w-full h-full object-contain" alt="Preview"/>
            ) : (
              <ImageIcon className="w-6 h-6 text-slate-200"/>
            )}
          </div>
          {value && (
            <button 
              type="button"
              onClick={() => onChange('')}
              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
            >
              <X className="w-3 h-3"/>
            </button>
          )}
        </div>
        <input 
          type="text" 
          placeholder={placeholder} 
          className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-brand-500 shadow-inner" 
          value={value} 
          onChange={e => onChange(e.target.value)} 
        />
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 pb-32">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Panel de Marca</h2>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
             <Sparkles className="w-4 h-4 text-brand-500"/> Personalización de Experiencia de Cliente
          </p>
        </div>
        <button 
            onClick={handleSave}
            className="px-10 py-5 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:brightness-110 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 relative overflow-hidden group"
            style={{backgroundColor: brandColor}}
        >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            {isSaving ? <RotateCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Guardar Configuración Premium
        </button>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* COLUMNA 1: GIRO Y CONTACTO */}
        <div className="space-y-8">
          <section className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50"></div>
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3 relative z-10">
              <Briefcase className="w-6 h-6 text-brand-500" /> Giro de Negocio
            </h3>
            <div className="grid grid-cols-3 gap-4 relative z-10">
               {[
                 {id: 'pharmacy', icon: Pill, label: 'Farmacia'},
                 {id: 'veterinary', icon: PawPrint, label: 'Veterinaria'},
                 {id: 'podiatry', icon: Footprints, label: 'Podología'}
               ].map(type => (
                 <button 
                  key={type.id} type="button" 
                  onClick={() => setCurrentConfig({...currentConfig, businessType: type.id as BusinessType})}
                  className={`flex flex-col items-center gap-3 p-6 rounded-[2.5rem] border-2 transition-all ${currentConfig.businessType === type.id ? 'border-brand-500 bg-brand-50 shadow-xl' : 'border-slate-50 bg-white hover:border-slate-200'}`}
                 >
                   <type.icon className={`w-7 h-7 ${currentConfig.businessType === type.id ? 'text-brand-600' : 'text-slate-300'}`} />
                   <span className="text-[9px] font-black uppercase tracking-tighter text-center">{type.label}</span>
                 </button>
               ))}
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 space-y-8">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <Phone className="w-6 h-6 text-emerald-500" /> Canales de Atención
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Números de WhatsApp (Empresa)</label>
                <input type="text" placeholder="Ej: 51987654321, 51912345678" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500" value={currentConfig.whatsappNumbers} onChange={e => setCurrentConfig({...currentConfig, whatsappNumbers: e.target.value})} />
                <p className="text-[8px] text-slate-400 font-bold uppercase italic">Separados por coma. Incluye código de país.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Facebook URL</label>
                    <input type="text" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px]" value={currentConfig.facebook_url} onChange={e => setCurrentConfig({...currentConfig, facebook_url: e.target.value})} />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Instagram URL</label>
                    <input type="text" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px]" value={currentConfig.instagram_url} onChange={e => setCurrentConfig({...currentConfig, instagram_url: e.target.value})} />
                 </div>
              </div>
            </div>
          </section>
        </div>

        {/* COLUMNA 2: IDENTIDAD Y SEDES */}
        <div className="space-y-8">
          <section className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 space-y-8">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <Palette className="w-6 h-6 text-indigo-500"/> Identidad Visual
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Comercial en Tienda</label>
                <input type="text" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black uppercase text-sm tracking-tighter outline-none focus:ring-2 focus:ring-indigo-500" value={currentConfig.nombreComercial} onChange={e => setCurrentConfig({...currentConfig, nombreComercial: e.target.value})} />
              </div>
              <ImageInput label="Logo de Marca" value={currentConfig.logoUrl} onChange={(val: string) => setCurrentConfig({...currentConfig, logoUrl: val})} placeholder="URL de la imagen del logo..." icon={ImageIcon}/>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Color Primario</label>
                    <div className="flex gap-3 items-center p-3 bg-slate-50 rounded-2xl">
                      <input type="color" className="w-10 h-10 rounded-xl border-none cursor-pointer" value={currentConfig.colorPrimario} onChange={e => setCurrentConfig({...currentConfig, colorPrimario: e.target.value})} />
                      <span className="text-[10px] font-mono font-bold uppercase">{currentConfig.colorPrimario}</span>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Color Acento</label>
                    <div className="flex gap-3 items-center p-3 bg-slate-50 rounded-2xl">
                      <input type="color" className="w-10 h-10 rounded-xl border-none cursor-pointer" value={currentConfig.colorAcento} onChange={e => setCurrentConfig({...currentConfig, colorAcento: e.target.value})} />
                      <span className="text-[10px] font-mono font-bold uppercase">{currentConfig.colorAcento}</span>
                    </div>
                 </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción / Slogan Footer</label>
                <textarea className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium h-28 italic shadow-inner" placeholder="Escribe tu propuesta de valor..." value={currentConfig.footer_description} onChange={e => setCurrentConfig({...currentConfig, footer_description: e.target.value})} />
              </div>
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 space-y-8">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <MapPin className="w-6 h-6 text-blue-500" /> Sedes de Recojo
            </h3>
            <div className="space-y-4">
              {(currentConfig.sedes_recojo || []).map(sede => (
                <div key={sede.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex gap-4 animate-in zoom-in-95">
                   <div className="flex-1 space-y-3">
                     <input type="text" placeholder="NOMBRE SEDE" className="w-full p-3 bg-white border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500" value={sede.nombre} onChange={e => updateSede(sede.id, 'nombre', e.target.value)} />
                     <input type="text" placeholder="DIRECCIÓN" className="w-full p-3 bg-white border border-slate-100 rounded-xl text-[10px] font-bold outline-none" value={sede.direccion} onChange={e => updateSede(sede.id, 'direccion', e.target.value)} />
                   </div>
                   <button type="button" onClick={() => removeSede(sede.id)} className="p-3 bg-white text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl self-center shadow-sm transition-all"><Trash2 className="w-5 h-5"/></button>
                </div>
              ))}
              <button type="button" onClick={addSede} className="w-full p-6 border-2 border-dashed border-slate-200 rounded-[2rem] text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-3">
                <Plus className="w-4 h-4"/> Añadir Punto de Recojo
              </button>
            </div>
          </section>
        </div>

        {/* COLUMNA 3: PAGOS Y SEGURIDAD */}
        <div className="space-y-8">
           <section className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 space-y-8">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <Wallet className="w-6 h-6 text-brand-600" /> Métodos de Pago
            </h3>
            
            <div className="space-y-8">
               {/* YAPE */}
               <div className="p-8 bg-[#742284]/5 rounded-[2.5rem] border border-[#742284]/10 space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                     <div className="w-10 h-10 bg-[#742284] rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg shadow-[#742284]/20">Y</div>
                     <span className="text-xs font-black uppercase text-[#742284] tracking-widest">Configuración Yape</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Número Celular</label>
                        <input type="text" className="w-full p-4 bg-white border border-[#742284]/10 rounded-2xl text-xs font-bold" value={currentConfig.yapeNumber} onChange={e => setCurrentConfig({...currentConfig, yapeNumber: e.target.value})} />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Nombre del Titular</label>
                        <input type="text" className="w-full p-4 bg-white border border-[#742284]/10 rounded-2xl text-[10px] font-black uppercase" value={currentConfig.yapeName} onChange={e => setCurrentConfig({...currentConfig, yapeName: e.target.value})} />
                     </div>
                  </div>
                  <ImageInput label="QR Yape" value={currentConfig.yapeQR} onChange={(val: string) => setCurrentConfig({...currentConfig, yapeQR: val})} placeholder="URL del código QR Yape..." icon={QrCode}/>
               </div>

               {/* PLIN */}
               <div className="p-8 bg-[#00A9E0]/5 rounded-[2.5rem] border border-[#00A9E0]/10 space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                     <div className="w-10 h-10 bg-[#00A9E0] rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg shadow-[#00A9E0]/20">P</div>
                     <span className="text-xs font-black uppercase text-[#00A9E0] tracking-widest">Configuración Plin</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Número Celular</label>
                        <input type="text" className="w-full p-4 bg-white border border-[#00A9E0]/10 rounded-2xl text-xs font-bold" value={currentConfig.plinNumber} onChange={e => setCurrentConfig({...currentConfig, plinNumber: e.target.value})} />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Nombre del Titular</label>
                        <input type="text" className="w-full p-4 bg-white border border-[#00A9E0]/10 rounded-2xl text-[10px] font-black uppercase" value={currentConfig.plinName} onChange={e => setCurrentConfig({...currentConfig, plinName: e.target.value})} />
                     </div>
                  </div>
                  <ImageInput label="QR Plin" value={currentConfig.plinQR} onChange={(val: string) => setCurrentConfig({...currentConfig, plinQR: val})} placeholder="URL del código QR Plin..." icon={QrCode}/>
               </div>
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 space-y-8">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-500" /> Garantías de Compra
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Texto de Calidad</label>
                <input type="text" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-bold" value={currentConfig.quality_text} onChange={e => setCurrentConfig({...currentConfig, quality_text: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Texto de Soporte</label>
                <input type="text" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-bold" value={currentConfig.support_text} onChange={e => setCurrentConfig({...currentConfig, support_text: e.target.value})} />
              </div>
            </div>
          </section>
        </div>

      </form>

      {/* FOOTER DE GUARDADO FLOTANTE */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-50 flex justify-center items-center gap-10 md:left-72 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
          <div className="hidden md:flex items-center gap-4">
             <div className="p-3 bg-brand-50 rounded-xl"><Info className="w-5 h-5 text-brand-600"/></div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">Asegúrate de guardar tus cambios<br/>para que se reflejen en Odoo y la Tienda.</p>
          </div>
          
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-16 py-5 text-white rounded-[2rem] font-black shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-4 text-xs uppercase tracking-[0.2em] relative overflow-hidden group w-full md:w-auto" 
            style={{backgroundColor: brandColor}}
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            {isSaving ? <RotateCcw className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
            Confirmar y Publicar Marca
          </button>
      </div>

      {/* Fix: Added missing ShieldCheck icon usage at the bottom of the component layout */}
      <p className="text-[8px] text-center font-black text-slate-300 uppercase mt-6 tracking-widest flex items-center justify-center gap-2 italic">
          <ShieldCheck className="w-3 h-3"/> Transacción Protegida e Integrada con Odoo ERP
      </p>

      {showSuccess && (
         <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-10 py-5 rounded-[2.5rem] shadow-2xl animate-in slide-in-from-top-10 flex items-center gap-4 border border-white/10">
            <BadgeCheck className="text-emerald-400 w-6 h-6"/>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">¡Branding Actualizado con Éxito!</span>
         </div>
      )}
    </div>
  );
};

// Subcomponente de Icono para notificaciones
const BadgeCheck = ({className}: any) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default StoreSettings;
