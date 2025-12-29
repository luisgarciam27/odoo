
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, Facebook, Instagram, CheckCircle2, 
  Loader2, Trash2, Smartphone, 
  Layers, Tag, SearchX, ChevronRight,
  Camera, Image as ImageIcon,
  QrCode, ChevronLeft,
  Citrus, ShieldCheck as Shield,
  ExternalLink, Sparkles, Globe
} from 'lucide-react';
import { Producto, CartItem, OdooSession, ClientConfig, SedeStore } from '../types';
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
  const [selectedSede, setSelectedSede] = useState<SedeStore | null>(null);
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
    const client = new OdooClient(session.url, session.db, session.useProxy);
    const fieldSets = [['display_name', 'list_price', 'categ_id', 'image_128', 'description_sale'], ['display_name', 'list_price', 'categ_id', 'image_128']];
    try {
      const extrasMap = await getProductExtras(config.code);
      let data = null;
      for (const fields of fieldSets) {
        try {
          data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], fields, { limit: 1000, order: 'display_name asc' });
          if (data && Array.isArray(data)) break;
        } catch (e) { }
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
            imagen: p.image_128 || p.image_medium || p.image_small || p.image_1920,
            descripcion_venta: extra?.descripcion_lemon || p.description_sale || '',
            categoria_personalizada: extra?.categoria_personalizada || '',
          };
        }));
      }
    } catch (e: any) { } finally { setLoading(false); }
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
      const waNumber = (config.whatsappNumbers || config.whatsappHelpNumber || '51975615244').replace(/\D/g, '');
      const orderRef = `WEB-${Date.now().toString().slice(-6)}`;
      
      // Subir voucher a supabase para tener un link público (o usar el base64 si no hay storage)
      let finalVoucherUrl = '';
      if (voucherImage) {
          const { data, error } = await supabase.from('pedidos_tienda').insert([{
            order_name: orderRef, 
            cliente_nombre: clientData.nombre, 
            monto: cartTotal, 
            voucher_url: voucherImage, // En LemonBI se suele guardar el base64 si no hay buckets configurados
            empresa_code: config.code, 
            estado: 'pendiente'
          }]).select();
          if (data) finalVoucherUrl = `${window.location.origin}/voucher-view?ref=${orderRef}`; // Simulación de link
      }

      let locationText = '';
      if (deliveryType === 'recojo' && selectedSede) {
          locationText = `\n*Lugar de Recojo:* ${selectedSede.nombre}\n*Dirección:* ${selectedSede.direccion}`;
      } else if (deliveryType === 'delivery') {
          locationText = `\n*Dirección Delivery:* ${clientData.direccion}`;
      }

      const message = `*NUEVO PEDIDO WEB*\nRef: ${orderRef}\nCliente: ${clientData.nombre}\nCelular: ${clientData.telefono}\n\n*Pedido:* \n${cart.map(i => `- ${i.cantidad}x ${i.producto.nombre}`).join('\n')}\n\n*Total:* S/ ${cartTotal.toFixed(2)}\n*Pago:* ${paymentMethod.toUpperCase()}${locationText}\n\n*Comprobante de Pago:* ${finalVoucherUrl || 'Adjunto en este chat'}`;
      
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank');
      setCurrentStep('success');
    } catch (err: any) { 
      alert("Error al procesar el pedido."); 
    } finally { 
      setIsOrderLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col relative overflow-x-hidden selection:bg-brand-100">
      
      <style>{`
        @keyframes kenburns {
          from { transform: scale(1); }
          to { transform: scale(1.1); }
        }
        .animate-kenburns {
          animation: kenburns 10s linear infinite alternate;
        }
      `}</style>

      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-[60] bg-white border-b border-slate-100 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-6">
           <div className="flex items-center gap-4 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
              {onBack && (
                <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-900 transition-all">
                  <ArrowLeft className="w-5 h-5"/>
                </button>
              )}
              {config.logoUrl ? (
                <img src={config.logoUrl} className="h-10 object-contain" alt="Logo" />
              ) : (
                <div className="flex items-center gap-2">
                   <Citrus className="w-8 h-8 text-brand-500" />
                   <h1 className="font-black text-slate-900 uppercase text-lg">{config.nombreComercial || config.code}</h1>
                </div>
              )}
           </div>
           
           <div className="flex-1 max-w-xl">
              <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"/>
                 <input 
                  type="text" 
                  placeholder="Buscar productos..." 
                  className="w-full pl-12 pr-6 py-3 bg-slate-50 border border-slate-100 rounded-full text-xs font-bold outline-none focus:ring-4 focus:ring-brand-500/5 transition-all" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                 />
              </div>
           </div>

           <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all">
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && <span className="absolute -top-2 -right-2 bg-brand-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black border-2 border-white">{totalItems}</span>}
           </button>
        </div>
      </header>

      <div className="h-[72px]"></div>

      {/* SLIDER */}
      {!loading && slideImages.length > 0 && !searchTerm && (
        <section className="w-full px-4 py-8">
           <div className="max-w-7xl mx-auto relative rounded-[3rem] overflow-hidden shadow-2xl aspect-[21/9] bg-slate-100">
              {slideImages.map((img, idx) => (
                 <img key={idx} src={img} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${idx === currentSlide ? 'opacity-100 animate-kenburns' : 'opacity-0'}`} alt="Banner" />
              ))}
              {slideImages.length > 1 && (
                 <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                    {slideImages.map((_, i) => (
                       <button key={i} onClick={() => setCurrentSlide(i)} className={`h-1.5 rounded-full transition-all ${i === currentSlide ? 'w-8 bg-white' : 'w-2 bg-white/40'}`}></button>
                    ))}
                 </div>
              )}
           </div>
        </section>
      )}

      {/* PRODUCTOS */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
             <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => setSelectedProduct(p)} className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-xl transition-all cursor-pointer">
                <div className="aspect-square bg-slate-50 rounded-[1.5rem] mb-4 flex items-center justify-center overflow-hidden">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain p-2 mix-blend-multiply" alt={p.nombre} /> : <Package className="w-8 h-8 text-slate-200" />}
                </div>
                <h3 className="text-[11px] font-black text-slate-800 uppercase line-clamp-2 h-10 tracking-tight">{p.nombre}</h3>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                  <button onClick={(e) => addToCart(p, e)} className="p-3 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-brand-500 transition-all"><Plus className="w-4 h-4"/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* FOOTER DINÁMICO */}
      {!loading && (
        <footer className="text-white py-16 px-6 border-t border-white/5" style={{ backgroundColor: secondaryColor }}>
           <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-12">
              <div className="flex-1 flex items-center gap-6">
                 {config.footerLogoUrl ? (
                   <img src={config.footerLogoUrl} className="h-10 object-contain" alt="Footer Logo" />
                 ) : (
                   <div className="flex items-center gap-2">
                      <Citrus className="w-8 h-8 text-brand-500" />
                      <h2 className="text-xl font-black uppercase tracking-tighter leading-none">{config.nombreComercial || config.code}</h2>
                   </div>
                 )}
                 <div className="h-10 w-px bg-white/10 hidden md:block"></div>
                 <p className="text-[9px] font-black uppercase tracking-widest text-white/40 max-w-[220px] leading-relaxed">
                    {config.footer_description || "Calidad y bienestar garantizado."}
                 </p>
              </div>

              {/* BOTÓN AYUDA GIGANTE */}
              <div className="flex-1 flex justify-center">
                 <a 
                    href={`https://wa.me/${(config.whatsappHelpNumber || config.whatsappNumbers || '51975615244').replace(/\D/g, '')}`} 
                    target="_blank" 
                    className="flex items-center gap-6 bg-white/5 border border-white/10 px-10 py-6 rounded-[2.5rem] hover:bg-brand-500 transition-all group shadow-2xl"
                 >
                    <div className="p-4 bg-brand-500/20 rounded-2xl group-hover:bg-white/20 transition-colors">
                       <MessageCircle className="w-8 h-8 text-white"/>
                    </div>
                    <div className="text-left">
                       <p className="text-[10px] font-black uppercase text-brand-400 group-hover:text-white/80 tracking-widest leading-none mb-1.5">Centro de Ayuda</p>
                       <p className="text-xl font-black uppercase tracking-tighter group-hover:text-white leading-none">Ayuda WhatsApp</p>
                    </div>
                 </a>
              </div>

              <div className="flex-1 flex flex-col items-center lg:items-end gap-6">
                 <div className="flex gap-4">
                    {config.facebook_url && <a href={config.facebook_url} target="_blank" className="p-4 bg-white/5 rounded-2xl hover:bg-blue-600 transition-all border border-white/5 shadow-lg"><Facebook className="w-5 h-5"/></a>}
                    {config.instagram_url && <a href={config.instagram_url} target="_blank" className="p-4 bg-white/5 rounded-2xl hover:bg-pink-600 transition-all border border-white/5 shadow-lg"><Instagram className="w-5 h-5"/></a>}
                 </div>
                 <p className="text-[8px] font-black uppercase tracking-widest opacity-30">Lemon BI Analytics &copy; 2025</p>
              </div>
           </div>
        </footer>
      )}

      {/* DRAWER CARRITO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md animate-in fade-in" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col p-8 animate-in slide-in-from-right duration-500">
              <div className="flex justify-between items-center mb-10">
                 <h2 className="text-3xl font-black uppercase tracking-tighter">Tu Bolsa</h2>
                 <button onClick={() => setIsCartOpen(false)} className="p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all text-slate-400"><X className="w-6 h-6"/></button>
              </div>

              {currentStep === 'cart' && (
                 <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                       {cart.length === 0 ? (
                          <div className="py-20 text-center flex flex-col items-center gap-6 opacity-20">
                             <ShoppingCart className="w-20 h-20"/>
                             <p className="font-black uppercase tracking-widest text-[10px]">No hay productos</p>
                          </div>
                       ) : cart.map(i => (
                          <div key={i.producto.id} className="flex gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                             <div className="w-14 h-14 bg-white rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-slate-100">
                                {i.producto.imagen ? <img src={`data:image/png;base64,${i.producto.imagen}`} className="w-full h-full object-contain mix-blend-multiply" /> : <Package className="w-6 h-6 text-slate-100"/>}
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase truncate tracking-tight">{i.producto.nombre}</p>
                                <p className="font-black text-xs text-brand-600">S/ {i.producto.precio.toFixed(2)}</p>
                             </div>
                             <div className="flex items-center gap-2">
                                <button onClick={() => updateCartQuantity(i.producto.id, -1)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Minus className="w-4 h-4"/></button>
                                <span className="text-xs font-black">{i.cantidad}</span>
                                <button onClick={() => updateCartQuantity(i.producto.id, 1)} className="p-2 text-slate-400 hover:text-brand-600 transition-colors"><Plus className="w-4 h-4"/></button>
                             </div>
                          </div>
                       ))}
                    </div>
                    <div className="pt-8 border-t border-slate-100 mt-4">
                       <div className="flex justify-between items-end mb-8">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Estimado</span>
                          <span className="text-4xl font-black tracking-tighter">S/ {cartTotal.toFixed(2)}</span>
                       </div>
                       <button onClick={() => setCurrentStep('details')} disabled={cart.length === 0} className="w-full py-7 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-widest hover:bg-brand-500 transition-all shadow-2xl disabled:opacity-20">Ir a Pagar</button>
                    </div>
                 </div>
              )}

              {currentStep === 'details' && (
                 <div className="space-y-6 animate-in slide-in-from-right">
                    <input type="text" placeholder="NOMBRE COMPLETO" className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl text-xs font-bold uppercase outline-none focus:ring-4 focus:ring-brand-500/10 transition-all" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                    <input type="tel" placeholder="TELÉFONO WHATSAPP" className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl text-xs font-bold uppercase outline-none focus:ring-4 focus:ring-brand-500/10 transition-all" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                    
                    <div className="flex gap-4">
                       <button onClick={() => setDeliveryType('recojo')} className={`flex-1 py-5 rounded-3xl text-[10px] font-black uppercase border-2 transition-all ${deliveryType === 'recojo' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'border-slate-100 text-slate-400'}`}>Recojo</button>
                       <button onClick={() => setDeliveryType('delivery')} className={`flex-1 py-5 rounded-3xl text-[10px] font-black uppercase border-2 transition-all ${deliveryType === 'delivery' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'border-slate-100 text-slate-400'}`}>Delivery</button>
                    </div>

                    {deliveryType === 'recojo' && (
                       <div className="space-y-4">
                          <p className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">Selecciona local de recojo</p>
                          {(config.sedes_recojo || []).map(sede => (
                             <button 
                                key={sede.id} 
                                onClick={() => setSelectedSede(sede)}
                                className={`w-full p-6 rounded-3xl text-left border-2 transition-all ${selectedSede?.id === sede.id ? 'bg-brand-50 border-brand-500' : 'bg-slate-50 border-slate-100'}`}
                             >
                                <p className="text-[10px] font-black uppercase text-brand-600 mb-1">{sede.nombre}</p>
                                <p className="text-xs font-bold text-slate-600">{sede.direccion}</p>
                                {selectedSede?.id === sede.id && sede.googleMapsUrl && (
                                   <a href={sede.googleMapsUrl} target="_blank" className="mt-3 flex items-center gap-2 text-[9px] font-black uppercase text-slate-400 hover:text-brand-500">
                                      <MapPin className="w-3 h-3"/> Abrir en Maps
                                   </a>
                                )}
                             </button>
                          ))}
                       </div>
                    )}

                    {deliveryType === 'delivery' && (
                       <textarea placeholder="DIRECCIÓN EXACTA..." className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl text-xs font-bold uppercase h-32 outline-none focus:ring-4 focus:ring-brand-500/10 transition-all" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                    )}
                    
                    <div className="flex gap-3 pt-6">
                       <button onClick={() => setCurrentStep('cart')} className="flex-1 py-5 bg-slate-100 rounded-2xl text-[10px] font-black uppercase text-slate-400">Atrás</button>
                       <button 
                          onClick={() => setCurrentStep('payment')} 
                          disabled={!clientData.nombre || !clientData.telefono || (deliveryType === 'recojo' && !selectedSede) || (deliveryType === 'delivery' && !clientData.direccion)} 
                          className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl disabled:opacity-20"
                       >
                          Continuar
                       </button>
                    </div>
                 </div>
              )}

              {currentStep === 'payment' && (
                 <div className="space-y-8 text-center animate-in slide-in-from-right">
                    <div className="flex gap-4 p-2 bg-slate-100 rounded-[2rem]">
                       <button onClick={() => setPaymentMethod('yape')} className={`flex-1 py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest transition-all ${paymentMethod === 'yape' ? 'bg-purple-600 text-white shadow-xl' : 'text-slate-400'}`}>Yape</button>
                       <button onClick={() => setPaymentMethod('plin')} className={`flex-1 py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest transition-all ${paymentMethod === 'plin' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400'}`}>Plin</button>
                    </div>
                    <div className="aspect-square bg-white rounded-[3rem] border border-slate-100 flex items-center justify-center p-12 shadow-inner group">
                       {paymentMethod === 'yape' ? (
                          config.yapeQR ? <img src={config.yapeQR} className="max-w-full h-auto rounded-3xl group-hover:scale-105 transition-transform" alt="QR Yape" /> : <QrCode className="w-16 h-16 opacity-10"/>
                       ) : (
                          config.plinQR ? <img src={config.plinQR} className="max-w-full h-auto rounded-3xl group-hover:scale-105 transition-transform" alt="QR Plin" /> : <QrCode className="w-16 h-16 opacity-10"/>
                       )}
                    </div>
                    <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 text-left">
                       <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Pagar a nombre de:</p>
                       <p className="text-sm font-black text-slate-900 uppercase leading-none">{paymentMethod === 'yape' ? (config.yapeName || 'Titular') : (config.plinName || 'Titular')}</p>
                       <p className="text-2xl font-black text-slate-900 mt-4 tracking-widest">{paymentMethod === 'yape' ? (config.yapeNumber || '--- --- ---') : (config.plinNumber || '--- --- ---')}</p>
                    </div>
                    <div className="flex gap-3 pt-6">
                       <button onClick={() => setCurrentStep('details')} className="flex-1 py-5 bg-slate-100 rounded-2xl text-[10px] font-black uppercase text-slate-400">Atrás</button>
                       <button onClick={() => setCurrentStep('voucher')} className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl">Subir Comprobante</button>
                    </div>
                 </div>
              )}

              {currentStep === 'voucher' && (
                 <div className="space-y-8 animate-in slide-in-from-right">
                    <div className="border-4 border-dashed rounded-[3.5rem] aspect-[3/4] flex flex-col items-center justify-center p-10 bg-slate-50 relative overflow-hidden group hover:border-brand-500 transition-all">
                       {voucherImage ? (
                          <img src={voucherImage} className="w-full h-full object-cover rounded-[2.5rem]" alt="Voucher" />
                       ) : (
                          <label className="cursor-pointer flex flex-col items-center">
                             <div className="p-6 bg-white rounded-3xl shadow-xl mb-6 text-slate-400 group-hover:text-brand-500 group-hover:scale-110 transition-all">
                                <Camera className="w-12 h-12"/>
                             </div>
                             <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 text-center">Toma foto del voucher de pago</span>
                             <input type="file" className="hidden" accept="image/*" onChange={handleVoucherUpload} />
                          </label>
                       )}
                    </div>
                    <button 
                       onClick={handleFinishOrder} 
                       disabled={!voucherImage || isOrderLoading} 
                       className="w-full py-8 bg-brand-500 text-white rounded-3xl font-black uppercase text-[11px] tracking-widest shadow-2xl flex items-center justify-center gap-4 transition-all hover:bg-brand-600 disabled:opacity-50"
                    >
                       {isOrderLoading ? <Loader2 className="animate-spin w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>} 
                       Confirmar Mi Compra
                    </button>
                 </div>
              )}

              {currentStep === 'success' && (
                 <div className="flex-1 flex flex-col items-center justify-center text-center space-y-10 animate-in zoom-in duration-1000">
                    <div className="w-32 h-32 bg-brand-500 text-white rounded-full flex items-center justify-center shadow-[0_30px_60px_-10px_rgba(132,204,22,0.6)] animate-bounce">
                       <CheckCircle2 className="w-16 h-16"/>
                    </div>
                    <div className="space-y-4">
                       <h3 className="text-4xl font-black uppercase tracking-tighter">¡PEDIDO RECIBIDO!</h3>
                       <p className="text-[11px] text-slate-500 uppercase font-bold tracking-widest max-w-[250px] mx-auto">Tu comprobante ha sido enviado. Atento a tu WhatsApp para coordinar la entrega.</p>
                    </div>
                    <button onClick={() => { setIsCartOpen(false); setCart([]); setCurrentStep('cart'); setVoucherImage(null); }} className="w-full py-6 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] shadow-xl hover:bg-brand-500 transition-all">Seguir Explorando</button>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default StoreView;
