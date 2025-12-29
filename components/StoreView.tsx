
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, Facebook, Instagram, CheckCircle2, 
  Loader2, RefreshCw, Trash2, Smartphone, 
  Layers, Tag, SearchX, PawPrint, ChevronRight,
  Upload, Camera, Image as ImageIcon,
  QrCode, ShieldCheck, CreditCard, Clock, ChevronLeft,
  Citrus, Zap, ShieldCheck as Shield, User,
  ChevronDown, ExternalLink, Sparkles, Globe, Heart,
  Star
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

type StoreStep = 'cart' | 'details' | 'payment' | 'voucher' | 'processing' | 'success';

const StoreView: React.FC<StoreViewProps> = ({ session, config, onBack }) => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<StoreStep>('cart');
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [cartAnimate, setCartAnimate] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin'>('yape');
  const [deliveryType, setDeliveryType] = useState<'recojo' | 'delivery'>('recojo');
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '' });
  const [voucherImage, setVoucherImage] = useState<string | null>(null);
  const [isOrderLoading, setIsOrderLoading] = useState(false);

  const brandColor = config?.colorPrimario || '#84cc16'; 
  const secondaryColor = config?.colorSecundario || '#1e293b';
  
  const slideImages = useMemo(() => 
    (config.slide_images || []).filter(img => img && img.trim() !== ''), 
    [config.slide_images]
  );

  const tickerMessages = [
    { text: "Envíos rápidos a nivel nacional", icon: <Truck className="w-3 h-3"/> },
    { text: "Pagos seguros con Yape y Plin", icon: <Shield className="w-3 h-3"/> },
    { text: "Asesoría personalizada por WhatsApp", icon: <MessageCircle className="w-3 h-3"/> },
    { text: "Garantía de productos originales", icon: <CheckCircle2 className="w-3 h-3"/> }
  ];

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.producto.precio * item.cantidad, 0);
  }, [cart]);

  const totalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.cantidad, 0);
  }, [cart]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    productos.forEach(p => {
       const cat = p.categoria_personalizada || p.categoria || 'General';
       const hiddenCats = config.hiddenCategories || [];
       if (!hiddenCats.includes(cat)) {
          cats.add(cat);
       }
    });
    return ['Todas', ...Array.from(cats)].sort();
  }, [productos, config.hiddenCategories]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % tickerMessages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (slideImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slideImages.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slideImages]);

  const addToCart = (producto: Producto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCartAnimate(true);
    setTimeout(() => setCartAnimate(false), 500);
    setCart(prev => {
      const existing = prev.find(item => item.producto.id === producto.id);
      if (existing) {
        return prev.map(item => item.producto.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  };

  const updateCartQuantity = (id: number, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.producto.id === id) {
          const newQty = Math.max(0, item.cantidad + delta);
          return { ...item, cantidad: newQty };
        }
        return item;
      }).filter(item => item.cantidad > 0);
    });
  };

  const handleVoucherUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setVoucherImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    setErrorMsg(null);
    const client = new OdooClient(session.url, session.db, session.useProxy);
    const fieldSets = [['display_name', 'list_price', 'categ_id', 'image_128', 'qty_available', 'uom_id', 'description_sale'], ['display_name', 'list_price', 'categ_id', 'image_128', 'uom_id']];
    try {
      const extrasMap = await getProductExtras(config.code);
      let data = null;
      for (const fields of fieldSets) {
        try {
          data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], fields, { limit: 1000, order: 'display_name asc' });
          if (data && Array.isArray(data)) break;
        } catch (e) { console.warn("Fallback Odoo fields"); }
      }
      if (data && Array.isArray(data)) {
        setProductos(data.map((p: any) => {
          const extra = extrasMap[p.id];
          return {
            id: p.id,
            nombre: p.display_name,
            precio: p.list_price || 0,
            costo: 0,
            categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
            stock: p.qty_available || 0,
            imagen: p.image_128 || p.image_medium || p.image_small || p.image_1920,
            descripcion_venta: extra?.descripcion_lemon || p.description_sale || '',
            uso_sugerido: extra?.instrucciones_lemon || '',
            categoria_personalizada: extra?.categoria_personalizada || '',
            uom_id: Array.isArray(p.uom_id) ? p.uom_id[0] : (typeof p.uom_id === 'number' ? p.uom_id : 1)
          };
        }));
      }
    } catch (e: any) { setErrorMsg(`Error: ${e.message}`); } finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, [session, config.code]);

  const filteredProducts = useMemo(() => {
    const hiddenIds = config.hiddenProducts || [];
    const hiddenCats = config.hiddenCategories || [];
    return productos.filter(p => {
       const isHidden = hiddenIds.includes(p.id);
       const catName = p.categoria_personalizada || p.categoria || 'General';
       const isCatHidden = hiddenCats.includes(catName);
       const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
       const matchesCategory = selectedCategory === 'Todas' || catName === selectedCategory;
       return !isHidden && !isCatHidden && matchesSearch && matchesCategory;
    });
  }, [productos, searchTerm, selectedCategory, config]);

  const handleFinishOrder = async () => {
    if (isOrderLoading) return;
    setIsOrderLoading(true);
    try {
      const waNumber = config.whatsappNumbers?.split(',')[0].trim() || '51975615244';
      const orderRef = `WEB-${Date.now().toString().slice(-6)}`;
      const client = new OdooClient(session.url, session.db, session.useProxy);
      
      const partnerSearch = await client.searchRead(session.uid, session.apiKey, 'res.partner', [['name', '=', clientData.nombre]], ['id'], { limit: 1 });
      let partnerId = partnerSearch.length > 0 ? partnerSearch[0].id : null;
      if (!partnerId) {
          partnerId = await client.create(session.uid, session.apiKey, 'res.partner', {
              name: clientData.nombre, 
              phone: clientData.telefono, 
              street: clientData.direccion || 'Pedido Web', 
              company_id: session.companyId
          });
      }

      const orderLines = cart.map(item => [0, 0, {
          product_id: item.producto.id, 
          product_uom_qty: item.cantidad, 
          price_unit: item.producto.precio, 
          product_uom: item.producto.uom_id || 1, 
          name: item.producto.nombre
      }]);

      await client.create(session.uid, session.apiKey, 'sale.order', {
          partner_id: partnerId, 
          company_id: session.companyId, 
          order_line: orderLines, 
          origin: `TIENDA WEB: ${orderRef}`,
          note: `Pago: ${paymentMethod.toUpperCase()} | Entrega: ${deliveryType.toUpperCase()} | Titular: ${paymentMethod === 'yape' ? config.yapeName : config.plinName}`,
          state: 'draft' 
      });

      await supabase.from('pedidos_tienda').insert([{
        order_name: orderRef, 
        cliente_nombre: clientData.nombre, 
        monto: cartTotal, 
        voucher_url: voucherImage || '', 
        empresa_code: config.code, 
        estado: 'pendiente'
      }]);

      const message = `*NUEVO PEDIDO WEB - ${config.nombreComercial || config.code}*\n\nRef: ${orderRef}\nCliente: ${clientData.nombre}\nCelular: ${clientData.telefono}\n\n*Pedido:* \n${cart.map(i => `• ${i.cantidad}x ${i.producto.nombre}`).join('\n')}\n\n*Total:* S/ ${cartTotal.toFixed(2)}\n*Método:* ${paymentMethod.toUpperCase()}\n*Entrega:* ${deliveryType.toUpperCase()}${deliveryType === 'delivery' ? `\n*Dir:* ${clientData.direccion}` : ''}\n\n_Ya realicé el pago y adjunté mi voucher._`;
      
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank');
      
      setCurrentStep('success');
    } catch (err: any) { 
      alert("Error al procesar el pedido. Revise su conexión."); 
    } finally { 
      setIsOrderLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col relative overflow-x-hidden selection:bg-brand-100">
      
      <style>{`
        @keyframes kenburns {
          from { transform: scale(1.05); }
          to { transform: scale(1.18); }
        }
        @keyframes orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes float-joy {
          0% { transform: translateY(0) rotate(0); opacity: 0; }
          20% { opacity: 0.8; }
          80% { opacity: 0.8; }
          100% { transform: translateY(-100px) rotate(45deg); opacity: 0; }
        }
        @keyframes cart-pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(132, 204, 22, 0.4); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(132, 204, 22, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(132, 204, 22, 0); }
        }
        .animate-kenburns {
          animation: kenburns 15s linear infinite alternate;
        }
        .animate-orbit {
          animation: orbit 8s linear infinite;
        }
        .animate-cart-pulse {
          animation: cart-pulse 2s infinite;
        }
        .joy-particle {
          position: absolute;
          pointer-events: none;
          animation: float-joy 5s infinite linear;
        }
      `}</style>

      {/* TICKER SUPERIOR */}
      <div className="bg-slate-900 text-white py-2 z-[70] relative hidden md:block overflow-hidden h-9">
         <div className="max-w-7xl mx-auto flex justify-center items-center h-full">
            {tickerMessages.map((msg, i) => (
              <div key={i} className={`flex items-center gap-2 transition-all duration-700 absolute ${i === tickerIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                 <span className="text-brand-400">{msg.icon}</span>
                 <span className="text-[10px] font-black uppercase tracking-[0.3em]">{msg.text}</span>
              </div>
            ))}
         </div>
      </div>

      {/* HEADER */}
      <header className={`fixed top-0 md:top-9 left-0 right-0 z-[60] transition-all duration-500`}>
        <div className={`transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-xl shadow-xl py-3 border-b border-slate-100' : 'bg-white py-5 shadow-sm border-b border-slate-100'}`}>
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between gap-4 md:gap-10">
             <div className="flex items-center gap-4 shrink-0 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
                {onBack && (
                  <button onClick={onBack} className="p-2.5 text-slate-400 hover:text-slate-900 transition-all rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100">
                    <ArrowLeft className="w-5 h-5"/>
                  </button>
                )}
                <div className="relative">
                  {config.logoUrl ? (
                    <img src={config.logoUrl} className={`transition-all duration-500 object-contain ${scrolled ? 'h-8' : 'h-11'}`} alt="Logo" />
                  ) : (
                    <div className="flex items-center gap-2">
                       <Citrus className="w-8 h-8 text-brand-500" />
                       <h1 className="font-black text-slate-900 uppercase text-lg tracking-tighter leading-none">{config.nombreComercial || config.code}</h1>
                    </div>
                  )}
                </div>
             </div>
             
             <div className="flex-1 max-w-xl group">
                <div className="relative">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <Search className="w-4 h-4 text-slate-300 group-focus-within:text-brand-500 transition-colors"/>
                   </div>
                   <input 
                    type="text" 
                    placeholder="Busca productos..." 
                    className="w-full pl-12 pr-6 py-3.5 bg-slate-50 border border-slate-100 rounded-full text-[11px] font-bold outline-none transition-all focus:bg-white focus:ring-4 focus:ring-brand-500/5 shadow-inner" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                   />
                </div>
             </div>

             <div className="hidden md:block">
                <button 
                    onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} 
                    className={`relative p-4 bg-slate-900 text-white rounded-2xl shadow-xl transition-all hover:scale-110 active:scale-95 ${cartAnimate ? 'bg-brand-500 scale-110' : 'hover:bg-slate-800'}`}
                >
                    <ShoppingCart className="w-5 h-5" />
                    {totalItems > 0 && (
                    <span className="absolute -top-2 -right-2 bg-brand-500 text-white text-[10px] w-6 h-6 rounded-full flex items-center justify-center font-black border-2 border-white shadow-lg">
                        {totalItems}
                    </span>
                    )}
                </button>
             </div>
          </div>
        </div>
      </header>

      <div className="h-[76px] md:h-[110px]"></div>

      {/* SECCIÓN DEL SLIDER "CÁPSULA ALEGRE" */}
      {!loading && slideImages.length > 0 && !searchTerm && (
        <section className="w-full px-4 md:px-12 py-6 md:py-10 relative z-10 overflow-hidden">
           <div className="max-w-7xl mx-auto relative group">
              
              {/* Marco animado perimetral */}
              <div className="absolute -inset-1.5 bg-gradient-to-r from-brand-400 via-blue-400 to-purple-400 rounded-[3rem] md:rounded-[4rem] opacity-30 blur-sm animate-pulse"></div>
              <div className="absolute -inset-0.5 bg-white rounded-[2.8rem] md:rounded-[3.8rem] z-0"></div>

              {/* Contenedor principal de slides */}
              <div className="relative aspect-[4/5] md:aspect-[21/9] rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] bg-slate-50 z-10">
                 
                 {/* Partículas decorativas de alegría */}
                 <div className="absolute inset-0 z-20 pointer-events-none">
                    <Star className="joy-particle text-amber-400 w-4 h-4 top-[20%] left-[10%] [animation-delay:0s]"/>
                    <div className="joy-particle bg-blue-400 w-2 h-2 rounded-full top-[40%] right-[15%] [animation-delay:1.5s]"></div>
                    <Star className="joy-particle text-brand-400 w-5 h-5 bottom-[30%] left-[20%] [animation-delay:3s]"/>
                    <div className="joy-particle bg-pink-400 w-3 h-3 rounded-full top-[10%] right-[30%] [animation-delay:0.5s]"></div>
                 </div>

                 {slideImages.map((img, idx) => (
                    <div 
                        key={idx} 
                        className={`absolute inset-0 transition-all duration-[1500ms] cubic-bezier(0.34, 1.56, 0.64, 1) transform ${idx === currentSlide ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-110 rotate-1 pointer-events-none'}`}
                    >
                        <img src={img} className={`w-full h-full object-cover ${idx === currentSlide ? 'animate-kenburns' : ''}`} alt={`Banner ${idx}`} />
                        {/* Overlay ultra sutil */}
                        <div className="absolute inset-0 bg-black/5"></div>
                    </div>
                 ))}

                 {/* Controles de navegación */}
                 {slideImages.length > 1 && (
                    <>
                        <button 
                            onClick={() => setCurrentSlide(prev => (prev - 1 + slideImages.length) % slideImages.length)} 
                            className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 p-3 md:p-5 bg-white/60 backdrop-blur-xl text-slate-800 rounded-full border border-white/80 hover:bg-white hover:scale-110 active:scale-90 transition-all z-30 shadow-xl opacity-0 group-hover:opacity-100"
                        >
                            <ChevronLeft className="w-5 h-5 md:w-8 md:h-8"/>
                        </button>
                        <button 
                            onClick={() => setCurrentSlide(prev => (prev + 1) % slideImages.length)} 
                            className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 p-3 md:p-5 bg-white/60 backdrop-blur-xl text-slate-800 rounded-full border border-white/80 hover:bg-white hover:scale-110 active:scale-90 transition-all z-30 shadow-xl opacity-0 group-hover:opacity-100"
                        >
                            <ChevronRight className="w-5 h-5 md:w-8 md:h-8"/>
                        </button>
                        
                        <div className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 flex gap-3 z-30 px-6 py-3 bg-black/20 backdrop-blur-md rounded-full">
                            {slideImages.map((_, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => setCurrentSlide(i)} 
                                    className={`h-2 rounded-full transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) ${i === currentSlide ? 'w-12 bg-white scale-110' : 'w-2 bg-white/40 hover:bg-white/60'}`}
                                ></button>
                            ))}
                        </div>
                    </>
                 )}
              </div>
           </div>
        </section>
      )}

      {/* CATEGORÍAS */}
      {!loading && (
         <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-[64px] md:top-[116px] z-50 py-4 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 md:px-8 overflow-x-auto flex gap-3 no-scrollbar scroll-smooth">
               {availableCategories.map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => { setSelectedCategory(cat); window.scrollTo({top: searchTerm ? 0 : 350, behavior: 'smooth'}); }}
                    className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all flex items-center gap-2.5 border-2 ${selectedCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-white hover:border-slate-100 hover:text-slate-600'}`}
                  >
                     {cat === 'Todas' ? <Layers className="w-3.5 h-3.5" /> : (cat.toLowerCase().includes('perro') || cat.toLowerCase().includes('mascota') ? <PawPrint className="w-3.5 h-3.5" /> : <Tag className="w-3.5 h-3.5" />)}
                     {cat}
                  </button>
               ))}
            </div>
         </div>
      )}

      {/* CATÁLOGO DE PRODUCTOS */}
      <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full min-h-[60vh]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-6">
             <div className="relative">
                <Loader2 className="w-16 h-16 animate-spin text-brand-500" />
                <Citrus className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-brand-600 animate-pulse" />
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Sincronizando Catálogo...</p>
          </div>
        ) : (
          <>
            <div className="mb-14 flex items-end justify-between border-b border-slate-100 pb-8">
               <div>
                  <div className="flex items-center gap-3 mb-2">
                     <Sparkles className="w-5 h-5 text-amber-500 animate-pulse"/>
                     <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-slate-900">
                       {selectedCategory === 'Todas' ? 'Catálogo Completo' : selectedCategory}
                     </h2>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Productos frescos directo para ti</p>
               </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-10 animate-in fade-in slide-in-from-bottom-10 duration-1000">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-48 text-center flex flex-col items-center gap-6">
                   <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-200">
                      <SearchX className="w-12 h-12" />
                   </div>
                   <p className="font-black uppercase tracking-widest text-xs text-slate-400">No encontramos resultados</p>
                </div>
              ) : filteredProducts.map(p => (
                <div key={p.id} onClick={() => setSelectedProduct(p)} className="bg-white p-4 md:p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 cursor-pointer relative overflow-hidden hover:-translate-y-2">
                  <div className="aspect-square bg-slate-50 rounded-[2rem] mb-6 flex items-center justify-center overflow-hidden border border-slate-50 relative group-hover:bg-white transition-colors">
                    {p.imagen ? (
                      <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-700 p-2" alt={p.nombre} />
                    ) : (
                      <Package className="w-12 h-12 text-slate-200" />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col">
                    <span className="text-[8px] font-black uppercase text-brand-600 tracking-widest mb-2 block">{p.categoria_personalizada || p.categoria}</span>
                    <h3 className="text-[11px] md:text-[12px] font-black text-slate-800 uppercase line-clamp-2 h-10 tracking-tight leading-tight mb-4">{p.nombre}</h3>
                    <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-50">
                      <span className="text-base md:text-lg font-black text-slate-900 tracking-tighter">S/ {p.precio.toFixed(2)}</span>
                      <button 
                        onClick={(e) => addToCart(p, e)} 
                        className="p-3 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-brand-500 hover:scale-110 active:scale-95 transition-all"
                      >
                        <Plus className="w-4 h-4"/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* CARRITO FLOTANTE DINÁMICO (Optimizado Móvil) */}
      {!isCartOpen && totalItems > 0 && (
        <button 
            onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }}
            className="fixed bottom-10 right-8 md:bottom-12 md:right-12 z-[100] w-20 h-20 md:w-24 md:h-24 bg-brand-500 text-white rounded-full shadow-[0_25px_50px_-12px_rgba(132,204,22,0.6)] flex flex-col items-center justify-center transition-all hover:scale-110 active:scale-90 animate-cart-pulse group"
        >
            <div className="relative mb-1">
                <ShoppingCart className="w-8 h-8 md:w-10 md:h-10 group-hover:rotate-12 transition-transform"/>
                <span className="absolute -top-3 -right-3 w-8 h-8 bg-slate-900 text-white text-[10px] md:text-[12px] font-black rounded-full flex items-center justify-center border-4 border-brand-500 shadow-xl">
                    {totalItems}
                </span>
            </div>
            <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">Pagar</span>
        </button>
      )}

      {/* FOOTER */}
      {!loading && (
        <footer className="text-white py-12 px-6 md:px-12 border-t border-white/5" style={{ backgroundColor: secondaryColor }}>
           <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
              <div className="flex items-center gap-6 flex-1">
                 {config.footerLogoUrl ? (
                   <img src={config.footerLogoUrl} className="h-10 object-contain" alt="Footer Logo" />
                 ) : (
                   <div className="flex items-center gap-2">
                      <Citrus className="w-8 h-8 text-brand-500" />
                      <h2 className="text-xl font-black uppercase tracking-tighter leading-none">{config.nombreComercial || config.code}</h2>
                   </div>
                 )}
                 <div className="h-8 w-px bg-white/10 hidden md:block"></div>
                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 max-w-[200px] leading-relaxed">
                    {config.footer_description || "Brindando bienestar y salud en cada pedido."}
                 </p>
              </div>

              <div className="flex-1 flex justify-center">
                 <a 
                    href={`https://wa.me/${(config.whatsappHelpNumber || '51975615244').replace(/\D/g, '')}`} 
                    target="_blank" 
                    className="flex items-center gap-4 bg-white/5 px-6 py-4 rounded-3xl border border-white/5 hover:bg-brand-500 transition-all group"
                 >
                    <div className="p-3 bg-brand-500/20 rounded-2xl group-hover:bg-white/20 transition-colors">
                       <MessageCircle className="w-5 h-5"/>
                    </div>
                    <div className="text-left">
                       <p className="text-[8px] font-black uppercase text-brand-500 group-hover:text-white/70 tracking-widest">¿Necesitas Ayuda?</p>
                       <p className="text-xs font-black uppercase tracking-widest group-hover:text-white">{config.whatsappHelpNumber || "Chat Directo"}</p>
                    </div>
                 </a>
              </div>

              <div className="flex-1 flex flex-col items-center md:items-end gap-6">
                 <div className="flex gap-4">
                    {config.facebook_url && <a href={config.facebook_url} target="_blank" className="p-3 bg-white/5 rounded-xl hover:bg-blue-600 transition-all border border-white/5"><Facebook className="w-4 h-4"/></a>}
                    {config.instagram_url && <a href={config.instagram_url} target="_blank" className="p-3 bg-white/5 rounded-xl hover:bg-pink-600 transition-all border border-white/5"><Instagram className="w-4 h-4"/></a>}
                 </div>
                 <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">
                    <span>Desarrollado por</span>
                    <a href="https://gaorsystem-pe.vercel.app/" target="_blank" className="text-brand-400 flex items-center gap-1 hover:text-white transition-colors">
                       GaorSystem Perú <ExternalLink className="w-2.5 h-2.5"/>
                    </a>
                 </div>
              </div>
           </div>
        </footer>
      )}

      {/* MODAL DETALLE DE PRODUCTO */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md animate-in fade-in" onClick={() => setSelectedProduct(null)}></div>
           <div className="relative bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in duration-300 max-h-[90vh]">
              <div className="w-full md:w-1/2 bg-slate-50 flex items-center justify-center p-12 md:p-20 relative border-r border-slate-100">
                 {selectedProduct.imagen ? (
                   <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-w-full max-h-full object-contain mix-blend-multiply drop-shadow-xl" alt={selectedProduct.nombre} />
                 ) : (
                   <Package className="w-32 h-32 text-slate-200" />
                 )}
                 <button onClick={() => setSelectedProduct(null)} className="absolute top-8 left-8 p-4 bg-white rounded-3xl shadow-xl text-slate-400 md:hidden"><X className="w-6 h-6"/></button>
              </div>
              <div className="w-full md:w-1/2 p-10 md:p-20 flex flex-col bg-white overflow-y-auto">
                 <div className="flex justify-between items-start mb-8">
                    <span className="bg-brand-50 text-brand-600 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">{selectedProduct.categoria_personalizada || selectedProduct.categoria}</span>
                    <button onClick={() => setSelectedProduct(null)} className="hidden md:flex p-3 bg-slate-50 text-slate-300 hover:text-slate-900 rounded-2xl transition-all"><X className="w-6 h-6"/></button>
                 </div>
                 <h2 className="text-4xl font-black uppercase text-slate-900 tracking-tighter leading-none mb-8">{selectedProduct.nombre}</h2>
                 <div className="flex items-center gap-6 mb-12 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 w-fit pr-12">
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Precio Online</span>
                       <span className="text-4xl font-black text-slate-900 tracking-tighter">S/ {selectedProduct.precio.toFixed(2)}</span>
                    </div>
                 </div>
                 {selectedProduct.descripcion_venta && (
                     <div className="space-y-6 mb-12">
                        <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em] pb-4 border-b border-slate-100 flex items-center gap-2"><Info className="w-4 h-4"/> Detalles</h4>
                        <p className="text-[13px] font-bold text-slate-600 uppercase leading-relaxed text-justify">{selectedProduct.descripcion_venta}</p>
                     </div>
                 )}
                 <button 
                    onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} 
                    className="w-full py-8 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase text-sm tracking-[0.3em] flex items-center justify-center gap-4 hover:bg-brand-500 transition-all shadow-2xl mt-auto"
                 >
                    <ShoppingCart className="w-6 h-6"/> Agregar al Carrito
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* DRAWER DEL CARRITO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md animate-in fade-in" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col p-8 md:p-12 overflow-y-auto animate-in slide-in-from-right duration-500">
              <div className="flex justify-between items-center mb-16">
                 <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900">
                    {currentStep === 'cart' ? 'Tu Bolsa' : 'Pago'}
                 </h2>
                 <button onClick={() => setIsCartOpen(false)} className="p-5 bg-slate-50 rounded-3xl hover:bg-slate-100 text-slate-400"><X className="w-7 h-7"/></button>
              </div>

              {currentStep === 'cart' && (
                 <div className="flex-1 flex flex-col">
                    {cart.length === 0 ? (
                       <div className="py-32 text-center opacity-20 flex flex-col items-center gap-6">
                          <ShoppingCart className="w-20 h-20"/>
                          <p className="font-black uppercase tracking-widest text-xs">Vacio</p>
                       </div>
                    ) : (
                      <>
                        <div className="space-y-5 overflow-y-auto flex-1">
                          {cart.map(i => (
                             <div key={i.producto.id} className="flex gap-6 items-center bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
                                <div className="w-20 h-20 bg-white rounded-3xl overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                                   {i.producto.imagen ? <img src={`data:image/png;base64,${i.producto.imagen}`} className="w-full h-full object-contain" /> : <Package className="w-10 h-10 text-slate-100"/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                   <p className="text-[11px] font-black uppercase truncate text-slate-800">{i.producto.nombre}</p>
                                   <p className="font-black text-sm text-brand-600 mt-2">S/ {i.producto.precio.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-4 bg-white p-2 rounded-2xl">
                                   <button onClick={() => updateCartQuantity(i.producto.id, -1)} className="p-3 text-slate-400"><Minus className="w-4 h-4"/></button>
                                   <span className="text-base font-black w-6 text-center">{i.cantidad}</span>
                                   <button onClick={() => updateCartQuantity(i.producto.id, 1)} className="p-3 text-slate-400"><Plus className="w-4 h-4"/></button>
                                </div>
                             </div>
                          ))}
                        </div>
                        <div className="pt-12">
                           <div className="flex justify-between items-center px-8 border-b border-slate-100 pb-8 mb-8">
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em]">Total</span>
                              <span className="text-4xl font-black text-slate-900 tracking-tighter">S/ {cartTotal.toFixed(2)}</span>
                           </div>
                           <button onClick={() => setCurrentStep('details')} className="w-full py-9 bg-slate-900 text-white rounded-[3rem] font-black uppercase text-xs tracking-[0.4em] hover:bg-brand-500 transition-all shadow-xl">Confirmar Pedido</button>
                        </div>
                      </>
                    )}
                 </div>
              )}

              {/* Otros pasos del checkout (simplificado para el ejemplo pero funcional) */}
              {currentStep === 'details' && (
                 <div className="space-y-12">
                    <div className="space-y-6">
                       <input type="text" placeholder="NOMBRE COMPLETO" className="w-full px-8 py-7 bg-slate-50 rounded-[2rem] outline-none font-bold text-sm uppercase shadow-inner" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                       <input type="tel" placeholder="CELULAR" className="w-full px-8 py-7 bg-slate-50 rounded-[2rem] outline-none font-bold text-sm shadow-inner" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                    </div>
                    <div className="flex gap-4">
                       <button onClick={() => setDeliveryType('recojo')} className={`flex-1 py-10 rounded-[2.5rem] border-2 font-black uppercase text-[10px] tracking-widest ${deliveryType === 'recojo' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-slate-50 text-slate-300 border-transparent'}`}>Recojo Sede</button>
                       <button onClick={() => setDeliveryType('delivery')} className={`flex-1 py-10 rounded-[2.5rem] border-2 font-black uppercase text-[10px] tracking-widest ${deliveryType === 'delivery' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-slate-50 text-slate-300 border-transparent'}`}>Delivery</button>
                    </div>
                    {deliveryType === 'delivery' && (
                       <textarea placeholder="DIRECCIÓN Y REFERENCIA..." className="w-full p-8 bg-slate-50 rounded-[2.5rem] outline-none font-bold h-40 shadow-inner text-sm uppercase resize-none" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                    )}
                    <div className="flex gap-4 pt-12">
                       <button onClick={() => setCurrentStep('cart')} className="flex-1 py-7 bg-slate-100 rounded-[2rem] font-black uppercase text-[10px] text-slate-400">Atrás</button>
                       <button onClick={() => setCurrentStep('payment')} disabled={!clientData.nombre || !clientData.telefono} className="flex-[2] py-7 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl disabled:opacity-20">Continuar</button>
                    </div>
                 </div>
              )}

              {currentStep === 'payment' && (
                 <div className="space-y-10 text-center">
                    <div className="bg-slate-50 p-10 rounded-[3rem] shadow-inner mb-6">
                       <h2 className="text-5xl font-black text-slate-900 tracking-tighter">S/ {cartTotal.toFixed(2)}</h2>
                    </div>
                    <div className="flex gap-4 p-2 bg-slate-100 rounded-[2rem]">
                       <button onClick={() => setPaymentMethod('yape')} className={`flex-1 py-5 rounded-[1.5rem] font-black uppercase text-[10px] ${paymentMethod === 'yape' ? 'bg-white text-purple-600 shadow-xl' : 'text-slate-400'}`}>Yape</button>
                       <button onClick={() => setPaymentMethod('plin')} className={`flex-1 py-5 rounded-[1.5rem] font-black uppercase text-[10px] ${paymentMethod === 'plin' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400'}`}>Plin</button>
                    </div>
                    <div className="aspect-square bg-slate-900 rounded-[3rem] flex items-center justify-center p-12 shadow-2xl overflow-hidden">
                       {paymentMethod === 'yape' ? (
                          config.yapeQR ? <img src={config.yapeQR} className="max-w-full max-h-full rounded-[2rem]" alt="QR Yape" /> : <QrCode className="text-white w-20 h-20 opacity-10"/>
                       ) : (
                          config.plinQR ? <img src={config.plinQR} className="max-w-full max-h-full rounded-[2rem]" alt="QR Plin" /> : <QrCode className="text-white w-20 h-20 opacity-10"/>
                       )}
                    </div>
                    <div className="flex gap-4 pt-12">
                       <button onClick={() => setCurrentStep('details')} className="flex-1 py-8 bg-slate-100 rounded-[2rem] font-black uppercase text-[10px] text-slate-400">Atrás</button>
                       <button onClick={() => setCurrentStep('voucher')} className="flex-[2] py-8 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl">Confirmar Pago</button>
                    </div>
                 </div>
              )}

              {currentStep === 'voucher' && (
                 <div className="space-y-10">
                    <div className="border-4 border-dashed rounded-[3rem] aspect-[3/4] flex flex-col items-center justify-center p-10 bg-slate-50 relative overflow-hidden group">
                       {voucherImage ? (
                          <img src={voucherImage} className="w-full h-full object-cover" alt="Voucher" />
                       ) : (
                          <label className="cursor-pointer flex flex-col items-center text-slate-300">
                             <Camera className="w-16 h-16 mb-8"/>
                             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-center">Subir foto del pago</p>
                             <input type="file" className="hidden" accept="image/*" onChange={handleVoucherUpload} />
                          </label>
                       )}
                    </div>
                    <button 
                       onClick={handleFinishOrder} 
                       disabled={!voucherImage || isOrderLoading} 
                       className="w-full py-8 bg-brand-500 text-white rounded-[2.5rem] font-black uppercase text-[11px] tracking-[0.4em] shadow-2xl flex items-center justify-center gap-4"
                    >
                       {isOrderLoading ? <Loader2 className="animate-spin w-6 h-6"/> : <CheckCircle2 className="w-6 h-6"/>} 
                       Confirmar Mi Compra
                    </button>
                 </div>
              )}

              {currentStep === 'success' && (
                 <div className="flex-1 flex flex-col items-center justify-center text-center space-y-16 animate-in zoom-in duration-700">
                    <div className="w-48 h-48 bg-brand-500 text-white rounded-full flex items-center justify-center shadow-2xl animate-bounce">
                       <CheckCircle2 className="w-20 h-20"/>
                    </div>
                    <div>
                       <h3 className="text-5xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-4">¡Listo!</h3>
                       <p className="text-sm font-bold text-slate-500 uppercase tracking-widest leading-relaxed">Pedido enviado con éxito. Atento a tu WhatsApp.</p>
                    </div>
                    <button 
                      onClick={() => { setIsCartOpen(false); setCart([]); setCurrentStep('cart'); }} 
                      className="w-full py-9 bg-slate-900 text-white rounded-[3rem] font-black uppercase tracking-[0.5em] text-[11px] shadow-2xl hover:bg-brand-500"
                    >
                      Seguir Comprando
                    </button>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default StoreView;
