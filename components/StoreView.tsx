
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, Image as ImageIcon, ArrowLeft, 
  Citrus, Plus, Minus, Info, MapPin, 
  MessageCircle, ShieldCheck, 
  Star, Rocket, Facebook, Instagram, Pill, Beaker, ClipboardCheck, Truck, ShieldAlert, AlertCircle,
  Stethoscope, Footprints, Syringe, Calendar
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
  const bizType = config?.businessType || 'general';

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    setFetchError(null);
    const client = new OdooClient(session.url, session.db, true);
    const context = session.companyId ? { allowed_company_ids: [session.companyId], company_id: session.companyId } : {};

    const coreFields = ['display_name', 'list_price', 'categ_id', 'image_128', 'description_sale'];
    const extraFields = ['qty_available', 'x_registro_sanitario', 'x_laboratorio', 'x_principio_activo', 'x_uso_sugerido', 'x_especie', 'x_duracion_sesion'];

    try {
      const configCategory = (config.tiendaCategoriaNombre || '').trim();
      const domain: any[] = [['sale_ok', '=', true]];
      let finalDomain = [...domain];
      
      if (configCategory && !['TODAS', 'CATALOGO', ''].includes(configCategory.toUpperCase())) {
        try {
          const cats = await client.searchRead(session.uid, session.apiKey, 'product.category', [['name', 'ilike', configCategory]], ['id'], { context });
          if (cats && cats.length > 0) finalDomain.push(['categ_id', 'child_of', cats[0].id]);
        } catch(e) { console.warn("Category fetch failed", e); }
      }

      let data: any[] = [];
      try {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', finalDomain, [...coreFields, ...extraFields], { limit: 500, context });
      } catch (err: any) {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', finalDomain, coreFields, { limit: 500, context });
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
  }, [session, config.tiendaCategoriaNombre]);

  const filteredProducts = useMemo(() => {
    return productos.filter(p => {
      if (searchTerm && !p.nombre.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [productos, searchTerm]);

  const addToCart = (p: Producto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCart(prev => {
      const exists = prev.find(item => item.producto.id === p.id);
      if (exists) return prev.map(item => item.producto.id === p.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      return [...prev, { producto: p, cantidad: 1 }];
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);

  // Icono dinámico según negocio
  const BizIcon = bizType === 'veterinary' ? Stethoscope : bizType === 'podiatry' ? Footprints : Pill;

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans text-slate-800 flex flex-col overflow-x-hidden relative">
      
      <header className="bg-white/80 backdrop-blur-2xl border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {onBack && (
              <button onClick={onBack} className="p-3 text-slate-400 hover:text-slate-900 rounded-2xl">
                <ArrowLeft className="w-5 h-5"/>
              </button>
            )}
            <div className="flex items-center gap-4">
               {config.logoUrl ? <img src={config.logoUrl} className="h-10 md:h-12 object-contain" alt="Logo" /> : <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{backgroundColor: colorP}}><BizIcon className="w-6 h-6 text-white" /></div>}
               <div className="hidden lg:block">
                 <h1 className="font-black text-slate-900 uppercase text-sm tracking-tighter leading-none">{config.nombreComercial || config.code}</h1>
                 <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-widest">{bizType === 'pharmacy' ? 'Farmacia Autorizada' : bizType === 'veterinary' ? 'Clínica Veterinaria' : 'Centro de Podología'}</p>
               </div>
            </div>
          </div>
          <div className="flex-1 max-w-2xl hidden md:block">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input type="text" placeholder="Buscar..." className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-[2rem] outline-none font-medium text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <button onClick={() => setIsCartOpen(true)} className="relative p-4 bg-slate-900 text-white rounded-[1.5rem] shadow-xl">
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && <span className="absolute -top-1.5 -right-1.5 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center animate-bounce shadow-xl" style={{backgroundColor: colorA}}>{cart.length}</span>}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-10">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {[1,2,3,4,5].map(i => <div key={i} className="bg-white rounded-[3rem] aspect-[3/4] animate-pulse border border-slate-50 shadow-sm"></div>)}
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
                  <h3 className="text-xs font-bold text-slate-800 line-clamp-2 uppercase h-9 mb-4">{p.nombre}</h3>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-auto">
                    <span className="text-base font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    <button onClick={(e) => addToCart(p, e)} className="p-3.5 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-900 hover:text-white transition-all"><Plus className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal de Detalle Pro Interactive */}
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

                {/* Tabs de Navegación Interna */}
                <div className="flex border-b border-slate-100 mb-6 gap-6">
                  <button onClick={() => setActiveTab('info')} className={`pb-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'info' ? 'border-b-2 border-brand-500 text-slate-900' : 'text-slate-300'}`}>General</button>
                  <button onClick={() => setActiveTab('tech')} className={`pb-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'tech' ? 'border-b-2 border-brand-500 text-slate-900' : 'text-slate-300'}`}>Ficha Técnica</button>
                  <button onClick={() => setActiveTab('usage')} className={`pb-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'usage' ? 'border-b-2 border-brand-500 text-slate-900' : 'text-slate-300'}`}>Uso Sugerido</button>
                </div>

                <div className="flex-1 overflow-y-auto pr-4 space-y-6">
                   {activeTab === 'info' && (
                     <div className="animate-in fade-in slide-in-from-right-4">
                       <p className="text-sm text-slate-500 leading-relaxed font-medium">{selectedProduct.descripcion_venta || 'Información de producto bajo revisión médica.'}</p>
                       <div className="mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                         <div><p className="text-[10px] font-bold text-slate-400 uppercase">Precio Unitario</p><p className="text-3xl font-black text-slate-900">S/ {selectedProduct.precio.toFixed(2)}</p></div>
                         <div className="text-right"><p className="text-[10px] font-bold text-slate-400 uppercase">Estado</p><p className="text-sm font-black text-emerald-500 uppercase">En Stock</p></div>
                       </div>
                     </div>
                   )}

                   {activeTab === 'tech' && (
                     <div className="animate-in fade-in slide-in-from-right-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                           {selectedProduct.laboratorio && <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Fabricante</p><p className="text-xs font-bold text-slate-800">{selectedProduct.laboratorio}</p></div>}
                           {selectedProduct.principio_activo && <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Composición</p><p className="text-xs font-bold text-slate-800">{selectedProduct.principio_activo}</p></div>}
                           {selectedProduct.registro_sanitario && <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Reg. Sanitario</p><p className="text-xs font-bold text-slate-800">{selectedProduct.registro_sanitario}</p></div>}
                           {selectedProduct.especie && <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Especie Destino</p><p className="text-xs font-bold text-slate-800">{selectedProduct.especie}</p></div>}
                           {selectedProduct.duracion_sesion && <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Duración Aproximada</p><p className="text-xs font-bold text-slate-800">{selectedProduct.duracion_sesion}</p></div>}
                        </div>
                     </div>
                   )}

                   {activeTab === 'usage' && (
                     <div className="animate-in fade-in slide-in-from-right-4">
                        <div className="p-6 border-l-4 border-brand-500 bg-brand-50/30 rounded-r-3xl">
                           <p className="text-xs font-bold text-slate-600 leading-relaxed italic">"{selectedProduct.uso_sugerido || 'Consulte con un profesional antes de su uso o aplicación.'}"</p>
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

      {/* Carrito Lateral (Se mantiene funcional igual que antes) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right rounded-l-[3rem]">
            <div className="p-10 flex items-center justify-between border-b border-slate-50">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Tu Carrito</h2>
              <button onClick={() => setIsCartOpen(false)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/30">
              {cart.map(item => (
                <div key={item.producto.id} className="flex gap-4 items-center bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl overflow-hidden flex items-center justify-center">{item.producto.imagen ? <img src={`data:image/png;base64,${item.producto.imagen}`} className="w-full h-full object-cover"/> : <Package className="w-6 h-6 text-slate-200"/>}</div>
                  <div className="flex-1">
                    <h4 className="text-[11px] font-black text-slate-800 line-clamp-1 uppercase">{item.producto.nombre}</h4>
                    <p className="text-xs font-black text-brand-600 mt-1">S/ {(item.producto.precio * item.cantidad).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="p-10 border-t border-slate-50 bg-white rounded-t-[3rem]">
                <div className="flex justify-between items-end mb-6"><div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Inversión Total</p><p className="text-3xl font-black text-slate-900 leading-none">S/ {cartTotal.toFixed(2)}</p></div></div>
                <button onClick={() => window.open(`https://wa.me/${config.whatsappNumbers?.split(',')[0]}?text=Hola, quiero pedir:\n${cart.map(i => `${i.cantidad}x ${i.producto.nombre}`).join('\n')}`)} className="w-full py-6 bg-emerald-500 text-white rounded-[2rem] font-black uppercase text-[11px] shadow-xl flex items-center justify-center gap-4"><MessageCircle className="w-5 h-5"/> Enviar por WhatsApp</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreView;
