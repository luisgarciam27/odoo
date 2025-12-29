
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingCart, Package, Search, X, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, Facebook, Instagram, Pill, Beaker, CheckCircle2, 
  Loader2, Sparkles, RefreshCw, Trash2, Smartphone, 
  Layers, Tag, SearchX, Briefcase, PawPrint, Footprints, ChevronRight,
  Upload, Camera, Image as ImageIcon,
  Building2, QrCode, AlertCircle, ShieldCheck, CreditCard, Clock, ChevronLeft,
  Citrus, Zap, ShieldCheck as Shield, HeartPulse, Filter, User
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

  // CATEGORÍAS DISPONIBLES (Incluye virtuales)
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
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col relative overflow-x-hidden">
      
      {/* HEADER DINÁMICO */}
      <header className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-500`}>
        <div className="bg-slate-900 text-white py-1.5 hidden md:block">
           <div className="max-w-7xl mx-auto flex justify-center items-center gap-6">
              {tickerMessages.map((msg, i) => (
                <div key={i} className={`flex items-center gap-2 transition-all duration-500 ${i === tickerIndex ? 'opacity-100' : 'opacity-0 absolute'}`}>
                   <span className="text-brand-400">{msg.icon}</span>
                   <span className="text-[10px] font-black uppercase tracking-[0.2em]">{msg.text}</span>
                </div>
              ))}
           </div>
        </div>

        <div className={`transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-xl shadow-xl py-3' : 'bg-white py-5 shadow-sm border-b border-slate-100'}`}>
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between gap-4 md:gap-10">
             <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
                {onBack && <button onClick={onBack} className="p-2.5 text-slate-400 hover:text-slate-900 transition-all"><ArrowLeft/></button>}
                {config.logoUrl ? (
                  <img src={config.logoUrl} className={`transition-all duration-300 object-contain ${scrolled ? 'h-7' : 'h-10'}`} alt="Logo" />
                ) : (
                  <h1 className="font-black text-slate-900 uppercase text-lg tracking-tighter">{config.nombreComercial || config.code}</h1>
                )}
             </div>
             
             <div className="flex-1 max-w-xl">
                <div className="relative">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"/>
                   <input type="text" placeholder="Busca productos..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none transition-all focus:bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
             </div>

             <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className={`relative p-3.5 bg-slate-900 text-white rounded-2xl shadow-2xl transition-all ${cartAnimate ? 'animate-bounce bg-brand-500' : ''}`}>
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && <span className="absolute -top-1.5 -right-1.5 bg-brand-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black border-2 border-white shadow-lg">{totalItems}</span>}
             </button>
          </div>
        </div>
      </header>

      <div className="h-[80px] md:h-[110px]"></div>

      {/* TABS DE CATEGORÍAS (CON FILTRO PARA PERROS, ETC) */}
      {!loading && (
         <div className="bg-white border-b border-slate-100 sticky top-[72px] md:top-[100px] z-50 py-4 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 md:px-8 overflow-x-auto flex gap-3 no-scrollbar scroll-smooth">
               {availableCategories.map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => { setSelectedCategory(cat); window.scrollTo({top: 350, behavior: 'smooth'}); }}
                    className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 ${selectedCategory === cat ? 'bg-slate-900 text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  >
                     {(cat.toLowerCase().includes('perro') || cat.toLowerCase().includes('mascota')) ? <PawPrint className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
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
            <div className="mb-10 animate-in slide-in-from-left duration-700">
               <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">{selectedCategory === 'Todas' ? 'Nuestros Productos' : selectedCategory}</h2>
               <div className="w-16 h-1.5 bg-brand-500 rounded-full mt-2"></div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-40 text-center opacity-30 flex flex-col items-center gap-4">
                   <SearchX className="w-20 h-20" />
                   <p className="font-black uppercase tracking-widest text-xs">No hay productos en esta sección</p>
                </div>
              ) : filteredProducts.map(p => (
                <div key={p.id} onClick={() => setSelectedProduct(p)} className="bg-white p-3 md:p-5 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-xl transition-all duration-500 cursor-pointer relative overflow-hidden">
                  <div className="aspect-square bg-slate-50 rounded-[2rem] mb-4 flex items-center justify-center overflow-hidden">
                    {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-700" alt={p.nombre} /> : <Package className="w-10 h-10 text-slate-200" />}
                  </div>
                  <div className="flex-1 flex flex-col">
                    <p className="text-[8px] font-black uppercase text-brand-600 tracking-widest truncate mb-1">{p.categoria_personalizada || p.categoria}</p>
                    <h3 className="text-[11px] font-black text-slate-800 uppercase line-clamp-2 h-10 tracking-tight leading-tight">{p.nombre}</h3>
                    <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-base font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                      <button onClick={(e) => addToCart(p, e)} className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-lg hover:bg-brand-500 transition-all">
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

      {/* FOOTER CON REDES RESTAURADO */}
      <footer className="text-white pt-24 pb-12 px-6 md:px-12 relative overflow-hidden" style={{ backgroundColor: secondaryColor }}>
         <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
               <div className="space-y-8">
                  {config.footerLogoUrl ? <img src={config.footerLogoUrl} className="h-12 object-contain" /> : <h2 className="text-2xl font-black uppercase tracking-tighter">{config.nombreComercial || config.code}</h2>}
                  <p className="text-slate-400 text-xs font-bold uppercase leading-relaxed">{config.footer_description || "Expertos dedicados a tu bienestar."}</p>
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
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-500">Soporte</h3>
                  <div className="flex items-center gap-4 cursor-pointer group">
                      <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-brand-500 transition-all"><MessageCircle className="w-6 h-6 text-white"/></div>
                      <div><p className="text-[9px] font-black uppercase text-slate-500">Consultas</p><p className="text-sm font-black tracking-widest">{config.whatsappHelpNumber || '--- --- ---'}</p></div>
                  </div>
               </div>
               <div className="space-y-8">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-500">Confianza</h3>
                  <div className="bg-white/5 p-8 rounded-[3rem] border border-white/5 space-y-5 text-center">
                     <div className="flex items-center gap-4"><ShieldCheck className="w-6 h-6 text-brand-500"/><span className="text-[10px] font-black uppercase">Pago Seguro</span></div>
                     <div className="flex items-center gap-4"><Clock className="w-6 h-6 text-brand-500"/><span className="text-[10px] font-black uppercase">Envío Veloz</span></div>
                  </div>
               </div>
            </div>
            <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 opacity-30 text-[10px] font-black uppercase tracking-widest">
               <p>Powered by Lemon BI & Gaor System</p>
               <p>&copy; 2025 Todos los derechos reservados.</p>
            </div>
         </div>
      </footer>

      {/* DRAWER CARRITO / PAGO ACTUALIZADO CON TITULAR */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative bg-white w-full max-w-lg h-full shadow-2xl flex flex-col p-8 overflow-y-auto animate-in slide-in-from-right duration-500">
              <div className="flex justify-between items-center mb-12">
                 <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">{currentStep === 'cart' ? 'Mi Carrito' : 'Checkout'}</h2>
                    <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mt-1">{totalItems} productos en lista</p>
                 </div>
                 <button onClick={() => setIsCartOpen(false)} className="p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all"><X className="w-6 h-6"/></button>
              </div>

              {currentStep === 'payment' && (
                 <div className="space-y-8 animate-in slide-in-from-bottom-6 text-center">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Total: S/ {cartTotal.toFixed(2)}</h2>
                    <div className="flex gap-4">
                       <button onClick={() => setPaymentMethod('yape')} className={`flex-1 py-5 rounded-2xl border-2 font-black uppercase text-[11px] transition-all ${paymentMethod === 'yape' ? 'border-purple-600 bg-purple-50 text-purple-600 shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Yape</button>
                       <button onClick={() => setPaymentMethod('plin')} className={`flex-1 py-5 rounded-2xl border-2 font-black uppercase text-[11px] transition-all ${paymentMethod === 'plin' ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Plin</button>
                    </div>
                    
                    <div className="aspect-square bg-slate-900 rounded-[3.5rem] flex items-center justify-center p-14 shadow-2xl relative overflow-hidden">
                       {paymentMethod === 'yape' ? (
                          config.yapeQR ? <img src={config.yapeQR} className="max-w-full max-h-full rounded-2xl" /> : <QrCode className="text-white w-24 h-24 opacity-20"/>
                       ) : (
                          config.plinQR ? <img src={config.plinQR} className="max-w-full max-h-full rounded-2xl" /> : <QrCode className="text-white w-24 h-24 opacity-20"/>
                       )}
                    </div>
                    
                    <div className="space-y-2">
                       <div className="flex items-center justify-center gap-2 text-brand-600">
                          <User className="w-4 h-4"/>
                          <p className="text-xs font-black uppercase tracking-widest">Titular de Cuenta:</p>
                       </div>
                       <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                          {paymentMethod === 'yape' ? (config.yapeName || 'TITULAR NO DEFINIDO') : (config.plinName || 'TITULAR NO DEFINIDO')}
                       </p>
                       <p className="text-3xl font-black text-slate-900 tracking-[0.2em] mt-4">
                          {paymentMethod === 'yape' ? (config.yapeNumber || '--- --- ---') : (config.plinNumber || '--- --- ---')}
                       </p>
                    </div>

                    <div className="flex gap-4 pt-8">
                       <button onClick={() => setCurrentStep('details')} className="flex-1 py-6 bg-slate-100 rounded-3xl font-black uppercase text-[10px]">Atrás</button>
                       <button onClick={() => setCurrentStep('voucher')} className="flex-[2.5] py-6 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:bg-brand-500">Ya pagué, subir voucher</button>
                    </div>
                 </div>
              )}

              {/* Otros pasos (cart, details, voucher, success) simplificados para brevedad pero mantienen coherencia */}
              {currentStep === 'cart' && (
                 <div className="space-y-4 flex-1 flex flex-col">
                    {cart.map(i => (
                       <div key={i.producto.id} className="flex gap-5 items-center bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                          <div className="w-16 h-16 bg-white rounded-2xl overflow-hidden flex items-center justify-center border border-slate-50 shrink-0">
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
                    <div className="pt-10 space-y-5 mt-auto">
                       <div className="flex justify-between items-center px-6">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Total Bruto</span>
                          <span className="text-4xl font-black text-slate-900 tracking-tighter">S/ {cartTotal.toFixed(2)}</span>
                       </div>
                       <button onClick={() => setCurrentStep('details')} className="w-full py-7 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] hover:bg-brand-500 transition-all shadow-2xl">Finalizar Pedido</button>
                    </div>
                 </div>
              )}

              {/* Steps Details / Voucher / Success mantenidos con mismo estilo */}
              {currentStep === 'details' && (
                 <div className="space-y-8 animate-in slide-in-from-bottom-6">
                    <div className="space-y-5">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Tu Nombre Completo</label>
                       <input type="text" placeholder="¿Cómo te llamas?" className="w-full p-6 bg-slate-50 rounded-[2rem] outline-none font-bold text-sm border-none shadow-inner" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mt-4">WhatsApp para entrega</label>
                       <input type="tel" placeholder="Número celular" className="w-full p-6 bg-slate-50 rounded-[2rem] outline-none font-bold text-sm border-none shadow-inner" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                    </div>
                    <div className="space-y-5">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">¿Cómo quieres recibirlo?</label>
                       <div className="grid grid-cols-2 gap-4">
                          <button onClick={() => setDeliveryType('recojo')} className={`py-6 rounded-[2rem] border-2 font-black uppercase text-[11px] transition-all ${deliveryType === 'recojo' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Recojo Sede</button>
                          <button onClick={() => setDeliveryType('delivery')} className={`py-6 rounded-[2rem] border-2 font-black uppercase text-[11px] transition-all ${deliveryType === 'delivery' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>A Domicilio</button>
                       </div>
                    </div>
                    {deliveryType === 'delivery' && (
                       <div className="space-y-5">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Dirección Detallada</label>
                          <textarea placeholder="Calle, número, urbanización..." className="w-full p-7 bg-slate-50 rounded-[2.5rem] outline-none font-bold h-40 shadow-inner text-sm border-none" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                       </div>
                    )}
                    <div className="flex gap-4 pt-10">
                       <button onClick={() => setCurrentStep('cart')} className="flex-1 py-6 bg-slate-100 rounded-3xl font-black uppercase text-[10px]">Atrás</button>
                       <button onClick={() => setCurrentStep('payment')} disabled={!clientData.nombre || !clientData.telefono} className="flex-[2.5] py-6 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest shadow-2xl">Confirmar Datos</button>
                    </div>
                 </div>
              )}

              {currentStep === 'voucher' && (
                 <div className="space-y-8 animate-in slide-in-from-bottom-6">
                    <h2 className="text-xl font-black uppercase text-center text-slate-900 tracking-widest">Sube tu captura de pantalla</h2>
                    <div className="border-4 border-dashed rounded-[3.5rem] aspect-[3/4] flex flex-col items-center justify-center p-6 bg-slate-50 relative overflow-hidden group hover:border-brand-500 transition-all shadow-inner">
                       {voucherImage ? (
                          <>
                             <img src={voucherImage} className="w-full h-full object-cover" alt="Voucher" />
                             <button onClick={() => setVoucherImage(null)} className="absolute top-8 right-8 bg-red-500 text-white p-5 rounded-3xl shadow-2xl"><Trash2 className="w-6 h-6"/></button>
                          </>
                       ) : (
                          <label className="cursor-pointer flex flex-col items-center text-slate-300 group-hover:text-brand-500 transition-colors">
                             <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mb-6">
                                <Camera className="w-10 h-10 animate-pulse"/>
                             </div>
                             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-center">Tocar para subir foto</p>
                             <input type="file" className="hidden" accept="image/*" onChange={handleVoucherUpload} />
                          </label>
                       )}
                    </div>
                    <div className="flex gap-4">
                       <button onClick={() => setCurrentStep('payment')} className="flex-1 py-7 bg-slate-100 rounded-[2.5rem] font-black uppercase text-[10px]">Atrás</button>
                       <button onClick={handleFinishOrder} disabled={!voucherImage || isOrderLoading} className="flex-[2.5] py-7 bg-brand-500 text-white rounded-[2.5rem] font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3">
                          {isOrderLoading ? <Loader2 className="animate-spin w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>} FINALIZAR PEDIDO
                       </button>
                    </div>
                 </div>
              )}

              {currentStep === 'success' && (
                 <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 p-8 animate-in zoom-in duration-500">
                    <div className="w-40 h-40 bg-brand-500 text-white rounded-full flex items-center justify-center shadow-2xl">
                       <CheckCircle2 className="w-20 h-20"/>
                    </div>
                    <div className="space-y-6">
                       <h3 className="text-5xl font-black uppercase tracking-tighter text-slate-900">¡Pedido Enviado!</h3>
                       <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed max-w-xs mx-auto">Revisa tu WhatsApp. Un asesor confirmará tu pedido en breves minutos.</p>
                    </div>
                    <button onClick={() => { setIsCartOpen(false); setCart([]); setCurrentStep('cart'); setVoucherImage(null); }} className="w-full py-7 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-xs shadow-2xl">Seguir Explorando</button>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default StoreView;
