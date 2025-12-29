
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
        @keyframes orbit-glow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes bounce-soft {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes cart-pulse-joy {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(132, 204, 22, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 25px rgba(132, 204, 22, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(132, 204, 22, 0); }
        }
        .animate-kenburns {
          animation: kenburns 15s linear infinite alternate;
        }
        .slider-glow-frame {
          background: linear-gradient(270deg, #84cc16, #0ea5e9, #f59e0b, #84cc16);
          background-size: 800% 800%;
          animation: orbit-glow 6s ease infinite;
        }
        .animate-cart-joy {
          animation: cart-pulse-joy 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        .joy-particle {
          position: absolute;
          pointer-events: none;
          animation: bounce-soft 3s infinite ease-in-out;
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
                    placeholder="Encuentra tu producto aquí..." 
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-full text-[11px] font-bold outline-none transition-all focus:bg-white focus:ring-4 focus:ring-brand-500/5 shadow-inner" 
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

      {/* SECCIÓN DEL SLIDER "CÁPSULA CON MARCO ANIMADO" */}
      {!loading && slideImages.length > 0 && !searchTerm && (
        <section className="w-full px-4 md:px-12 py-8 md:py-12 relative z-10 overflow-hidden">
           <div className="max-w-7xl mx-auto relative group">
              
              {/* Marco con Brillo Animado Orbitante */}
              <div className="absolute -inset-1.5 slider-glow-frame rounded-[3.5rem] md:rounded-[4.5rem] opacity-40 blur-md"></div>
              <div className="absolute -inset-0.5 bg-white rounded-[3.2rem] md:rounded-[4.2rem] z-0"></div>

              {/* Contenedor del Slide */}
              <div className="relative aspect-[4/5] md:aspect-[21/9] rounded-[3rem] md:rounded-[4rem] overflow-hidden shadow-[0_50px_100px_-25px_rgba(0,0,0,0.2)] bg-slate-100 z-10">
                 
                 {slideImages.map((img, idx) => (
                    <div 
                        key={idx} 
                        className={`absolute inset-0 transition-all duration-[1200ms] cubic-bezier(0.34, 1.56, 0.64, 1) transform ${idx === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'}`}
                    >
                        <img src={img} className={`w-full h-full object-cover ${idx === currentSlide ? 'animate-kenburns' : ''}`} alt={`Banner ${idx}`} />
                        <div className="absolute inset-0 bg-black/10"></div>
                    </div>
                 ))}

                 {/* Controles minimalistas */}
                 {slideImages.length > 1 && (
                    <>
                        <button 
                            onClick={() => setCurrentSlide(prev => (prev - 1 + slideImages.length) % slideImages.length)} 
                            className="absolute left-6 top-1/2 -translate-y-1/2 p-4 md:p-6 bg-white/30 backdrop-blur-xl text-slate-800 rounded-full border border-white/50 hover:bg-white hover:scale-110 active:scale-90 transition-all z-30 shadow-2xl opacity-0 group-hover:opacity-100"
                        >
                            <ChevronLeft className="w-6 h-6 md:w-8 md:h-8"/>
                        </button>
                        <button 
                            onClick={() => setCurrentSlide(prev => (prev + 1) % slideImages.length)} 
                            className="absolute right-6 top-1/2 -translate-y-1/2 p-4 md:p-6 bg-white/30 backdrop-blur-xl text-slate-800 rounded-full border border-white/50 hover:bg-white hover:scale-110 active:scale-90 transition-all z-30 shadow-2xl opacity-0 group-hover:opacity-100"
                        >
                            <ChevronRight className="w-6 h-6 md:w-8 md:h-8"/>
                        </button>
                        
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-30 p-2.5 bg-black/30 backdrop-blur-md rounded-full border border-white/20">
                            {slideImages.map((_, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => setCurrentSlide(i)} 
                                    className={`h-2.5 rounded-full transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) ${i === currentSlide ? 'w-16 bg-white scale-110' : 'w-2.5 bg-white/40 hover:bg-white/70'}`}
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
             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Sincronizando con Odoo...</p>
          </div>
        ) : (
          <>
            <div className="mb-14 flex items-end justify-between border-b border-slate-100 pb-8">
               <div>
                  <div className="flex items-center gap-3 mb-2">
                     <Sparkles className="w-5 h-5 text-amber-500 animate-pulse"/>
                     <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-slate-900 leading-none">
                       {selectedCategory === 'Todas' ? 'Nuestros Productos' : selectedCategory}
                     </h2>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Calidad garantizada para tu bienestar</p>
               </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-10 animate-in fade-in slide-in-from-bottom-10 duration-1000">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-48 text-center flex flex-col items-center gap-6">
                   <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-200">
                      <SearchX className="w-12 h-12" />
                   </div>
                   <p className="font-black uppercase tracking-widest text-[10px] text-slate-400">Sin resultados para tu búsqueda</p>
                </div>
              ) : filteredProducts.map(p => (
                <div key={p.id} onClick={() => setSelectedProduct(p)} className="bg-white p-4 md:p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.12)] transition-all duration-700 cursor-pointer relative overflow-hidden hover:-translate-y-3">
                  <div className="aspect-square bg-slate-50 rounded-[2rem] mb-6 flex items-center justify-center overflow-hidden border border-slate-100 relative group-hover:bg-white transition-colors duration-500">
                    {p.imagen ? (
                      <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-700 p-2" alt={p.nombre} />
                    ) : (
                      <Package className="w-12 h-12 text-slate-200" />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col">
                    <span className="text-[8px] font-black uppercase text-brand-600 tracking-widest mb-2 block">{p.categoria_personalizada || p.categoria}</span>
                    <h3 className="text-[11px] md:text-[12px] font-black text-slate-800 uppercase line-clamp-2 h-10 tracking-tight leading-tight group-hover:text-brand-600 transition-colors">{p.nombre}</h3>
                    <div className="mt-auto pt-6 flex items-center justify-between border-t border-slate-50">
                      <span className="text-base md:text-lg font-black text-slate-900 tracking-tighter">S/ {p.precio.toFixed(2)}</span>
                      <button 
                        onClick={(e) => addToCart(p, e)} 
                        className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-xl hover:bg-brand-500 hover:scale-110 active:scale-95 transition-all shadow-brand-500/10"
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

      {/* CARRITO FLOTANTE (Optimizado para Móvil) */}
      {!isCartOpen && totalItems > 0 && (
        <button 
            onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }}
            className="fixed bottom-8 right-6 md:bottom-12 md:right-12 z-[100] w-20 h-20 md:w-24 md:h-24 bg-brand-500 text-white rounded-full shadow-[0_30px_60px_-15px_rgba(132,204,22,0.6)] flex flex-col items-center justify-center transition-all hover:scale-110 active:scale-90 animate-cart-joy group"
        >
            <div className="relative mb-0.5">
                <ShoppingCart className="w-8 h-8 md:w-10 md:h-10 group-hover:rotate-12 transition-transform"/>
                <span className="absolute -top-3.5 -right-3.5 w-8 h-8 bg-slate-900 text-white text-[11px] font-black rounded-full flex items-center justify-center border-[3px] border-brand-500 shadow-xl">
                    {totalItems}
                </span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest hidden md:block">Checkout</span>
        </button>
      )}

      {/* FOOTER */}
      {!loading && (
        <footer className="text-white py-16 px-6 md:px-12 border-t border-white/5" style={{ backgroundColor: secondaryColor }}>
           <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
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
                    className="flex items-center gap-5 bg-white/5 px-8 py-5 rounded-[2.5rem] border border-white/10 hover:bg-brand-500 transition-all group shadow-2xl"
                 >
                    <div className="p-3 bg-brand-500/20 rounded-2xl group-hover:bg-white/20 transition-colors">
                       <MessageCircle className="w-6 h-6"/>
                    </div>
                    <div className="text-left">
                       <p className="text-[9px] font-black uppercase text-brand-500 group-hover:text-white/70 tracking-widest leading-none mb-1">¿Necesitas ayuda?</p>
                       <p className="text-sm font-black uppercase tracking-widest group-hover:text-white leading-none">{config.whatsappHelpNumber || "Chat Directo"}</p>
                    </div>
                 </a>
              </div>

              <div className="flex-1 flex flex-col items-center md:items-end gap-6">
                 <div className="flex gap-4">
                    {config.facebook_url && <a href={config.facebook_url} target="_blank" className="p-3.5 bg-white/5 rounded-2xl hover:bg-blue-600 transition-all border border-white/5"><Facebook className="w-5 h-5"/></a>}
                    {config.instagram_url && <a href={config.instagram_url} target="_blank" className="p-3.5 bg-white/5 rounded-2xl hover:bg-pink-600 transition-all border border-white/5"><Instagram className="w-5 h-5"/></a>}
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
           <div className="relative bg-white w-full max-w-5xl rounded-[4rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in duration-300 max-h-[90vh]">
              <div className="w-full md:w-1/2 bg-slate-50 flex items-center justify-center p-12 md:p-20 relative border-r border-slate-100">
                 {selectedProduct.imagen ? (
                   <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-w-full max-h-full object-contain mix-blend-multiply drop-shadow-2xl hover:scale-105 transition-transform duration-700" alt={selectedProduct.nombre} />
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
                 <div className="flex items-center gap-6 mb-12 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 w-fit pr-12">
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Precio Online</span>
                       <span className="text-4xl font-black text-slate-900 tracking-tighter">S/ {selectedProduct.precio.toFixed(2)}</span>
                    </div>
                 </div>
                 {selectedProduct.descripcion_venta && (
                     <div className="space-y-6 mb-12">
                        <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em] pb-4 border-b border-slate-100 flex items-center gap-2"><Info className="w-4 h-4"/> Detalles</h4>
                        <p className="text-[13px] font-bold text-slate-600 uppercase leading-relaxed text-justify opacity-80">{selectedProduct.descripcion_venta}</p>
                     </div>
                 )}
                 <button 
                    onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} 
                    className="w-full py-8 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase text-sm tracking-[0.3em] flex items-center justify-center gap-4 hover:bg-brand-500 transition-all shadow-2xl mt-auto shadow-brand-500/10"
                 >
                    <ShoppingCart className="w-6 h-6"/> Agregar al Carrito
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* DRAWER DEL CARRITO / CHECKOUT (Se mantiene funcional igual que antes) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md animate-in fade-in" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col p-8 md:p-12 overflow-y-auto animate-in slide-in-from-right duration-500">
              <div className="flex justify-between items-center mb-16">
                 <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900">
                    {currentStep === 'cart' ? 'Mi Bolsa' : 
                     currentStep === 'details' ? 'Tus Datos' : 
                     currentStep === 'payment' ? 'Pagar Orden' : 'Finalizar'}
                 </h2>
                 <button onClick={() => setIsCartOpen(false)} className="p-5 bg-slate-50 rounded-[2rem] hover:bg-slate-100 text-slate-400 transition-all"><X className="w-7 h-7"/></button>
              </div>

              {currentStep === 'cart' && (
                 <div className="flex-1 flex flex-col">
                    {cart.length === 0 ? (
                       <div className="py-32 text-center opacity-20 flex flex-col items-center gap-10">
                          <ShoppingCart className="w-20 h-20"/>
                          <p className="font-black uppercase tracking-[0.3em] text-[10px]">Tu bolsa está vacía</p>
                       </div>
                    ) : (
                      <>
                        <div className="space-y-6 overflow-y-auto flex-1 pr-2">
                          {cart.map(i => (
                             <div key={i.producto.id} className="flex gap-6 items-center bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
                                <div className="w-20 h-20 bg-white rounded-3xl overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                                   {i.producto.imagen ? <img src={`data:image/png;base64,${i.producto.imagen}`} className="w-full h-full object-contain" /> : <Package className="w-10 h-10 text-slate-100"/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                   <p className="text-[11px] font-black uppercase truncate text-slate-800 tracking-tight">{i.producto.nombre}</p>
                                   <p className="font-black text-sm text-brand-600 mt-2">S/ {i.producto.precio.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-4 bg-white p-2.5 rounded-2xl border border-slate-100">
                                   <button onClick={() => updateCartQuantity(i.producto.id, -1)} className="p-3 text-slate-400 hover:text-red-500 transition-colors"><Minus className="w-4 h-4"/></button>
                                   <span className="text-base font-black w-6 text-center">{i.cantidad}</span>
                                   <button onClick={() => updateCartQuantity(i.producto.id, 1)} className="p-3 text-slate-400 hover:text-brand-600 transition-colors"><Plus className="w-4 h-4"/></button>
                                </div>
                             </div>
                          ))}
                        </div>
                        <div className="pt-12">
                           <div className="flex justify-between items-center px-8 border-b border-slate-100 pb-10 mb-8">
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.5em]">Total a Pagar</span>
                              <span className="text-5xl font-black text-slate-900 tracking-tighter">S/ {cartTotal.toFixed(2)}</span>
                           </div>
                           <button onClick={() => setCurrentStep('details')} className="w-full py-9 bg-slate-900 text-white rounded-[3rem] font-black uppercase text-[11px] tracking-[0.5em] hover:bg-brand-500 transition-all shadow-2xl">Proceder al Pago</button>
                        </div>
                      </>
                    )}
                 </div>
              )}

              {currentStep === 'details' && (
                 <div className="space-y-12 animate-in slide-in-from-right">
                    <div className="space-y-6">
                       <input type="text" placeholder="NOMBRE COMPLETO" className="w-full px-10 py-7 bg-slate-50 rounded-[2.5rem] outline-none font-bold text-sm uppercase shadow-inner border-none focus:ring-4 focus:ring-brand-500/10 transition-all" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                       <input type="tel" placeholder="CELULAR WHATSAPP" className="w-full px-10 py-7 bg-slate-50 rounded-[2.5rem] outline-none font-bold text-sm shadow-inner border-none focus:ring-4 focus:ring-brand-500/10 transition-all" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                       <button onClick={() => setDeliveryType('recojo')} className={`py-10 rounded-[3rem] border-2 font-black uppercase text-[10px] tracking-widest transition-all ${deliveryType === 'recojo' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-slate-50 text-slate-300 border-transparent'}`}>Recojo Local</button>
                       <button onClick={() => setDeliveryType('delivery')} className={`py-10 rounded-[3rem] border-2 font-black uppercase text-[10px] tracking-widest transition-all ${deliveryType === 'delivery' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-slate-50 text-slate-300 border-transparent'}`}>Delivery</button>
                    </div>
                    {deliveryType === 'delivery' && (
                       <textarea placeholder="DIRECCIÓN Y REFERENCIA EXACTA..." className="w-full p-8 bg-slate-50 rounded-[3rem] outline-none font-bold h-44 shadow-inner text-sm uppercase resize-none border-none focus:ring-4 focus:ring-brand-500/10 transition-all" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                    )}
                    <div className="flex gap-4 pt-12">
                       <button onClick={() => setCurrentStep('cart')} className="flex-1 py-8 bg-slate-100 rounded-[2.5rem] font-black uppercase text-[10px] text-slate-400 tracking-widest">Atrás</button>
                       <button onClick={() => setCurrentStep('payment')} disabled={!clientData.nombre || !clientData.telefono} className="flex-[2] py-8 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase tracking-[0.4em] text-[11px] shadow-2xl disabled:opacity-20 transition-all">Siguiente Paso</button>
                    </div>
                 </div>
              )}

              {currentStep === 'payment' && (
                 <div className="space-y-10 text-center animate-in slide-in-from-right">
                    <div className="bg-slate-50 p-12 rounded-[4rem] shadow-inner mb-6">
                       <h2 className="text-6xl font-black text-slate-900 tracking-tighter">S/ {cartTotal.toFixed(2)}</h2>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Escanea el código para pagar</p>
                    </div>
                    <div className="flex gap-4 p-2.5 bg-slate-100 rounded-[2.5rem]">
                       <button onClick={() => setPaymentMethod('yape')} className={`flex-1 py-6 rounded-[2rem] font-black uppercase text-[10px] tracking-widest transition-all ${paymentMethod === 'yape' ? 'bg-white text-purple-600 shadow-xl' : 'text-slate-400'}`}>Yape</button>
                       <button onClick={() => setPaymentMethod('plin')} className={`flex-1 py-6 rounded-[2rem] font-black uppercase text-[10px] tracking-widest transition-all ${paymentMethod === 'plin' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400'}`}>Plin</button>
                    </div>
                    <div className="aspect-square bg-slate-900 rounded-[4rem] flex items-center justify-center p-14 shadow-2xl overflow-hidden group">
                       {paymentMethod === 'yape' ? (
                          config.yapeQR ? <img src={config.yapeQR} className="max-w-full max-h-full rounded-[2rem] group-hover:scale-105 transition-transform" alt="QR Yape" /> : <QrCode className="text-white w-24 h-24 opacity-10"/>
                       ) : (
                          config.plinQR ? <img src={config.plinQR} className="max-w-full max-h-full rounded-[2rem] group-hover:scale-105 transition-transform" alt="QR Plin" /> : <QrCode className="text-white w-24 h-24 opacity-10"/>
                       )}
                    </div>
                    <div className="p-10 bg-slate-50 rounded-[3rem] border border-slate-100">
                       <p className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">
                          {paymentMethod === 'yape' ? (config.yapeName || 'Titular Yape') : (config.plinName || 'Titular Plin')}
                       </p>
                       <p className="text-3xl font-black text-slate-800 tracking-widest">
                          {paymentMethod === 'yape' ? (config.yapeNumber || '--- --- ---') : (config.plinNumber || '--- --- ---')}
                       </p>
                    </div>
                    <div className="flex gap-4 pt-12">
                       <button onClick={() => setCurrentStep('details')} className="flex-1 py-8 bg-slate-100 rounded-[2.5rem] font-black uppercase text-[10px] text-slate-400 tracking-widest">Atrás</button>
                       <button onClick={() => setCurrentStep('voucher')} className="flex-[2] py-8 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase tracking-[0.4em] text-[11px] shadow-2xl">Subir Comprobante</button>
                    </div>
                 </div>
              )}

              {currentStep === 'voucher' && (
                 <div className="space-y-12 animate-in slide-in-from-right">
                    <div className="border-4 border-dashed rounded-[4rem] aspect-[3/4] flex flex-col items-center justify-center p-12 bg-slate-50 relative overflow-hidden group hover:border-brand-500 transition-all cursor-pointer">
                       {voucherImage ? (
                          <>
                             <img src={voucherImage} className="w-full h-full object-cover" alt="Voucher" />
                             <button onClick={() => setVoucherImage(null)} className="absolute top-10 right-10 p-5 bg-red-500 text-white rounded-[2rem] shadow-2xl hover:bg-red-600 transition-all"><Trash2 className="w-7 h-7"/></button>
                          </>
                       ) : (
                          <label className="cursor-pointer flex flex-col items-center text-slate-300">
                             <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center shadow-xl mb-10 group-hover:scale-110 transition-transform"><Camera className="w-12 h-12 text-slate-400"/></div>
                             <p className="text-[12px] font-black uppercase tracking-[0.5em] text-center">Toma foto del pago</p>
                             <input type="file" className="hidden" accept="image/*" onChange={handleVoucherUpload} />
                          </label>
                       )}
                    </div>
                    <button 
                       onClick={handleFinishOrder} 
                       disabled={!voucherImage || isOrderLoading} 
                       className="w-full py-10 bg-brand-500 text-white rounded-[3.5rem] font-black uppercase text-[12px] tracking-[0.5em] shadow-[0_30px_60px_-15px_rgba(132,204,22,0.5)] flex items-center justify-center gap-5 transition-all active:scale-95 disabled:opacity-50"
                    >
                       {isOrderLoading ? <Loader2 className="animate-spin w-7 h-7"/> : <CheckCircle2 className="w-7 h-7"/>} 
                       {isOrderLoading ? 'Enviando Pedido...' : 'Confirmar Mi Compra'}
                    </button>
                 </div>
              )}

              {currentStep === 'success' && (
                 <div className="flex-1 flex flex-col items-center justify-center text-center space-y-20 animate-in zoom-in duration-1000">
                    <div className="w-60 h-60 bg-brand-500 text-white rounded-full flex items-center justify-center shadow-[0_40px_80px_-20px_rgba(132,204,22,0.6)] animate-bounce">
                       <CheckCircle2 className="w-28 h-28"/>
                    </div>
                    <div>
                       <h3 className="text-7xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-6">¡GRACIAS!</h3>
                       <p className="text-[14px] font-bold text-slate-500 uppercase tracking-[0.3em] leading-relaxed max-w-xs mx-auto">Tu pedido ha sido recibido. Atento a tu WhatsApp para coordinar la entrega.</p>
                    </div>
                    <button 
                      onClick={() => { setIsCartOpen(false); setCart([]); setCurrentStep('cart'); setVoucherImage(null); }} 
                      className="w-full py-10 bg-slate-900 text-white rounded-[3.5rem] font-black uppercase tracking-[0.5em] text-[12px] shadow-2xl hover:bg-brand-500 transition-all"
                    >
                      Seguir Explorando
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
