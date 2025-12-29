
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, ShieldCheck, 
  Facebook, Instagram, Pill, Beaker, CheckCircle2, 
  Loader2, BadgeCheck, Sparkles, Zap, HeartHandshake,
  RefreshCw, Trash2, CreditCard, Building2, Smartphone, 
  Layers, Tag, SearchX, Briefcase, PawPrint, Footprints, ChevronRight
} from 'lucide-react';
import { Producto, CartItem, OdooSession, ClientConfig } from '../types';
import { OdooClient } from '../services/odoo';
import { getProductExtras } from '../services/clientManager';

interface StoreViewProps {
  session: OdooSession;
  config: ClientConfig;
  onBack?: () => void;
}

type StoreStep = 'cart' | 'details' | 'payment' | 'processing' | 'success';

const StoreView: React.FC<StoreViewProps> = ({ session, config, onBack }) => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<StoreStep>('cart');
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'efectivo'>('yape');
  const [deliveryType, setDeliveryType] = useState<'recojo' | 'delivery'>('recojo');
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '', sedeId: '' });
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  const brandColor = config?.colorPrimario || '#84cc16'; 
  const colorA = config?.colorAcento || '#0ea5e9';
  const bizType = config?.businessType || 'pharmacy';

  const slides = useMemo(() => {
    if (config.slide_images && config.slide_images.some(img => img)) {
      return config.slide_images.filter(img => img).map((url) => ({ image: url }));
    }
    return [
      { title: "Calidad Garantizada", desc: "Tus productos de confianza ahora online.", badge: "OFICIAL", bg: `linear-gradient(135deg, ${brandColor}, ${colorA})` },
      { title: "Atención Especializada", desc: "Expertos cuidando de tu bienestar.", badge: "CONFIANZA", bg: `linear-gradient(135deg, ${colorA}, ${brandColor})` }
    ];
  }, [config.slide_images, brandColor, colorA]);

  useEffect(() => {
    const timer = setInterval(() => { setActiveSlide(s => (s + 1) % slides.length); }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    const client = new OdooClient(session.url, session.db, true);
    try {
      const extrasMap = await getProductExtras(config.code);
      const fields = ['display_name', 'list_price', 'categ_id', 'image_512', 'description_sale', 'qty_available'];
      const domain: any[] = [['sale_ok', '=', true]];
      if (session.companyId) domain.push(['company_id', 'in', [false, session.companyId]]);

      let data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, fields, { limit: 1000 });
      if (!data || data.length === 0) {
        data = await client.searchRead(session.uid, session.apiKey, 'product.template', [['sale_ok', '=', true]], fields, { limit: 500 });
      }

      setProductos((data || []).map((p: any) => {
        const extra = extrasMap[p.id];
        return {
          id: p.id,
          nombre: p.display_name,
          precio: p.list_price || 0,
          categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
          stock: p.qty_available || 0,
          imagen: p.image_512 || p.image_128,
          descripcion_venta: extra?.descripcion_lemon || p.description_sale || '',
          uso_sugerido: extra?.instrucciones_lemon || '',
          categoria_personalizada: extra?.categoria_personalizada || '',
          marca: 'Genérico',
          registro_sanitario: 'S/N'
        };
      }));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, [session, config.code]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    productos.forEach(p => {
        if (p.categoria_personalizada) cats.add(p.categoria_personalizada);
        else if (p.categoria) cats.add(p.categoria);
    });
    const hidden = config.hiddenCategories || [];
    return ['Todas', ...Array.from(cats).filter(c => !hidden.includes(c))].sort();
  }, [productos, config.hiddenCategories]);

  const filteredProducts = useMemo(() => {
    const hiddenIds = config.hiddenProducts || [];
    const hiddenCats = config.hiddenCategories || [];
    return productos.filter(p => {
        const prodCat = p.categoria_personalizada || p.categoria || 'General';
        const matchesSearch = searchTerm === '' || p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCat = selectedCategory === 'Todas' || prodCat === selectedCategory;
        return !hiddenIds.includes(p.id) && !hiddenCats.includes(prodCat) && matchesSearch && matchesCat;
    });
  }, [productos, searchTerm, selectedCategory, config.hiddenProducts, config.hiddenCategories]);

  const addToCart = (p: Producto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCart(prev => {
      const exists = prev.find(item => item.producto.id === p.id);
      if (exists) return prev.map(item => item.producto.id === p.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      return [...prev, { producto: p, cantidad: 1 }];
    });
    setIsCartOpen(true);
    setCurrentStep('cart');
  };

  const updateCartQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => item.producto.id === id ? { ...item, cantidad: Math.max(0, item.cantidad + delta) } : item).filter(item => item.cantidad > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);

  const handleFinishOrder = async () => {
    setIsOrderLoading(true);
    const waNumber = config.whatsappNumbers?.split(',')[0].trim() || '51975615244';
    const sedeName = (config.sedes_recojo || []).find(s => s.id === clientData.sedeId)?.nombre || 'Principal';
    
    const message = `*NUEVO PEDIDO - ${config.nombreComercial || config.code}*\n\n` +
      `*Cliente:* ${clientData.nombre}\n` +
      `*Teléfono:* ${clientData.telefono}\n` +
      `*Tipo:* ${deliveryType === 'recojo' ? 'Recojo (' + sedeName + ')' : 'Delivery'}\n` +
      `*Dirección:* ${deliveryType === 'delivery' ? clientData.direccion : 'N/A'}\n` +
      `*Pago:* ${paymentMethod.toUpperCase()}\n\n` +
      `*PRODUCTOS:*\n` +
      cart.map(i => `• ${i.cantidad}x ${i.producto.nombre} - S/ ${(i.producto.precio * i.cantidad).toFixed(2)}`).join('\n') +
      `\n\n*TOTAL: S/ ${cartTotal.toFixed(2)}*`;

    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank');
    setCurrentStep('success');
    setIsOrderLoading(false);
  };

  const bizIcons = {
    pharmacy: { main: Pill, label: 'Farmacia', catIcon: Beaker },
    veterinary: { main: PawPrint, label: 'Veterinaria', catIcon: PawPrint },
    podiatry: { main: Footprints, label: 'Podología', catIcon: Footprints },
    general: { main: Briefcase, label: 'Comercio', catIcon: Package }
  }[bizType];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col relative overflow-x-hidden">
      
      {/* HEADER */}
      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-900"><ArrowLeft className="w-5 h-5"/></button>}
            {config.logoUrl ? <img src={config.logoUrl} className="h-8 md:h-12 w-auto object-contain" /> : <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg" style={{backgroundColor: brandColor}}><bizIcons.main className="w-5 h-5" /></div>}
            <div className="hidden sm:block">
               <h1 className="font-black text-slate-900 uppercase text-[12px] md:text-[14px] leading-none tracking-tighter">{config.nombreComercial || config.code}</h1>
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Tienda Oficial</p>
            </div>
          </div>
          <div className="flex-1 max-w-lg">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
              <input type="text" placeholder="¿Qué estás buscando hoy?" className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[12px] font-bold outline-none focus:bg-white transition-all shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-3 bg-slate-900 text-white rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95">
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 text-white text-[9px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white" style={{backgroundColor: colorA}}>{cart.length}</span>}
          </button>
        </div>
      </header>

      {/* CAROUSEL / SLIDES */}
      <div className="px-4 md:px-6 pt-4">
        <div className="max-w-7xl mx-auto overflow-hidden rounded-[2rem] md:rounded-[3rem] shadow-xl relative h-[180px] md:h-[450px]">
          {slides.map((slide: any, idx) => (
            <div key={idx} className={`absolute inset-0 transition-all duration-1000 ${activeSlide === idx ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'}`}>
              {slide.image ? <img src={slide.image} className="w-full h-full object-cover" /> : (
                <div className="w-full h-full p-8 md:p-24 flex items-center" style={{ background: slide.bg }}>
                   <div className="max-w-lg text-white space-y-3 md:space-y-6">
                      <span className="text-[8px] md:text-[11px] font-black uppercase tracking-widest bg-white/20 px-4 py-1 rounded-full backdrop-blur-md">{slide.badge}</span>
                      <h2 className="text-xl md:text-6xl font-black uppercase tracking-tighter leading-none">{slide.title}</h2>
                      <p className="text-white/80 text-[10px] md:text-xl font-bold uppercase">{slide.desc}</p>
                   </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CATEGORÍAS */}
      <div className="w-full mt-6 px-4 overflow-x-auto no-scrollbar scroll-smooth">
         <div className="max-w-7xl mx-auto flex items-center gap-3 min-w-max pb-2">
            {availableCategories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`flex items-center gap-2 px-5 py-3 rounded-2xl transition-all border-2 font-black uppercase text-[9px] tracking-widest ${selectedCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-400 border-slate-50 hover:border-slate-200'}`}>
                {cat === 'Todas' ? <Layers className="w-4 h-4"/> : <Tag className="w-4 h-4"/>} {cat}
              </button>
            ))}
         </div>
      </div>

      {/* PRODUCT GRID */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
             <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sincronizando con Odoo...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center gap-6 opacity-40">
             <SearchX className="w-16 h-16 text-slate-200" />
             <p className="text-sm font-black uppercase tracking-widest text-slate-400">No encontramos lo que buscas</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-12">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => setSelectedProduct(p)} className="group bg-white rounded-[2rem] p-3 md:p-5 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col relative overflow-hidden">
                <div className="aspect-square bg-slate-50 rounded-[1.5rem] mb-3 md:mb-6 overflow-hidden flex items-center justify-center relative border border-slate-50">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500" /> : <Package className="w-10 h-10 text-slate-200"/>}
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest mb-2 px-3 py-1 bg-slate-50 rounded-lg w-fit text-slate-400 truncate max-w-full">{p.categoria_personalizada || p.categoria}</span>
                  <h3 className="text-[10px] md:text-[11px] font-black text-slate-800 line-clamp-2 uppercase h-8 mb-3 leading-tight tracking-tight">{p.nombre}</h3>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-auto">
                    <span className="text-xs md:text-lg font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    <button onClick={(e) => addToCart(p, e)} className="p-2.5 md:p-4 bg-slate-900 text-white rounded-xl shadow-md hover:scale-110 active:scale-95 transition-all"><Plus className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL DETALLE PRODUCTO */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-12">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in" onClick={() => setSelectedProduct(null)}></div>
           <div className="relative bg-white w-full max-w-5xl md:rounded-[3rem] rounded-t-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in slide-in-from-bottom md:zoom-in duration-300 max-h-[95vh]">
              <div className="w-full md:w-1/2 h-72 md:h-auto bg-white relative overflow-hidden border-b md:border-b-0 md:border-r border-slate-100 p-8 flex items-center justify-center">
                 {selectedProduct.imagen ? <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-w-full max-h-full object-contain" /> : <Package className="w-20 h-20 text-slate-100"/>}
                 <button onClick={() => setSelectedProduct(null)} className="absolute top-6 left-6 p-3 bg-slate-900/10 hover:bg-slate-900/20 rounded-2xl text-slate-900"><X className="w-5 h-5"/></button>
              </div>
              <div className="flex-1 p-6 md:p-14 flex flex-col justify-between overflow-y-auto">
                 <div className="space-y-6">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-600 mb-2 block">{selectedProduct.categoria_personalizada || selectedProduct.categoria}</span>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{selectedProduct.nombre}</h2>
                    <p className="text-3xl font-black text-slate-900">S/ {selectedProduct.precio.toFixed(2)}</p>
                    <div className="space-y-2">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Info className="w-4 h-4 text-brand-500" /> Descripción</h4>
                       <p className="text-xs font-bold text-slate-600 leading-relaxed uppercase">{selectedProduct.descripcion_venta || 'Información de catálogo no disponible.'}</p>
                    </div>
                    {selectedProduct.uso_sugerido && (
                       <div className="p-5 bg-brand-50 rounded-2xl border border-brand-100 space-y-2">
                          <h4 className="text-[9px] font-black text-brand-700 uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-4 h-4" /> Recomendación</h4>
                          <p className="text-[10px] font-black text-brand-900 leading-relaxed uppercase italic">{selectedProduct.uso_sugerido}</p>
                       </div>
                    )}
                 </div>
                 <div className="mt-8 pt-6 border-t border-slate-100 sticky bottom-0 bg-white">
                    <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="w-full py-5 text-white rounded-2xl font-black uppercase text-xs tracking-[0.15em] shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95" style={{backgroundColor: brandColor}}>
                       <ShoppingCart className="w-5 h-5" /> Agregar al Carrito
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* DRAWER DEL CARRITO / CHECKOUT */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative bg-white w-full max-w-lg h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              
              {/* Header Drawer */}
              <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                 <div><h3 className="text-lg font-black uppercase tracking-tighter">Mi Carrito</h3><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{cart.length} productos seleccionados</p></div>
                 <button onClick={() => setIsCartOpen(false)} className="p-3 bg-white border rounded-xl"><X className="w-5 h-5"/></button>
              </div>

              {/* Contenido Dinámico según Paso */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {currentStep === 'cart' && (
                    <div className="space-y-4">
                       {cart.length === 0 ? (
                          <div className="py-20 text-center opacity-30 flex flex-col items-center gap-6"><ShoppingCart className="w-16 h-16"/><p className="font-black uppercase tracking-widest">El carrito está vacío</p></div>
                       ) : cart.map(item => (
                          <div key={item.producto.id} className="flex gap-4 p-4 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm">
                             <div className="w-16 h-16 bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center border border-slate-50">
                                {item.producto.imagen ? <img src={`data:image/png;base64,${item.producto.imagen}`} className="w-full h-full object-contain" /> : <Package className="w-8 h-8 text-slate-200"/>}
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase truncate">{item.producto.nombre}</p>
                                <p className="text-sm font-black mt-1">S/ {item.producto.precio.toFixed(2)}</p>
                                <div className="flex items-center gap-4 mt-3">
                                   <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
                                      <button onClick={() => updateCartQuantity(item.producto.id, -1)} className="p-1 text-slate-500"><Minus className="w-3.5 h-3.5"/></button>
                                      <span className="text-xs font-black w-6 text-center">{item.cantidad}</span>
                                      <button onClick={() => updateCartQuantity(item.producto.id, 1)} className="p-1 text-slate-500"><Plus className="w-3.5 h-3.5"/></button>
                                   </div>
                                   <button onClick={() => updateCartQuantity(item.producto.id, -item.cantidad)} className="text-[9px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/> Quitar</button>
                                </div>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}

                 {currentStep === 'details' && (
                    <div className="space-y-6">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre Completo</label>
                          <input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none" placeholder="¿Cómo te llamas?" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                       </div>
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Teléfono WhatsApp</label>
                          <input type="tel" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none" placeholder="Tu número de celular" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                       </div>
                       <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Método de Entrega</label>
                          <div className="grid grid-cols-2 gap-3">
                             <button onClick={() => setDeliveryType('recojo')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${deliveryType === 'recojo' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 bg-white text-slate-400'}`}><Building2 className="w-5 h-5"/> <span className="text-[10px] font-black uppercase">Recojo</span></button>
                             <button onClick={() => setDeliveryType('delivery')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${deliveryType === 'delivery' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 bg-white text-slate-400'}`}><Truck className="w-5 h-5"/> <span className="text-[10px] font-black uppercase">Delivery</span></button>
                          </div>
                       </div>
                       {deliveryType === 'recojo' ? (
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Seleccionar Sede</label>
                             <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none" value={clientData.sedeId} onChange={e => setClientData({...clientData, sedeId: e.target.value})}>
                                <option value="">Sede Principal</option>
                                {(config.sedes_recojo || []).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                             </select>
                          </div>
                       ) : (
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Dirección de Envío</label>
                             <textarea className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none h-24" placeholder="Ej: Av. Las Flores 123, Int 4, Referencia..." value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                          </div>
                       )}
                    </div>
                 )}

                 {currentStep === 'payment' && (
                    <div className="space-y-8">
                       <div className="text-center space-y-2">
                          <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Total a Pagar</h4>
                          <p className="text-4xl font-black text-slate-900">S/ {cartTotal.toFixed(2)}</p>
                       </div>
                       <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Selecciona Método de Pago</label>
                          <div className="grid grid-cols-2 gap-3">
                             <button onClick={() => setPaymentMethod('yape')} className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-3 transition-all ${paymentMethod === 'yape' ? 'border-[#742284] bg-[#742284]/10' : 'border-slate-100 bg-slate-50'}`}><div className="w-10 h-10 bg-[#742284] rounded-xl flex items-center justify-center text-white font-black">Y</div> <span className="text-[10px] font-black uppercase">Yape</span></button>
                             <button onClick={() => setPaymentMethod('plin')} className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-3 transition-all ${paymentMethod === 'plin' ? 'border-[#00A9E0] bg-[#00A9E0]/10' : 'border-slate-100 bg-slate-50'}`}><div className="w-10 h-10 bg-[#00A9E0] rounded-xl flex items-center justify-center text-white font-black">P</div> <span className="text-[10px] font-black uppercase">Plin</span></button>
                          </div>
                       </div>
                       <div className="p-6 bg-slate-900 rounded-[2rem] text-white space-y-4 text-center">
                          <Smartphone className="w-8 h-8 mx-auto text-brand-400" />
                          <div>
                             <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Pagar al Número:</p>
                             <p className="text-2xl font-black mt-1 tracking-widest">{paymentMethod === 'yape' ? (config.yapeNumber || '975615244') : (config.plinNumber || '975615244')}</p>
                             <p className="text-[10px] font-bold uppercase tracking-tighter mt-1">{paymentMethod === 'yape' ? (config.yapeName || 'Lemon BI') : (config.plinName || 'Lemon BI')}</p>
                          </div>
                          <div className="pt-4 border-t border-white/10">
                             <p className="text-[9px] font-bold uppercase tracking-widest">⚠️ Luego de pagar, finaliza para enviar el comprobante por WhatsApp.</p>
                          </div>
                       </div>
                    </div>
                 )}

                 {currentStep === 'success' && (
                    <div className="py-20 text-center space-y-6 flex flex-col items-center">
                       <div className="w-24 h-24 bg-brand-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-brand-200 animate-bounce"><CheckCircle2 className="w-12 h-12"/></div>
                       <div className="space-y-2">
                          <h3 className="text-2xl font-black uppercase tracking-tighter">¡Pedido Registrado!</h3>
                          <p className="text-sm font-bold text-slate-500 leading-relaxed uppercase">Tu pedido ha sido enviado con éxito a nuestro centro de atención.</p>
                       </div>
                       <button onClick={() => { setCart([]); setIsCartOpen(false); setCurrentStep('cart'); }} className="px-12 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest">Seguir Comprando</button>
                    </div>
                 )}
              </div>

              {/* Footer Drawer / Acciones */}
              {currentStep !== 'success' && cart.length > 0 && (
                 <div className="p-6 border-t bg-white sticky bottom-0">
                    <div className="flex justify-between items-center mb-6">
                       <span className="text-[11px] font-black uppercase text-slate-400">Total a pagar:</span>
                       <span className="text-2xl font-black text-slate-900">S/ {cartTotal.toFixed(2)}</span>
                    </div>
                    {currentStep === 'cart' && (
                       <button onClick={() => setCurrentStep('details')} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 shadow-xl">Continuar <ChevronRight className="w-5 h-5"/></button>
                    )}
                    {currentStep === 'details' && (
                       <div className="flex gap-3">
                          <button onClick={() => setCurrentStep('cart')} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[11px]">Atrás</button>
                          <button onClick={() => setCurrentStep('payment')} disabled={!clientData.nombre || !clientData.telefono} className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest disabled:opacity-50">Siguiente Pago</button>
                       </div>
                    )}
                    {currentStep === 'payment' && (
                       <div className="flex gap-3">
                          <button onClick={() => setCurrentStep('details')} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[11px]">Atrás</button>
                          <button onClick={handleFinishOrder} disabled={isOrderLoading} className="flex-[2] py-5 bg-brand-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl flex items-center justify-center gap-3">
                             {isOrderLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : <CheckCircle2 className="w-5 h-5"/>} Finalizar Pedido
                          </button>
                       </div>
                    )}
                 </div>
              )}
           </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-auto py-16 px-6 text-center" style={{backgroundColor: brandColor}}>
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-8 text-white relative z-10">
           {config.footerLogoUrl ? <img src={config.footerLogoUrl} className="h-16 object-contain" /> : <div className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl"><bizIcons.main className="w-8 h-8 text-white" /><span className="font-black text-2xl tracking-tighter uppercase">{config.nombreComercial || config.code}</span></div>}
           <p className="text-[11px] font-bold italic opacity-90 uppercase tracking-widest">"{config.footer_description || 'Cuidando de ti con la mejor tecnología.'}"</p>
           <div className="flex gap-4">
               {config.facebook_url && <a href={config.facebook_url} className="p-4 bg-white/10 rounded-full text-white"><Facebook className="w-6 h-6"/></a>}
               {config.instagram_url && <a href={config.instagram_url} className="p-4 bg-white/10 rounded-full text-white"><Instagram className="w-6 h-6"/></a>}
               {config.whatsappHelpNumber && <a href={`https://wa.me/${config.whatsappHelpNumber}`} className="p-4 bg-white/10 rounded-full text-white"><MessageCircle className="w-6 h-6"/></a>}
           </div>
           <div className="opacity-40 text-[9px] font-black uppercase tracking-[0.4em]">LEMON BI • 2025</div>
        </div>
      </footer>
    </div>
  );
};

export default StoreView;
