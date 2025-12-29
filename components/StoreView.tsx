
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingCart, Package, Search, X, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, Facebook, Instagram, Pill, Beaker, CheckCircle2, 
  Loader2, Sparkles, RefreshCw, Trash2, Smartphone, 
  Layers, Tag, SearchX, Briefcase, PawPrint, Footprints, ChevronRight,
  Upload, Camera, Image as ImageIcon,
  Building2, QrCode, AlertCircle, ShieldCheck, CreditCard, Clock, ChevronLeft,
  Citrus, Zap, ShieldCheck as Shield, HeartPulse, Filter
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
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'efectivo'>('yape');
  const [deliveryType, setDeliveryType] = useState<'recojo' | 'delivery'>('recojo');
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '', sedeId: '' });
  const [voucherImage, setVoucherImage] = useState<string | null>(null);
  const [isOrderLoading, setIsOrderLoading] = useState(false);

  const brandColor = config?.colorPrimario || '#84cc16'; 
  const secondaryColor = config?.colorSecundario || '#1e293b';
  const slideImages = config.slide_images || [];

  const tickerMessages = [
    { text: "Envíos rápidos a todo el Perú", icon: <Truck className="w-3 h-3"/> },
    { text: "Pago 100% Seguro vía Yape/Plin", icon: <Shield className="w-3 h-3"/> },
    { text: "Atención personalizada por WhatsApp", icon: <MessageCircle className="w-3 h-3"/> },
    { text: "Productos originales garantizados", icon: <CheckCircle2 className="w-3 h-3"/> }
  ];

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.producto.precio * item.cantidad, 0);
  }, [cart]);

  const totalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.cantidad, 0);
  }, [cart]);

  // Obtener categorías únicas presentes en el catálogo
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
    }, 5000);
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
    
    const fieldSets = [
      ['display_name', 'list_price', 'categ_id', 'image_128', 'qty_available', 'uom_id', 'description_sale'],
      ['display_name', 'list_price', 'categ_id', 'image_128', 'uom_id'], 
      ['display_name', 'list_price', 'categ_id', 'image_small'], 
      ['display_name', 'list_price']
    ];

    try {
      const extrasMap = await getProductExtras(config.code);
      let data = null;
      for (const fields of fieldSets) {
        try {
          data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], fields, { limit: 500 });
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
      } else {
        setErrorMsg("Odoo no devolvió productos.");
      }
    } catch (e: any) { 
      setErrorMsg(`Error: ${e.message}`);
    } finally { setLoading(false); }
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
              name: clientData.nombre, phone: clientData.telefono, street: clientData.direccion || 'Pedido Web', company_id: session.companyId
          });
      }
      const orderLines = cart.map(item => [0, 0, {
          product_id: item.producto.id, product_uom_qty: item.cantidad, price_unit: item.producto.precio, product_uom: item.producto.uom_id || 1, name: item.producto.nombre
      }]);
      await client.create(session.uid, session.apiKey, 'sale.order', {
          partner_id: partnerId, company_id: session.companyId, order_line: orderLines, origin: `TIENDA WEB: ${orderRef}`,
          note: `Pago: ${paymentMethod.toUpperCase()} | Entrega: ${deliveryType.toUpperCase()}`,
          state: 'draft' 
      });
      await supabase.from('pedidos_tienda').insert([{
        order_name: orderRef, cliente_nombre: clientData.nombre, monto: cartTotal, voucher_url: voucherImage || '', empresa_code: config.code, estado: 'pendiente'
      }]);
      const message = `*NUEVO PEDIDO - ${config.nombreComercial || config.code}*\nRef: ${orderRef}\nCliente: ${clientData.nombre}\nTotal: S/ ${cartTotal.toFixed(2)}`;
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank');
      setCurrentStep('success');
    } catch (err) { alert("Error al procesar pedido."); }
    finally { setIsOrderLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col relative overflow-x-hidden selection:bg-brand-100 selection:text-brand-900">
      
      {/* HEADER */}
      <header className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-500 ${scrolled ? 'translate-y-0' : 'translate-y-0'}`}>
        <div className="bg-slate-900 text-white overflow-hidden py-1.5 px-4 hidden md:block">
           <div className="max-w-7xl mx-auto flex justify-center items-center gap-6 animate-in slide-in-from-top-full duration-700">
              {tickerMessages.map((msg, i) => (
                <div key={i} className={`flex items-center gap-2 transition-all duration-500 ${i === tickerIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute pointer-events-none'}`}>
                   <span className="text-brand-400">{msg.icon}</span>
                   <span className="text-[10px] font-black uppercase tracking-[0.2em]">{msg.text}</span>
                </div>
              ))}
           </div>
        </div>

        <div className={`transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-xl shadow-xl py-3' : 'bg-white py-5 shadow-sm border-b border-slate-100'}`}>
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between gap-4 md:gap-10">
             <div className="flex items-center gap-3 shrink-0">
               {onBack && (
                 <button onClick={onBack} className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all active:scale-90">
                    <ArrowLeft className="w-5 h-5"/>
                 </button>
               )}
               <div className="flex flex-col group cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
                  {config.logoUrl ? (
                    <img src={config.logoUrl} className={`transition-all duration-300 object-contain group-hover:scale-105 ${scrolled ? 'h-7 md:h-8' : 'h-8 md:h-10'}`} alt="Logo" />
                  ) : (
                    <h1 className="font-black text-slate-900 uppercase text-sm md:text-lg tracking-tighter">{config.nombreComercial || config.code}</h1>
                  )}
               </div>
             </div>
             
             <div className="flex-1 max-w-xl group">
                <div className={`relative transition-all duration-300 ${scrolled ? 'scale-95' : 'scale-100'}`}>
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-500 transition-colors"/>
                   <input 
                      type="text" 
                      placeholder="Busca por nombre de producto..." 
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none transition-all focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-200 group-hover:bg-white shadow-inner" 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)} 
                   />
                </div>
             </div>

             <div className="flex items-center gap-2 md:gap-4">
                <button 
                  onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} 
                  className={`relative p-3.5 bg-slate-900 text-white rounded-2xl shadow-2xl transition-all hover:scale-110 active:scale-90 ${cartAnimate ? 'animate-bounce bg-brand-500' : ''}`}
                >
                   <ShoppingCart className="w-5 h-5" />
                   {totalItems > 0 && (
                     <span className="absolute -top-1.5 -right-1.5 bg-brand-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black border-2 border-white shadow-lg">
                        {totalItems}
                     </span>
                   )}
                </button>
             </div>
          </div>
        </div>
      </header>

      <div className="h-[80px] md:h-[110px]"></div>

      {/* HERO SLIDER */}
      {!loading && slideImages.length > 0 && !searchTerm && (
        <section className="w-full h-[250px] md:h-[400px] relative overflow-hidden bg-slate-100 animate-in fade-in duration-1000">
           {slideImages.map((img, idx) => (
             <div 
               key={idx} 
               className={`absolute inset-0 transition-all duration-1000 ease-in-out transform ${idx === currentSlide ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-12 scale-105 pointer-events-none'}`}
             >
                <img src={img} className="w-full h-full object-cover" alt={`Promo ${idx}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
             </div>
           ))}
           {slideImages.length > 1 && (
             <>
               <button onClick={() => setCurrentSlide(prev => (prev - 1 + slideImages.length) % slideImages.length)} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/40 transition-all z-20"><ChevronLeft/></button>
               <button onClick={() => setCurrentSlide(prev => (prev + 1) % slideImages.length)} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/40 transition-all z-20"><ChevronRight/></button>
             </>
           )}
        </section>
      )}

      {/* BARRA DE CATEGORÍAS - PARA QUE APAREZCA "PERROS", ETC. */}
      {!loading && (
         <div className="bg-white border-b border-slate-100 sticky top-[72px] md:top-[100px] z-50 py-4 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 md:px-8 overflow-x-auto flex gap-3 no-scrollbar scroll-smooth">
               {availableCategories.map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => { setSelectedCategory(cat); window.scrollTo({top: searchTerm ? 0 : 350, behavior: 'smooth'}); }}
                    className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 ${selectedCategory === cat ? 'bg-slate-900 text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                  >
                     {cat === 'Todas' ? <Layers className="w-3.5 h-3.5" /> : (cat.toLowerCase().includes('perro') ? <PawPrint className="w-3.5 h-3.5" /> : <Tag className="w-3.5 h-3.5" />)}
                     {cat}
                  </button>
               ))}
            </div>
         </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 md:p-12 max-w-7xl mx-auto w-full min-h-[50vh]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
             <Loader2 className="w-12 h-12 animate-spin text-brand-500" />
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Sincronizando Catálogo...</p>
          </div>
        ) : (
          <>
            <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
               <div className="animate-in slide-in-from-left duration-700">
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">
                    {selectedCategory === 'Todas' ? 'Novedades' : selectedCategory} {searchTerm ? `: ${searchTerm}` : ''}
                  </h2>
                  <div className="w-16 h-1.5 bg-brand-500 rounded-full mt-2"></div>
               </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8 animate-in fade-in slide-in-from-bottom-12 duration-1000">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-40 text-center opacity-30 flex flex-col items-center gap-4">
                   <SearchX className="w-20 h-20" />
                   <p className="font-black uppercase tracking-widest text-xs">No encontramos productos en esta sección</p>
                </div>
              ) : filteredProducts.map(p => (
                <div key={p.id} onClick={() => setSelectedProduct(p)} className="bg-white p-3 md:p-5 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] transition-all duration-500 relative overflow-hidden cursor-pointer hover:-translate-y-2">
                  <div className="aspect-square bg-slate-50 rounded-[2rem] mb-4 flex items-center justify-center relative overflow-hidden border border-slate-50">
                    {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-700" alt={p.nombre} /> : <Package className="w-10 h-10 text-slate-200" />}
                    {p.stock <= 0 && <span className="absolute top-3 left-3 bg-white/80 backdrop-blur-md px-3 py-1 rounded-full text-[8px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">Sin Stock</span>}
                  </div>
                  <div className="flex-1 flex flex-col">
                    <p className="text-[8px] font-black uppercase text-brand-600 tracking-widest truncate mb-1">{p.categoria_personalizada || p.categoria}</p>
                    <h3 className="text-[11px] md:text-[13px] font-black text-slate-800 uppercase line-clamp-2 leading-tight h-10 mb-4 tracking-tight group-hover:text-brand-600 transition-colors">{p.nombre}</h3>
                    <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-base md:text-xl font-black text-slate-900 tracking-tighter">S/ {p.precio.toFixed(2)}</span>
                      <button onClick={(e) => addToCart(p, e)} className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-lg hover:bg-brand-500 hover:scale-110 active:scale-95 transition-all">
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

      {/* MODAL DETALLE */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md animate-in fade-in" onClick={() => setSelectedProduct(null)}></div>
           <div className="relative bg-white w-full max-w-4xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in duration-300 max-h-[90vh]">
              <div className="w-full md:w-1/2 bg-slate-50 flex items-center justify-center p-12 relative overflow-hidden">
                 {selectedProduct.imagen ? (
                   <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-w-full max-h-full object-contain mix-blend-multiply" alt={selectedProduct.nombre} />
                 ) : (
                   <Package className="w-24 h-24 text-slate-200" />
                 )}
                 <button onClick={() => setSelectedProduct(null)} className="absolute top-8 left-8 p-3 bg-white rounded-2xl shadow-xl text-slate-400 md:hidden"><X/></button>
              </div>
              <div className="w-full md:w-1/2 p-10 md:p-14 flex flex-col overflow-y-auto">
                 <button onClick={() => setSelectedProduct(null)} className="hidden md:flex self-end p-2 text-slate-300 hover:text-slate-900"><X className="w-6 h-6"/></button>
                 <div className="flex-1 mt-6 md:mt-0">
                    <p className="text-[11px] font-black text-brand-600 uppercase tracking-[0.3em] mb-3">{selectedProduct.categoria_personalizada || selectedProduct.categoria}</p>
                    <h2 className="text-3xl md:text-4xl font-black uppercase text-slate-900 tracking-tighter leading-none mb-6">{selectedProduct.nombre}</h2>
                    <p className="text-3xl font-black text-slate-900 mb-10 tracking-tighter">S/ {selectedProduct.precio.toFixed(2)}</p>
                    {selectedProduct.descripcion_venta && (
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                           <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Información</h4>
                           <p className="text-[11px] font-bold text-slate-600 uppercase leading-relaxed">{selectedProduct.descripcion_venta}</p>
                        </div>
                    )}
                 </div>
                 <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-4 hover:bg-brand-500 transition-all shadow-2xl mt-10">
                    <ShoppingCart className="w-5 h-5"/> Añadir al carrito
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* FOOTER */}
      {!loading && (
        <footer className="text-white pt-24 pb-12 px-6 md:px-12 relative overflow-hidden" style={{ backgroundColor: secondaryColor }}>
           <div className="max-w-7xl mx-auto relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
                 <div className="col-span-1 md:col-span-1 space-y-8">
                    {config.footerLogoUrl ? (
                      <img src={config.footerLogoUrl} className="h-12 object-contain" alt="Footer Logo" />
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="bg-brand-500 p-3 rounded-2xl shadow-2xl" style={{ backgroundColor: brandColor }}>
                           <Citrus className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">{config.nombreComercial || config.code}</h2>
                      </div>
                    )}
                    <p className="text-slate-400 text-xs font-bold uppercase leading-relaxed tracking-wider">{config.footer_description || "Expertos en salud y bienestar."}</p>
                    <div className="flex gap-4">
                       {config.facebook_url && <a href={config.facebook_url} target="_blank" className="p-4 bg-white/5 rounded-2xl hover:bg-brand-500 transition-all"><Facebook className="w-5 h-5"/></a>}
                       {config.instagram_url && <a href={config.instagram_url} target="_blank" className="p-4 bg-white/5 rounded-2xl hover:bg-pink-500 transition-all"><Instagram className="w-5 h-5"/></a>}
                    </div>
                 </div>
                 <div className="space-y-8">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-500">Tienda</h3>
                    <ul className="space-y-4">
                       <li><button onClick={onBack} className="text-xs font-black text-slate-400 hover:text-white transition-colors uppercase">Panel Administrativo</button></li>
                    </ul>
                 </div>
                 <div className="space-y-8">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-500">Atención</h3>
                    <div className="flex items-center gap-4 group cursor-pointer">
                        <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-brand-500 transition-all"><MessageCircle className="w-6 h-6 text-white"/></div>
                        <div><p className="text-[9px] font-black uppercase text-slate-500">Escríbenos</p><p className="text-sm font-black tracking-widest">{config.whatsappHelpNumber || '975 615 244'}</p></div>
                    </div>
                 </div>
                 <div className="space-y-8">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-500">Confianza</h3>
                    <div className="bg-white/5 p-8 rounded-[3rem] border border-white/5 space-y-5">
                       <div className="flex items-center gap-4"><ShieldCheck className="w-6 h-6 text-brand-500"/><span className="text-[10px] font-black uppercase tracking-[0.2em]">Pago Seguro</span></div>
                       <div className="flex items-center gap-4"><Clock className="w-6 h-6 text-brand-500"/><span className="text-[10px] font-black uppercase tracking-[0.2em]">Envío Veloz</span></div>
                    </div>
                 </div>
              </div>
              <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 opacity-30">
                 <p className="text-[10px] font-black uppercase tracking-[0.3em]">Built with Lemon BI & Gaor System</p>
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">&copy; 2025 Todos los derechos reservados.</p>
              </div>
           </div>
        </footer>
      )}

      {/* DRAWER CARRITO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative bg-white w-full max-w-lg h-full shadow-2xl flex flex-col p-8 overflow-y-auto animate-in slide-in-from-right duration-500">
              <div className="flex justify-between items-center mb-12">
                 <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">{currentStep === 'cart' ? 'Mi Carrito' : 'Checkout'}</h2>
                    <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mt-1">{totalItems} productos</p>
                 </div>
                 <button onClick={() => setIsCartOpen(false)} className="p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all hover:rotate-90"><X className="w-6 h-6"/></button>
              </div>

              {currentStep === 'cart' && (
                 <div className="space-y-4 flex-1 flex flex-col">
                    {cart.length === 0 ? (
                       <div className="py-24 text-center opacity-20 flex flex-col items-center gap-8">
                          <ShoppingCart className="w-24 h-24"/><p className="font-black uppercase tracking-[0.4em] text-xs">Tu bolsa está vacía</p>
                       </div>
                    ) : (
                      <>
                        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                          {cart.map(i => (
                             <div key={i.producto.id} className="flex gap-5 items-center bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                                <div className="w-16 h-16 bg-white rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border border-slate-50">
                                   {i.producto.imagen ? <img src={`data:image/png;base64,${i.producto.imagen}`} className="w-full h-full object-contain" alt={i.producto.nombre} /> : <Package className="w-8 h-8 text-slate-100"/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                   <p className="text-[11px] font-black uppercase truncate text-slate-800 tracking-tight">{i.producto.nombre}</p>
                                   <p className="font-black text-xs text-brand-600 mt-1">S/ {i.producto.precio.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl shadow-inner border border-slate-100">
                                   <button onClick={() => updateCartQuantity(i.producto.id, -1)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><Minus className="w-4 h-4"/></button>
                                   <span className="text-sm font-black w-6 text-center">{i.cantidad}</span>
                                   <button onClick={() => updateCartQuantity(i.producto.id, 1)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><Plus className="w-4 h-4"/></button>
                                </div>
                             </div>
                          ))}
                        </div>
                        <div className="pt-10 space-y-5 mt-auto">
                           <div className="flex justify-between items-center px-6">
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Total</span>
                              <span className="text-4xl font-black text-slate-900 tracking-tighter">S/ {cartTotal.toFixed(2)}</span>
                           </div>
                           <button onClick={() => setCurrentStep('details')} className="w-full py-7 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] hover:bg-brand-500 transition-all shadow-2xl">Pagar ahora</button>
                        </div>
                      </>
                    )}
                 </div>
              )}

              {currentStep === 'details' && (
                 <div className="space-y-8 animate-in slide-in-from-bottom-6">
                    <div className="space-y-5">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Tu Nombre</label>
                       <input type="text" placeholder="¿Cómo te llamas?" className="w-full p-6 bg-slate-50 rounded-[2rem] outline-none font-bold text-sm border-none focus:ring-4 focus:ring-brand-500/10" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mt-4">WhatsApp</label>
                       <input type="tel" placeholder="Número para coordinar" className="w-full p-6 bg-slate-50 rounded-[2rem] outline-none font-bold text-sm border-none focus:ring-4 focus:ring-brand-500/10" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                    </div>
                    <div className="space-y-5">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Método de Envío</label>
                       <div className="grid grid-cols-2 gap-4">
                          <button onClick={() => setDeliveryType('recojo')} className={`py-6 rounded-[2rem] border-2 font-black uppercase text-[11px] transition-all ${deliveryType === 'recojo' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Recojo Sede</button>
                          <button onClick={() => setDeliveryType('delivery')} className={`py-6 rounded-[2rem] border-2 font-black uppercase text-[11px] transition-all ${deliveryType === 'delivery' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Delivery</button>
                       </div>
                    </div>
                    {deliveryType === 'delivery' && (
                       <div className="space-y-5">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Dirección</label>
                          <textarea placeholder="Calle, número, urbanización y referencia..." className="w-full p-7 bg-slate-50 rounded-[2.5rem] outline-none font-bold h-40 text-sm border-none focus:ring-4 focus:ring-brand-500/10" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                       </div>
                    )}
                    <div className="flex gap-4 pt-10">
                       <button onClick={() => setCurrentStep('cart')} className="flex-1 py-6 bg-slate-100 rounded-3xl font-black uppercase text-[10px]">Atrás</button>
                       <button onClick={() => setCurrentStep('payment')} disabled={!clientData.nombre || !clientData.telefono} className="flex-[2.5] py-6 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest shadow-2xl">Confirmar</button>
                    </div>
                 </div>
              )}

              {currentStep === 'payment' && (
                 <div className="space-y-8 animate-in slide-in-from-bottom-6 text-center">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">S/ {cartTotal.toFixed(2)}</h2>
                    <div className="flex gap-4">
                       <button onClick={() => setPaymentMethod('yape')} className={`flex-1 py-5 rounded-2xl border-2 font-black uppercase text-[11px] transition-all ${paymentMethod === 'yape' ? 'border-purple-600 bg-purple-50 text-purple-600 shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Yape</button>
                       <button onClick={() => setPaymentMethod('plin')} className={`flex-1 py-5 rounded-2xl border-2 font-black uppercase text-[11px] transition-all ${paymentMethod === 'plin' ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Plin</button>
                    </div>
                    <div className="aspect-square bg-slate-900 rounded-[3.5rem] flex items-center justify-center p-14 shadow-2xl relative overflow-hidden group">
                       {paymentMethod === 'yape' ? (
                          config.yapeQR ? <img src={config.yapeQR.startsWith('data:') ? config.yapeQR : `data:image/png;base64,${config.yapeQR}`} className="max-w-full max-h-full rounded-2xl relative z-10" alt="Yape QR" /> : <QrCode className="text-white w-24 h-24 opacity-20"/>
                       ) : (
                          config.plinQR ? <img src={config.plinQR.startsWith('data:') ? config.plinQR : `data:image/png;base64,${config.plinQR}`} className="max-w-full max-h-full rounded-2xl relative z-10" alt="Plin QR" /> : <QrCode className="text-white w-24 h-24 opacity-20"/>
                       )}
                    </div>
                    <div className="space-y-2">
                       <p className="text-3xl font-black text-slate-900 tracking-[0.2em]">{paymentMethod === 'yape' ? (config.yapeNumber || '---') : (config.plinNumber || '---')}</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{paymentMethod === 'yape' ? (config.yapeName || 'Titular Yape') : (config.plinName || 'Titular Plin')}</p>
                    </div>
                    <div className="flex gap-4 pt-8">
                       <button onClick={() => setCurrentStep('details')} className="flex-1 py-6 bg-slate-100 rounded-3xl font-black uppercase text-[10px]">Atrás</button>
                       <button onClick={() => setCurrentStep('voucher')} className="flex-[2.5] py-6 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest shadow-2xl">Ya pagué</button>
                    </div>
                 </div>
              )}

              {currentStep === 'voucher' && (
                 <div className="space-y-8 animate-in slide-in-from-bottom-6">
                    <h2 className="text-xl font-black uppercase text-center text-slate-900 tracking-widest">Sube tu comprobante</h2>
                    <div className="border-4 border-dashed rounded-[3.5rem] aspect-[3/4] flex flex-col items-center justify-center p-6 bg-slate-50 relative overflow-hidden group hover:border-brand-500 transition-all shadow-inner">
                       {voucherImage ? (
                          <>
                             <img src={voucherImage} className="w-full h-full object-cover" alt="Voucher" />
                             <button onClick={() => setVoucherImage(null)} className="absolute top-8 right-8 bg-red-500 text-white p-5 rounded-3xl shadow-2xl hover:scale-110 active:scale-95 transition-all"><Trash2 className="w-6 h-6"/></button>
                          </>
                       ) : (
                          <label className="cursor-pointer flex flex-col items-center text-slate-300 group-hover:text-brand-500 transition-colors">
                             <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mb-6 group-hover:scale-110 transition-transform">
                                <Camera className="w-10 h-10 animate-pulse"/>
                             </div>
                             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-center max-w-[150px]">Cargar foto de pago</p>
                             <input type="file" className="hidden" accept="image/*" onChange={handleVoucherUpload} />
                          </label>
                       )}
                    </div>
                    <div className="flex gap-4">
                       <button onClick={() => setCurrentStep('payment')} className="flex-1 py-7 bg-slate-100 rounded-[2.5rem] font-black uppercase text-[10px]">Atrás</button>
                       <button onClick={handleFinishOrder} disabled={!voucherImage || isOrderLoading} className="flex-[2.5] py-7 bg-brand-500 text-white rounded-[2.5rem] font-black uppercase text-[11px] tracking-[0.2em] disabled:opacity-50 flex items-center justify-center gap-4 shadow-2xl shadow-brand-500/20">
                          {isOrderLoading ? <Loader2 className="animate-spin w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>} FINALIZAR PEDIDO
                       </button>
                    </div>
                 </div>
              )}

              {currentStep === 'success' && (
                 <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 p-8">
                    <div className="w-40 h-40 bg-brand-500 text-white rounded-full flex items-center justify-center shadow-2xl animate-in zoom-in duration-1000">
                       <CheckCircle2 className="w-20 h-20"/>
                    </div>
                    <div className="space-y-6">
                       <h3 className="text-5xl font-black uppercase tracking-tighter text-slate-900">¡Listo!</h3>
                       <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed max-w-xs mx-auto">Orden recibida. Revisa tu WhatsApp para la confirmación final.</p>
                    </div>
                    <button onClick={() => { setIsCartOpen(false); setCart([]); setCurrentStep('cart'); setVoucherImage(null); }} className="w-full py-7 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-xs shadow-2xl hover:bg-slate-800 transition-all">Seguir Comprando</button>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default StoreView;
