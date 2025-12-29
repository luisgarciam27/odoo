import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, Image as ImageIcon, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, ShieldCheck, 
  Star, Facebook, Instagram, Pill, Beaker, ClipboardCheck, AlertCircle,
  Stethoscope, Footprints, PawPrint, Calendar, Wallet, CheckCircle2, Camera, ChevronRight,
  Loader2, BadgeCheck, Send, UserCheck, Sparkles, Zap, Award, HeartHandshake, ShieldAlert,
  RefreshCw, Trash2, CreditCard, Building2, Smartphone, CheckCircle, QrCode, Music2, Upload, Briefcase,
  Dog, Cat, Syringe, Tag, Layers, SearchX, Wand2, Boxes, Phone, ShoppingBag
} from 'lucide-react';
import { Producto, CartItem, OdooSession, ClientConfig } from '../types';
import { OdooClient } from '../services/odoo';
import { getProductExtras } from '../services/clientManager';
import { supabase } from '../services/supabaseClient';

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
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '', sede: '' });
  const [isOrderLoading, setIsOrderLoading] = useState(false);

  const brandColor = config?.colorPrimario || '#84cc16'; 
  const colorA = config?.colorAcento || '#0ea5e9';
  const bizType = config?.businessType || 'pharmacy';

  const parseOdooDescription = (rawText: string = "") => {
    if (!rawText) return { marca: "Genérico", especie: "General", registro: "S/N", cleanDesc: "" };
    const lines = rawText.split('\n');
    let marca = ""; let especie = ""; let registro = "";
    let descripcionLimpiaLines: string[] = [];
    lines.forEach(line => {
      const upperLine = line.toUpperCase();
      if (upperLine.includes("MARCA:")) marca = line.split(":")[1]?.trim();
      else if (upperLine.includes("ESPECIE:")) especie = line.trim();
      else if (upperLine.includes("R.S.") || upperLine.includes("REGISTRO")) registro = line.split(":")[1]?.trim() || line.trim();
      else if (line.trim().length > 0 && !upperLine.includes("IMÁGENES REFERENCIALES")) descripcionLimpiaLines.push(line.trim());
    });
    return { marca: marca || "Genérico", especie: especie || "General", registro: registro, cleanDesc: descripcionLimpiaLines.join(' ') };
  };

  const slides = useMemo(() => {
    if (config.slide_images && config.slide_images.some(img => img)) {
      return config.slide_images.filter(img => img).map((url) => ({ image: url }));
    }
    return [
      { title: "Salud y Bienestar", desc: "Tus productos de confianza ahora online.", icon: ShieldCheck, badge: "Garantía", bg: `linear-gradient(135deg, ${brandColor}, ${colorA})` },
      { title: "Atención Especializada", desc: "Expertos cuidando de ti.", icon: HeartHandshake, badge: "Confianza", bg: `linear-gradient(135deg, ${colorA}, ${brandColor})` }
    ];
  }, [config.slide_images, brandColor, colorA]);

  useEffect(() => {
    if (slides.length > 1) {
      const timer = setInterval(() => { setActiveSlide(s => (s + 1) % slides.length); }, 6000);
      return () => clearInterval(timer);
    }
  }, [slides.length]);

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    const client = new OdooClient(session.url, session.db, true);
    try {
      const extrasMap = await getProductExtras(config.code);
      const fields = ['display_name', 'list_price', 'categ_id', 'image_128', 'description_sale', 'qty_available'];
      
      const domain: any[] = [['sale_ok', '=', true]];
      if (session.companyId) {
          domain.push(['company_id', 'in', [false, session.companyId]]);
      }

      let data = [];
      try {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, fields, { limit: 1000 });
      } catch (e) {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], fields, { limit: 1000 });
      }

      if (!data || data.length === 0) {
        data = await client.searchRead(session.uid, session.apiKey, 'product.template', [['sale_ok', '=', true]], fields, { limit: 500 });
      }

      if (data && data.length > 0) {
        setProductos(data.map((p: any) => {
          const extra = extrasMap[p.id];
          const parsed = parseOdooDescription(p.description_sale);
          return {
            id: p.id,
            nombre: p.display_name,
            precio: p.list_price || 0,
            categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
            stock: p.qty_available || 0,
            imagen: p.image_128,
            descripcion_venta: extra?.descripcion_lemon || parsed.cleanDesc || p.description_sale || '',
            uso_sugerido: extra?.instrucciones_lemon || '',
            marca: parsed.marca,
            especie: parsed.especie,
            registro_sanitario: parsed.registro || 'S/N'
          };
        }));
      } else {
        setProductos([]);
      }
    } catch (e) { 
      setProductos([]);
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchProducts(); }, [session, config.code]);

  const availableCategories = useMemo(() => {
    const cats = Array.from(new Set(productos.map(p => p.categoria || 'General')));
    const hidden = config.hiddenCategories || [];
    return ['Todas', ...cats.filter(c => !hidden.includes(c))].sort();
  }, [productos, config.hiddenCategories]);

  const filteredProducts = useMemo(() => {
    const hiddenIds = config.hiddenProducts || [];
    const hiddenCats = config.hiddenCategories || [];
    return productos.filter(p => {
        const isHidden = hiddenIds.includes(p.id) || hiddenCats.includes(p.categoria || 'General');
        const matchesSearch = searchTerm === '' || p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCat = selectedCategory === 'Todas' || p.categoria === selectedCategory;
        return !isHidden && matchesSearch && matchesCat;
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
    // Simulación de envío de pedido por WhatsApp
    const message = `*NUEVO PEDIDO - ${config.nombreComercial || config.code}*\n\n` +
      `*Cliente:* ${clientData.nombre}\n` +
      `*Teléfono:* ${clientData.telefono}\n` +
      `*Tipo:* ${deliveryType === 'recojo' ? 'Recojo en Sede (' + clientData.sede + ')' : 'Delivery'}\n` +
      `*Dirección:* ${deliveryType === 'delivery' ? clientData.direccion : 'N/A'}\n` +
      `*Pago:* ${paymentMethod.toUpperCase()}\n\n` +
      `*PRODUCTOS:*\n` +
      cart.map(i => `• ${i.cantidad}x ${i.producto.nombre} - S/ ${(i.producto.precio * i.cantidad).toFixed(2)}`).join('\n') +
      `\n\n*TOTAL: S/ ${cartTotal.toFixed(2)}*`;

    const waNumber = config.whatsappNumbers?.split(',')[0].trim() || '51975615244';
    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
    
    // Aquí podrías guardar en Supabase si fuera necesario
    window.open(waUrl, '_blank');
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
      
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {onBack && <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-900"><ArrowLeft className="w-5 h-5"/></button>}
            {config.logoUrl ? <img src={config.logoUrl} className="h-10 md:h-12 object-contain" /> : <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{backgroundColor: brandColor}}><bizIcons.main className="w-6 h-6" /></div>}
            <div className="hidden md:block">
               <h1 className="font-black text-slate-900 uppercase text-[14px] leading-none tracking-tighter">{config.nombreComercial || config.code}</h1>
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5 text-brand-500" /> Tienda Online</p>
            </div>
          </div>
          <div className="flex-1 max-w-lg">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input type="text" placeholder="Buscar productos..." className="w-full pl-12 pr-6 py-3.5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-sm font-bold outline-none focus:bg-white shadow-inner transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-4 bg-slate-900 text-white rounded-[1.5rem] shadow-xl hover:scale-105 active:scale-95 transition-all">
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 text-white text-[9px] font-black w-7 h-7 rounded-full flex items-center justify-center border-2 border-white animate-pulse" style={{backgroundColor: colorA}}>{cart.length}</span>}
          </button>
        </div>
      </header>

      {/* Hero / Slides */}
      <div className="px-6 pt-6">
        <div className="max-w-7xl mx-auto overflow-hidden rounded-[3rem] shadow-2xl relative h-[220px] md:h-[450px]">
          {slides.map((slide: any, idx) => (
            <div key={idx} className={`absolute inset-0 transition-all duration-1000 ${activeSlide === idx ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'}`}>
              {slide.image ? <img src={slide.image} className="w-full h-full object-cover" /> : (
                <div className="w-full h-full p-12 md:p-24 flex items-center" style={{ background: slide.bg }}>
                   <div className="max-w-lg text-white space-y-6">
                      <span className="text-[11px] font-black uppercase tracking-widest bg-white/20 px-6 py-2 rounded-full backdrop-blur-md">{slide.badge}</span>
                      <h2 className="text-3xl md:text-6xl font-black uppercase tracking-tighter leading-none">{slide.title}</h2>
                      <p className="text-white/80 text-sm md:text-xl font-bold">{slide.desc}</p>
                   </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Categorías */}
      <div className="w-full mt-10 px-6 overflow-x-auto no-scrollbar scroll-smooth">
         <div className="max-w-7xl mx-auto flex items-center gap-4 min-w-max pb-4">
            {availableCategories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`flex items-center gap-3 px-8 py-5 rounded-[2rem] transition-all border-2 font-black uppercase text-[11px] tracking-widest ${selectedCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-50 hover:border-slate-300'}`}>
                {cat === 'Todas' ? <Layers className="w-5 h-5"/> : <bizIcons.catIcon className="w-5 h-5"/>} {cat}
              </button>
            ))}
         </div>
      </div>

      {/* Listado de Productos */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-8 md:p-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
             <Loader2 className="w-12 h-12 animate-spin text-brand-500" />
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Sincronizando Catálogo Odoo...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-32 text-center flex flex-col items-center gap-8 opacity-40">
             <SearchX className="w-20 h-20 text-slate-200" />
             <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase tracking-widest text-slate-400">Sin productos disponibles</h3>
                <p className="text-[10px] font-bold uppercase">Verifica que los productos tengan "Puede ser vendido" activo en Odoo.</p>
             </div>
             <button onClick={fetchProducts} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-3 shadow-xl"><RefreshCw className="w-4 h-4" /> Reintentar Carga</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 md:gap-12">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => setSelectedProduct(p)} className="group bg-white rounded-[2.5rem] p-5 border border-slate-50 shadow-sm hover:shadow-2xl hover:-translate-y-3 transition-all duration-500 cursor-pointer flex flex-col relative overflow-hidden">
                <div className="aspect-square bg-slate-50 rounded-[2rem] mb-6 overflow-hidden flex items-center justify-center relative">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" /> : <Package className="w-12 h-12 text-slate-200"/>}
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest mb-3 px-4 py-1.5 bg-slate-100 rounded-lg w-fit text-slate-400">{p.categoria}</span>
                  <h3 className="text-[12px] font-black text-slate-800 line-clamp-2 uppercase h-10 mb-6 leading-tight tracking-tight">{p.nombre}</h3>
                  <div className="flex items-center justify-between pt-5 border-t border-slate-50 mt-auto">
                    <span className="text-lg font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    <button onClick={(e) => addToCart(p, e)} className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all"><Plus className="w-5 h-5"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Detalle de Producto */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12">
           <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl animate-in fade-in" onClick={() => setSelectedProduct(null)}></div>
           <div className="relative bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in duration-300">
              <div className="w-full md:w-1/2 h-64 md:h-auto bg-slate-50 relative overflow-hidden">
                 {selectedProduct.imagen ? <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="w-full h-full object-cover" /> : <Package className="w-24 h-24 text-slate-200 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"/>}
                 <button onClick={() => setSelectedProduct(null)} className="absolute top-6 left-6 p-4 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-2xl text-white transition-all"><ArrowLeft className="w-6 h-6"/></button>
              </div>
              <div className="flex-1 p-8 md:p-14 flex flex-col justify-between overflow-y-auto max-h-[70vh] md:max-h-none">
                 <div className="space-y-8">
                    <div className="flex justify-between items-start">
                       <div>
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-600 mb-2 block">{selectedProduct.categoria}</span>
                          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{selectedProduct.nombre}</h2>
                       </div>
                       <div className="text-right">
                          <p className="text-4xl font-black text-slate-900">S/ {selectedProduct.precio.toFixed(2)}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Precio Online</p>
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Marca / Lab</p><p className="font-bold text-slate-700">{selectedProduct.marca || 'Genérico'}</p></div>
                       <div className="p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Reg. Sanitario</p><p className="font-bold text-slate-700">{selectedProduct.registro_sanitario || 'S/N'}</p></div>
                    </div>

                    <div className="space-y-4">
                       <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3"><Info className="w-4 h-4 text-brand-500" /> Descripción del Producto</h4>
                       <p className="text-sm font-bold text-slate-600 leading-relaxed uppercase">{selectedProduct.descripcion_venta || 'Información detallada no disponible en este momento.'}</p>
                    </div>

                    {selectedProduct.uso_sugerido && (
                       <div className="p-8 bg-brand-50 rounded-[2rem] border border-brand-100 space-y-3">
                          <h4 className="text-[10px] font-black text-brand-700 uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-4 h-4" /> Uso Sugerido</h4>
                          <p className="text-xs font-black text-brand-900 leading-relaxed uppercase">{selectedProduct.uso_sugerido}</p>
                       </div>
                    )}
                 </div>

                 <div className="mt-12 pt-10 border-t border-slate-100">
                    <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="w-full py-6 text-white rounded-[2rem] font-black uppercase text-sm tracking-[0.2em] shadow-2xl flex items-center justify-center gap-4 transition-all hover:scale-105 active:scale-95" style={{backgroundColor: brandColor}}>
                       <ShoppingCart className="w-6 h-6" /> Agregar a mi pedido
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Drawer Carrito / Checkout */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
              
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-900 text-white rounded-2xl"><ShoppingCart className="w-6 h-6"/></div>
                    <div><h3 className="font-black text-xl uppercase tracking-tighter">Mi Pedido</h3><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{cart.length} Artículos</p></div>
                 </div>
                 <button onClick={() => setIsCartOpen(false)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"><X className="w-6 h-6"/></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                 {currentStep === 'cart' ? (
                    cart.length === 0 ? (
                       <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30 py-20">
                          <ShoppingBag className="w-20 h-20 text-slate-200" />
                          <div className="space-y-2">
                             <h4 className="font-black text-lg uppercase">Carrito Vacío</h4>
                             <p className="text-xs font-bold uppercase">Agrega productos para continuar</p>
                          </div>
                          <button onClick={() => setIsCartOpen(false)} className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">Explorar Catálogo</button>
                       </div>
                    ) : (
                       <div className="space-y-4">
                          {cart.map(item => (
                             <div key={item.producto.id} className="flex gap-4 p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100">
                                <div className="w-16 h-16 bg-white rounded-xl overflow-hidden shrink-0 border border-slate-200">{item.producto.imagen ? <img src={`data:image/png;base64,${item.producto.imagen}`} className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-slate-100" />}</div>
                                <div className="flex-1 min-w-0">
                                   <p className="font-black text-xs uppercase text-slate-800 truncate">{item.producto.nombre}</p>
                                   <p className="text-[10px] font-black text-brand-600 mt-1">S/ {item.producto.precio.toFixed(2)}</p>
                                   <div className="flex items-center gap-3 mt-3">
                                      <button onClick={() => updateCartQuantity(item.producto.id, -1)} className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-red-500"><Minus className="w-3.5 h-3.5"/></button>
                                      <span className="font-black text-xs w-6 text-center">{item.cantidad}</span>
                                      <button onClick={() => updateCartQuantity(item.producto.id, 1)} className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-brand-600"><Plus className="w-3.5 h-3.5"/></button>
                                   </div>
                                </div>
                                <button onClick={() => updateCartQuantity(item.producto.id, -item.cantidad)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                             </div>
                          ))}
                       </div>
                    )
                 ) : currentStep === 'details' ? (
                    <div className="space-y-8">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Datos de Entrega</h4>
                       <div className="space-y-4">
                          <input type="text" placeholder="Nombre Completo" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black uppercase outline-none focus:bg-white" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                          <input type="tel" placeholder="WhatsApp / Celular" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black outline-none focus:bg-white" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                          
                          <div className="grid grid-cols-2 gap-2">
                             <button onClick={() => setDeliveryType('recojo')} className={`p-4 rounded-2xl font-black text-[9px] uppercase border-2 flex flex-col items-center gap-2 transition-all ${deliveryType === 'recojo' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 bg-slate-50 text-slate-400'}`}><MapPin className="w-4 h-4"/> Recojo</button>
                             <button onClick={() => setDeliveryType('delivery')} className={`p-4 rounded-2xl font-black text-[9px] uppercase border-2 flex flex-col items-center gap-2 transition-all ${deliveryType === 'delivery' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 bg-slate-50 text-slate-400'}`}><Truck className="w-4 h-4"/> Delivery</button>
                          </div>

                          {deliveryType === 'recojo' ? (
                             <select className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black uppercase outline-none" value={clientData.sede} onChange={e => setClientData({...clientData, sede: e.target.value})}>
                                <option value="">Selecciona Sede de Recojo</option>
                                {(config.sedes_recojo || []).map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                                <option value="Principal">Sede Principal</option>
                             </select>
                          ) : (
                             <textarea placeholder="Dirección Exacta / Referencia" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black uppercase h-24 outline-none focus:bg-white" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                          )}
                       </div>
                    </div>
                 ) : currentStep === 'payment' ? (
                    <div className="space-y-8">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Finalizar Pago</h4>
                       <div className="space-y-6">
                          <div className="p-8 bg-slate-900 text-white rounded-[2rem] text-center space-y-2">
                             <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Monto Final</p>
                             <h3 className="text-4xl font-black">S/ {cartTotal.toFixed(2)}</h3>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                             <button onClick={() => setPaymentMethod('yape')} className={`p-6 rounded-[1.5rem] border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'yape' ? 'border-[#742284] bg-[#742284]/5 text-[#742284]' : 'border-slate-100 opacity-60'}`}>
                                <div className="w-10 h-10 bg-[#742284] rounded-xl flex items-center justify-center text-white font-black">Y</div>
                                <span className="text-[10px] font-black uppercase">Yape</span>
                             </button>
                             <button onClick={() => setPaymentMethod('plin')} className={`p-6 rounded-[1.5rem] border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'plin' ? 'border-[#00A9E0] bg-[#00A9E0]/5 text-[#00A9E0]' : 'border-slate-100 opacity-60'}`}>
                                <div className="w-10 h-10 bg-[#00A9E0] rounded-xl flex items-center justify-center text-white font-black">P</div>
                                <span className="text-[10px] font-black uppercase">Plin</span>
                             </button>
                          </div>

                          <div className="p-8 border-2 border-dashed border-slate-200 rounded-[2rem] space-y-4">
                             <div className="flex justify-center mb-4"><div className="w-48 h-48 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 font-black text-[10px] uppercase text-center p-6 border border-slate-200">Aquí se mostrará el QR de {paymentMethod.toUpperCase()}</div></div>
                             <div className="text-center space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase">A nombre de:</p>
                                <p className="font-black text-slate-800 uppercase text-xs">{paymentMethod === 'yape' ? config.yapeName || 'ADMINISTRADOR' : config.plinName || 'ADMINISTRADOR'}</p>
                                <p className="font-black text-brand-600 text-lg">{paymentMethod === 'yape' ? config.yapeNumber || '9XX XXX XXX' : config.plinNumber || '9XX XXX XXX'}</p>
                             </div>
                          </div>
                          
                          <p className="text-[9px] font-bold text-slate-400 text-center uppercase leading-relaxed italic px-6">Al dar click en finalizar, se te redirigirá a WhatsApp para enviar el voucher y confirmar tu pedido.</p>
                       </div>
                    </div>
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in">
                       <div className="w-24 h-24 bg-brand-500 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-brand-200"><CheckCircle2 className="w-12 h-12 animate-bounce"/></div>
                       <div className="space-y-2">
                          <h4 className="text-2xl font-black uppercase tracking-tighter">¡Pedido Generado!</h4>
                          <p className="text-xs font-bold text-slate-400 uppercase max-w-[250px] mx-auto">Tu comprobante está listo. Envía el mensaje de WhatsApp para que el establecimiento procese tu compra.</p>
                       </div>
                       <button onClick={() => { setIsCartOpen(false); setCart([]); setCurrentStep('cart'); }} className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-105 active:scale-95">Regresar a la Tienda</button>
                    </div>
                 )}
              </div>

              {currentStep !== 'success' && cart.length > 0 && (
                 <div className="p-8 border-t border-slate-100 space-y-6">
                    <div className="flex justify-between items-end">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal del Pedido</p>
                       <p className="text-2xl font-black text-slate-900">S/ {cartTotal.toFixed(2)}</p>
                    </div>

                    <div className="flex gap-2">
                       {currentStep !== 'cart' && <button onClick={() => setCurrentStep(currentStep === 'payment' ? 'details' : 'cart')} className="p-5 bg-slate-100 rounded-2xl text-slate-500 hover:bg-slate-200"><ArrowLeft className="w-5 h-5"/></button>}
                       <button 
                         onClick={() => {
                            if (currentStep === 'cart') setCurrentStep('details');
                            else if (currentStep === 'details') {
                               if (!clientData.nombre || !clientData.telefono || (deliveryType === 'recojo' && !clientData.sede) || (deliveryType === 'delivery' && !clientData.direccion)) {
                                  alert("Por favor completa todos tus datos.");
                                  return;
                               }
                               setCurrentStep('payment');
                            }
                            else if (currentStep === 'payment') handleFinishOrder();
                         }} 
                         disabled={isOrderLoading}
                         className="flex-1 py-5 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95" 
                         style={{backgroundColor: brandColor}}
                       >
                          {isOrderLoading ? <Loader2 className="animate-spin w-5 h-5"/> : (
                             <>
                               {currentStep === 'cart' ? 'Continuar con Pedido' : currentStep === 'details' ? 'Elegir Pago' : 'Confirmar en WhatsApp'} 
                               <ChevronRight className="w-5 h-5" />
                             </>
                          )}
                       </button>
                    </div>
                 </div>
              )}

           </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto py-24 relative overflow-hidden" style={{backgroundColor: brandColor}}>
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="max-w-7xl mx-auto px-10 flex flex-col md:flex-row justify-between items-center gap-16 relative z-10 text-white">
           <div className="space-y-8 max-w-md text-center md:text-left">
              <div className="flex items-center gap-6 justify-center md:justify-start">
                 {config.footerLogoUrl ? (
                   <img src={config.footerLogoUrl} className="h-20 object-contain drop-shadow-2xl" />
                 ) : (
                   <div className="flex items-center gap-4 bg-white/10 p-5 rounded-[2rem] border border-white/20">
                     <bizIcons.main className="w-10 h-10 text-white" />
                     <span className="font-black text-4xl tracking-tighter uppercase text-white">{config.nombreComercial || config.code}</span>
                   </div>
                 )}
              </div>
              <p className="text-sm font-bold leading-relaxed italic border-l-4 border-white/40 pl-8 uppercase tracking-widest opacity-90 text-white">"{config.footer_description || 'Excelencia y garantía en cada servicio.'}"</p>
           </div>
           <div className="text-right flex flex-col items-center md:items-end gap-10">
              <div className="flex gap-4">
                  {config.facebook_url && <a href={config.facebook_url} target="_blank" rel="noreferrer" className="p-6 bg-white/10 rounded-full hover:bg-white hover:text-slate-900 transition-all shadow-xl text-white"><Facebook className="w-8 h-8"/></a>}
                  {config.instagram_url && <a href={config.instagram_url} target="_blank" rel="noreferrer" className="p-6 bg-white/10 rounded-full hover:bg-white hover:text-slate-900 transition-all shadow-xl text-white"><Instagram className="w-8 h-8"/></a>}
                  {config.tiktok_url && <a href={config.tiktok_url} target="_blank" rel="noreferrer" className="p-6 bg-white/10 rounded-full hover:bg-white hover:text-slate-900 transition-all shadow-xl text-white"><Music2 className="w-8 h-8"/></a>}
                  {config.whatsappHelpNumber && <a href={`https://wa.me/${config.whatsappHelpNumber}`} target="_blank" rel="noreferrer" className="p-6 bg-white/10 rounded-full hover:bg-white hover:text-slate-900 transition-all shadow-xl text-white"><MessageCircle className="w-8 h-8"/></a>}
              </div>
              <div className="space-y-3 opacity-60 text-center md:text-right text-white">
                <p className="text-[11px] font-black uppercase tracking-[0.5em]">LEMON BI POWERED • 2025</p>
                <p className="text-[9px] font-black uppercase tracking-widest">Tecnología Inteligente para el Cuidado de la Salud</p>
              </div>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default StoreView;