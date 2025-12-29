
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
  ChevronDown, ExternalLink, Sparkles, Globe, Heart
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

      <header className={`fixed top-0 md:top-9 left-0 right-0 z-[60] transition-all duration-500`}>
        <div className={`transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-xl shadow-xl py-3 border-b border-slate-100' : 'bg-white py-5 shadow-sm border-b border-slate-100'}`}>
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between gap-4 md:gap-10">
             <div className="flex items-center gap-4 shrink-0 cursor-pointer group" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
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
                      <div className="w-px h-4 bg-slate-200 hidden md:block"></div>
                   </div>
                   <input 
                    type="text" 
                    placeholder="Encuentra lo que buscas hoy..." 
                    className="w-full pl-12 pr-6 py-3.5 bg-slate-50 border border-slate-100 rounded-[1.25rem] text-[11px] font-bold outline-none transition-all focus:bg-white focus:ring-4 focus:ring-brand-500/5 shadow-inner" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                   />
                </div>
             </div>

             <button 
                onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} 
                className={`relative p-4 bg-slate-900 text-white rounded-2xl shadow-2xl transition-all hover:scale-110 active:scale-95 ${cartAnimate ? 'bg-brand-500 scale-110' : 'hover:bg-slate-800'}`}
             >
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-brand-500 text-white text-[10px] w-6 h-6 rounded-full flex items-center justify-center font-black border-2 border-white shadow-lg animate-in zoom-in">
                    {totalItems}
                  </span>
                )}
             </button>
          </div>
        </div>
      </header>

      <div className="h-[76px] md:h-[110px]"></div>

      {!loading && slideImages.length > 0 && !searchTerm && (
        <section className="w-full h-[280px] md:h-[500px] relative overflow-hidden bg-slate-200 z-10">
           {slideImages.map((img, idx) => (
             <div 
               key={idx} 
               className={`absolute inset-0 transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1) transform ${idx === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'}`}
             >
                <img src={img} className="w-full h-full object-cover" alt={`Slide ${idx}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                <div className={`absolute bottom-20 left-12 md:left-24 transition-all duration-1000 delay-300 transform ${idx === currentSlide ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                   <span className="bg-brand-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-lg mb-4 inline-block">Novedad Exclusiva</span>
                   <h2 className="text-white text-4xl md:text-6xl font-black uppercase tracking-tighter drop-shadow-2xl max-w-xl leading-none">Tu bienestar es nuestra prioridad</h2>
                </div>
             </div>
           ))}
           
           {slideImages.length > 1 && (
             <>
                <button onClick={() => setCurrentSlide(prev => (prev - 1 + slideImages.length) % slideImages.length)} className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-white/10 backdrop-blur-xl text-white rounded-[1.5rem] border border-white/20 hover:bg-white/40 transition-all z-20 group">
                   <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform"/>
                </button>
                <button onClick={() => setCurrentSlide(prev => (prev + 1) % slideImages.length)} className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-white/10 backdrop-blur-xl text-white rounded-[1.5rem] border border-white/20 hover:bg-white/40 transition-all z-20 group">
                   <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform"/>
                </button>
                
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3 z-20">
                    {slideImages.map((_, i) => (
                        <button key={i} onClick={() => setCurrentSlide(i)} className={`h-1.5 rounded-full transition-all duration-500 ${i === currentSlide ? 'w-12 bg-brand-500' : 'w-2 bg-white/30'}`}></button>
                    ))}
                </div>
             </>
           )}
        </section>
      )}

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

      <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full min-h-[60vh]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-6">
             <div className="relative">
                <Loader2 className="w-16 h-16 animate-spin text-brand-500" />
                <Citrus className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-brand-600 animate-pulse" />
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">Sincronizando Catálogo Lemon BI...</p>
          </div>
        ) : (
          <>
            <div className="mb-14 flex items-end justify-between border-b border-slate-100 pb-8 animate-in slide-in-from-left duration-700">
               <div>
                  <div className="flex items-center gap-3 mb-2">
                     <Sparkles className="w-5 h-5 text-amber-500 animate-pulse"/>
                     <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900 leading-none">
                       {selectedCategory === 'Todas' ? 'Catálogo Completo' : selectedCategory}
                     </h2>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Explora nuestros productos seleccionados</p>
               </div>
               <div className="hidden md:flex items-center gap-3 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  <span>{filteredProducts.length} Ítems</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                  <span>Envío Gratis Lima</span>
               </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-10 animate-in fade-in slide-in-from-bottom-10 duration-1000">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-48 text-center flex flex-col items-center gap-6">
                   <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-200 shadow-inner">
                      <SearchX className="w-12 h-12" />
                   </div>
                   <div>
                      <p className="font-black uppercase tracking-widest text-sm text-slate-400 mb-2">No encontramos lo que buscas</p>
                      <button onClick={() => { setSearchTerm(''); setSelectedCategory('Todas'); }} className="text-[10px] font-black uppercase text-brand-600 underline tracking-widest">Ver todo el catálogo</button>
                   </div>
                </div>
              ) : filteredProducts.map(p => (
                <div key={p.id} onClick={() => setSelectedProduct(p)} className="bg-white p-4 md:p-6 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-[0_40px_80px_-24px_rgba(0,0,0,0.12)] transition-all duration-700 cursor-pointer relative overflow-hidden hover:-translate-y-3">
                  <div className="aspect-square bg-slate-50 rounded-[2.5rem] mb-6 flex items-center justify-center overflow-hidden border border-slate-50 relative group-hover:bg-white transition-colors duration-500">
                    {p.imagen ? (
                      <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-700 p-2" alt={p.nombre} />
                    ) : (
                      <Package className="w-12 h-12 text-slate-200" />
                    )}
                    <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/[0.02] transition-colors"></div>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <span className="text-[9px] font-black uppercase text-brand-600 tracking-widest mb-2 block">{p.categoria_personalizada || p.categoria}</span>
                    <h3 className="text-[12px] font-black text-slate-800 uppercase line-clamp-2 h-10 tracking-tight leading-tight group-hover:text-brand-600 transition-colors">{p.nombre}</h3>
                    <div className="mt-auto pt-6 flex items-center justify-between border-t border-slate-50">
                      <div className="flex flex-col">
                         <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Precio</span>
                         <span className="text-lg font-black text-slate-900 tracking-tighter">S/ {p.precio.toFixed(2)}</span>
                      </div>
                      <button 
                        onClick={(e) => addToCart(p, e)} 
                        className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl hover:bg-brand-500 hover:scale-110 active:scale-95 transition-all shadow-brand-500/10"
                      >
                        <Plus className="w-5 h-5"/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {selectedProduct && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md animate-in fade-in" onClick={() => setSelectedProduct(null)}></div>
           <div className="relative bg-white w-full max-w-5xl rounded-[4rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col md:flex-row animate-in zoom-in duration-300 max-h-[90vh]">
              <div className="w-full md:w-1/2 bg-slate-50 flex items-center justify-center p-12 md:p-20 relative group">
                 {selectedProduct.imagen ? (
                   <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-w-full max-h-full object-contain mix-blend-multiply drop-shadow-[0_20px_50px_rgba(0,0,0,0.1)] group-hover:scale-105 transition-transform duration-700" alt={selectedProduct.nombre} />
                 ) : (
                   <Package className="w-32 h-32 text-slate-200" />
                 )}
                 <button onClick={() => setSelectedProduct(null)} className="absolute top-8 left-8 p-4 bg-white rounded-3xl shadow-xl text-slate-400 md:hidden hover:text-red-500 transition-colors"><X className="w-6 h-6"/></button>
              </div>
              <div className="w-full md:w-1/2 p-10 md:p-20 flex flex-col bg-white overflow-y-auto custom-scrollbar">
                 <div className="flex justify-between items-start mb-8">
                    <span className="bg-brand-50 text-brand-600 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">{selectedProduct.categoria_personalizada || selectedProduct.categoria}</span>
                    <button onClick={() => setSelectedProduct(null)} className="hidden md:flex p-3 bg-slate-50 text-slate-300 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all"><X className="w-6 h-6"/></button>
                 </div>
                 <div className="flex-1">
                    <h2 className="text-4xl md:text-5xl font-black uppercase text-slate-900 tracking-tighter leading-none mb-8">{selectedProduct.nombre}</h2>
                    <div className="flex items-center gap-6 mb-12 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 w-fit pr-12">
                       <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Precio Web</span>
                          <span className="text-5xl font-black text-slate-900 tracking-tighter leading-none">S/ {selectedProduct.precio.toFixed(2)}</span>
                       </div>
                    </div>
                    {selectedProduct.descripcion_venta && (
                        <div className="space-y-6 mb-12">
                           <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                              <Info className="w-5 h-5 text-brand-500"/>
                              <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em]">Descripción del Producto</h4>
                           </div>
                           <p className="text-[14px] font-bold text-slate-600 uppercase leading-relaxed text-justify opacity-80">{selectedProduct.descripcion_venta}</p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                          <ShieldCheck className="w-8 h-8 text-brand-500"/>
                          <div><p className="text-[10px] font-black uppercase text-slate-900">Garantía</p><p className="text-[9px] font-bold text-slate-400 uppercase">100% Original</p></div>
                       </div>
                       <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                          <Truck className="w-8 h-8 text-brand-500"/>
                          <div><p className="text-[10px] font-black uppercase text-slate-900">Envío</p><p className="text-[9px] font-bold text-slate-400 uppercase">Express 24h</p></div>
                       </div>
                    </div>
                 </div>
                 <button 
                    onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} 
                    className="w-full py-8 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase text-sm tracking-[0.3em] flex items-center justify-center gap-4 hover:bg-brand-500 transition-all shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] mt-16 hover:scale-105 active:scale-95 shadow-brand-500/20"
                 >
                    <ShoppingCart className="w-6 h-6"/> Agregar al Carrito
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* FOOTER REDISEÑADO - COMPACTO Y PROFESIONAL */}
      {!loading && (
        <footer className="text-white border-t border-white/5 py-16 px-6 md:px-12 relative overflow-hidden" style={{ backgroundColor: secondaryColor }}>
           {/* Decoración sutil */}
           <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-500/5 blur-[100px] rounded-full -translate-x-1/2 translate-y-1/2"></div>
           
           <div className="max-w-7xl mx-auto relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
                 
                 {/* LEMA Y LOGO */}
                 <div className="md:col-span-5 space-y-6">
                    <div className="flex items-center gap-3">
                        {config.footerLogoUrl ? (
                          <img src={config.footerLogoUrl} className="h-10 object-contain" alt="Footer Logo" />
                        ) : (
                          <div className="flex items-center gap-2">
                             <Citrus className="w-7 h-7 text-brand-500" />
                             <h2 className="text-xl font-black uppercase tracking-tighter">{config.nombreComercial || config.code}</h2>
                          </div>
                        )}
                    </div>
                    <p className="text-slate-400 text-xs font-bold uppercase leading-relaxed max-w-sm tracking-wide">
                        {config.footer_description || "Ofrecemos los mejores productos con la garantía de expertos en el sector."}
                    </p>
                    <div className="flex gap-3">
                       {config.facebook_url && <a href={config.facebook_url} target="_blank" className="p-3 bg-white/5 rounded-xl hover:bg-brand-500 hover:scale-110 transition-all border border-white/5 shadow-lg"><Facebook className="w-4 h-4"/></a>}
                       {config.instagram_url && <a href={config.instagram_url} target="_blank" className="p-3 bg-white/5 rounded-xl hover:bg-pink-500 hover:scale-110 transition-all border border-white/5 shadow-lg"><Instagram className="w-4 h-4"/></a>}
                       {config.tiktok_url && <a href={config.tiktok_url} target="_blank" className="p-3 bg-white/5 rounded-xl hover:bg-black hover:scale-110 transition-all border border-white/5 shadow-lg"><Globe className="w-4 h-4"/></a>}
                    </div>
                 </div>

                 {/* EXPLORAR */}
                 <div className="md:col-span-3 space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-500">Explorar</h3>
                    <ul className="space-y-4">
                       <li><button onClick={() => { setSelectedCategory('Todas'); window.scrollTo({top: 350, behavior: 'smooth'}); }} className="text-[11px] font-black text-slate-400 hover:text-white transition-all uppercase tracking-widest flex items-center gap-2">Catálogo Completo</button></li>
                       <li><button onClick={onBack} className="text-[11px] font-black text-slate-400 hover:text-white transition-all uppercase tracking-widest flex items-center gap-2">Administrar Tienda</button></li>
                    </ul>
                 </div>

                 {/* ATENCIÓN */}
                 <div className="md:col-span-4 space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-500">Atención Directa</h3>
                    <a 
                        href={`https://wa.me/${config.whatsappHelpNumber?.replace(/\D/g, '') || '51975615244'}`} 
                        target="_blank" 
                        className="group flex items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/5 hover:bg-brand-500 transition-all duration-500 shadow-2xl"
                    >
                        <div className="p-3 bg-brand-500/10 rounded-2xl group-hover:bg-white/20 transition-colors">
                            <MessageCircle className="w-6 h-6 text-white"/>
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase text-slate-500 group-hover:text-white/70 tracking-widest mb-0.5">¿Necesitas ayuda?</p>
                            <p className="text-sm font-black tracking-widest uppercase group-hover:text-white transition-colors">{config.whatsappHelpNumber || 'Escríbenos ahora'}</p>
                        </div>
                    </a>
                 </div>
              </div>

              {/* BARRA INFERIOR COMPACTA */}
              <div className="pt-8 mt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 opacity-40 text-[9px] font-black uppercase tracking-[0.2em]">
                 <div className="flex items-center gap-3">
                    <span className="text-slate-500">Powered by</span>
                    <span className="text-white">Lemon BI</span>
                    <span className="text-slate-500">&</span>
                    <a href="https://gaorsystem-pe.vercel.app/" target="_blank" className="text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1.5 underline underline-offset-4 decoration-brand-500/30">
                        GaorSystem Perú
                        <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                 </div>
                 <div className="flex items-center gap-1.5">
                    <span>&copy; 2025 Todos los derechos reservados</span>
                    <span className="w-1 h-1 bg-slate-500 rounded-full mx-1"></span>
                    <span className="flex items-center gap-1">Made with <Heart className="w-2 h-2 text-brand-500 fill-brand-500"/> for Lima</span>
                 </div>
              </div>
           </div>
        </footer>
      )}

      {/* DRAWER DEL CARRITO Y CHECKOUT */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md animate-in fade-in" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative bg-white w-full max-w-2xl h-full shadow-[0_0_100px_rgba(0,0,0,0.3)] flex flex-col p-8 md:p-12 overflow-y-auto animate-in slide-in-from-right duration-500 custom-scrollbar">
              <div className="flex justify-between items-center mb-16">
                 <div>
                    <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900 leading-none">
                        {currentStep === 'cart' ? 'Bolsa de Compras' : 
                         currentStep === 'details' ? 'Tus Datos' : 
                         currentStep === 'payment' ? 'Pagar Orden' : 
                         currentStep === 'voucher' ? 'Comprobante' : '¡Listo!'}
                    </h2>
                    <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.3em] mt-3">PROCESO SEGURO • {totalItems} PRODUCTOS</p>
                 </div>
                 <button onClick={() => setIsCartOpen(false)} className="p-5 bg-slate-50 rounded-3xl hover:bg-slate-100 transition-all hover:rotate-90 text-slate-400 hover:text-slate-900 shadow-sm"><X className="w-7 h-7"/></button>
              </div>

              {currentStep === 'cart' && (
                 <div className="space-y-6 flex-1 flex flex-col">
                    {cart.length === 0 ? (
                       <div className="py-32 text-center opacity-20 flex flex-col items-center gap-10">
                          <div className="p-12 bg-slate-50 rounded-[4rem] shadow-inner"><ShoppingCart className="w-24 h-24"/></div>
                          <p className="font-black uppercase tracking-[0.5em] text-xs">Tu bolsa está vacía actualmente</p>
                       </div>
                    ) : (
                      <>
                        <div className="space-y-5 overflow-y-auto flex-1 pr-3 custom-scrollbar">
                          {cart.map(i => (
                             <div key={i.producto.id} className="flex gap-6 items-center bg-slate-50 p-6 md:p-8 rounded-[3rem] border border-slate-100 shadow-sm animate-in slide-in-from-right transition-all group">
                                <div className="w-20 h-20 bg-white rounded-3xl overflow-hidden flex items-center justify-center shrink-0 border border-slate-50 shadow-inner group-hover:scale-105 transition-transform">
                                   {i.producto.imagen ? <img src={`data:image/png;base64,${i.producto.imagen}`} className="w-full h-full object-contain" /> : <Package className="w-10 h-10 text-slate-100"/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                   <p className="text-[12px] font-black uppercase truncate text-slate-800 tracking-tight leading-tight">{i.producto.nombre}</p>
                                   <p className="font-black text-xs text-brand-600 mt-2">S/ {i.producto.precio.toFixed(2)} / unidad</p>
                                </div>
                                <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-inner border border-slate-100">
                                   <button onClick={() => updateCartQuantity(i.producto.id, -1)} className="p-3 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-slate-900"><Minus className="w-5 h-5"/></button>
                                   <span className="text-base font-black w-8 text-center">{i.cantidad}</span>
                                   <button onClick={() => updateCartQuantity(i.producto.id, 1)} className="p-3 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-slate-900"><Plus className="w-5 h-5"/></button>
                                </div>
                             </div>
                          ))}
                        </div>
                        <div className="pt-12 space-y-6 mt-auto">
                           <div className="flex justify-between items-center px-8 border-b border-slate-100 pb-8">
                              <div className="flex flex-col">
                                 <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em]">Subtotal Bruto</span>
                                 <span className="text-4xl font-black text-slate-900 tracking-tighter mt-1">S/ {cartTotal.toFixed(2)}</span>
                              </div>
                              <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest">IGV INCLUIDO</span>
                           </div>
                           <button onClick={() => setCurrentStep('details')} className="w-full py-9 bg-slate-900 text-white rounded-[3rem] font-black uppercase text-xs tracking-[0.4em] hover:bg-brand-500 transition-all shadow-[0_30px_60px_-15px_rgba(0,0,0,0.35)] hover:scale-[1.02] active:scale-95 shadow-brand-500/20">Proceder al Pago</button>
                        </div>
                      </>
                    )}
                 </div>
              )}

              {currentStep === 'details' && (
                 <div className="space-y-12 animate-in slide-in-from-right">
                    <div className="space-y-6">
                       <div className="flex items-center gap-3 mb-2">
                          <User className="w-5 h-5 text-brand-500" />
                          <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em]">Información Personal</h3>
                       </div>
                       <div className="relative">
                          <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300"/>
                          <input 
                            type="text" 
                            placeholder="ESCRIBE TU NOMBRE COMPLETO" 
                            className="w-full pl-16 pr-8 py-7 bg-slate-50 rounded-[2.5rem] outline-none font-bold text-sm border-none shadow-inner focus:ring-4 focus:ring-brand-500/5 transition-all uppercase placeholder:text-slate-200" 
                            value={clientData.nombre} 
                            onChange={e => setClientData({...clientData, nombre: e.target.value})} 
                          />
                       </div>
                       <div className="relative">
                          <Smartphone className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300"/>
                          <input 
                            type="tel" 
                            placeholder="WHATSAPP DE CONTACTO" 
                            className="w-full pl-16 pr-8 py-7 bg-slate-50 rounded-[2.5rem] outline-none font-bold text-sm border-none shadow-inner focus:ring-4 focus:ring-brand-500/5 transition-all placeholder:text-slate-200" 
                            value={clientData.telefono} 
                            onChange={e => setClientData({...clientData, telefono: e.target.value})} 
                          />
                       </div>
                    </div>
                    <div className="space-y-6">
                       <div className="flex items-center gap-3 mb-2">
                          <Truck className="w-5 h-5 text-brand-500" />
                          <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em]">Modalidad de Entrega</h3>
                       </div>
                       <div className="grid grid-cols-2 gap-6">
                          <button onClick={() => setDeliveryType('recojo')} className={`flex flex-col items-center gap-4 py-10 rounded-[3rem] border-2 font-black uppercase text-[10px] tracking-widest transition-all ${deliveryType === 'recojo' ? 'bg-slate-900 text-white border-slate-900 shadow-2xl scale-105' : 'bg-slate-50 border-transparent text-slate-300 hover:bg-slate-100 hover:text-slate-500'}`}>
                             <MapPin className="w-8 h-8 mb-1"/> Recojo Sede
                          </button>
                          <button onClick={() => setDeliveryType('delivery')} className={`flex flex-col items-center gap-4 py-10 rounded-[3rem] border-2 font-black uppercase text-[10px] tracking-widest transition-all ${deliveryType === 'delivery' ? 'bg-slate-900 text-white border-slate-900 shadow-2xl scale-105' : 'bg-slate-50 border-transparent text-slate-300 hover:bg-slate-100 hover:text-slate-500'}`}>
                             <Truck className="w-8 h-8 mb-1"/> Delivery
                          </button>
                       </div>
                    </div>
                    {deliveryType === 'delivery' && (
                       <div className="space-y-6 animate-in slide-in-from-top-4">
                          <div className="flex items-center gap-3">
                             <MapPin className="w-5 h-5 text-brand-500" />
                             <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em]">Dirección de Envío</h3>
                          </div>
                          <textarea 
                            placeholder="CALLE, NÚMERO, DPTO, URBANIZACIÓN Y REFERENCIAS DE TU DOMICILIO..." 
                            className="w-full p-8 bg-slate-50 rounded-[3rem] outline-none font-bold h-44 shadow-inner text-sm border-none focus:ring-4 focus:ring-brand-500/5 transition-all uppercase placeholder:text-slate-200 leading-relaxed resize-none" 
                            value={clientData.direccion} 
                            onChange={e => setClientData({...clientData, direccion: e.target.value})} 
                          />
                       </div>
                    )}
                    <div className="flex gap-4 pt-12">
                       <button onClick={() => setCurrentStep('cart')} className="flex-1 py-7 bg-slate-100 rounded-[2.5rem] font-black uppercase text-[10px] text-slate-400 tracking-widest hover:bg-slate-200 transition-colors">Atrás</button>
                       <button 
                        onClick={() => setCurrentStep('payment')} 
                        disabled={!clientData.nombre || !clientData.telefono || (deliveryType === 'delivery' && !clientData.direccion)} 
                        className="flex-[2.5] py-7 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl disabled:opacity-20 hover:bg-brand-500 transition-all shadow-brand-500/10"
                       >
                        Confirmar Datos
                       </button>
                    </div>
                 </div>
              )}

              {currentStep === 'payment' && (
                 <div className="space-y-10 animate-in slide-in-from-right text-center">
                    <div className="bg-slate-50 p-10 rounded-[4rem] shadow-inner mb-8">
                       <span className="text-[10px] font-black uppercase text-slate-300 tracking-[0.5em] block mb-2">Monto a Transferir</span>
                       <h2 className="text-6xl font-black text-slate-900 tracking-tighter leading-none">S/ {cartTotal.toFixed(2)}</h2>
                    </div>
                    <div className="flex gap-4 p-2 bg-slate-100 rounded-[2.5rem] mb-10">
                       <button onClick={() => setPaymentMethod('yape')} className={`flex-1 py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-widest transition-all ${paymentMethod === 'yape' ? 'bg-white text-purple-600 shadow-xl scale-[1.02]' : 'text-slate-400'}`}>Yape</button>
                       <button onClick={() => setPaymentMethod('plin')} className={`flex-1 py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-widest transition-all ${paymentMethod === 'plin' ? 'bg-white text-blue-600 shadow-xl scale-[1.02]' : 'text-slate-400'}`}>Plin</button>
                    </div>
                    <div className="aspect-square bg-slate-900 rounded-[4rem] flex items-center justify-center p-14 shadow-2xl relative overflow-hidden group">
                       <div className="absolute inset-0 bg-brand-500/5 mix-blend-overlay group-hover:opacity-0 transition-opacity"></div>
                       {paymentMethod === 'yape' ? (
                          config.yapeQR ? <img src={config.yapeQR} className="max-w-full max-h-full rounded-[2rem] animate-in zoom-in duration-500" alt="QR Yape" /> : <QrCode className="text-white w-24 h-24 opacity-10 animate-pulse"/>
                       ) : (
                          config.plinQR ? <img src={config.plinQR} className="max-w-full max-h-full rounded-[2rem] animate-in zoom-in duration-500" alt="QR Plin" /> : <QrCode className="text-white w-24 h-24 opacity-10 animate-pulse"/>
                       )}
                    </div>
                    <div className="space-y-4 bg-slate-50 p-10 rounded-[3.5rem] border border-slate-100 shadow-inner">
                       <div className="flex items-center justify-center gap-3 text-brand-600">
                          <User className="w-4 h-4"/>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em]">Titular de la cuenta</p>
                       </div>
                       <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-tight drop-shadow-sm">
                          {paymentMethod === 'yape' ? (config.yapeName || 'LEMON BI SYSTEM') : (config.plinName || 'LEMON BI SYSTEM')}
                       </p>
                       <div className="w-12 h-px bg-slate-200 mx-auto my-4"></div>
                       <div className="flex items-center justify-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-[10px] shadow-lg ${paymentMethod === 'yape' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                             {paymentMethod[0].toUpperCase()}
                          </div>
                          <p className="text-3xl font-black text-slate-800 tracking-[0.3em]">
                             {paymentMethod === 'yape' ? (config.yapeNumber || '--- --- ---') : (config.plinNumber || '--- --- ---')}
                          </p>
                       </div>
                    </div>
                    <div className="flex gap-4 pt-12">
                       <button onClick={() => setCurrentStep('details')} className="flex-1 py-8 bg-slate-100 rounded-[2.5rem] font-black uppercase text-[10px] text-slate-400 tracking-widest hover:bg-slate-200 transition-colors">Atrás</button>
                       <button onClick={() => setCurrentStep('voucher')} className="flex-[2.5] py-8 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl hover:bg-brand-500 transition-all shadow-brand-500/10">Ya transferí, subir comprobante</button>
                    </div>
                 </div>
              )}

              {currentStep === 'voucher' && (
                 <div className="space-y-10 animate-in slide-in-from-right">
                    <div className="text-center mb-10">
                       <h2 className="text-xl font-black uppercase text-slate-900 tracking-[0.4em] mb-4">Captura de Pantalla</h2>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Tu pedido será validado por nuestro equipo una vez subas la foto del pago.</p>
                    </div>
                    <div className="border-4 border-dashed rounded-[4rem] aspect-[3/4] flex flex-col items-center justify-center p-10 bg-slate-50 relative overflow-hidden group hover:border-brand-500 transition-all shadow-inner cursor-pointer">
                       {voucherImage ? (
                          <>
                             <img src={voucherImage} className="w-full h-full object-cover animate-in fade-in" alt="Voucher" />
                             <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button onClick={(e) => { e.stopPropagation(); setVoucherImage(null); }} className="bg-red-500 text-white p-6 rounded-[2.5rem] shadow-2xl hover:scale-110 active:scale-95 transition-all"><Trash2 className="w-8 h-8"/></button>
                             </div>
                          </>
                       ) : (
                          <label className="cursor-pointer flex flex-col items-center text-slate-300 group-hover:text-brand-500 transition-colors">
                             <div className="w-32 h-32 bg-white rounded-[3.5rem] flex items-center justify-center shadow-xl mb-10 group-hover:scale-110 transition-transform shadow-brand-500/5">
                                <Camera className="w-12 h-12 animate-pulse"/>
                             </div>
                             <p className="text-[11px] font-black uppercase tracking-[0.4em] text-center max-w-[200px]">Presiona aquí para cargar tu imagen</p>
                             <input type="file" className="hidden" accept="image/*" onChange={handleVoucherUpload} />
                          </label>
                       )}
                    </div>
                    <div className="flex gap-4 pt-10">
                       <button onClick={() => setCurrentStep('payment')} className="flex-1 py-8 bg-slate-100 rounded-[2.5rem] font-black uppercase text-[10px] text-slate-400 tracking-widest">Atrás</button>
                       <button 
                          onClick={handleFinishOrder} 
                          disabled={!voucherImage || isOrderLoading} 
                          className="flex-[2.5] py-8 bg-brand-500 text-white rounded-[2.5rem] font-black uppercase text-[11px] tracking-[0.4em] shadow-2xl flex items-center justify-center gap-4 disabled:opacity-30 transition-all shadow-brand-500/30 hover:scale-[1.02]"
                       >
                          {isOrderLoading ? <Loader2 className="animate-spin w-6 h-6"/> : <CheckCircle2 className="w-6 h-6"/>} 
                          {isOrderLoading ? 'Sincronizando...' : 'Finalizar Pedido'}
                       </button>
                    </div>
                 </div>
              )}

              {currentStep === 'success' && (
                 <div className="flex-1 flex flex-col items-center justify-center text-center space-y-16 p-10 animate-in zoom-in duration-700">
                    <div className="relative">
                       <div className="w-56 h-56 bg-brand-500 text-white rounded-[4rem] flex items-center justify-center shadow-[0_40px_80px_-15px_rgba(132,204,22,0.5)] animate-bounce relative z-10">
                          <CheckCircle2 className="w-24 h-24"/>
                       </div>
                       <div className="absolute inset-0 bg-brand-200 rounded-[4rem] blur-3xl opacity-30 animate-pulse"></div>
                    </div>
                    <div className="space-y-8">
                       <h3 className="text-6xl font-black uppercase tracking-tighter text-slate-900 leading-none">¡Recibido!</h3>
                       <div className="max-w-xs mx-auto space-y-4">
                          <p className="text-[13px] font-bold text-slate-500 uppercase tracking-[0.2em] leading-relaxed">Tu pedido ha sido enviado con éxito a nuestra sede.</p>
                          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                             <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Atento a tu WhatsApp</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">Un asesor te enviará la confirmación final y tiempo estimado de entrega.</p>
                          </div>
                       </div>
                    </div>
                    <button 
                      onClick={() => { setIsCartOpen(false); setCart([]); setCurrentStep('cart'); setVoucherImage(null); }} 
                      className="w-full py-9 bg-slate-900 text-white rounded-[3rem] font-black uppercase tracking-[0.5em] text-[11px] shadow-2xl hover:bg-brand-500 transition-all hover:scale-[1.02]"
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
