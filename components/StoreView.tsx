
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, Image as ImageIcon, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, ShieldCheck, 
  Star, Facebook, Instagram, Pill, Beaker, ClipboardCheck, AlertCircle,
  Stethoscope, Footprints, PawPrint, Calendar, Wallet, CheckCircle2, Camera, ChevronRight,
  Loader2, BadgeCheck, Send, UserCheck, Sparkles, Zap, Award, HeartHandshake, ShieldAlert,
  // Fix: Added missing RefreshCw icon import
  RefreshCw
} from 'lucide-react';
import { Producto, CartItem, OdooSession, ClientConfig } from '../types';
import { OdooClient } from '../services/odoo';
import { getProductExtras } from '../services/clientManager';

interface StoreViewProps {
  session: OdooSession;
  config: ClientConfig;
  onBack?: () => void;
}

type StoreStep = 'browsing' | 'cart' | 'checkout' | 'payment' | 'processing' | 'success';

const StoreView: React.FC<StoreViewProps> = ({ session, config, onBack }) => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<StoreStep>('browsing');
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'tech' | 'usage'>('info');
  const [activeSlide, setActiveSlide] = useState(0);
  
  // Estados de Pago/Envío
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'efectivo'>('yape');
  const [deliveryType, setDeliveryType] = useState<'recojo' | 'delivery'>('recojo');
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '', sede: '' });
  const [voucherAttached, setVoucherAttached] = useState<boolean>(false);

  const colorP = config?.colorPrimario || '#84cc16'; 
  const colorA = config?.colorAcento || '#0ea5e9';
  const bizType = config?.businessType || 'pharmacy';

  const slides = [
    {
      title: "Salud y Confianza Certificada",
      desc: "Solo productos validados y autorizados para tu bienestar total. Calidad garantizada por expertos.",
      icon: ShieldCheck,
      bg: `linear-gradient(135deg, ${colorP} 0%, ${colorP}dd 100%)`,
      badge: "Estándar de Calidad Premium"
    },
    {
      title: "Delivery Express Seguro",
      desc: "Llevamos tus productos en tiempo récord con protocolos de seguridad sanitaria estrictos.",
      icon: Truck,
      bg: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
      badge: "Envío Prioritario Hoy"
    },
    {
      title: "Asesoría Profesional Humana",
      desc: "Expertos colegiados listos para ayudarte en cada paso de tu compra con atención personalizada.",
      icon: HeartHandshake,
      bg: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
      badge: "Atención Especializada"
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
      const baseFields = ['display_name', 'list_price', 'categ_id', 'image_128', 'description_sale', 'qty_available'];
      
      const data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, baseFields, { limit: 500, context });

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

  const bizMeta = {
    pharmacy: { icon: Pill, label: 'Farmacia Autorizada', reg: 'Registro Sanitario', lab: 'Laboratorio' },
    veterinary: { icon: PawPrint, label: 'Clínica Veterinaria', reg: 'Reg. SENASA', lab: 'Marca Veterinaria' },
    podiatry: { icon: Footprints, label: 'Centro de Podología', reg: 'Procedimiento', lab: 'Especialista' }
  }[bizType] || { icon: Package, label: 'Catálogo Pro', reg: 'Referencia', lab: 'Fabricante' };

  const handleFinalOrder = async () => {
    const client = new OdooClient(session.url, session.db, true);
    setCurrentStep('processing');
    try {
      let partnerId: number;
      const partners = await client.searchRead(session.uid, session.apiKey, 'res.partner', [['phone', '=', clientData.telefono]], ['id'], { limit: 1 });
      if (partners.length > 0) partnerId = partners[0].id;
      else partnerId = await client.create(session.uid, session.apiKey, 'res.partner', { name: clientData.nombre.toUpperCase(), phone: clientData.telefono, company_id: session.companyId });

      const orderLines = cart.map(item => [0, 0, { product_id: item.producto.id, product_uom_qty: item.cantidad, price_unit: item.producto.precio, name: item.producto.nombre }]);
      const note = `PAGO: ${paymentMethod.toUpperCase()} | ENTREGA: ${deliveryType.toUpperCase()} | ${deliveryType === 'recojo' ? 'SEDE: '+clientData.sede : 'DIR: '+clientData.direccion}`;
      
      const newOrderId = await client.create(session.uid, session.apiKey, 'sale.order', { partner_id: partnerId, company_id: session.companyId, order_line: orderLines, note: note });
      const orderInfo = await client.searchRead(session.uid, session.apiKey, 'sale.order', [['id', '=', newOrderId]], ['name']);
      setLastOrderId(orderInfo[0]?.name || `#${newOrderId}`);
      setCurrentStep('success');
      setCart([]);
      
      const itemsText = orderLines.map((l: any) => `• ${l[2].product_uom_qty}x ${l[2].name}`).join('%0A');
      const message = `*ORDEN ODOO: ${orderInfo[0]?.name || newOrderId}*%0A%0A*Cliente:* ${clientData.nombre}%0A*Total:* S/ ${cartTotal.toFixed(2)}%0A%0A*Items:*%0A${itemsText}`;
      window.open(`https://wa.me/${config.whatsappNumbers?.split(',')[0]}?text=${message}`);
    } catch (e: any) {
      alert("Error: " + e.message);
      setCurrentStep('payment');
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans text-slate-800 flex flex-col relative overflow-x-hidden">
      
      <header className="bg-white/95 backdrop-blur-3xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {onBack && <button onClick={onBack} className="p-3 text-slate-400 hover:text-slate-900 rounded-2xl transition-all"><ArrowLeft className="w-5 h-5"/></button>}
            <div className="flex items-center gap-4 group cursor-pointer">
               {config.logoUrl ? <img src={config.logoUrl} className="h-10 object-contain group-hover:scale-105 transition-transform" /> : <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl group-hover:rotate-6 transition-all" style={{backgroundColor: colorP}}><bizMeta.icon className="w-6 h-6" /></div>}
               <div className="hidden lg:block">
                 <h1 className="font-black text-slate-900 uppercase text-xs tracking-tighter leading-none">{config.nombreComercial || config.code}</h1>
                 <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-widest flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-500" /> {bizMeta.label}</p>
               </div>
            </div>
          </div>
          <div className="flex-1 max-w-2xl hidden md:block">
            <div className="relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
              <input type="text" placeholder={`Buscar medicamentos, suplementos o cuidado personal...`} className="w-full pl-16 pr-6 py-4 bg-slate-50 border border-transparent rounded-[2.5rem] outline-none font-medium text-sm focus:bg-white focus:border-slate-200 transition-all shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-4 bg-slate-900 text-white rounded-[1.5rem] shadow-xl hover:scale-110 active:scale-95 transition-all group">
            <ShoppingCart className="w-5 h-5 group-hover:animate-bounce" />
            {cart.length > 0 && <span className="absolute -top-1.5 -right-1.5 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-xl animate-in zoom-in" style={{backgroundColor: colorA}}>{cart.length}</span>}
          </button>
        </div>
      </header>

      {/* HERO SLIDER PREMIUM NNIMADA */}
      <div className="px-6 pt-6 animate-in fade-in duration-1000">
        <div className="max-w-7xl mx-auto overflow-hidden rounded-[4rem] shadow-2xl relative h-[340px] md:h-[450px]">
          {slides.map((slide, idx) => (
            <div 
              key={idx} 
              className={`absolute inset-0 p-12 md:p-20 flex items-center transition-all duration-1000 ease-out ${activeSlide === idx ? 'opacity-100 translate-x-0 scale-100 blur-0' : 'opacity-0 translate-x-40 scale-110 blur-sm pointer-events-none'}`}
              style={{ background: slide.bg }}
            >
              <div className="max-w-2xl text-white space-y-6 md:space-y-8 relative z-10">
                <div className="flex items-center gap-4 animate-in slide-in-from-top-6 duration-700">
                  <div className="p-5 bg-white/20 rounded-3xl backdrop-blur-xl shadow-inner border border-white/20"><slide.icon className="w-8 h-8 text-white" /></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] bg-white/10 px-6 py-2 rounded-full border border-white/10 backdrop-blur-sm">{slide.badge}</span>
                </div>
                <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-[0.85] animate-in slide-in-from-left-10 duration-1000 delay-100 drop-shadow-2xl">{slide.title}</h2>
                <p className="text-white/90 text-lg md:text-2xl font-medium italic animate-in fade-in duration-1000 delay-300 max-w-lg">"{slide.desc}"</p>
                <div className="pt-6 animate-in zoom-in-50 duration-700 delay-500">
                  <button className="px-12 py-6 bg-white text-slate-900 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.25em] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.4)] flex items-center gap-4 hover:scale-105 active:scale-95 transition-all group">
                    Explorar Catálogo <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform"/>
                  </button>
                </div>
              </div>
              <div className="absolute top-1/2 right-20 -translate-y-1/2 opacity-10 hidden lg:block scale-[4] pointer-events-none transition-transform duration-[20s] linear animate-pulse">
                 <slide.icon className="w-64 h-64 text-white" />
              </div>
              {/* Decorative shapes */}
              <div className="absolute top-0 right-0 w-[50%] h-full bg-white/5 skew-x-[-20deg] translate-x-1/2"></div>
              <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/10 rounded-full blur-[100px]"></div>
            </div>
          ))}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-4 z-20">
             {slides.map((_, i) => <button key={i} onClick={() => setActiveSlide(i)} className={`h-2.5 rounded-full transition-all duration-700 ${activeSlide === i ? 'w-16 bg-white shadow-lg' : 'w-2.5 bg-white/25 hover:bg-white/50'}`}></button>)}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-12 space-y-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-10">
           <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Nuestros Productos</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2 flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Conectado a Odoo en Tiempo Real</p>
           </div>
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-emerald-50 text-emerald-700 px-6 py-3 rounded-2xl border border-emerald-100 shadow-sm animate-in fade-in duration-1000">
                 <BadgeCheck className="w-5 h-5"/>
                 <span className="text-[11px] font-black uppercase tracking-widest">Calidad Farmacéutica</span>
              </div>
           </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10">
            {[1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className="bg-white rounded-[4rem] aspect-[3/4] animate-pulse border border-slate-100 shadow-sm"></div>)}
          </div>
        ) : fetchError ? (
           <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in duration-500">
              <div className="p-12 bg-red-50 rounded-full text-red-500 mb-8 shadow-xl"><ShieldAlert className="w-20 h-20"/></div>
              <h3 className="text-3xl font-black uppercase text-slate-900 tracking-tighter">Fallo en Conexión ERP</h3>
              <p className="text-sm text-slate-500 max-w-xs mt-3 font-medium uppercase leading-relaxed">No pudimos sincronizar el catálogo con el servidor central de Odoo en este momento.</p>
              <button onClick={fetchProducts} className="mt-10 px-16 py-6 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase text-xs shadow-2xl tracking-[0.2em] hover:scale-105 active:scale-95 transition-all flex items-center gap-4"><RefreshCw className="w-5 h-5"/> Intentar Reconectar</button>
           </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 animate-in fade-in duration-1000">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => { setSelectedProduct(p); setActiveTab('info'); }} className="group bg-white rounded-[4rem] p-7 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-4 transition-all duration-700 cursor-pointer flex flex-col relative overflow-hidden">
                <div className="aspect-square bg-slate-50 rounded-[3rem] mb-8 overflow-hidden flex items-center justify-center relative shadow-inner">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" /> : <Package className="w-14 h-14 text-slate-100"/>}
                  <div className="absolute top-5 right-5 p-2.5 bg-white/95 backdrop-blur rounded-[1.2rem] opacity-0 group-hover:opacity-100 transition-all translate-y-3 group-hover:translate-y-0 shadow-lg"><Info className="w-5 h-5 text-slate-600"/></div>
                  {p.stock <= 5 && p.stock > 0 && <div className="absolute bottom-5 left-5 text-[9px] font-black bg-orange-500 text-white px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg animate-pulse">Stock Crítico</div>}
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] mb-3 block px-4 py-2 bg-slate-100 rounded-full w-fit text-slate-500">{p.categoria}</span>
                  <h3 className="text-sm font-bold text-slate-800 line-clamp-2 uppercase h-10 mb-8 leading-tight group-hover:text-brand-600 transition-colors duration-500">{p.nombre}</h3>
                  <div className="flex items-center justify-between pt-8 border-t border-slate-50 mt-auto">
                    <div className="space-y-0.5">
                        <p className="text-[9px] text-slate-300 font-black uppercase tracking-widest">P. Unitario</p>
                        <span className="text-xl font-black text-slate-900 tracking-tighter">S/ {p.precio.toFixed(2)}</span>
                    </div>
                    <button onClick={(e) => addToCart(p, e)} className="p-4 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-900 hover:text-white transition-all shadow-md active:scale-90 group-hover:bg-brand-500 group-hover:text-white"><Plus className="w-6 h-6"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL DETALLE PRODUCTO ATREVIA ONE SMALL STYLE (REDISEÑADO) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-2xl animate-in fade-in duration-700" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative bg-white w-full max-w-6xl rounded-[5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col lg:flex-row animate-in zoom-in-95 duration-700 max-h-[95vh] border border-white/10">
             <button onClick={() => setSelectedProduct(null)} className="absolute top-10 right-10 p-5 bg-slate-50 hover:bg-slate-900 hover:text-white rounded-full z-20 shadow-xl transition-all active:scale-90"><X className="w-6 h-6"/></button>
             
             <div className="lg:w-[45%] bg-slate-50 flex items-center justify-center p-16 shrink-0 relative">
               <div className="w-full aspect-square bg-white rounded-[5rem] shadow-2xl p-20 flex items-center justify-center border border-slate-100 relative group overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                 {selectedProduct.imagen ? <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-h-full max-w-full object-contain hover:scale-110 transition-transform duration-1000 ease-out" /> : <ImageIcon className="w-28 h-28 text-slate-100"/>}
                 
                 <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white px-8 py-4 rounded-[2rem] shadow-2xl border border-slate-100 animate-in slide-in-from-bottom-4 duration-1000 delay-300">
                    <BadgeCheck className="w-6 h-6 text-emerald-500"/>
                    <span className="text-[11px] font-black uppercase text-slate-800 tracking-[0.2em]">Producto de Red Validado</span>
                 </div>
               </div>
               
               {/* Brand Badges side vertical */}
               <div className="absolute top-12 left-12 space-y-4 hidden sm:block">
                  <div className="p-4 bg-white rounded-[1.5rem] shadow-lg border border-slate-100 hover:scale-110 transition-transform"><ShieldCheck className="w-6 h-6 text-brand-500"/></div>
                  <div className="p-4 bg-white rounded-[1.5rem] shadow-lg border border-slate-100 hover:scale-110 transition-transform"><Zap className="w-6 h-6 text-amber-500"/></div>
                  <div className="p-4 bg-white rounded-[1.5rem] shadow-lg border border-slate-100 hover:scale-110 transition-transform"><Sparkles className="w-6 h-6 text-indigo-500"/></div>
               </div>
             </div>

             <div className="lg:w-[55%] p-16 md:p-20 flex flex-col min-h-0 bg-white">
                <div className="mb-12">
                  <div className="flex items-center gap-4 mb-8">
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] px-5 py-2.5 rounded-[1.2rem] bg-brand-50 text-brand-600 border border-brand-100">{selectedProduct.categoria}</span>
                    <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-[1.2rem] shadow-lg shadow-slate-200"><Star className="w-4 h-4 text-amber-400 fill-amber-400"/><span className="text-[10px] font-black text-white uppercase tracking-widest">ATREVIA PREMIUM CHOICE</span></div>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-[1] tracking-tighter uppercase mb-6 animate-in slide-in-from-left-4 duration-700">{selectedProduct.nombre}</h2>
                  <div className="flex items-center gap-4 animate-in fade-in duration-1000 delay-200">
                    <div className="p-3 bg-emerald-50 rounded-[1.2rem] border border-emerald-100 shadow-sm"><UserCheck className="w-6 h-6 text-emerald-600"/></div>
                    <div className="flex flex-col">
                      <p className="text-[12px] font-black text-slate-900 uppercase tracking-tight">Farmacia Autorizada Certificado</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Suministro verificado por Lemon BI Analytics</p>
                    </div>
                  </div>
                </div>

                <div className="flex border-b border-slate-100 mb-12 gap-12 overflow-x-auto no-scrollbar">
                  {[
                    {id: 'info', icon: Info, label: 'Resumen'},
                    {id: 'tech', icon: ClipboardCheck, label: 'Ficha Técnica'},
                    {id: 'usage', icon: Zap, label: 'Instrucciones'}
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`pb-6 text-[12px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 relative shrink-0 ${activeTab === tab.id ? 'text-slate-900' : 'text-slate-300 hover:text-slate-500'}`}>
                      <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-brand-500' : 'text-slate-300'}`}/> {tab.label}
                      {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-brand-500 rounded-full shadow-[0_-5px_15px_rgba(132,204,22,0.4)] animate-in slide-in-from-left-full duration-500"></div>}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto pr-8 custom-scrollbar">
                   {activeTab === 'info' && (
                     <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                       <p className="text-lg text-slate-600 leading-relaxed font-semibold mb-12 italic border-l-8 border-brand-500 pl-8 bg-brand-50/20 py-6 rounded-r-[2rem]">"{selectedProduct.descripcion_venta || 'Nuestro compromiso institucional es garantizar el suministro de productos con los más rigurosos estándares de seguridad y eficacia clínica.'}"</p>
                       <div className="p-12 bg-slate-900 text-white rounded-[4rem] flex items-center justify-between shadow-3xl relative overflow-hidden group">
                         <div className="absolute inset-0 bg-brand-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                         <div className="relative z-10">
                           <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Valor Online Exclusivo</p>
                           <p className="text-6xl font-black tracking-tighter">S/ {selectedProduct.precio.toFixed(2)}</p>
                         </div>
                         <div className="text-right flex flex-col items-end relative z-10">
                           <div className="flex items-center gap-3 font-black text-emerald-400 uppercase text-sm mb-3">
                             <div className="w-4 h-4 bg-emerald-400 rounded-full animate-ping"></div> Stock Confirmado
                           </div>
                           <p className="text-[11px] text-slate-500 uppercase font-black tracking-[0.2em] bg-white/5 px-6 py-3 rounded-[1.2rem] border border-white/5">Entrega Prioritaria</p>
                         </div>
                       </div>
                     </div>
                   )}

                   {activeTab === 'tech' && (
                     <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                           <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex items-center gap-5 hover:bg-white hover:shadow-xl transition-all duration-500">
                              <div className="p-4 bg-white rounded-2xl shadow-md"><Package className="w-6 h-6 text-brand-500"/></div>
                              <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{bizMeta.lab}</p><p className="text-sm font-black text-slate-800 uppercase leading-none">{selectedProduct.laboratorio || 'Certificado Odoo'}</p></div>
                           </div>
                           <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex items-center gap-5 hover:bg-white hover:shadow-xl transition-all duration-500">
                              <div className="p-4 bg-white rounded-2xl shadow-md"><Sparkles className="w-6 h-6 text-amber-500"/></div>
                              <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Presentación</p><p className="text-sm font-black text-slate-800 uppercase leading-none">Atrevia One Small X 4 TAB</p></div>
                           </div>
                           <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex items-center gap-5 col-span-1 sm:col-span-2 hover:bg-white hover:shadow-xl transition-all duration-500">
                              <div className="p-4 bg-white rounded-2xl shadow-md"><ShieldCheck className="w-6 h-6 text-emerald-500"/></div>
                              <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{bizMeta.reg}</p><p className="text-sm font-black text-slate-800 uppercase tracking-tighter leading-none">{selectedProduct.registro_sanitario || 'Validado por DIGEMID / SENASA'}</p></div>
                           </div>
                           <div className="p-10 bg-indigo-50 rounded-[3rem] border border-indigo-100 col-span-1 sm:col-span-2 flex items-center justify-between shadow-sm">
                              <div className="flex items-center gap-5">
                                <div className="p-5 bg-white rounded-3xl shadow-xl"><Pill className="w-8 h-8 text-indigo-500"/></div>
                                <div><p className="text-[11px] font-black text-indigo-500 uppercase mb-2 tracking-[0.3em]">Rango de Peso / Dosis</p><p className="text-2xl font-black text-indigo-900 uppercase tracking-tighter">5-10 KG</p></div>
                              </div>
                              <div className="px-6 py-3 bg-white/50 rounded-full text-[10px] font-black text-indigo-700 uppercase tracking-[0.2em] border border-white">Eficiencia Clínica</div>
                           </div>
                        </div>
                     </div>
                   )}

                   {activeTab === 'usage' && (
                     <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 h-full flex flex-col">
                        <div className="p-12 border-l-[12px] border-brand-500 bg-brand-50/40 rounded-r-[4rem] shadow-lg">
                           <div className="flex items-center gap-5 mb-8">
                              <div className="p-4 bg-brand-500 rounded-3xl text-white shadow-xl shadow-brand-200"><Zap className="w-6 h-6 fill-white"/></div>
                              <h4 className="text-[14px] font-black uppercase text-brand-700 tracking-[0.3em]">Protocolo de Aplicación</h4>
                           </div>
                           <p className="text-xl font-bold text-slate-800 leading-relaxed italic border-b border-brand-100 pb-10 mb-10">"{selectedProduct.uso_sugerido || 'Siga estrictamente las indicaciones de su profesional tratante. Este producto ha sido validado para su administración según el protocolo institucional de salud.'}"</p>
                           <div className="grid grid-cols-2 gap-8">
                              <div className="flex items-center gap-4 group cursor-help"><div className="p-2 bg-brand-100 rounded-lg group-hover:bg-brand-500 transition-colors"><CheckCircle2 className="w-5 h-5 text-brand-600 group-hover:text-white"/></div><span className="text-[11px] font-black uppercase text-slate-500 tracking-widest">Administración Oral</span></div>
                              <div className="flex items-center gap-4 group cursor-help"><div className="p-2 bg-brand-100 rounded-lg group-hover:bg-brand-500 transition-colors"><CheckCircle2 className="w-5 h-5 text-brand-600 group-hover:text-white"/></div><span className="text-[11px] font-black uppercase text-slate-500 tracking-widest">Absorción Rápida</span></div>
                           </div>
                        </div>
                     </div>
                   )}
                </div>

                <div className="pt-12 mt-auto border-t border-slate-50 flex gap-8">
                   <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="flex-1 py-7 bg-slate-900 text-white rounded-[3rem] font-black uppercase text-[12px] tracking-[0.3em] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex items-center justify-center gap-6 hover:scale-[1.02] active:scale-95 transition-all">
                     <ShoppingCart className="w-7 h-7" /> Añadir al Pedido
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* FOOTER PREMIUM */}
      <footer className="mt-24 py-32 bg-slate-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-10 relative z-10">
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-20 mb-32">
              <div className="lg:col-span-1 space-y-12">
                 <div className="flex items-center gap-4 group cursor-pointer">
                    <div className="p-5 rounded-[1.8rem] shadow-2xl transition-all group-hover:rotate-12" style={{backgroundColor: colorP}}><bizMeta.icon className="w-10 h-10 text-white" /></div>
                    <span className="font-black text-4xl tracking-tighter uppercase group-hover:text-brand-400 transition-colors">{config.nombreComercial || config.code}</span>
                 </div>
                 <p className="text-base text-slate-400 font-medium leading-relaxed italic opacity-80 border-l-[3px] border-white/10 pl-8">"{config.footer_description || 'Compromiso profesional, ética médica y excelencia logística para el cuidado de lo que más importa: tu salud.'}"</p>
                 <div className="flex gap-6">
                    <button className="p-5 bg-white/5 rounded-2xl hover:bg-brand-500 hover:text-white transition-all shadow-xl"><Facebook className="w-6 h-6"/></button>
                    <button className="p-5 bg-white/5 rounded-2xl hover:bg-brand-500 hover:text-white transition-all shadow-xl"><Instagram className="w-6 h-6"/></button>
                 </div>
              </div>
           </div>
           <div className="pt-16 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-10">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.4em]">&copy; 2025 LEMON BI ANALYTICS • POWERED BY GAORSYSTEM</p>
              <div className="flex items-center gap-12 text-[11px] font-black text-slate-600 uppercase tracking-[0.2em]">
                 <a href="#" className="hover:text-brand-400 transition-colors">Normativa Sanitaria</a>
                 <a href="#" className="hover:text-brand-400 transition-colors">Privacidad de Datos</a>
                 <a href="#" className="hover:text-brand-400 transition-colors">Soporte Médico</a>
              </div>
           </div>
        </div>
        {/* Dynamic decorative BG */}
        <div className="absolute top-0 right-0 w-[50%] h-full bg-brand-500/[0.03] -skew-x-[30deg] translate-x-1/2"></div>
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-brand-500/[0.02] rounded-full blur-[120px]"></div>
      </footer>
    </div>
  );
};

export default StoreView;
