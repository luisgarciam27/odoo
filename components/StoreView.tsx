
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, Image as ImageIcon, ArrowLeft, 
  Citrus, Plus, Minus, Info, MapPin, 
  MessageCircle, ShieldCheck, 
  Star, Rocket, Facebook, Instagram, Pill, Beaker, ClipboardCheck, Truck, ShieldAlert, AlertCircle,
  Stethoscope, Footprints, Syringe, Calendar, PawPrint
} from 'lucide-react';
import { Producto, CartItem, OdooSession, ClientConfig } from '../types';
import { OdooClient } from '../services/odoo';

interface StoreViewProps {
  session: OdooSession;
  config: ClientConfig;
  onBack?: () => void;
}

const StoreView: React.FC<StoreViewProps> = ({ session, config, onBack }) => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'tech' | 'usage'>('info');
  
  const colorP = config?.colorPrimario || '#84cc16'; 
  const colorS = config?.colorSecundario || '#0F172A';
  const colorA = config?.colorAcento || '#0ea5e9';
  const bizType = config?.businessType || 'pharmacy';

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    setFetchError(null);
    const client = new OdooClient(session.url, session.db, true);
    const context = session.companyId ? { allowed_company_ids: [session.companyId], company_id: session.companyId } : {};

    try {
      // Sincronización estricta por compañía
      const domain: any[] = [
        ['sale_ok', '=', true],
        ['company_id', 'in', [session.companyId, false]]
      ];

      const coreFields = ['display_name', 'list_price', 'categ_id', 'image_128', 'description_sale'];
      const extraFields = ['qty_available', 'x_registro_sanitario', 'x_laboratorio', 'x_principio_activo', 'x_uso_sugerido', 'x_especie', 'x_duracion_sesion'];

      let data: any[] = [];
      try {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, [...coreFields, ...extraFields], { limit: 500, context });
      } catch (err: any) {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, coreFields, { limit: 500, context });
      }

      const mapped = data.map((p: any) => ({
        id: Number(p.id),
        nombre: p.display_name,
        precio: p.list_price || 0,
        costo: 0,
        categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
        stock: p.qty_available || 0,
        imagen: p.image_128,
        descripcion_venta: p.description_sale || '',
        registro_sanitario: p.x_registro_sanitario || '',
        laboratorio: p.x_laboratorio || (Array.isArray(p.categ_id) ? p.categ_id[1] : ''),
        principio_activo: p.x_principio_activo || '',
        presentacion: p.display_name.split(',').pop()?.trim() || '',
        uso_sugerido: p.x_uso_sugerido || '',
        especie: p.x_especie || '',
        duracion_sesion: p.x_duracion_sesion || ''
      }));
      setProductos(mapped);
    } catch (e: any) {
      setFetchError(e.message || "Error al conectar con Odoo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [session]);

  const filteredProducts = useMemo(() => {
    const hidden = config.hiddenProducts || [];
    return productos.filter(p => {
      if (hidden.includes(p.id)) return false;
      if (searchTerm && !p.nombre.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [productos, searchTerm, config.hiddenProducts]);

  const addToCart = (p: Producto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCart(prev => {
      const exists = prev.find(item => item.producto.id === p.id);
      if (exists) return prev.map(item => item.producto.id === p.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      return [...prev, { producto: p, cantidad: 1 }];
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);

  // Labels dinámicos según tipo de negocio
  const bizMeta = {
    pharmacy: { icon: Pill, label: 'Farmacia Autorizada', regLabel: 'Reg. Sanitario', labLabel: 'Laboratorio' },
    veterinary: { icon: PawPrint, label: 'Atención Veterinaria', regLabel: 'Reg. SENASA', labLabel: 'Marca Veterinaria' },
    podiatry: { icon: Footprints, label: 'Centro de Podología', regLabel: 'Procedimiento', labLabel: 'Especialista' }
  }[bizType] || { icon: Package, label: 'E-commerce Pro', regLabel: 'Referencia', labLabel: 'Fabricante' };

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans text-slate-800 flex flex-col overflow-x-hidden relative">
      
      <header className="bg-white/80 backdrop-blur-2xl border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {onBack && (
              <button onClick={onBack} className="p-3 text-slate-400 hover:text-slate-900 rounded-2xl transition-all">
                <ArrowLeft className="w-5 h-5"/>
              </button>
            )}
            <div className="flex items-center gap-4">
               {config.logoUrl ? <img src={config.logoUrl} className="h-10 md:h-12 object-contain" alt="Logo" /> : <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{backgroundColor: colorP}}><bizMeta.icon className="w-6 h-6 text-white" /></div>}
               <div className="hidden lg:block">
                 <h1 className="font-black text-slate-900 uppercase text-sm tracking-tighter leading-none">{config.nombreComercial || config.code}</h1>
                 <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-widest flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" /> {bizMeta.label}
                 </p>
               </div>
            </div>
          </div>
          <div className="flex-1 max-w-2xl hidden md:block">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
              <input type="text" placeholder={`Buscar en ${config.nombreComercial}...`} className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-100 rounded-[2rem] outline-none font-medium text-sm focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <button onClick={() => setIsCartOpen(true)} className="relative p-4 bg-slate-900 text-white rounded-[1.5rem] shadow-xl hover:scale-105 active:scale-95 transition-all">
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && <span className="absolute -top-1.5 -right-1.5 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center animate-bounce shadow-xl" style={{backgroundColor: colorA}}>{cart.length}</span>}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-10">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {[1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className="bg-white rounded-[3rem] aspect-[3/4] animate-pulse border border-slate-50 shadow-sm"></div>)}
          </div>
        ) : fetchError ? (
           <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <h3 className="text-xl font-black uppercase text-slate-900">Sincronización Fallida</h3>
              <p className="text-xs text-slate-500 max-w-xs">{fetchError}</p>
              <button onClick={fetchProducts} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold uppercase text-xs">Reintentar</button>
           </div>
        ) : filteredProducts.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
              <div className="p-10 bg-slate-100 text-slate-300 rounded-[3rem]"><Package className="w-20 h-20"/></div>
              <p className="text-sm font-bold uppercase text-slate-400 tracking-widest">No se encontraron productos para esta sucursal</p>
           </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 animate-in fade-in duration-700">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => { setSelectedProduct(p); setActiveTab('info'); }} className="group bg-white rounded-[3rem] p-5 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer flex flex-col overflow-hidden">
                <div className="aspect-square bg-slate-50 rounded-[2.5rem] mb-6 overflow-hidden flex items-center justify-center">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" /> : <Package className="w-12 h-12 text-slate-100"/>}
                </div>
                <div className="flex-1">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] mb-2 block px-2.5 py-1 bg-slate-100 rounded-full w-fit text-slate-500">{p.categoria}</span>
                  <h3 className="text-xs font-bold text-slate-800 line-clamp-2 uppercase h-9 mb-4 leading-tight">{p.nombre}</h3>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-auto">
                    <div>
                        <p className="text-[8px] font-black text-slate-300 uppercase leading-none mb-1">Precio Online</p>
                        <span className="text-base font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    </div>
                    <button onClick={(e) => addToCart(p, e)} className="p-3.5 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-900 hover:text-white transition-all active:scale-90"><Plus className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal interactivo adaptado */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative bg-white w-full max-w-5xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row animate-in zoom-in-95 duration-300 h-fit max-h-[90vh]">
             <button onClick={() => setSelectedProduct(null)} className="absolute top-8 right-8 p-3 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-full z-20"><X className="w-5 h-5"/></button>
             
             <div className="lg:w-1/2 bg-slate-50/50 flex items-center justify-center p-12 shrink-0">
               <div className="w-full aspect-square bg-white rounded-[3rem] shadow-sm p-12 flex items-center justify-center border border-slate-100">
                 {selectedProduct.imagen ? <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-h-full max-w-full object-contain" /> : <ImageIcon className="w-24 h-24 text-slate-100"/>}
               </div>
             </div>

             <div className="lg:w-1/2 p-12 flex flex-col min-h-0">
                <div className="mb-6">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-xl bg-brand-50 text-brand-600 mb-4 inline-block">{selectedProduct.categoria}</span>
                  <h2 className="text-3xl font-black text-slate-900 leading-tight tracking-tighter uppercase">{selectedProduct.nombre}</h2>
                </div>

                <div className="flex border-b border-slate-100 mb-6 gap-6">
                  <button onClick={() => setActiveTab('info')} className={`pb-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'info' ? 'border-b-2 border-brand-500 text-slate-900' : 'text-slate-300'}`}>Información</button>
                  <button onClick={() => setActiveTab('tech')} className={`pb-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'tech' ? 'border-b-2 border-brand-500 text-slate-900' : 'text-slate-300'}`}>Ficha Técnica</button>
                  <button onClick={() => setActiveTab('usage')} className={`pb-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'usage' ? 'border-b-2 border-brand-500 text-slate-900' : 'text-slate-300'}`}>Instrucciones</button>
                </div>

                <div className="flex-1 overflow-y-auto pr-4 space-y-6">
                   {activeTab === 'info' && (
                     <div className="animate-in fade-in slide-in-from-right-4">
                       <p className="text-sm text-slate-500 leading-relaxed font-medium">{selectedProduct.descripcion_venta || 'Información de producto bajo revisión.'}</p>
                       <div className="mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                         <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inversión Salud</p><p className="text-4xl font-black text-slate-900">S/ {selectedProduct.precio.toFixed(2)}</p></div>
                         <div className="text-right flex flex-col items-end"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Disponibilidad</p><div className="flex items-center gap-2 font-black text-emerald-500 uppercase"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> En Stock</div></div>
                       </div>
                     </div>
                   )}

                   {activeTab === 'tech' && (
                     <div className="animate-in fade-in slide-in-from-right-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                           {selectedProduct.laboratorio && <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">{bizMeta.labLabel}</p><p className="text-xs font-bold text-slate-800 uppercase">{selectedProduct.laboratorio}</p></div>}
                           {selectedProduct.principio_activo && <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Composición</p><p className="text-xs font-bold text-slate-800 uppercase">{selectedProduct.principio_activo}</p></div>}
                           {selectedProduct.registro_sanitario && <div className="p-4 bg-slate-50 rounded-2xl col-span-2"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">{bizMeta.regLabel}</p><p className="text-xs font-bold text-slate-800 uppercase tracking-tighter">{selectedProduct.registro_sanitario}</p></div>}
                           {bizType === 'veterinary' && selectedProduct.especie && <div className="p-4 bg-brand-50 rounded-2xl"><p className="text-[9px] font-black text-brand-500 uppercase mb-1">Especie Destino</p><p className="text-xs font-bold text-brand-700 uppercase">{selectedProduct.especie}</p></div>}
                           {bizType === 'podiatry' && selectedProduct.duracion_sesion && <div className="p-4 bg-brand-50 rounded-2xl"><p className="text-[9px] font-black text-brand-500 uppercase mb-1">Duración</p><p className="text-xs font-bold text-brand-700 uppercase">{selectedProduct.duracion_sesion}</p></div>}
                        </div>
                     </div>
                   )}

                   {activeTab === 'usage' && (
                     <div className="animate-in fade-in slide-in-from-right-4">
                        <div className="p-6 border-l-4 border-slate-900 bg-slate-50 rounded-r-3xl">
                           <p className="text-xs font-bold text-slate-600 leading-relaxed italic">"{selectedProduct.uso_sugerido || 'Consulte con su profesional de confianza antes de adquirir este producto.'}"</p>
                        </div>
                     </div>
                   )}
                </div>

                <div className="pt-8 mt-auto border-t border-slate-50 flex gap-4">
                   <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="flex-1 py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[11px] shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all">
                     <ShoppingCart className="w-5 h-5" /> Añadir al Pedido
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* WhatsApp Button */}
      <a href={`https://wa.me/${config.whatsappNumbers?.split(',')[0]}?text=Hola, solicito atención profesional`} target="_blank" className="fixed bottom-10 right-10 z-[100] w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-all">
         <MessageCircle className="w-8 h-8 fill-white/10" />
      </a>
    </div>
  );
};

export default StoreView;
