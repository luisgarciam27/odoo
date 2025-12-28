
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, Image as ImageIcon, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, ShieldCheck, 
  Star, Facebook, Instagram, Pill, Beaker, ClipboardCheck, AlertCircle,
  Stethoscope, Footprints, PawPrint, Calendar, Wallet, CheckCircle2, Camera, ChevronRight,
  Loader2, BadgeCheck, Send, UserCheck, Sparkles, Zap, Award, HeartHandshake, ShieldAlert,
  RefreshCw, Trash2, CreditCard, Building2, Smartphone, CheckCircle, QrCode
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
      desc: "Productos validados para tu bienestar total.",
      icon: ShieldCheck,
      bg: `linear-gradient(135deg, ${colorP} 0%, ${colorP}dd 100%)`,
      badge: "Garantía Premium"
    },
    {
      title: "Delivery Express Seguro",
      desc: "Llevamos tus productos en tiempo récord.",
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
      
      {/* HEADER COMPACTO Y RESPONSIVO */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 md:py-3 flex items-center justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {onBack && <button onClick={onBack} className="p-1.5 md:p-2 text-slate-400 hover:text-slate-900 transition-all"><ArrowLeft className="w-4 h-4 md:w-5 md:h-5"/></button>}
            <div className="flex items-center gap-2 md:gap-3">
               {config.logoUrl ? <img src={config.logoUrl} className="h-6 md:h-8 object-contain" /> : <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-white" style={{backgroundColor: colorP}}><bizMeta.icon className="w-4 h-4 md:w-5 md:h-5" /></div>}
               <div className="hidden sm:block">
                 <h1 className="font-black text-slate-900 uppercase text-[9px] md:text-[10px] tracking-tighter leading-none">{config.nombreComercial || config.code}</h1>
                 <p className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><ShieldCheck className="w-2 md:w-2.5 h-2 md:h-2.5 text-emerald-500" /> {bizMeta.label}</p>
               </div>
            </div>
          </div>
          <div className="flex-1 max-w-md mx-2">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-300 group-focus-within:text-brand-500" />
              <input type="text" placeholder={`Buscar...`} className="w-full pl-8 pr-3 py-1.5 md:py-2 bg-slate-100 border-none rounded-xl outline-none font-medium text-[10px] md:text-xs focus:bg-white transition-all shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-2 md:p-2.5 bg-slate-900 text-white rounded-xl shadow-md hover:scale-105 transition-all shrink-0">
            <ShoppingCart className="w-3.5 h-3.5 md:w-4 md:h-4" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 text-white text-[7px] md:text-[8px] font-black w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center shadow-md animate-bounce" style={{backgroundColor: colorA}}>{cart.length}</span>}
          </button>
        </div>
      </header>

      {/* HERO SLIDER REDEFINIDO */}
      <div className="px-4 md:px-6 pt-3 md:pt-4">
        <div className="max-w-7xl mx-auto overflow-hidden rounded-[1.5rem] md:rounded-[2rem] shadow-lg relative h-[140px] md:h-[240px]">
          {slides.map((slide, idx) => (
            <div 
              key={idx} 
              className={`absolute inset-0 p-6 md:p-10 flex items-center transition-all duration-700 ${activeSlide === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              style={{ background: slide.bg }}
            >
              <div className="max-w-sm text-white space-y-2 md:space-y-3">
                <span className="text-[7px] md:text-[9px] font-black uppercase tracking-[0.2em] bg-white/20 px-3 py-1 rounded-full">{slide.badge}</span>
                <h2 className="text-xl md:text-4xl font-black uppercase tracking-tighter leading-none">{slide.title}</h2>
                <p className="text-white/80 text-[10px] md:text-sm font-medium leading-snug">{slide.desc}</p>
              </div>
            </div>
          ))}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
             {slides.map((_, i) => <button key={i} onClick={() => setActiveSlide(i)} className={`h-1 rounded-full transition-all ${activeSlide === i ? 'w-6 bg-white' : 'w-1.5 bg-white/30'}`}></button>)}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-3">
           <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter text-slate-900">Productos</h2>
           <div className="hidden xs:flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100">
              <BadgeCheck className="w-3.5 h-3.5"/>
              <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">Garantía Odoo</span>
           </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="bg-white rounded-[1.5rem] aspect-[3/4] animate-pulse border border-slate-100"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => { setSelectedProduct(p); setActiveTab('info'); }} className="group bg-white rounded-[1.8rem] p-3 md:p-4 border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col relative">
                <div className="aspect-square bg-slate-50 rounded-[1.2rem] md:rounded-[1.5rem] mb-3 overflow-hidden flex items-center justify-center">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <Package className="w-8 h-8 text-slate-200"/>}
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="text-[7px] font-black uppercase tracking-widest mb-1 px-2 py-0.5 bg-slate-100 rounded-full w-fit text-slate-500">{p.categoria}</span>
                  <h3 className="text-[9px] md:text-[11px] font-bold text-slate-800 line-clamp-2 uppercase h-7 mb-3 leading-tight">{p.nombre}</h3>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-auto">
                    <span className="text-[11px] md:text-sm font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    <button onClick={(e) => addToCart(p, e)} className="p-2 bg-slate-900 text-white rounded-lg hover:bg-brand-500 transition-all shadow-sm active:scale-90"><Plus className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* CARRITO / CHECKOUT LATERAL RESPONSIVO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative bg-white w-full max-w-sm h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-brand-600"/>
                <h3 className="font-black uppercase tracking-tight text-sm">Resumen de Compra</h3>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full transition-all"><X className="w-4 h-4"/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/30">
              {currentStep === 'cart' && (
                <div className="space-y-3">
                  {cart.length === 0 ? (
                    <div className="text-center py-16 space-y-3">
                       <Package className="w-12 h-12 text-slate-200 mx-auto" />
                       <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Tu bolsa está vacía</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.producto.id} className="flex gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm animate-in slide-in-from-right-2">
                        <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center shrink-0">
                           {item.producto.imagen ? <img src={`data:image/png;base64,${item.producto.imagen}`} className="max-h-full max-w-full object-contain" /> : <Package className="w-4 h-4 text-slate-100"/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[9px] font-bold uppercase leading-tight truncate mb-1">{item.producto.nombre}</h4>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black">S/ {item.producto.precio.toFixed(2)}</span>
                            <div className="flex items-center gap-2 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                               <button onClick={() => updateQuantity(item.producto.id, -1)} className="text-slate-400 hover:text-slate-900"><Minus className="w-2.5 h-2.5"/></button>
                               <span className="text-[10px] font-bold w-4 text-center">{item.cantidad}</span>
                               <button onClick={() => updateQuantity(item.producto.id, 1)} className="text-slate-400 hover:text-slate-900"><Plus className="w-2.5 h-2.5"/></button>
                            </div>
                          </div>
                        </div>
                        <button onClick={() => removeFromCart(item.producto.id)} className="text-slate-200 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {currentStep === 'details' && (
                <div className="space-y-5 animate-in fade-in">
                   <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Tus Datos</label>
                      <input type="text" placeholder="NOMBRE COMPLETO" className="w-full p-3 bg-white border rounded-xl outline-none font-bold text-[10px] uppercase shadow-inner" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                      <input type="tel" placeholder="TELÉFONO / WHATSAPP" className="w-full p-3 bg-white border rounded-xl outline-none font-bold text-[10px] shadow-inner" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                   </div>
                   
                   <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Entrega</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setDeliveryType('recojo')} className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${deliveryType === 'recojo' ? 'border-brand-500 bg-brand-50' : 'bg-white'}`}>
                          <Building2 className={`w-4 h-4 ${deliveryType === 'recojo' ? 'text-brand-600' : 'text-slate-300'}`}/>
                          <span className="text-[8px] font-black uppercase tracking-tighter">Recojo</span>
                        </button>
                        <button onClick={() => setDeliveryType('delivery')} className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${deliveryType === 'delivery' ? 'border-brand-500 bg-brand-50' : 'bg-white'}`}>
                          <Truck className={`w-4 h-4 ${deliveryType === 'delivery' ? 'text-brand-600' : 'text-slate-300'}`}/>
                          <span className="text-[8px] font-black uppercase tracking-tighter">Envío</span>
                        </button>
                      </div>
                      {deliveryType === 'recojo' ? (
                        <select className="w-full p-3 bg-white border rounded-xl outline-none font-bold text-[9px] uppercase" value={clientData.sede} onChange={e => setClientData({...clientData, sede: e.target.value})}>
                            <option value="">ELEGIR SEDE...</option>
                            {config.sedes_recojo?.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                        </select>
                      ) : (
                        <textarea placeholder="DIRECCIÓN DE ENVÍO..." className="w-full p-3 bg-white border rounded-xl outline-none font-bold text-[9px] h-20 uppercase shadow-inner" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                      )}
                   </div>
                </div>
              )}

              {currentStep === 'payment' && (
                <div className="space-y-5 animate-in fade-in">
                   <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Método de Pago</label>
                      <div className="space-y-2">
                        <button onClick={() => setPaymentMethod('yape')} className={`w-full p-4 rounded-xl border flex items-center gap-3 transition-all ${paymentMethod === 'yape' ? 'border-[#742284] bg-[#742284]/5' : 'bg-white'}`}>
                          <div className="w-8 h-8 bg-[#742284] rounded-lg flex items-center justify-center text-white font-black text-xs">Y</div>
                          <div className="text-left"><p className="text-[9px] font-black uppercase text-[#742284]">Pagar con Yape</p></div>
                        </button>
                        <button onClick={() => setPaymentMethod('plin')} className={`w-full p-4 rounded-xl border flex items-center gap-3 transition-all ${paymentMethod === 'plin' ? 'border-[#00A9E0] bg-[#00A9E0]/5' : 'bg-white'}`}>
                          <div className="w-8 h-8 bg-[#00A9E0] rounded-lg flex items-center justify-center text-white font-black text-xs">P</div>
                          <div className="text-left"><p className="text-[9px] font-black uppercase text-[#00A9E0]">Pagar con Plin</p></div>
                        </button>
                        <button onClick={() => setPaymentMethod('efectivo')} className={`w-full p-4 rounded-xl border flex items-center gap-3 transition-all ${paymentMethod === 'efectivo' ? 'border-slate-900 bg-slate-50' : 'bg-white'}`}>
                          <Wallet className="w-8 h-8 text-slate-400 p-1.5"/>
                          <div className="text-left"><p className="text-[9px] font-black uppercase">Efectivo / POS</p></div>
                        </button>
                      </div>
                   </div>

                   {(paymentMethod === 'yape' || paymentMethod === 'plin') && (
                     <div className="p-5 bg-white rounded-2xl border border-slate-100 flex flex-col items-center text-center space-y-4 shadow-sm animate-in zoom-in-95">
                        <Smartphone className="w-6 h-6 text-brand-500" />
                        <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{paymentMethod === 'yape' ? config.yapeName : config.plinName}</p>
                          <p className="text-lg font-black text-slate-900">{paymentMethod === 'yape' ? config.yapeNumber : config.plinNumber}</p>
                        </div>
                        {/* IMAGEN DE QR DE PAGO */}
                        <div className="w-40 h-40 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden">
                           { (paymentMethod === 'yape' && config.yapeQR) || (paymentMethod === 'plin' && config.plinQR) ? (
                              <img src={paymentMethod === 'yape' ? config.yapeQR : config.plinQR} alt="QR de Pago" className="w-full h-full object-contain" />
                           ) : (
                             <div className="flex flex-col items-center gap-2 text-slate-300">
                               <QrCode className="w-12 h-12" />
                               <span className="text-[7px] font-bold">QR NO DISPONIBLE</span>
                             </div>
                           )}
                        </div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase leading-snug">Escanea el código o usa el número.<br/>Adjunta tu captura al finalizar.</p>
                     </div>
                   )}
                </div>
              )}

              {currentStep === 'processing' && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                   <div className="w-16 h-16 border-3 border-slate-100 border-t-brand-500 rounded-full animate-spin"></div>
                   <h3 className="text-sm font-black uppercase tracking-tight">Procesando...</h3>
                </div>
              )}

              {currentStep === 'success' && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in">
                   <div className="w-20 h-20 bg-brand-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-brand-500/20">
                      <CheckCircle className="w-10 h-10" />
                   </div>
                   <div className="space-y-1">
                      <h3 className="text-xl font-black uppercase tracking-tighter">¡Listo!</h3>
                      <p className="text-[9px] font-black text-brand-600 uppercase">Orden {lastOrderId}</p>
                   </div>
                   <p className="text-[10px] text-slate-500 font-medium leading-relaxed max-w-[200px]">Redirigiendo a WhatsApp para confirmación...</p>
                </div>
              )}
            </div>

            {/* BARRA DE TOTAL Y ACCIÓN */}
            {currentStep !== 'processing' && currentStep !== 'success' && cart.length > 0 && (
              <div className="p-6 border-t border-slate-100 bg-white space-y-4 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between">
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total del Pedido</span>
                   <span className="text-xl font-black text-slate-900">S/ {cartTotal.toFixed(2)}</span>
                </div>
                {currentStep === 'cart' ? (
                   <button onClick={() => setCurrentStep('details')} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-2">
                     Siguiente Paso <ChevronRight className="w-4 h-4"/>
                   </button>
                ) : (
                   <div className="flex gap-2">
                      <button onClick={() => setCurrentStep(currentStep === 'details' ? 'cart' : 'details')} className="p-4 bg-slate-100 text-slate-400 rounded-xl"><ArrowLeft className="w-4 h-4"/></button>
                      <button onClick={currentStep === 'details' ? () => setCurrentStep('payment') : handleFinalOrder} className="flex-1 py-4 bg-brand-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-brand-500/20">
                        {currentStep === 'details' ? 'Elegir Pago' : 'Confirmar Pedido'}
                      </button>
                   </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DETALLE PRODUCTO OPTIMIZADO */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[85vh] animate-in zoom-in-95">
             <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-full z-20 transition-all shadow-sm"><X className="w-4 h-4"/></button>
             
             <div className="md:w-[45%] bg-slate-50 flex items-center justify-center p-8 shrink-0 relative">
               <div className="w-full aspect-square bg-white rounded-2xl shadow-sm p-8 flex items-center justify-center border border-slate-100 relative group overflow-hidden">
                 {selectedProduct.imagen ? <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" /> : <ImageIcon className="w-16 h-16 text-slate-100"/>}
                 <div className="absolute bottom-4 left-4 right-4 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600"/>
                    <span className="text-[8px] font-black uppercase text-emerald-700 tracking-widest">Validado</span>
                 </div>
               </div>
             </div>

             <div className="md:w-[55%] p-6 md:p-8 flex flex-col min-h-0 bg-white">
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-brand-50 text-brand-600">{selectedProduct.categoria}</span>
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400"/>
                  </div>
                  <h2 className="text-lg md:text-xl font-black text-slate-900 leading-tight tracking-tight uppercase mb-2">{selectedProduct.nombre}</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <UserCheck className="w-3 h-3 text-brand-500"/> Farmacia Autorizada
                  </p>
                </div>

                <div className="flex border-b border-slate-100 mb-4 gap-4 overflow-x-auto no-scrollbar">
                  {['info', 'tech', 'usage'].map(id => (
                    <button key={id} onClick={() => setActiveTab(id as any)} className={`pb-2 text-[10px] font-black uppercase tracking-widest transition-all relative shrink-0 ${activeTab === id ? 'text-slate-900' : 'text-slate-300'}`}>
                      {id === 'info' ? 'Resumen' : id === 'tech' ? 'Ficha' : 'Uso'}
                      {activeTab === id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-500 rounded-full animate-in slide-in-from-left"></div>}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar text-slate-600 text-[11px] leading-relaxed">
                   {activeTab === 'info' && (
                     <div className="animate-in fade-in space-y-4">
                       <p className="italic bg-brand-50/20 p-4 border-l-2 border-brand-500 rounded-r-xl">"{selectedProduct.descripcion_venta || 'Información de producto validada para garantizar seguridad y eficacia.'}"</p>
                       <div className="p-5 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
                         <div>
                           <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Valor Online</p>
                           <p className="text-2xl font-black tracking-tighter">S/ {selectedProduct.precio.toFixed(2)}</p>
                         </div>
                         <div className="text-right"><div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse inline-block mr-2"></div><span className="text-[9px] font-black uppercase text-emerald-400">En Stock</span></div>
                       </div>
                     </div>
                   )}
                   {activeTab === 'tech' && (
                     <div className="animate-in fade-in grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Lab.</p><p className="text-[9px] font-bold uppercase">{selectedProduct.laboratorio || 'Validado'}</p></div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Tipo</p><p className="text-[9px] font-bold uppercase">Clínico</p></div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2"><p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Registro</p><p className="text-[9px] font-bold uppercase truncate">{selectedProduct.registro_sanitario || 'DIGEMID Validado'}</p></div>
                     </div>
                   )}
                   {activeTab === 'usage' && (
                     <div className="animate-in fade-in p-4 bg-brand-50/30 rounded-xl border border-brand-100/50">
                        <h4 className="text-[9px] font-black uppercase text-brand-600 mb-2">Protocolo Sugerido</h4>
                        <p className="italic font-bold">"{selectedProduct.uso_sugerido || 'Consulte con su profesional de salud. Siga la posología recomendada.'}"</p>
                     </div>
                   )}
                </div>

                <div className="pt-6 mt-4 border-t border-slate-50">
                   <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-3">
                     <ShoppingCart className="w-4 h-4" /> Añadir a mi Pedido
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* FOOTER ESTILIZADO Y VISIBLE */}
      <footer className="mt-auto py-12 md:py-16 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
           <div className="space-y-5">
              <div className="flex items-center gap-3">
                 <div className="p-2.5 rounded-xl bg-brand-500 shadow-lg shadow-brand-500/20"><bizMeta.icon className="w-5 h-5 text-white" /></div>
                 <span className="font-black text-lg md:text-xl tracking-tighter uppercase">{config.nombreComercial || config.code}</span>
              </div>
              <p className="text-[10px] md:text-[11px] text-slate-400 font-medium leading-relaxed italic opacity-80 border-l-2 border-slate-700 pl-4">
                "{config.footer_description || 'Excelencia profesional y cuidado integral de su salud con tecnología Odoo.'}"
              </p>
           </div>
           <div className="flex flex-col md:items-end gap-6">
              <div className="flex gap-3">
                  <button className="p-3 bg-white/5 rounded-xl hover:bg-brand-500 transition-all"><Facebook className="w-5 h-5"/></button>
                  <button className="p-3 bg-white/5 rounded-xl hover:bg-brand-500 transition-all"><Instagram className="w-5 h-5"/></button>
                  <button className="p-3 bg-white/5 rounded-xl hover:bg-brand-500 transition-all"><MessageCircle className="w-5 h-5"/></button>
              </div>
              <p className="text-[8px] md:text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em]">
                © 2025 LEMON BI ANALYTICS • POWERED BY GAORSYSTEM
              </p>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default StoreView;
