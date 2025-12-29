
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, Facebook, Instagram, CheckCircle2, 
  Loader2, RefreshCw, Trash2, Smartphone, 
  Layers, Tag, SearchX, PawPrint, ChevronRight,
  Upload, Camera, Image as ImageIcon,
  QrCode, ShieldCheck, CreditCard, Clock, ChevronLeft,
  Citrus, Zap, ShieldCheck as Shield, User
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
  const slideImages = useMemo(() => (config.slide_images || []).filter(img => img && img.trim() !== ''), [config.slide_images]);

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
      
      // Intentar buscar o crear cliente
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

      // Crear líneas de pedido
      const orderLines = cart.map(item => [0, 0, {
          product_id: item.producto.id, 
          product_uom_qty: item.cantidad, 
          price_unit: item.producto.precio, 
          product_uom: item.producto.uom_id || 1, 
          name: item.producto.nombre
      }]);

      // Crear pedido en Odoo
      await client.create(session.uid, session.apiKey, 'sale.order', {
          partner_id: partnerId, 
          company_id: session.companyId, 
          order_line: orderLines, 
          origin: `TIENDA WEB: ${orderRef}`,
          note: `Pago: ${paymentMethod.toUpperCase()} | Entrega: ${deliveryType.toUpperCase()} | Titular: ${paymentMethod === 'yape' ? config.yapeName : config.plinName}`,
          state: 'draft' 
      });

      // Guardar en Supabase para notificaciones en tiempo real
      await supabase.from('pedidos_tienda').insert([{
        order_name: orderRef, 
        cliente_nombre: clientData.nombre, 
        monto: cartTotal, 
        voucher_url: voucherImage || '', 
        empresa_code: config.code, 
        estado: 'pendiente'
      }]);

      // Enviar mensaje de WhatsApp
      const message = `*NUEVO PEDIDO - ${config.nombreComercial || config.code}*\n\nRef: ${orderRef}\nCliente: ${clientData.nombre}\nWhatsApp: ${clientData.telefono}\nTotal: S/ ${cartTotal.toFixed(2)}\n\n*Detalle:* \n${cart.map(i => `- ${i.cantidad}x ${i.producto.nombre}`).join('\n')}\n\n*Método:* ${paymentMethod.toUpperCase()}\n*Entrega:* ${deliveryType.toUpperCase()}${deliveryType === 'delivery' ? `\n*Dir:* ${clientData.direccion}` : ''}`;
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank');
      
      setCurrentStep('success');
    } catch (err: any) { 
      console.error(err);
      alert("Error al procesar el pedido: " + err.message); 
    }
    finally { setIsOrderLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col relative overflow-x-hidden">
      
      {/* HEADER DINÁMICO */}
      <header className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-500`}>
        <div className="bg-slate-900 text-white py-1.5 hidden md:block">
           <div className="max-w-7xl mx-auto flex justify-center items-center gap-6">
              {tickerMessages.map((msg, i) => (
                <div key={i} className={`flex items-center gap-2 transition-all duration-500 ${i === tickerIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 absolute'}`}>
                   <span className="text-brand-400">{msg.icon}</span>
                   <span className="text-[10px] font-black uppercase tracking-[0.2em]">{msg.text}</span>
                </div>
              ))}
           </div>
        </div>

        <div className={`transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-xl shadow-xl py-3' : 'bg-white py-5 shadow-sm border-b border-slate-100'}`}>
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between gap-4 md:gap-10">
             <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
                {onBack && <button onClick={onBack} className="p-2.5 text-slate-400 hover:text-slate-900 transition-all rounded-xl hover:bg-slate-50"><ArrowLeft className="w-5 h-5"/></button>}
                {config.logoUrl ? (
                  <img src={config.logoUrl} className={`transition-all duration-300 object-contain ${scrolled ? 'h-7' : 'h-10'}`} alt="Logo" />
                ) : (
                  <h1 className="font-black text-slate-900 uppercase text-lg tracking-tighter">{config.nombreComercial || config.code}</h1>
                )}
             </div>
             
             <div className="flex-1 max-w-xl group">
                <div className="relative">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-500 transition-colors"/>
                   <input type="text" placeholder="Busca productos..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none transition-all focus:bg-white focus:ring-4 focus:ring-brand-500/10 shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
             </div>

             <button 
                onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} 
                className={`relative p-3.5 bg-slate-900 text-white rounded-2xl shadow-2xl transition-all hover:scale-105 ${cartAnimate ? 'animate-bounce bg-brand-500' : ''}`}
             >
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && <span className="absolute -top-1.5 -right-1.5 bg-brand-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black border-2 border-white shadow-lg animate-in zoom-in">{totalItems}</span>}
             </button>
          </div>
        </div>
      </header>

      <div className="h-[80px] md:h-[110px]"></div>

      {/* HERO SLIDER RESTAURADO */}
      {!loading && slideImages.length > 0 && !searchTerm && (
        <section className="w-full h-[300px] md:h-[450px] relative overflow-hidden bg-slate-200">
           {slideImages.map((img, idx) => (
             <div 
               key={idx} 
               className={`absolute inset-0 transition-all duration-1000 ease-in-out transform ${idx === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'}`}
             >
                <img src={img} className="w-full h-full object-cover" alt={`Banner ${idx}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
             </div>
           ))}
           
           {slideImages.length > 1 && (
             <>
                <button onClick={() => setCurrentSlide(prev => (prev - 1 + slideImages.length) % slideImages.length)} className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-white/20 backdrop-blur-xl text-white rounded-full hover:bg-white/40 transition-all z-20"><ChevronLeft className="w-6 h-6"/></button>
                <button onClick={() => setCurrentSlide(prev => (prev + 1) % slideImages.length)} className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-white/20 backdrop-blur-xl text-white rounded-full hover:bg-white/40 transition-all z-20"><ChevronRight className="w-6 h-6"/></button>
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-20">
                    {slideImages.map((_, i) => (
                        <button key={i} onClick={() => setCurrentSlide(i)} className={`h-1.5 rounded-full transition-all ${i === currentSlide ? 'w-8 bg-brand-500' : 'w-2 bg-white/40 hover:bg-white/60'}`}></button>
                    ))}
                </div>
             </>
           )}
        </section>
      )}

      {/* BARRA DE CATEGORÍAS */}
      {!loading && (
         <div className="bg-white border-b border-slate-100 sticky top-[72px] md:top-[100px] z-50 py-4 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 md:px-8 overflow-x-auto flex gap-3 no-scrollbar scroll-smooth">
               {availableCategories.map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => { setSelectedCategory(cat); window.scrollTo({top: searchTerm ? 0 : 350, behavior: 'smooth'}); }}
                    className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 ${selectedCategory === cat ? 'bg-slate-900 text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                  >
                     {cat === 'Todas' ? <Layers className="w-3.5 h-3.5" /> : (cat.toLowerCase().includes('perro') || cat.toLowerCase().includes('mascota') ? <PawPrint className="w-3.5 h-3.5" /> : <Tag className="w-3.5 h-3.5" />)}
                     {cat}
                  </button>
               ))}
            </div>
         </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-4 md:p-12 max-w-7xl mx-auto w-full min-h-[60vh]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
             <Loader2 className="w-12 h-12 animate-spin text-brand-500" />
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Sincronizando Catálogo...</p>
          </div>
        ) : (
          <>
            <div className="mb-12 animate-in slide-in-from-left duration-700">
               <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
                     <Citrus className="w-6 h-6"/>
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">
                    {selectedCategory === 'Todas' ? 'Nuestras Novedades' : selectedCategory}
                  </h2>
               </div>
               <div className="w-20 h-1.5 bg-brand-500 rounded-full"></div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-40 text-center opacity-30 flex flex-col items-center gap-4">
                   <SearchX className="w-20 h-20" />
                   <p className="font-black uppercase tracking-widest text-xs">No hay productos en esta sección</p>
                </div>
              ) : filteredProducts.map(p => (
                <div key={p.id} onClick={() => setSelectedProduct(p)} className="bg-white p-3 md:p-5 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] transition-all duration-500 cursor-pointer relative overflow-hidden group hover:-translate-y-2">
                  <div className="aspect-square bg-slate-50 rounded-[2rem] mb-4 flex items-center justify-center overflow-hidden border border-slate-50 relative">
                    {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-700" alt={p.nombre} /> : <Package className="w-10 h-10 text-slate-200" />}
                    <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/5 transition-colors"></div>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <p className="text-[8px] font-black uppercase text-brand-600 tracking-widest truncate mb-1">{p.categoria_personalizada || p.categoria}</p>
                    <h3 className="text-[11px] font-black text-slate-800 uppercase line-clamp-2 h-10 tracking-tight leading-tight group-hover:text-brand-600 transition-colors">{p.nombre}</h3>
                    <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-base font-black text-slate-900 tracking-tighter">S/ {p.precio.toFixed(2)}</span>
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

      {/* PLANTILLA DE DETALLE DE PRODUCTO RESTAURADA */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md animate-in fade-in" onClick={() => setSelectedProduct(null)}></div>
           <div className="relative bg-white w-full max-w-4xl rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col md:flex-row animate-in zoom-in duration-300 max-h-[90vh]">
              <div className="w-full md:w-1/2 bg-slate-50 flex items-center justify-center p-12 relative">
                 {selectedProduct.imagen ? (
                   <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-w-full max-h-full object-contain mix-blend-multiply drop-shadow-2xl" alt={selectedProduct.nombre} />
                 ) : (
                   <Package className="w-24 h-24 text-slate-200" />
                 )}
                 <button onClick={() => setSelectedProduct(null)} className="absolute top-8 left-8 p-3 bg-white rounded-2xl shadow-xl text-slate-400 md:hidden"><X/></button>
              </div>
              <div className="w-full md:w-1/2 p-10 md:p-14 flex flex-col overflow-y-auto">
                 <button onClick={() => setSelectedProduct(null)} className="hidden md:flex self-end p-2 text-slate-300 hover:text-slate-900 transition-colors"><X className="w-6 h-6"/></button>
                 <div className="flex-1 mt-6 md:mt-0">
                    <p className="text-[11px] font-black text-brand-600 uppercase tracking-[0.3em] mb-3">{selectedProduct.categoria_personalizada || selectedProduct.categoria}</p>
                    <h2 className="text-3xl md:text-4xl font-black uppercase text-slate-900 tracking-tighter leading-none mb-6">{selectedProduct.nombre}</h2>
                    <p className="text-4xl font-black text-slate-900 mb-10 tracking-tighter">S/ {selectedProduct.precio.toFixed(2)}</p>
                    
                    {selectedProduct.descripcion_venta && (
                        <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                           <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4">Información del Producto</h4>
                           <p className="text-[12px] font-bold text-slate-600 uppercase leading-relaxed">{selectedProduct.descripcion_venta}</p>
                        </div>
                    )}

                    <div className="mt-8 flex items-center gap-4 p-4 border border-slate-100 rounded-2xl bg-white">
                        <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600"><ShieldCheck className="w-6 h-6"/></div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-900">Garantía Lemon BI</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Producto 100% Original</p>
                        </div>
                    </div>
                 </div>
                 <button 
                    onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} 
                    className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-4 hover:bg-brand-500 transition-all shadow-2xl mt-10 hover:scale-105 active:scale-95"
                 >
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
                 <div className="space-y-8">
                    {config.footerLogoUrl ? <img src={config.footerLogoUrl} className="h-12 object-contain" /> : <h2 className="text-2xl font-black uppercase tracking-tighter">{config.nombreComercial || config.code}</h2>}
                    <p className="text-slate-400 text-xs font-bold uppercase leading-relaxed">{config.footer_description || "Dedicados a brindarte la mejor experiencia de compra online."}</p>
                    <div className="flex gap-4">
                       {config.facebook_url && <a href={config.facebook_url} target="_blank" className="p-4 bg-white/5 rounded-2xl hover:bg-brand-500 transition-all"><Facebook className="w-5 h-5"/></a>}
                       {config.instagram_url && <a href={config.instagram_url} target="_blank" className="p-4 bg-white/5 rounded-2xl hover:bg-pink-500 transition-all"><Instagram className="w-5 h-5"/></a>}
                    </div>
                 </div>
                 <div className="space-y-8">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-500">Explorar</h3>
                    <ul className="space-y-4">
                       <li><button onClick={() => { setSelectedCategory('Todas'); window.scrollTo({top: 350, behavior: 'smooth'}); }} className="text-xs font-black text-slate-400 hover:text-white transition-colors uppercase">Catálogo Completo</button></li>
                       <li><button onClick={onBack} className="text-xs font-black text-slate-400 hover:text-white transition-colors uppercase">Administrar Tienda</button></li>
                    </ul>
                 </div>
                 <div className="space-y-8">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-500">Atención</h3>
                    <div className="flex items-center gap-4 group cursor-pointer">
                        <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-brand-500 transition-all shadow-lg"><MessageCircle className="w-6 h-6 text-white"/></div>
                        <div><p className="text-[9px] font-black uppercase text-slate-500">¿Necesitas ayuda?</p><p className="text-sm font-black tracking-widest">{config.whatsappHelpNumber || 'Escríbenos'}</p></div>
                    </div>
                 </div>
                 <div className="space-y-8">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-500">Confianza</h3>
                    <div className="bg-white/5 p-8 rounded-[3rem] border border-white/5 space-y-5 text-center">
                       <div className="flex items-center gap-4"><ShieldCheck className="w-6 h-6 text-brand-500"/><span className="text-[10px] font-black uppercase tracking-widest">Pago Seguro</span></div>
                       <div className="flex items-center gap-4"><Clock className="w-6 h-6 text-brand-500"/><span className="text-[10px] font-black uppercase tracking-widest">Entrega Veloz</span></div>
                    </div>
                 </div>
              </div>
              <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 opacity-30 text-[10px] font-black uppercase tracking-widest">
                 <p>Powered by Lemon BI & Gaor System</p>
                 <p>&copy; 2025 Todos los derechos reservados.</p>
              </div>
           </div>
        </footer>
      )}

      {/* FLUJO DE COMPRA / DRAWER CARRITO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative bg-white w-full max-w-lg h-full shadow-2xl flex flex-col p-8 overflow-y-auto animate-in slide-in-from-right duration-500">
              <div className="flex justify-between items-center mb-12">
                 <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">
                        {currentStep === 'cart' ? 'Mi Carrito' : 
                         currentStep === 'details' ? 'Tus Datos' : 
                         currentStep === 'payment' ? 'Pagar Orden' : 'Finalizar'}
                    </h2>
                    <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mt-1">{totalItems} productos seleccionados</p>
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
                             <div key={i.producto.id} className="flex gap-5 items-center bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-sm animate-in slide-in-from-right transition-all">
                                <div className="w-16 h-16 bg-white rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border border-slate-50 shadow-inner">
                                   {i.producto.imagen ? <img src={`data:image/png;base64,${i.producto.imagen}`} className="w-full h-full object-contain" /> : <Package className="w-8 h-8 text-slate-100"/>}
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
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Total de compra</span>
                              <span className="text-4xl font-black text-slate-900 tracking-tighter">S/ {cartTotal.toFixed(2)}</span>
                           </div>
                           <button onClick={() => setCurrentStep('details')} className="w-full py-7 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] hover:bg-brand-500 transition-all shadow-2xl hover:scale-[1.02] active:scale-95">Continuar Compra</button>
                        </div>
                      </>
                    )}
                 </div>
              )}

              {currentStep === 'details' && (
                 <div className="space-y-8 animate-in slide-in-from-right">
                    <div className="space-y-5">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Tu Nombre Completo</label>
                       <div className="relative">
                          <User className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"/>
                          <input type="text" placeholder="¿Cómo te llamas?" className="w-full pl-14 pr-6 py-6 bg-slate-50 rounded-[2rem] outline-none font-bold text-sm border-none shadow-inner focus:ring-4 focus:ring-brand-500/10 transition-all uppercase" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                       </div>
                       
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mt-4">WhatsApp para coordinación</label>
                       <div className="relative">
                          <Smartphone className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"/>
                          <input type="tel" placeholder="Número celular" className="w-full pl-14 pr-6 py-6 bg-slate-50 rounded-[2rem] outline-none font-bold text-sm border-none shadow-inner focus:ring-4 focus:ring-brand-500/10 transition-all" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                       </div>
                    </div>

                    <div className="space-y-5">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Modalidad de Entrega</label>
                       <div className="grid grid-cols-2 gap-4">
                          <button onClick={() => setDeliveryType('recojo')} className={`flex flex-col items-center gap-3 py-6 rounded-[2rem] border-2 font-black uppercase text-[11px] transition-all ${deliveryType === 'recojo' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                             <MapPin className="w-5 h-5"/> Recojo Sede
                          </button>
                          <button onClick={() => setDeliveryType('delivery')} className={`flex flex-col items-center gap-3 py-6 rounded-[2rem] border-2 font-black uppercase text-[11px] transition-all ${deliveryType === 'delivery' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                             <Truck className="w-5 h-5"/> Delivery
                          </button>
                       </div>
                    </div>

                    {deliveryType === 'delivery' && (
                       <div className="space-y-5 animate-in slide-in-from-top-4">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Dirección Detallada</label>
                          <textarea placeholder="Calle, número, urbanización y referencia..." className="w-full p-8 bg-slate-50 rounded-[2.5rem] outline-none font-bold h-40 shadow-inner text-sm border-none focus:ring-4 focus:ring-brand-500/10 transition-all uppercase" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                       </div>
                    )}

                    <div className="flex gap-4 pt-10">
                       <button onClick={() => setCurrentStep('cart')} className="flex-1 py-6 bg-slate-100 rounded-3xl font-black uppercase text-[10px] text-slate-400">Atrás</button>
                       <button onClick={() => setCurrentStep('payment')} disabled={!clientData.nombre || !clientData.telefono} className="flex-[2.5] py-6 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest shadow-2xl disabled:opacity-30 hover:bg-brand-500 transition-all">Confirmar Datos</button>
                    </div>
                 </div>
              )}

              {currentStep === 'payment' && (
                 <div className="space-y-8 animate-in slide-in-from-right text-center">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">S/ {cartTotal.toFixed(2)}</h2>
                    
                    <div className="flex gap-4">
                       <button onClick={() => setPaymentMethod('yape')} className={`flex-1 py-5 rounded-2xl border-2 font-black uppercase text-[11px] transition-all ${paymentMethod === 'yape' ? 'border-purple-600 bg-purple-50 text-purple-600 shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Yape</button>
                       <button onClick={() => setPaymentMethod('plin')} className={`flex-1 py-5 rounded-2xl border-2 font-black uppercase text-[11px] transition-all ${paymentMethod === 'plin' ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Plin</button>
                    </div>
                    
                    <div className="aspect-square bg-slate-900 rounded-[3.5rem] flex items-center justify-center p-14 shadow-2xl relative overflow-hidden group">
                       {paymentMethod === 'yape' ? (
                          config.yapeQR ? <img src={config.yapeQR} className="max-w-full max-h-full rounded-2xl animate-in zoom-in" alt="Yape QR" /> : <QrCode className="text-white w-24 h-24 opacity-20"/>
                       ) : (
                          config.plinQR ? <img src={config.plinQR} className="max-w-full max-h-full rounded-2xl animate-in zoom-in" alt="Plin QR" /> : <QrCode className="text-white w-24 h-24 opacity-20"/>
                       )}
                       <div className="absolute inset-0 bg-brand-500/10 mix-blend-overlay group-hover:opacity-0 transition-opacity"></div>
                    </div>
                    
                    <div className="space-y-3 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-inner">
                       <div className="flex items-center justify-center gap-2 text-brand-600">
                          <User className="w-4 h-4"/>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em]">Titular de la cuenta</p>
                       </div>
                       <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-tight">
                          {paymentMethod === 'yape' ? (config.yapeName || 'NOMBRE NO DISPONIBLE') : (config.plinName || 'NOMBRE NO DISPONIBLE')}
                       </p>
                       <div className="flex items-center justify-center gap-3 mt-4">
                          <Smartphone className="w-5 h-5 text-slate-400"/>
                          <p className="text-3xl font-black text-slate-900 tracking-[0.2em]">
                             {paymentMethod === 'yape' ? (config.yapeNumber || '---') : (config.plinNumber || '---')}
                          </p>
                       </div>
                    </div>

                    <div className="flex gap-4 pt-8">
                       <button onClick={() => setCurrentStep('details')} className="flex-1 py-6 bg-slate-100 rounded-3xl font-black uppercase text-[10px] text-slate-400">Atrás</button>
                       <button onClick={() => setCurrentStep('voucher')} className="flex-[2.5] py-6 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:bg-brand-500 transition-all">Ya pagué, subir foto</button>
                    </div>
                 </div>
              )}

              {currentStep === 'voucher' && (
                 <div className="space-y-8 animate-in slide-in-from-right">
                    <h2 className="text-xl font-black uppercase text-center text-slate-900 tracking-widest">Sube tu comprobante</h2>
                    <div className="border-4 border-dashed rounded-[3.5rem] aspect-[3/4] flex flex-col items-center justify-center p-8 bg-slate-50 relative overflow-hidden group hover:border-brand-500 transition-all shadow-inner">
                       {voucherImage ? (
                          <>
                             <img src={voucherImage} className="w-full h-full object-cover animate-in fade-in" alt="Voucher" />
                             <button onClick={() => setVoucherImage(null)} className="absolute top-8 right-8 bg-red-500 text-white p-5 rounded-3xl shadow-2xl hover:scale-110 active:scale-95 transition-all"><Trash2 className="w-6 h-6"/></button>
                          </>
                       ) : (
                          <label className="cursor-pointer flex flex-col items-center text-slate-300 group-hover:text-brand-500 transition-colors">
                             <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mb-6 group-hover:scale-110 transition-transform">
                                <Camera className="w-10 h-10 animate-pulse"/>
                             </div>
                             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-center max-w-[150px]">Toca para cargar la captura del pago</p>
                             <input type="file" className="hidden" accept="image/*" onChange={handleVoucherUpload} />
                          </label>
                       )}
                    </div>
                    <div className="flex gap-4">
                       <button onClick={() => setCurrentStep('payment')} className="flex-1 py-7 bg-slate-100 rounded-[2.5rem] font-black uppercase text-[10px] text-slate-400">Atrás</button>
                       <button 
                          onClick={handleFinishOrder} 
                          disabled={!voucherImage || isOrderLoading} 
                          className="flex-[2.5] py-7 bg-brand-500 text-white rounded-[2.5rem] font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 disabled:opacity-30 transition-all"
                       >
                          {isOrderLoading ? <Loader2 className="animate-spin w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>} FINALIZAR PEDIDO
                       </button>
                    </div>
                 </div>
              )}

              {currentStep === 'success' && (
                 <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 p-8 animate-in zoom-in duration-500">
                    <div className="w-44 h-44 bg-brand-500 text-white rounded-full flex items-center justify-center shadow-[0_30px_60px_-12px_rgba(132,204,22,0.5)] animate-bounce">
                       <CheckCircle2 className="w-20 h-20"/>
                    </div>
                    <div className="space-y-6">
                       <h3 className="text-5xl font-black uppercase tracking-tighter text-slate-900 leading-none">¡Éxito Total!</h3>
                       <p className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed max-w-xs mx-auto">Tu pedido ha sido recibido. En unos minutos te contactaremos por WhatsApp para la confirmación final.</p>
                    </div>
                    <button onClick={() => { setIsCartOpen(false); setCart([]); setCurrentStep('cart'); setVoucherImage(null); }} className="w-full py-7 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-xs shadow-2xl hover:bg-brand-500 transition-all hover:scale-[1.02]">Seguir Comprando</button>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default StoreView;
