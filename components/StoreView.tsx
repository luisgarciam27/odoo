
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingCart, Package, Search, X, ArrowLeft, ArrowRight,
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, Facebook, Instagram, CheckCircle2, 
  Loader2, Trash2, Smartphone, 
  Layers, Tag, SearchX, ChevronRight,
  Camera, Image as ImageIcon,
  QrCode, ChevronLeft,
  Citrus, ShieldCheck as Shield,
  ExternalLink, Sparkles, Globe, Copy, Check, Clock, ShieldCheck, Zap,
  BellRing, HeartHandshake, CreditCard
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
  const [copyStatus, setCopyStatus] = useState(false);
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin'>('yape');
  const [deliveryType, setDeliveryType] = useState<'recojo' | 'delivery'>('recojo');
  const [selectedSede, setSelectedSede] = useState<SedeStore | null>(null);
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '' });
  const [voucherImage, setVoucherImage] = useState<string | null>(null);
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [orderRef, setOrderRef] = useState('');

  const brandColor = config?.colorPrimario || '#84cc16'; 
  const secondaryColor = config?.colorSecundario || '#1e293b';
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const slideImages = useMemo(() => 
    (config.slide_images || []).filter(img => img && img.trim() !== ''), 
    [config.slide_images]
  );

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.producto.precio * item.cantidad, 0);
  }, [cart]);

  const totalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.cantidad, 0);
  }, [cart]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    (config.customCategories || []).forEach(c => cats.add(c));
    productos.forEach(p => {
       const cat = p.categoria || 'General';
       if (!(config.hiddenCategories || []).includes(cat)) {
          cats.add(cat);
       }
    });
    return ['Todas', ...Array.from(cats)].sort();
  }, [productos, config.hiddenCategories, config.customCategories]);

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

  const handleCopyNumber = (num: string) => {
    navigator.clipboard.writeText(num.replace(/\s/g, ''));
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
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
    const fields = ['display_name', 'list_price', 'categ_id', 'image_128', 'description_sale'];
    try {
      const extrasMap = await getProductExtras(config.code);
      const data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], fields, { limit: 1000, order: 'display_name asc' });
      
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
       const catName = p.categoria || 'General';
       const customCat = p.categoria_personalizada;
       const isCatHidden = hiddenCats.includes(catName);
       
       const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
       const matchesCategory = selectedCategory === 'Todas' || 
                               catName === selectedCategory || 
                               customCat === selectedCategory;

       return !isHidden && !isCatHidden && matchesSearch && matchesCategory;
    });
  }, [productos, searchTerm, selectedCategory, config]);

  const handleFinishOrder = async () => {
    if (isOrderLoading) return;
    setIsOrderLoading(true);
    setCurrentStep('processing');
    
    try {
      const waNumber = (config.whatsappNumbers || config.whatsappHelpNumber || '51975615244').replace(/\D/g, '');
      const ref = `WEB-${Date.now().toString().slice(-6)}`;
      setOrderRef(ref);
      
      const payload = {
        order_name: ref, 
        cliente_nombre: clientData.nombre, 
        monto: cartTotal, 
        voucher_url: voucherImage,
        empresa_code: config.code, 
        estado: 'pendiente',
        metadata: {
          telefono: clientData.telefono,
          entrega: deliveryType,
          sede: selectedSede?.nombre,
          direccion: clientData.direccion,
          metodo_pago: paymentMethod,
          carrito: cart.map(i => `${i.cantidad}x ${i.producto.nombre}`)
        }
      };

      // 1. Guardar en Supabase para registro permanente
      await supabase.from('pedidos_tienda').insert([payload]);

      // 2. Disparar Webhook a n8n para respuesta inmediata
      // URL de ejemplo, reemplázala con la de tu n8n
      const n8nWebhookUrl = 'https://n8n.tu-dominio.com/webhook/lemon-order-webhook';
      try {
        await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch(e) { console.error("Webhook n8n fallido, el trigger de Supabase servirá de respaldo."); }

      // 3. Odoo Silencioso
      try {
        const client = new OdooClient(session.url, session.db, session.useProxy);
        await client.createSaleOrder(
          session.uid, 
          session.apiKey, 
          { 
            name: clientData.nombre, 
            phone: clientData.telefono, 
            address: deliveryType === 'delivery' ? clientData.direccion : (selectedSede?.nombre || ''),
            paymentMethod
          },
          cart.map(i => ({ productId: i.producto.id, qty: i.cantidad, price: i.producto.precio })),
          session.companyId || 1
        );
      } catch (err) { console.warn("Fallo Odoo, el pedido se procesará via WhatsApp"); }

      // 4. WhatsApp Backup (User-initiated)
      let locationText = '';
      if (deliveryType === 'recojo' && selectedSede) {
          locationText = `\n📍 *Recojo:* ${selectedSede.nombre}`;
      } else if (deliveryType === 'delivery') {
          locationText = `\n🚚 *Delivery:* ${clientData.direccion}`;
      }

      const message = `*ORDEN WEB: ${ref}*\n👤 Cliente: ${clientData.nombre}\n💰 Total: S/ ${cartTotal.toFixed(2)}\n${locationText}\n\n_He adjuntado el comprobante de pago._`;
      
      // Solo abrimos WhatsApp si el navegador lo permite, pero la UI ya cambió a Éxito
      setTimeout(() => {
        window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank');
      }, 500);

      setCurrentStep('success');
    } catch (err: any) { 
      alert("Error al procesar pedido. Inténtelo nuevamente."); 
      setCurrentStep('voucher');
    } finally { 
      setIsOrderLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col relative overflow-x-hidden pb-24">
      
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-[60] bg-white border-b border-slate-100 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-6">
           <div className="flex items-center gap-4 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
              {onBack && <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-900"><ArrowLeft className="w-5 h-5"/></button>}
              {config.logoUrl ? <img src={config.logoUrl} className="h-10 object-contain" /> : <h1 className="font-black text-slate-900 uppercase text-lg">{config.nombreComercial || config.code}</h1>}
           </div>
           
           <div className="flex-1 max-w-xl hidden md:block">
              <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"/>
                 <input type="text" placeholder="¿Qué estás buscando hoy?" className="w-full pl-12 pr-6 py-3 bg-slate-50 border border-slate-100 rounded-full text-xs font-bold outline-none focus:ring-4 focus:ring-brand-500/5 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
           </div>

           <div className="flex items-center gap-3">
              <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-3 bg-slate-900 text-white rounded-2xl shadow-xl transform active:scale-95 transition-transform">
                 <ShoppingCart className="w-5 h-5" />
                 {totalItems > 0 && <span className="absolute -top-2 -right-2 bg-brand-500 text-white text-[10px] w-6 h-6 rounded-full flex items-center justify-center font-black border-2 border-white">{totalItems}</span>}
              </button>
           </div>
        </div>
      </header>

      <div className="h-[72px]"></div>

      {/* CARRUSEL VISUAL DE CATEGORÍAS */}
      {!loading && (
         <div className="bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-[72px] z-50 py-6">
            <div className="max-w-7xl mx-auto px-4 overflow-x-auto flex gap-6 no-scrollbar items-start">
               {availableCategories.map(cat => {
                  const meta = config.category_metadata?.[cat];
                  const isActive = selectedCategory === cat;
                  return (
                     <button key={cat} onClick={() => setSelectedCategory(cat)} className="flex flex-col items-center gap-3 shrink-0 group transition-all">
                        <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center overflow-hidden border-4 transition-all duration-300 ${isActive ? 'scale-110 shadow-xl border-brand-500' : 'scale-100 grayscale-[0.5] opacity-60 border-transparent'}`}>
                           {meta?.imageUrl ? (
                              <img src={meta.imageUrl} className="w-full h-full object-cover" />
                           ) : (
                              <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                                 <Citrus className="w-6 h-6 text-slate-300" />
                              </div>
                           )}
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-widest text-center max-w-[80px] leading-tight transition-colors ${isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}`}>
                           {cat}
                        </span>
                     </button>
                  );
               })}
            </div>
         </div>
      )}

      {/* PRODUCTOS */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-40">
             <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
             <p className="text-[10px] font-black uppercase tracking-widest">Cargando catálogo...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => setSelectedProduct(p)} className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-xl transition-all cursor-pointer">
                <div className="aspect-square bg-slate-50 rounded-[2rem] mb-4 flex items-center justify-center overflow-hidden relative">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain p-2 mix-blend-multiply" /> : <Package className="w-8 h-8 text-slate-200" />}
                </div>
                <h3 className="text-[11px] font-black text-slate-800 uppercase line-clamp-2 h-10 tracking-tight leading-tight mb-2">{p.nombre}</h3>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-sm font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                  <button onClick={(e) => addToCart(p, e)} className="p-3 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-brand-500 transition-all transform active:scale-90"><Plus className="w-4 h-4"/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* CARRITO FLOTANTE (BOTÓN) */}
      {!isCartOpen && totalItems > 0 && (
        <button 
          onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }}
          className="fixed bottom-8 right-8 z-[100] bg-slate-900 text-white p-6 rounded-full shadow-2xl animate-in slide-in-from-bottom-20 flex items-center gap-4 hover:scale-110 active:scale-95 transition-all group"
        >
          <div className="relative">
            <ShoppingCart className="w-8 h-8"/>
            <span className="absolute -top-3 -right-3 w-7 h-7 bg-brand-500 text-white font-black text-xs rounded-full border-4 border-slate-900 flex items-center justify-center group-hover:animate-bounce">
              {totalItems}
            </span>
          </div>
          <div className="hidden sm:block text-left pr-2">
            <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1 opacity-60">Pagar ahora</p>
            <p className="text-xl font-black leading-none">S/ {cartTotal.toFixed(2)}</p>
          </div>
        </button>
      )}

      {/* CHECKOUT DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => !isOrderLoading && setIsCartOpen(false)}></div>
           <div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col p-8 animate-in slide-in-from-right duration-500 overflow-y-auto">
              
              <div className="flex justify-between items-center mb-10">
                 <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">Checkout</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-2">Paso {currentStep === 'cart' ? '1' : currentStep === 'details' ? '2' : currentStep === 'payment' ? '3' : '4'} de 4</p>
                 </div>
                 {!isOrderLoading && <button onClick={() => setIsCartOpen(false)} className="p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 text-slate-400"><X className="w-6 h-6"/></button>}
              </div>

              {currentStep === 'cart' && (
                 <div className="flex-1 flex flex-col">
                    <div className="flex-1 space-y-4">
                       {cart.length === 0 ? (
                          <div className="py-20 text-center flex flex-col items-center gap-6 opacity-20"><ShoppingCart className="w-20 h-20"/><p className="font-black uppercase tracking-widest text-[10px]">Tu bolsa está vacía</p></div>
                       ) : cart.map(i => (
                          <div key={i.producto.id} className="flex gap-4 items-center bg-slate-50 p-4 rounded-3xl border border-slate-100 group">
                             <div className="w-16 h-16 bg-white rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border border-slate-100">
                                {i.producto.imagen ? <img src={`data:image/png;base64,${i.producto.imagen}`} className="w-full h-full object-contain mix-blend-multiply" /> : <Package className="w-6 h-6 text-slate-100"/>}
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase truncate tracking-tight mb-1">{i.producto.nombre}</p>
                                <p className="font-black text-sm text-brand-600">S/ {i.producto.precio.toFixed(2)}</p>
                             </div>
                             <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm">
                                <button onClick={() => updateCartQuantity(i.producto.id, -1)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><Minus className="w-4 h-4"/></button>
                                <span className="text-xs font-black w-4 text-center">{i.cantidad}</span>
                                <button onClick={() => updateCartQuantity(i.producto.id, 1)} className="p-1.5 text-slate-400 hover:text-brand-600 transition-colors"><Plus className="w-4 h-4"/></button>
                             </div>
                          </div>
                       ))}
                    </div>
                    <div className="pt-8 border-t border-slate-100 mt-8">
                       <div className="flex justify-between items-end mb-8">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Monto Total</span>
                          <span className="text-4xl font-black tracking-tighter">S/ {cartTotal.toFixed(2)}</span>
                       </div>
                       <button onClick={() => setCurrentStep('details')} disabled={cart.length === 0} className="w-full py-7 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase text-[11px] tracking-[0.2em] hover:bg-brand-500 transition-all shadow-2xl disabled:opacity-20 flex items-center justify-center gap-3">Siguiente <ArrowRight className="w-5 h-5"/></button>
                    </div>
                 </div>
              )}

              {currentStep === 'details' && (
                 <div className="space-y-6">
                    <div className="space-y-4">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Información del Cliente</label>
                       <input type="text" placeholder="NOMBRE COMPLETO" className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-xs font-bold uppercase outline-none focus:ring-4 focus:ring-brand-500/10 transition-all" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                       <input type="tel" placeholder="NÚMERO DE CELULAR" className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-xs font-bold outline-none focus:ring-4 focus:ring-brand-500/10 transition-all" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                    </div>
                    
                    <div className="space-y-4">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Método de Entrega</label>
                       <div className="flex gap-4">
                          <button onClick={() => setDeliveryType('recojo')} className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-[1.5rem] text-[10px] font-black uppercase border-2 transition-all ${deliveryType === 'recojo' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'border-slate-100 text-slate-400'}`}>
                             <MapPin className="w-5 h-5"/> Recojo
                          </button>
                          <button onClick={() => setDeliveryType('delivery')} className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-[1.5rem] text-[10px] font-black uppercase border-2 transition-all ${deliveryType === 'delivery' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'border-slate-100 text-slate-400'}`}>
                             <Truck className="w-5 h-5"/> Delivery
                          </button>
                       </div>
                    </div>

                    {deliveryType === 'recojo' ? (
                       <div className="space-y-4">
                          {(config.sedes_recojo || []).map(sede => (
                             <button key={sede.id} onClick={() => setSelectedSede(sede)} className={`w-full p-6 rounded-3xl text-left border-2 transition-all ${selectedSede?.id === sede.id ? 'bg-brand-50 border-brand-500 shadow-lg' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex items-center justify-between mb-1">
                                   <p className="text-[10px] font-black uppercase text-brand-600">{sede.nombre}</p>
                                   {selectedSede?.id === sede.id && <CheckCircle2 className="w-4 h-4 text-brand-500"/>}
                                </div>
                                <p className="text-xs font-bold text-slate-600">{sede.direccion}</p>
                             </button>
                          ))}
                       </div>
                    ) : (
                       <div className="space-y-4">
                          <textarea placeholder="DIRECCIÓN EXACTA Y REFERENCIA" className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-xs font-bold uppercase h-32 outline-none focus:ring-4 focus:ring-brand-500/10 transition-all" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                       </div>
                    )}
                    
                    <div className="flex gap-4 pt-10">
                       <button onClick={() => setCurrentStep('cart')} className="flex-1 py-6 bg-slate-100 rounded-[2rem] text-[10px] font-black uppercase text-slate-400">Atrás</button>
                       <button onClick={() => setCurrentStep('payment')} disabled={!clientData.nombre || !clientData.telefono || (deliveryType === 'recojo' && !selectedSede) || (deliveryType === 'delivery' && !clientData.direccion)} className="flex-[2] py-6 bg-slate-900 text-white rounded-[2rem] text-[10px] font-black uppercase shadow-xl disabled:opacity-20">Continuar</button>
                    </div>
                 </div>
              )}

              {currentStep === 'payment' && (
                 <div className="space-y-8 animate-in slide-in-from-right">
                    <div className="flex gap-4 p-2 bg-slate-100 rounded-[2rem]">
                       <button onClick={() => setPaymentMethod('yape')} className={`flex-1 py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest transition-all ${paymentMethod === 'yape' ? 'bg-purple-600 text-white shadow-xl' : 'text-slate-400'}`}>Yape</button>
                       <button onClick={() => setPaymentMethod('plin')} className={`flex-1 py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest transition-all ${paymentMethod === 'plin' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400'}`}>Plin</button>
                    </div>

                    <div className="bg-white rounded-[3rem] border border-slate-100 flex flex-col items-center justify-center p-10 shadow-inner">
                       <p className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest">Escanea el código QR</p>
                       <div className="w-64 h-64 bg-slate-50 rounded-[2rem] flex items-center justify-center overflow-hidden mb-6 relative group">
                          {paymentMethod === 'yape' ? (
                             config.yapeQR ? <img src={config.yapeQR} className="w-full h-full object-contain p-4" /> : <QrCode className="w-16 h-16 opacity-10"/>
                          ) : (
                             config.plinQR ? <img src={config.plinQR} className="w-full h-full object-contain p-4" /> : <QrCode className="w-16 h-16 opacity-10"/>
                          )}
                       </div>
                       
                       <div className="w-full space-y-4">
                          <div className="text-center">
                             <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Titular de cuenta</p>
                             <p className="text-sm font-black text-slate-900 uppercase leading-none">{paymentMethod === 'yape' ? (config.yapeName || 'Titular') : (config.plinName || 'Titular')}</p>
                          </div>
                          
                          <button 
                            onClick={() => handleCopyNumber(paymentMethod === 'yape' ? (config.yapeNumber || '') : (config.plinNumber || ''))}
                            className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between hover:bg-slate-100 transition-all group"
                          >
                             <div className="text-left">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Número de cuenta</p>
                                <p className="text-xl font-black text-slate-900 tracking-[0.2em]">{paymentMethod === 'yape' ? (config.yapeNumber || '---') : (config.plinNumber || '---')}</p>
                             </div>
                             <div className={`p-3 rounded-xl transition-all ${copyStatus ? 'bg-brand-500 text-white' : 'bg-white text-slate-400 group-hover:text-slate-900'}`}>
                                {copyStatus ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4"/>}
                             </div>
                          </button>
                       </div>
                    </div>

                    <div className="flex gap-4">
                       <button onClick={() => setCurrentStep('details')} className="flex-1 py-6 bg-slate-100 rounded-[2rem] text-[10px] font-black uppercase text-slate-400">Atrás</button>
                       <button onClick={() => setCurrentStep('voucher')} className="flex-[2] py-6 bg-slate-900 text-white rounded-[2rem] text-[10px] font-black uppercase shadow-xl">Siguiente Paso</button>
                    </div>
                 </div>
              )}

              {currentStep === 'voucher' && (
                 <div className="space-y-8 animate-in slide-in-from-right">
                    <div className="text-center space-y-2">
                       <h4 className="text-2xl font-black uppercase tracking-tighter">Sube tu Pago</h4>
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-relaxed max-w-[280px] mx-auto">Para validar tu orden, adjunta una captura de pantalla del voucher de transferencia.</p>
                    </div>

                    <div className="border-4 border-dashed border-slate-200 rounded-[3.5rem] aspect-[3/4] flex flex-col items-center justify-center p-10 bg-slate-50 relative overflow-hidden group hover:border-brand-500 transition-all cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                       {voucherImage ? (
                          <div className="relative w-full h-full">
                             <img src={voucherImage} className="w-full h-full object-cover rounded-[2.5rem]" />
                             <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                <span className="px-6 py-3 bg-white rounded-full font-black text-[10px] uppercase tracking-widest">Cambiar Imagen</span>
                             </div>
                          </div>
                       ) : (
                          <div className="flex flex-col items-center">
                             <div className="p-8 bg-white rounded-[2.5rem] shadow-xl mb-6 text-slate-300 group-hover:text-brand-500 group-hover:scale-110 transition-all">
                                <Camera className="w-16 h-16"/>
                             </div>
                             <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 text-center">Subir captura del voucher</span>
                          </div>
                       )}
                       <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleVoucherUpload} />
                    </div>

                    <button onClick={handleFinishOrder} disabled={!voucherImage || isOrderLoading} className="w-full py-8 bg-brand-500 text-white rounded-[2.5rem] font-black uppercase text-[11px] tracking-[0.3em] shadow-2xl flex items-center justify-center gap-4 transition-all hover:bg-brand-600 active:scale-95 disabled:opacity-50">
                       {isOrderLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <CheckCircle2 className="w-5 h-5"/>} Finalizar y Enviar
                    </button>
                 </div>
              )}

              {currentStep === 'processing' && (
                 <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in">
                    <div className="relative">
                       <div className="w-24 h-24 border-4 border-slate-100 rounded-full"></div>
                       <div className="w-24 h-24 border-4 border-brand-500 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                       <ShoppingCart className="w-10 h-10 text-slate-900 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"/>
                    </div>
                    <div className="space-y-3">
                       <h3 className="text-2xl font-black uppercase tracking-tighter">Procesando Orden</h3>
                       <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest max-w-[200px] mx-auto leading-relaxed">Estamos sincronizando tu pedido con nuestro sistema central...</p>
                    </div>
                 </div>
              )}

              {currentStep === 'success' && (
                 <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in duration-700 pb-10">
                    <div className="relative">
                      <div className="w-32 h-32 bg-brand-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-brand-500/50">
                        <HeartHandshake className="w-16 h-16"/>
                      </div>
                      <div className="absolute -top-4 -right-4 bg-white p-3 rounded-2xl shadow-xl animate-pulse">
                        <BellRing className="w-6 h-6 text-brand-500 fill-brand-500/10"/>
                      </div>
                    </div>

                    <div className="space-y-6">
                       <div className="space-y-1">
                          <h3 className="text-4xl font-black uppercase tracking-tighter leading-none">¡Recibido!</h3>
                          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Orden ID: {orderRef}</p>
                       </div>
                       
                       <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100 space-y-6">
                          <div className="space-y-4">
                             <div className="flex items-center gap-4 text-left">
                                <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm text-brand-500 shrink-0">
                                   <Clock className="w-5 h-5"/>
                                </div>
                                <div className="flex-1">
                                   <p className="text-[10px] font-black uppercase text-slate-900 tracking-tight">Validando Transferencia</p>
                                   <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                                      <div className="bg-brand-500 h-full animate-progress-fast"></div>
                                   </div>
                                </div>
                             </div>

                             <div className="flex items-center gap-4 text-left">
                                <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm text-blue-500 shrink-0">
                                   <MessageCircle className="w-5 h-5"/>
                                </div>
                                <div className="flex-1">
                                   <p className="text-[10px] font-black uppercase text-slate-900 tracking-tight">Bot de WhatsApp Activado</p>
                                   <p className="text-[9px] text-slate-500 font-bold uppercase leading-tight mt-1">Recibirás una notificación oficial en segundos.</p>
                                </div>
                             </div>
                          </div>
                       </div>

                       <div className="flex items-center justify-center gap-3 py-4 px-8 bg-brand-500/10 rounded-2xl border border-brand-500/20">
                          <ShieldCheck className="w-5 h-5 text-brand-600"/>
                          <span className="text-[9px] font-black uppercase tracking-widest text-brand-700">Garantía Lemon BI Analytics</span>
                       </div>
                    </div>

                    <button 
                      onClick={() => { setIsCartOpen(false); setCart([]); setCurrentStep('cart'); setVoucherImage(null); }} 
                      className="w-full py-8 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase text-[11px] tracking-[0.3em] shadow-2xl hover:bg-brand-500 transition-all active:scale-95 transform"
                    >
                      Volver a la Tienda
                    </button>
                 </div>
              )}
           </div>
        </div>
      )}

      {/* DETALLE PRODUCTO MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in" onClick={() => setSelectedProduct(null)}></div>
           <div className="relative bg-white w-full max-w-3xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in duration-300">
              <button onClick={() => setSelectedProduct(null)} className="absolute top-8 right-8 z-10 p-4 bg-slate-100/50 backdrop-blur-md text-slate-600 rounded-full hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                <X className="w-6 h-6"/>
              </button>
              <div className="w-full md:w-1/2 bg-slate-50 flex items-center justify-center p-12">
                 {selectedProduct.imagen ? <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-h-[400px] w-auto object-contain mix-blend-multiply drop-shadow-2xl" /> : <Package className="w-24 h-24 text-slate-200" />}
              </div>
              <div className="w-full md:w-1/2 p-12 flex flex-col justify-center">
                 <div className="mb-8">
                    <p className="text-[10px] font-black uppercase text-brand-600 tracking-[0.3em] mb-4">Detalles del Producto</p>
                    <h2 className="text-3xl font-black uppercase text-slate-900 tracking-tighter leading-tight mb-4">{selectedProduct.nombre}</h2>
                    <p className="text-4xl font-black text-slate-900 tracking-tighter">S/ {selectedProduct.precio.toFixed(2)}</p>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-3xl mb-10">
                    <p className="text-xs text-slate-600 uppercase font-bold leading-relaxed">{selectedProduct.descripcion_venta || "Este producto cuenta con los más altos estándares de calidad de LemonBI."}</p>
                 </div>
                 <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="w-full py-7 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] hover:bg-brand-500 transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-95">
                    <Plus className="w-5 h-5"/> Agregar a la bolsa
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default StoreView;
