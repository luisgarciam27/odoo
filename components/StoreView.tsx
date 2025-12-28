
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, Image as ImageIcon, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, ShieldCheck, 
  Star, Facebook, Instagram, Pill, Beaker, ClipboardCheck, AlertCircle,
  Stethoscope, Footprints, PawPrint, Calendar, Wallet, CheckCircle2, Camera, ChevronRight,
  Loader2, BadgeCheck, Send, UserCheck, Sparkles, Zap, Award, HeartHandshake, ShieldAlert,
  RefreshCw, Trash2, CreditCard, Building2, Smartphone, CheckCircle, QrCode, Music2, Upload
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
  
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'efectivo'>('yape');
  const [deliveryType, setDeliveryType] = useState<'recojo' | 'delivery'>('recojo');
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '', sede: '' });
  const [voucherImage, setVoucherImage] = useState<string | null>(null);

  const colorP = config?.colorPrimario || '#84cc16'; 
  const colorA = config?.colorAcento || '#0ea5e9';
  const bizType = config?.businessType || 'pharmacy';

  const defaultSlides = [
    { title: "Salud y Confianza Certificada", desc: "Productos validados para tu bienestar total.", icon: ShieldCheck, badge: "Garantía Premium", bg: `linear-gradient(135deg, ${colorP}, ${colorA})` },
    { title: "Delivery Express Seguro", desc: "Llevamos tus productos en tiempo récord.", icon: Truck, badge: "Envío Hoy", bg: `linear-gradient(135deg, ${colorA}, ${colorP})` }
  ];

  const slides = useMemo(() => {
    if (config.slide_images && config.slide_images.some(img => img)) {
      return config.slide_images.filter(img => img).map((url) => ({
        image: url,
        title: config.nombreComercial || "Nuestros Productos",
        desc: "Calidad garantizada.",
        badge: "Novedad"
      }));
    }
    return defaultSlides;
  }, [config.slide_images, config.nombreComercial]);

  useEffect(() => {
    if (slides.length > 1) {
      const timer = setInterval(() => {
        setActiveSlide(s => (s + 1) % slides.length);
      }, 6000);
      return () => clearInterval(timer);
    }
  }, [slides.length]);

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    const client = new OdooClient(session.url, session.db, true);
    try {
      const extras = await getProductExtras(config.code);
      const domain: any[] = [['sale_ok', '=', true], ['company_id', '=', session.companyId]];
      const data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, ['display_name', 'list_price', 'categ_id', 'image_128', 'description_sale', 'qty_available'], { limit: 500 });
      setProductos(data.map((p: any) => {
        const extra = extras[p.id];
        return {
          id: p.id,
          nombre: p.display_name,
          precio: p.list_price || 0,
          categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
          stock: p.qty_available || 0,
          imagen: p.image_128,
          descripcion_venta: extra?.descripcion_lemon || p.description_sale || '',
          uso_sugerido: extra?.instrucciones_lemon || '',
          laboratorio: 'Genérico',
          registro_sanitario: 'DIGEMID Validado'
        };
      }));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, [session, config.code]);

  const filteredProducts = useMemo(() => {
    const hidden = config.hiddenProducts || [];
    return productos.filter(p => !hidden.includes(p.id) && (searchTerm === '' || p.nombre.toLowerCase().includes(searchTerm.toLowerCase())));
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

  const handleVoucherUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setVoucherImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFinalOrder = async () => {
    if (clientData.nombre.length < 3 || clientData.telefono.length < 9) {
      alert("Completa tus datos para continuar.");
      setCurrentStep('details');
      return;
    }
    setCurrentStep('processing');
    try {
      const client = new OdooClient(session.url, session.db, true);
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
      const msg = `*NUEVA ORDEN: ${orderInfo[0]?.name || newOrderId}*%0A%0A*Cliente:* ${clientData.nombre}%0A*Total:* S/ ${cartTotal.toFixed(2)}%0A*Pago:* ${paymentMethod.toUpperCase()}%0A${voucherImage ? '✅ COMPROBANTE LISTO' : '❌ PENDIENTE DE VOUCHER'}%0A%0A*Productos:*%0A${itemsText}`;
      
      setTimeout(() => {
        window.open(`https://wa.me/${config.whatsappNumbers?.split(',')[0]}?text=${msg}`);
        setCart([]);
        setVoucherImage(null);
      }, 2500);
    } catch (e: any) {
      alert(e.message);
      setCurrentStep('payment');
    }
  };

  const bizMeta = {
    pharmacy: { icon: Pill, label: 'Farmacia Autorizada' },
    veterinary: { icon: PawPrint, label: 'Clínica Veterinaria' },
    podiatry: { icon: Footprints, label: 'Podología Especializada' }
  }[bizType] || { icon: Package, label: 'Tienda Oficial' };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col overflow-x-hidden">
      
      {/* BOTÓN AYUDA FLOTANTE */}
      {config.whatsappHelpNumber && (
        <a 
          href={`https://wa.me/${config.whatsappHelpNumber}?text=Hola, necesito ayuda con un pedido.`} 
          target="_blank" rel="noreferrer"
          className="fixed bottom-6 right-6 z-[80] bg-emerald-500 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all flex items-center justify-center animate-bounce group"
        >
          <MessageCircle className="w-6 h-6" />
        </a>
      )}

      <header className="bg-white/90 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 md:py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            {onBack && <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-900"><ArrowLeft className="w-5 h-5"/></button>}
            {config.logoUrl ? <img src={config.logoUrl} className="h-6 md:h-8 object-contain" /> : <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{backgroundColor: colorP}}><bizMeta.icon className="w-5 h-5" /></div>}
            <div className="hidden sm:block">
               <h1 className="font-black text-slate-900 uppercase text-[10px] leading-none tracking-tight">{config.nombreComercial || config.code}</h1>
               <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-1">{bizMeta.label}</p>
            </div>
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
              <input type="text" placeholder="Buscar..." className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl text-xs font-medium outline-none focus:bg-white transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-2.5 bg-slate-900 text-white rounded-xl shadow-lg">
            <ShoppingCart className="w-4 h-4" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 text-white text-[8px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-pulse" style={{backgroundColor: colorA}}>{cart.length}</span>}
          </button>
        </div>
      </header>

      {/* SLIDER */}
      <div className="px-4 md:px-6 pt-4">
        <div className="max-w-7xl mx-auto overflow-hidden rounded-[1.5rem] md:rounded-[2.5rem] shadow-xl relative h-[150px] md:h-[300px]">
          {slides.map((slide: any, idx) => (
            <div key={idx} className={`absolute inset-0 transition-all duration-1000 ${activeSlide === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              {slide.image ? (
                <img src={slide.image} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full p-8 md:p-12 flex items-center" style={{ background: slide.bg }}>
                   <div className="max-w-sm text-white space-y-3">
                      <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">{slide.badge}</span>
                      <h2 className="text-xl md:text-4xl font-black uppercase tracking-tighter leading-none">{slide.title}</h2>
                      <p className="text-white/80 text-[10px] md:text-sm font-medium">{slide.desc}</p>
                   </div>
                </div>
              )}
            </div>
          ))}
          {slides.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {slides.map((_, i) => <button key={i} onClick={() => setActiveSlide(i)} className={`h-1 rounded-full transition-all ${activeSlide === i ? 'w-8 bg-white' : 'w-2 bg-white/30'}`}></button>)}
            </div>
          )}
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
           <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900">Nuestro Catálogo</h2>
           <div className="hidden sm:flex items-center gap-3 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-100">
              <BadgeCheck className="w-4 h-4"/>
              <span className="text-[9px] font-black uppercase tracking-widest">Sincronizado Live</span>
           </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {[1,2,3,4,5].map(i => <div key={i} className="bg-white rounded-[2rem] aspect-[3/4] animate-pulse border border-slate-100"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => { setSelectedProduct(p); setActiveTab('info'); }} className="group bg-white rounded-[2rem] p-4 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col">
                <div className="aspect-square bg-slate-50 rounded-[1.5rem] mb-4 overflow-hidden flex items-center justify-center">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <Package className="w-10 h-10 text-slate-200"/>}
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest mb-1.5 px-3 py-1 bg-slate-100 rounded-full w-fit text-slate-500">{p.categoria}</span>
                  <h3 className="text-[10px] md:text-xs font-bold text-slate-800 line-clamp-2 uppercase h-8 mb-4 leading-tight">{p.nombre}</h3>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-auto">
                    <span className="text-sm font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    <button onClick={(e) => addToCart(p, e)} className="p-2.5 bg-slate-900 text-white rounded-xl shadow-sm"><Plus className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL DETALLE PRODUCTO (FICHA) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative bg-white w-full max-w-4xl rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] md:max-h-[85vh] animate-in zoom-in-95">
             <button onClick={() => setSelectedProduct(null)} className="absolute top-6 right-6 p-2.5 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-full z-20 transition-all"><X className="w-4 h-4"/></button>
             
             <div className="md:w-[45%] bg-slate-50 flex items-center justify-center p-10 shrink-0 border-r border-slate-100">
               <div className="w-full aspect-square bg-white rounded-[2.5rem] shadow-sm p-10 flex items-center justify-center border border-slate-100 relative group overflow-hidden">
                 {selectedProduct.imagen ? <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" /> : <ImageIcon className="w-20 h-20 text-slate-100"/>}
                 <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600"/>
                    <span className="text-[9px] font-black uppercase text-emerald-700 tracking-widest">Validado</span>
                 </div>
               </div>
             </div>

             <div className="md:w-[55%] p-8 md:p-14 flex flex-col min-h-0 bg-white">
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-lg bg-brand-50 text-brand-600 border border-brand-100">{selectedProduct.categoria}</span>
                    <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-lg text-amber-600"><Star className="w-3.5 h-3.5 fill-amber-500"/><span className="text-[9px] font-black uppercase">Top Choice</span></div>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight tracking-tighter uppercase mb-4">{selectedProduct.nombre}</h2>
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-slate-100 rounded-xl"><UserCheck className="w-4 h-4 text-slate-600"/></div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Certificado por Lemon BI Analytics</p>
                  </div>
                </div>

                <div className="flex border-b border-slate-100 mb-8 gap-8 overflow-x-auto no-scrollbar">
                  {[
                    {id: 'info', icon: Info, label: 'Resumen'},
                    {id: 'tech', icon: ClipboardCheck, label: 'Ficha Técnica'},
                    {id: 'usage', icon: Zap, label: 'Modo de Uso'}
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`pb-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative shrink-0 flex items-center gap-2.5 ${activeTab === tab.id ? 'text-slate-900' : 'text-slate-300'}`}>
                      <tab.icon className="w-4 h-4"/> {tab.label}
                      {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-500 rounded-full animate-in slide-in-from-left duration-300"></div>}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar text-slate-600 text-[12px] leading-relaxed">
                   {activeTab === 'info' && (
                     <div className="animate-in fade-in duration-300 space-y-6">
                       <p className="italic font-bold text-slate-800 bg-slate-50 p-6 border-l-4 border-brand-500 rounded-r-[2rem]">"{selectedProduct.descripcion_venta || 'Información validada por nuestro departamento de especialistas para garantizar su efectividad.'}"</p>
                       <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] flex items-center justify-between shadow-2xl">
                         <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Precio Online</p>
                           <p className="text-4xl font-black tracking-tighter">S/ {selectedProduct.precio.toFixed(2)}</p>
                         </div>
                         <div className="text-right">
                           <div className="flex items-center gap-2 text-emerald-400 font-black uppercase text-[9px] mb-1"><div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"></div> En Stock</div>
                           <p className="text-[7px] text-slate-500 font-black uppercase tracking-widest">Sincronizado Odoo</p>
                         </div>
                       </div>
                     </div>
                   )}

                   {activeTab === 'tech' && (
                     <div className="animate-in fade-in duration-300 grid grid-cols-2 gap-4">
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Laboratorio / Marca</p><p className="text-[11px] font-black text-slate-900 uppercase">{selectedProduct.laboratorio || 'Validado'}</p></div>
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Presentación</p><p className="text-[11px] font-black text-slate-900 uppercase">Unidad Estándar</p></div>
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm col-span-2"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Registro de Calidad</p><p className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">{selectedProduct.registro_sanitario || 'DIGEMID / SENASA Validado'}</p></div>
                        <div className="p-6 bg-indigo-50 rounded-[2rem] border border-indigo-100 col-span-2 flex items-center gap-4"><Award className="w-8 h-8 text-indigo-600"/><div className="flex-1"><p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Garantía Profesional</p><p className="text-sm font-black text-indigo-900 tracking-tighter uppercase">Eficacia Clínica Comprobada</p></div></div>
                     </div>
                   )}

                   {activeTab === 'usage' && (
                     <div className="animate-in fade-in duration-300">
                        <div className="p-8 bg-brand-50/50 border-l-4 border-brand-500 rounded-r-[2rem] shadow-sm space-y-5">
                           <div className="flex items-center gap-3">
                              <Zap className="w-5 h-5 text-brand-500"/>
                              <h4 className="text-[11px] font-black uppercase text-brand-700 tracking-widest">Modo de Administración</h4>
                           </div>
                           <p className="text-[13px] font-bold text-slate-700 leading-relaxed italic">"{selectedProduct.uso_sugerido || 'Consulte con su profesional de salud de confianza. La administración debe seguir las indicaciones terapéuticas recomendadas.'}"</p>
                           <div className="flex items-center gap-3 pt-4 border-t border-brand-100"><CheckCircle2 className="w-4 h-4 text-brand-500"/><span className="text-[9px] font-black uppercase text-brand-400 tracking-widest">Protocolo Validado</span></div>
                        </div>
                     </div>
                   )}
                </div>

                <div className="pt-10 mt-8 border-t border-slate-50">
                   <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-[0.3em] shadow-2xl flex items-center justify-center gap-4 hover:bg-brand-600 transition-all hover:scale-[1.02] active:scale-95">
                     <ShoppingCart className="w-5 h-5" /> Añadir al Pedido
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* CARRITO Y CHECKOUT */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative bg-white w-full max-w-sm h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5 text-brand-600"/>
                <h3 className="font-black uppercase tracking-tight text-sm">Mi Bolsa</h3>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all"><X className="w-5 h-5"/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/20">
              {currentStep === 'cart' && (
                <div className="space-y-4">
                  {cart.length === 0 ? (
                    <div className="text-center py-20 opacity-30"><Package className="w-16 h-16 mx-auto mb-4"/><p className="text-xs font-black uppercase tracking-widest">Vacio</p></div>
                  ) : cart.map(item => (
                    <div key={item.producto.id} className="flex gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm animate-in slide-in-from-right-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center shrink-0">
                         {item.producto.imagen ? <img src={`data:image/png;base64,${item.producto.imagen}`} className="max-h-full max-w-full object-contain" /> : <Package className="w-6 h-6 text-slate-200"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[10px] font-black uppercase leading-tight truncate mb-2">{item.producto.nombre}</h4>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black">S/ {item.producto.precio.toFixed(2)}</span>
                          <div className="flex items-center gap-3 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                             <button onClick={() => updateQuantity(item.producto.id, -1)} className="text-slate-400 hover:text-slate-900"><Minus className="w-3 h-3"/></button>
                             <span className="text-xs font-black w-4 text-center">{item.cantidad}</span>
                             <button onClick={() => updateQuantity(item.producto.id, 1)} className="text-slate-400 hover:text-slate-900"><Plus className="w-3 h-3"/></button>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => removeFromCart(item.producto.id)} className="text-slate-200 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  ))}
                </div>
              )}

              {currentStep === 'details' && (
                <div className="space-y-6 animate-in fade-in">
                   <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Datos de Cliente</label>
                      <input type="text" placeholder="NOMBRE COMPLETO" className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-brand-500" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                      <input type="tel" placeholder="TELÉFONO / WHATSAPP" className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black outline-none focus:ring-2 focus:ring-brand-500" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                   </div>
                   <div className="space-y-4 pt-4 border-t border-slate-100">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Tipo de Entrega</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setDeliveryType('recojo')} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${deliveryType === 'recojo' ? 'border-brand-500 bg-brand-50' : 'border-slate-100 bg-white'}`}><Building2 className="w-5 h-5"/><span className="text-[8px] font-black uppercase">Recojo</span></button>
                        <button onClick={() => setDeliveryType('delivery')} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${deliveryType === 'delivery' ? 'border-brand-500 bg-brand-50' : 'border-slate-100 bg-white'}`}><Truck className="w-5 h-5"/><span className="text-[8px] font-black uppercase">Envío</span></button>
                      </div>
                      {deliveryType === 'recojo' ? (
                        <select className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase outline-none" value={clientData.sede} onChange={e => setClientData({...clientData, sede: e.target.value})}>
                            <option value="">ELEGIR SEDE...</option>
                            {config.sedes_recojo?.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                        </select>
                      ) : (
                        <textarea placeholder="DIRECCIÓN DE ENTREGA Y REFERENCIAS..." className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase h-24 outline-none" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                      )}
                   </div>
                </div>
              )}

              {currentStep === 'payment' && (
                <div className="space-y-6 animate-in fade-in pb-20">
                   <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Método de Pago</label>
                      <div className="space-y-3">
                        <button onClick={() => setPaymentMethod('yape')} className={`w-full p-5 rounded-2xl border-2 flex items-center gap-4 transition-all ${paymentMethod === 'yape' ? 'border-[#742284] bg-[#742284]/5 shadow-sm' : 'border-transparent bg-white shadow-sm'}`}>
                          <div className="w-10 h-10 bg-[#742284] rounded-xl flex items-center justify-center text-white font-black text-xs">Y</div>
                          <div className="text-left font-black"><p className="text-[10px] uppercase text-[#742284]">Yape</p><p className="text-[8px] text-slate-400">Pagar ahora</p></div>
                        </button>
                        <button onClick={() => setPaymentMethod('plin')} className={`w-full p-5 rounded-2xl border-2 flex items-center gap-4 transition-all ${paymentMethod === 'plin' ? 'border-[#00A9E0] bg-[#00A9E0]/5 shadow-sm' : 'border-transparent bg-white shadow-sm'}`}>
                          <div className="w-10 h-10 bg-[#00A9E0] rounded-xl flex items-center justify-center text-white font-black text-xs">P</div>
                          <div className="text-left font-black"><p className="text-[10px] uppercase text-[#00A9E0]">Plin</p><p className="text-[8px] text-slate-400">Pagar ahora</p></div>
                        </button>
                        <button onClick={() => setPaymentMethod('efectivo')} className={`w-full p-5 rounded-2xl border-2 flex items-center gap-4 transition-all ${paymentMethod === 'efectivo' ? 'border-slate-800 bg-slate-50 shadow-sm' : 'border-transparent bg-white shadow-sm'}`}>
                          <Wallet className="w-10 h-10 text-slate-400 p-2"/>
                          <div className="text-left font-black"><p className="text-[10px] uppercase">Efectivo / POS</p><p className="text-[8px] text-slate-400">Pagar al recibir</p></div>
                        </button>
                      </div>
                   </div>

                   {(paymentMethod === 'yape' || paymentMethod === 'plin') && (
                     <div className="p-6 bg-white rounded-3xl border border-slate-100 flex flex-col items-center text-center space-y-5 shadow-inner animate-in zoom-in-95">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{paymentMethod === 'yape' ? config.yapeName : config.plinName}</p>
                          <p className="text-2xl font-black text-slate-900">{paymentMethod === 'yape' ? config.yapeNumber : config.plinNumber}</p>
                        </div>
                        <div className="w-48 h-48 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden">
                           { (paymentMethod === 'yape' && config.yapeQR) || (paymentMethod === 'plin' && config.plinQR) ? (
                              <img src={paymentMethod === 'yape' ? config.yapeQR : config.plinQR} alt="QR de Pago" className="w-full h-full object-contain" />
                           ) : <QrCode className="w-16 h-16 text-slate-200" />}
                        </div>
                        <div className="w-full pt-6 border-t border-slate-100 space-y-4">
                           <p className="text-[9px] font-black uppercase text-brand-600 tracking-widest">Adjuntar Comprobante</p>
                           <label className="w-full flex items-center justify-center gap-4 p-5 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 cursor-pointer hover:border-brand-500 transition-all">
                              {voucherImage ? (
                                <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md"><img src={voucherImage} className="w-full h-full object-cover" /></div>
                                   <span className="text-[10px] font-black uppercase text-brand-600">Comprobante Listo</span>
                                   <CheckCircle2 className="w-5 h-5 text-brand-500"/>
                                </div>
                              ) : (
                                <><Camera className="w-6 h-6 text-slate-300"/><span className="text-[10px] font-black uppercase text-slate-400">Cargar Voucher</span></>
                              )}
                              <input type="file" className="hidden" accept="image/*" onChange={handleVoucherUpload} />
                           </label>
                        </div>
                     </div>
                   )}
                </div>
              )}

              {currentStep === 'processing' && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6"><div className="w-20 h-20 border-4 border-slate-100 border-t-brand-500 rounded-full animate-spin"></div><h3 className="text-lg font-black uppercase">Validando...</h3></div>
              )}

              {currentStep === 'success' && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in">
                   <div className="w-24 h-24 bg-brand-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-brand-500/30"><CheckCircle className="w-12 h-12" /></div>
                   <div><h3 className="text-2xl font-black uppercase">¡Recibido!</h3><p className="text-[11px] font-black text-brand-600 uppercase tracking-widest mt-2">Orden {lastOrderId}</p></div>
                   <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-[220px]">Sincronizando con WhatsApp para confirmar entrega...</p>
                </div>
              )}
            </div>

            {currentStep !== 'processing' && currentStep !== 'success' && cart.length > 0 && (
              <div className="p-8 border-t border-slate-100 bg-white space-y-4 shadow-[0_-15px_30px_rgba(0,0,0,0.03)]">
                <div className="flex items-center justify-between">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total</span>
                   <span className="text-2xl font-black text-slate-900">S/ {cartTotal.toFixed(2)}</span>
                </div>
                {currentStep === 'cart' ? (
                   <button onClick={() => setCurrentStep('details')} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl flex items-center justify-center gap-3">Siguiente <ChevronRight className="w-4 h-4"/></button>
                ) : (
                   <div className="flex gap-3">
                      <button onClick={() => setCurrentStep(currentStep === 'details' ? 'cart' : 'details')} className="p-5 bg-slate-100 text-slate-400 rounded-2xl"><ArrowLeft className="w-5 h-5"/></button>
                      <button onClick={currentStep === 'details' ? () => setCurrentStep('payment') : handleFinalOrder} className="flex-1 py-5 bg-brand-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-brand-500/20">{currentStep === 'details' ? 'Elegir Pago' : 'Finalizar'}</button>
                   </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-auto py-16 bg-slate-900 text-white border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-12">
           <div className="space-y-6 max-w-sm text-center md:text-left">
              <div className="flex items-center gap-3 justify-center md:justify-start">
                 <div className="p-3 rounded-xl bg-brand-500 shadow-xl shadow-brand-500/20"><bizMeta.icon className="w-6 h-6 text-white" /></div>
                 <span className="font-black text-xl tracking-tighter uppercase">{config.nombreComercial || config.code}</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic border-l-2 border-slate-700 pl-4">"{config.footer_description || 'Excelencia profesional y cuidado integral de su salud con tecnología Odoo.'}"</p>
           </div>
           <div className="flex flex-col items-center md:items-end gap-6">
              <div className="flex gap-4">
                  {config.facebook_url && <a href={config.facebook_url} target="_blank" rel="noreferrer" className="p-3.5 bg-white/5 rounded-2xl hover:bg-brand-500 transition-all"><Facebook className="w-5 h-5"/></a>}
                  {config.instagram_url && <a href={config.instagram_url} target="_blank" rel="noreferrer" className="p-3.5 bg-white/5 rounded-2xl hover:bg-brand-500 transition-all"><Instagram className="w-5 h-5"/></a>}
                  {config.tiktok_url && <a href={config.tiktok_url} target="_blank" rel="noreferrer" className="p-3.5 bg-white/5 rounded-2xl hover:bg-brand-500 transition-all"><Music2 className="w-5 h-5"/></a>}
              </div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.4em]">© 2025 LEMON BI ANALYTICS • GAORSYSTEM</p>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default StoreView;
