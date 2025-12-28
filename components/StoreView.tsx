
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, Image as ImageIcon, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, ShieldCheck, 
  Star, Facebook, Instagram, Pill, Beaker, ClipboardCheck, AlertCircle,
  Stethoscope, Footprints, PawPrint, Calendar, Wallet, CheckCircle2, Camera, ChevronRight,
  Loader2, BadgeCheck, Send, UserCheck, Sparkles, Zap, Award, HeartHandshake, ShieldAlert,
  RefreshCw, Trash2, CreditCard, Building2, Smartphone, CheckCircle
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'tech' | 'usage'>('info');
  const [activeSlide, setActiveSlide] = useState(0);
  
  // Estados de Pago/Envío
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'efectivo'>('yape');
  const [deliveryType, setDeliveryType] = useState<'recojo' | 'delivery'>('recojo');
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '', sede: '' });

  const colorP = config?.colorPrimario || '#84cc16'; 
  const colorA = config?.colorAcento || '#0ea5e9';
  const bizType = config?.businessType || 'pharmacy';

  const slides = [
    {
      title: "Salud y Confianza Certificada",
      desc: "Productos validados para tu bienestar total. Calidad garantizada.",
      icon: ShieldCheck,
      bg: `linear-gradient(135deg, ${colorP} 0%, ${colorP}dd 100%)`,
      badge: "Garantía Premium"
    },
    {
      title: "Delivery Express Seguro",
      desc: "Llevamos tus productos en tiempo récord a tu puerta.",
      icon: Truck,
      bg: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
      badge: "Envío Hoy"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide(s => (s + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    setFetchError(null);
    const client = new OdooClient(session.url, session.db, true);
    const context = { allowed_company_ids: [session.companyId], company_id: session.companyId };

    try {
      const extras = await getProductExtras(config.code);
      const domain: any[] = [['sale_ok', '=', true], ['company_id', '=', session.companyId]];
      const data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, ['display_name', 'list_price', 'categ_id', 'image_128', 'description_sale', 'qty_available'], { limit: 500, context });

      const mapped = data.map((p: any) => {
        const extra = extras[p.id];
        return {
          id: Number(p.id),
          nombre: p.display_name,
          precio: p.list_price || 0,
          categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
          stock: p.qty_available || 0,
          imagen: p.image_128,
          descripcion_venta: extra?.descripcion_lemon || p.description_sale || '',
          uso_sugerido: extra?.instrucciones_lemon || '',
          laboratorio: 'Genérico',
          registro_sanitario: 'Validado'
        };
      });
      setProductos(mapped);
    } catch (e: any) {
      setFetchError(e.message || "Error al conectar con Odoo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [session, config.code]);

  const filteredProducts = useMemo(() => {
    const hidden = config.hiddenProducts || [];
    return productos.filter(p => {
      if (hidden.includes(p.id)) return false;
      if (searchTerm && !p.nombre.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [productos, searchTerm, config.hiddenProducts]);

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

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(i => i.producto.id === id ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i));
  };

  const removeFromCart = (id: number) => setCart(prev => prev.filter(i => i.producto.id !== id));

  const cartTotal = cart.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);

  const handleFinalOrder = async () => {
    if (clientData.nombre.length < 3 || clientData.telefono.length < 9) {
      alert("Por favor completa tus datos de contacto.");
      setCurrentStep('details');
      return;
    }

    const client = new OdooClient(session.url, session.db, true);
    setCurrentStep('processing');
    try {
      let partnerId: number;
      const partners = await client.searchRead(session.uid, session.apiKey, 'res.partner', [['phone', '=', clientData.telefono]], ['id'], { limit: 1 });
      if (partners.length > 0) partnerId = partners[0].id;
      else partnerId = await client.create(session.uid, session.apiKey, 'res.partner', { name: clientData.nombre.toUpperCase(), phone: clientData.telefono, company_id: session.companyId });

      const orderLines = cart.map(item => [0, 0, { product_id: item.producto.id, product_uom_qty: item.cantidad, price_unit: item.producto.precio, name: item.producto.nombre }]);
      const note = `[TIENDA LEMON] PAGO: ${paymentMethod.toUpperCase()} | ENTREGA: ${deliveryType.toUpperCase()} | ${deliveryType === 'recojo' ? 'SEDE: '+clientData.sede : 'DIR: '+clientData.direccion}`;
      
      const newOrderId = await client.create(session.uid, session.apiKey, 'sale.order', { partner_id: partnerId, company_id: session.companyId, order_line: orderLines, note: note });
      const orderInfo = await client.searchRead(session.uid, session.apiKey, 'sale.order', [['id', '=', newOrderId]], ['name']);
      
      setLastOrderId(orderInfo[0]?.name || `#${newOrderId}`);
      setCurrentStep('success');
      
      const itemsText = cart.map(item => `• ${item.cantidad}x ${item.producto.nombre}`).join('%0A');
      const message = `*NUEVA ORDEN: ${orderInfo[0]?.name || newOrderId}*%0A%0A*Cliente:* ${clientData.nombre}%0A*Total:* S/ ${cartTotal.toFixed(2)}%0A*Pago:* ${paymentMethod.toUpperCase()}%0A%0A*Productos:*%0A${itemsText}`;
      
      // WhatsApp Redirection
      setTimeout(() => {
        window.open(`https://wa.me/${config.whatsappNumbers?.split(',')[0]}?text=${message}`);
        setCart([]);
      }, 2000);

    } catch (e: any) {
      alert("Error al procesar: " + e.message);
      setCurrentStep('payment');
    }
  };

  const bizMeta = {
    pharmacy: { icon: Pill, label: 'Farmacia Autorizada' },
    veterinary: { icon: PawPrint, label: 'Clínica Veterinaria' },
    podiatry: { icon: Footprints, label: 'Centro de Podología' }
  }[bizType] || { icon: Package, label: 'Tienda Online' };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col overflow-x-hidden">
      
      {/* HEADER COMPACTO */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {onBack && <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-900 transition-all"><ArrowLeft className="w-5 h-5"/></button>}
            <div className="flex items-center gap-3">
               {config.logoUrl ? <img src={config.logoUrl} className="h-8 md:h-10 object-contain" /> : <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{backgroundColor: colorP}}><bizMeta.icon className="w-5 h-5" /></div>}
               <div className="hidden sm:block">
                 <h1 className="font-black text-slate-900 uppercase text-[10px] tracking-tighter leading-none">{config.nombreComercial || config.code}</h1>
                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><ShieldCheck className="w-2.5 h-2.5 text-emerald-500" /> {bizMeta.label}</p>
               </div>
            </div>
          </div>
          <div className="flex-1 max-w-xl">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 group-focus-within:text-brand-500" />
              <input type="text" placeholder={`Buscar productos...`} className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-2xl outline-none font-medium text-xs focus:bg-white transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-3 bg-slate-900 text-white rounded-2xl shadow-lg hover:scale-105 transition-all">
            <ShoppingCart className="w-4 h-4" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 text-white text-[8px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md" style={{backgroundColor: colorA}}>{cart.length}</span>}
          </button>
        </div>
      </header>

      {/* HERO SLIDER */}
      <div className="px-4 md:px-6 pt-4">
        <div className="max-w-7xl mx-auto overflow-hidden rounded-[2.5rem] shadow-xl relative h-[180px] md:h-[300px]">
          {slides.map((slide, idx) => (
            <div 
              key={idx} 
              className={`absolute inset-0 p-8 md:p-12 flex items-center transition-all duration-700 ${activeSlide === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              style={{ background: slide.bg }}
            >
              <div className="max-w-md text-white space-y-3">
                <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] bg-white/20 px-4 py-1.5 rounded-full">{slide.badge}</span>
                <h2 className="text-2xl md:text-5xl font-black uppercase tracking-tighter leading-none">{slide.title}</h2>
                <p className="text-white/80 text-xs md:text-lg font-medium opacity-90">{slide.desc}</p>
              </div>
            </div>
          ))}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
             {slides.map((_, i) => <button key={i} onClick={() => setActiveSlide(i)} className={`h-1 rounded-full transition-all ${activeSlide === i ? 'w-8 bg-white' : 'w-2 bg-white/30'}`}></button>)}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
           <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900">Nuestros Productos</h2>
           <div className="hidden sm:flex items-center gap-3 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-100">
              <BadgeCheck className="w-4 h-4"/>
              <span className="text-[9px] font-black uppercase tracking-widest">Calidad Farmacéutica</span>
           </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8">
            {[1,2,3,4,5].map(i => <div key={i} className="bg-white rounded-[2rem] aspect-[3/4] animate-pulse border border-slate-100"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => { setSelectedProduct(p); setActiveTab('info'); }} className="group bg-white rounded-[2.5rem] p-4 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col">
                <div className="aspect-square bg-slate-50 rounded-[2rem] mb-4 overflow-hidden flex items-center justify-center">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <Package className="w-10 h-10 text-slate-200"/>}
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest mb-1.5 block px-3 py-1 bg-slate-100 rounded-full w-fit text-slate-500">{p.categoria}</span>
                  <h3 className="text-[10px] md:text-xs font-bold text-slate-800 line-clamp-2 uppercase h-8 mb-4 leading-tight">{p.nombre}</h3>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-auto">
                    <span className="text-sm font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    <button onClick={(e) => addToCart(p, e)} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-brand-500 transition-all shadow-sm active:scale-90"><Plus className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* CARRITO / CHECKOUT LATERAL */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 text-white rounded-xl"><ShoppingCart className="w-5 h-5"/></div>
                <h3 className="font-black uppercase tracking-tighter text-lg">Mi Pedido</h3>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all"><X className="w-5 h-5"/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {currentStep === 'cart' && (
                <div className="space-y-4">
                  {cart.length === 0 ? (
                    <div className="text-center py-20 space-y-4">
                       <Package className="w-16 h-16 text-slate-200 mx-auto" />
                       <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">El carrito está vacío</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.producto.id} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group animate-in slide-in-from-right-4">
                        <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shrink-0 border border-slate-100">
                           {item.producto.imagen ? <img src={`data:image/png;base64,${item.producto.imagen}`} className="max-h-full max-w-full object-contain" /> : <Package className="w-6 h-6 text-slate-100"/>}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-[10px] font-black uppercase leading-tight line-clamp-2 mb-2">{item.producto.nombre}</h4>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black">S/ {item.producto.precio.toFixed(2)}</span>
                            <div className="flex items-center gap-3">
                               <button onClick={() => updateQuantity(item.producto.id, -1)} className="p-1 bg-white rounded-md border border-slate-200"><Minus className="w-3 h-3"/></button>
                               <span className="text-xs font-bold">{item.cantidad}</span>
                               <button onClick={() => updateQuantity(item.producto.id, 1)} className="p-1 bg-white rounded-md border border-slate-200"><Plus className="w-3 h-3"/></button>
                            </div>
                          </div>
                        </div>
                        <button onClick={() => removeFromCart(item.producto.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {currentStep === 'details' && (
                <div className="space-y-6 animate-in fade-in">
                   <h4 className="text-[10px] font-black uppercase text-brand-600 tracking-widest flex items-center gap-2"><UserCheck className="w-4 h-4"/> Información de Contacto</h4>
                   <div className="space-y-4">
                      <input type="text" placeholder="NOMBRE COMPLETO" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold text-xs uppercase" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                      <input type="tel" placeholder="CELULAR (WHATSAPP)" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold text-xs" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                   </div>
                   
                   <h4 className="text-[10px] font-black uppercase text-brand-600 tracking-widest flex items-center gap-2"><Truck className="w-4 h-4"/> Método de Entrega</h4>
                   <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setDeliveryType('recojo')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${deliveryType === 'recojo' ? 'border-brand-500 bg-brand-50' : 'border-slate-100 bg-white'}`}>
                        <Building2 className="w-5 h-5"/>
                        <span className="text-[8px] font-black uppercase">Recojo Sede</span>
                      </button>
                      <button onClick={() => setDeliveryType('delivery')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${deliveryType === 'delivery' ? 'border-brand-500 bg-brand-50' : 'border-slate-100 bg-white'}`}>
                        <Truck className="w-5 h-5"/>
                        <span className="text-[8px] font-black uppercase">Envío hoy</span>
                      </button>
                   </div>

                   {deliveryType === 'recojo' ? (
                     <select className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[10px] uppercase" value={clientData.sede} onChange={e => setClientData({...clientData, sede: e.target.value})}>
                        <option value="">SELECCIONAR SEDE...</option>
                        {config.sedes_recojo?.map(s => <option key={s.id} value={s.nombre}>{s.nombre} - {s.direccion}</option>)}
                     </select>
                   ) : (
                     <textarea placeholder="DIRECCIÓN COMPLETA DE ENVÍO Y REFERENCIAS..." className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[10px] h-24 uppercase" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                   )}
                </div>
              )}

              {currentStep === 'payment' && (
                <div className="space-y-6 animate-in fade-in">
                   <h4 className="text-[10px] font-black uppercase text-brand-600 tracking-widest flex items-center gap-2"><CreditCard className="w-4 h-4"/> Método de Pago</h4>
                   <div className="space-y-4">
                      <button onClick={() => setPaymentMethod('yape')} className={`w-full p-5 rounded-3xl border-2 flex items-center gap-4 transition-all ${paymentMethod === 'yape' ? 'border-[#742284] bg-[#742284]/5' : 'border-slate-100 bg-white'}`}>
                        <div className="w-10 h-10 bg-[#742284] rounded-xl flex items-center justify-center text-white font-black text-sm">Y</div>
                        <div className="text-left"><p className="text-[10px] font-black uppercase text-[#742284]">Pagar con Yape</p><p className="text-[8px] font-bold text-slate-400">Rápido y Seguro</p></div>
                      </button>
                      <button onClick={() => setPaymentMethod('plin')} className={`w-full p-5 rounded-3xl border-2 flex items-center gap-4 transition-all ${paymentMethod === 'plin' ? 'border-[#00A9E0] bg-[#00A9E0]/5' : 'border-slate-100 bg-white'}`}>
                        <div className="w-10 h-10 bg-[#00A9E0] rounded-xl flex items-center justify-center text-white font-black text-sm">P</div>
                        <div className="text-left"><p className="text-[10px] font-black uppercase text-[#00A9E0]">Pagar con Plin</p><p className="text-[8px] font-bold text-slate-400">Transferencia Instantánea</p></div>
                      </button>
                      <button onClick={() => setPaymentMethod('efectivo')} className={`w-full p-5 rounded-3xl border-2 flex items-center gap-4 transition-all ${paymentMethod === 'efectivo' ? 'border-slate-900 bg-slate-50' : 'border-slate-100 bg-white'}`}>
                        <Wallet className="w-10 h-10 text-slate-400 p-2"/>
                        <div className="text-left"><p className="text-[10px] font-black uppercase">Efectivo / POS</p><p className="text-[8px] font-bold text-slate-400">Pagar al recibir</p></div>
                      </button>
                   </div>

                   {(paymentMethod === 'yape' || paymentMethod === 'plin') && (
                     <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col items-center text-center space-y-3">
                        <Smartphone className="w-8 h-8 text-brand-500" />
                        <p className="text-[10px] font-black uppercase tracking-widest">{paymentMethod === 'yape' ? config.yapeName : config.plinName}</p>
                        <p className="text-xl font-black text-slate-900">{paymentMethod === 'yape' ? config.yapeNumber : config.plinNumber}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Adjunta tu captura al WhatsApp final</p>
                     </div>
                   )}
                </div>
              )}

              {currentStep === 'processing' && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                   <div className="relative">
                      <div className="w-20 h-20 border-4 border-slate-100 border-t-brand-500 rounded-full animate-spin"></div>
                      <ShieldCheck className="w-8 h-8 text-brand-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                   </div>
                   <h3 className="text-lg font-black uppercase tracking-tighter">Procesando Pedido...</h3>
                   <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Sincronizando con el ERP Odoo</p>
                </div>
              )}

              {currentStep === 'success' && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in">
                   <div className="w-24 h-24 bg-brand-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-brand-500/30">
                      <CheckCircle className="w-12 h-12" />
                   </div>
                   <div className="space-y-2">
                      <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900">¡Pedido Recibido!</h3>
                      <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.3em]">ORDEN: {lastOrderId}</p>
                   </div>
                   <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-[250px]">Redirigiendo a WhatsApp para confirmar los detalles finales y envío de voucher...</p>
                   <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                </div>
              )}
            </div>

            {/* BOTÓN DE ACCIÓN FOOTER CARRITO */}
            {currentStep !== 'processing' && currentStep !== 'success' && cart.length > 0 && (
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 space-y-6">
                <div className="flex items-center justify-between">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total a Pagar</span>
                   <span className="text-2xl font-black text-slate-900">S/ {cartTotal.toFixed(2)}</span>
                </div>
                
                {currentStep === 'cart' && (
                   <button onClick={() => setCurrentStep('details')} className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl flex items-center justify-center gap-3">
                     Continuar con mis datos <ChevronRight className="w-4 h-4"/>
                   </button>
                )}
                
                {currentStep === 'details' && (
                   <div className="flex gap-4">
                      <button onClick={() => setCurrentStep('cart')} className="p-5 bg-white border border-slate-200 rounded-[1.5rem] text-slate-400"><ArrowLeft className="w-5 h-5"/></button>
                      <button onClick={() => setCurrentStep('payment')} className="flex-1 py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl">
                        Elegir método de pago
                      </button>
                   </div>
                )}

                {currentStep === 'payment' && (
                   <div className="flex gap-4">
                      <button onClick={() => setCurrentStep('details')} className="p-5 bg-white border border-slate-200 rounded-[1.5rem] text-slate-400"><ArrowLeft className="w-5 h-5"/></button>
                      <button onClick={handleFinalOrder} className="flex-1 py-5 bg-brand-500 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-brand-500/20">
                        Finalizar mi Pedido
                      </button>
                   </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DETALLE PRODUCTO */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative bg-white w-full max-w-4xl rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] md:max-h-[85vh] animate-in slide-in-from-bottom-10 md:zoom-in-95">
             <button onClick={() => setSelectedProduct(null)} className="absolute top-6 right-6 p-2.5 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-full z-20 transition-all"><X className="w-4 h-4"/></button>
             
             <div className="md:w-[40%] bg-slate-50 flex items-center justify-center p-8 shrink-0">
               <div className="w-full aspect-square bg-white rounded-[2rem] shadow-sm p-8 flex items-center justify-center border border-slate-100 relative">
                 {selectedProduct.imagen ? <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-h-full max-w-full object-contain" /> : <ImageIcon className="w-20 h-20 text-slate-100"/>}
                 <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 flex items-center gap-2">
                    <Award className="w-3 h-3 text-emerald-600"/>
                    <span className="text-[8px] font-black uppercase text-emerald-700 tracking-widest">Certificado</span>
                 </div>
               </div>
             </div>

             <div className="md:w-[60%] p-8 md:p-12 flex flex-col min-h-0 bg-white">
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-lg bg-brand-50 text-brand-600 border border-brand-100">{selectedProduct.categoria}</span>
                    <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg"><Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400"/><span className="text-[8px] font-black text-white uppercase tracking-widest">Premium Choice</span></div>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight tracking-tighter uppercase mb-3">{selectedProduct.nombre}</h2>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-50 rounded-lg"><UserCheck className="w-3.5 h-3.5 text-emerald-600"/></div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Farmacia Autorizada Lemon BI Analytics</p>
                  </div>
                </div>

                <div className="flex border-b border-slate-100 mb-6 gap-6">
                  {['info', 'tech', 'usage'].map(id => (
                    <button key={id} onClick={() => setActiveTab(id as any)} className={`pb-3 text-[9px] font-black uppercase tracking-widest transition-all relative ${activeTab === id ? 'text-slate-900' : 'text-slate-300'}`}>
                      {id === 'info' ? 'Resumen' : id === 'tech' ? 'Ficha' : 'Uso'}
                      {activeTab === id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-500 rounded-full"></div>}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar text-slate-600">
                   {activeTab === 'info' && (
                     <div className="animate-in fade-in duration-300">
                       <p className="text-xs leading-relaxed font-medium italic border-l-4 border-brand-500 pl-4 bg-brand-50/20 py-4 rounded-r-2xl mb-6">"{selectedProduct.descripcion_venta || 'Información validada por el departamento farmacéutico.'}"</p>
                       <div className="p-6 bg-slate-900 text-white rounded-[2rem] flex items-center justify-between shadow-xl">
                         <div>
                           <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Precio Online</p>
                           <p className="text-3xl font-black tracking-tighter">S/ {selectedProduct.precio.toFixed(2)}</p>
                         </div>
                       </div>
                     </div>
                   )}
                   {/* ... otros tabs omitidos para brevedad ... */}
                </div>

                <div className="pt-8 mt-6 border-t border-slate-50">
                   <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-xl flex items-center justify-center gap-4 hover:bg-brand-600 transition-all">
                     <ShoppingCart className="w-5 h-5" /> Añadir al Pedido
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-20 py-16 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-12">
           <div className="space-y-4 max-w-sm">
              <div className="flex items-center gap-3 justify-center md:justify-start">
                 <div className="p-3 rounded-xl bg-brand-500 shadow-xl shadow-brand-500/20"><bizMeta.icon className="w-6 h-6 text-white" /></div>
                 <span className="font-black text-xl tracking-tighter uppercase">{config.nombreComercial || config.code}</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic opacity-80">"{config.footer_description || 'Compromiso con la excelencia farmacéutica.'}"</p>
           </div>
           <div className="flex gap-4">
               <button className="p-3 bg-white/5 rounded-xl hover:bg-brand-500 transition-all"><Facebook className="w-5 h-5"/></button>
               <button className="p-3 bg-white/5 rounded-xl hover:bg-brand-500 transition-all"><Instagram className="w-5 h-5"/></button>
               <button className="p-3 bg-white/5 rounded-xl hover:bg-brand-500 transition-all"><MessageCircle className="w-5 h-5"/></button>
           </div>
        </div>
        <div className="mt-12 pt-8 border-t border-white/5 text-center">
           <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em]">© 2025 LEMON BI ANALYTICS • POWERED BY GAORSYSTEM</p>
        </div>
      </footer>
    </div>
  );
};

export default StoreView;
