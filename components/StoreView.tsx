
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, Facebook, Instagram, Pill, Beaker, CheckCircle2, 
  Loader2, Sparkles, RefreshCw, Trash2, Smartphone, 
  Layers, Tag, SearchX, Briefcase, PawPrint, Footprints, ChevronRight,
  Upload, Camera, Image as ImageIcon,
  Building2, QrCode, AlertCircle
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
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<StoreStep>('cart');
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'efectivo'>('yape');
  const [deliveryType, setDeliveryType] = useState<'recojo' | 'delivery'>('recojo');
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '', sedeId: '' });
  const [voucherImage, setVoucherImage] = useState<string | null>(null);
  const [isOrderLoading, setIsOrderLoading] = useState(false);

  const brandColor = config?.colorPrimario || '#84cc16'; 
  const colorA = config?.colorAcento || '#0ea5e9';
  const bizType = config?.businessType || 'pharmacy';

  const slides = useMemo(() => {
    if (config.slide_images && config.slide_images.some(img => img)) {
      return config.slide_images.filter(img => img).map((url) => ({ image: url }));
    }
    return [
      { title: "Calidad Garantizada", desc: "Tus productos de confianza ahora online.", badge: "OFICIAL", bg: `linear-gradient(135deg, ${brandColor}, ${colorA})` },
      { title: "Atención Especializada", desc: "Expertos cuidando de tu bienestar.", badge: "CONFIANZA", bg: `linear-gradient(135deg, ${colorA}, ${brandColor})` }
    ];
  }, [config.slide_images, brandColor, colorA]);

  useEffect(() => {
    const timer = setInterval(() => { setActiveSlide(s => (s + 1) % slides.length); }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    const client = new OdooClient(session.url, session.db, session.useProxy);
    try {
      const extrasMap = await getProductExtras(config.code);
      const fields = ['display_name', 'list_price', 'categ_id', 'image_1920', 'image_512', 'description_sale', 'qty_available'];
      const domain: any[] = [['sale_ok', '=', true], ['active', '=', true]];
      
      let data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, fields, { limit: 1000 });
      
      if (data) {
        setProductos(data.map((p: any) => {
          const extra = extrasMap[p.id];
          return {
            id: p.id,
            nombre: p.display_name,
            precio: p.list_price || 0,
            categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
            stock: p.qty_available || 0,
            imagen: p.image_512 || p.image_1920 || p.image_128,
            descripcion_venta: extra?.descripcion_lemon || p.description_sale || '',
            uso_sugerido: extra?.instrucciones_lemon || '',
            categoria_personalizada: extra?.categoria_personalizada || '',
            marca: 'Genérico',
            registro_sanitario: 'Validado'
          };
        }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, [session, config.code]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    productos.forEach(p => {
        if (p.categoria_personalizada) cats.add(p.categoria_personalizada);
        else if (p.categoria) cats.add(p.categoria);
    });
    const hidden = config.hiddenCategories || [];
    return ['Todas', ...Array.from(cats).filter(c => !hidden.includes(c))].sort();
  }, [productos, config.hiddenCategories]);

  const filteredProducts = useMemo(() => {
    const hiddenIds = config.hiddenProducts || [];
    const hiddenCats = config.hiddenCategories || [];
    return productos.filter(p => {
        const prodCat = p.categoria_personalizada || p.categoria || 'General';
        const matchesSearch = searchTerm === '' || p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCat = selectedCategory === 'Todas' || prodCat === selectedCategory;
        return !hiddenIds.includes(p.id) && !hiddenCats.includes(prodCat) && matchesSearch && matchesCat;
    });
  }, [productos, searchTerm, selectedCategory, config.hiddenProducts, config.hiddenCategories]);

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

  const handleVoucherUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setVoucherImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const updateCartQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => item.producto.id === id ? { ...item, cantidad: Math.max(0, item.cantidad + delta) } : item).filter(item => item.cantidad > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);

  const handleFinishOrder = async () => {
    if (isOrderLoading) return;
    setIsOrderLoading(true);

    try {
      const waNumber = config.whatsappNumbers?.split(',')[0].trim() || '51975615244';
      const sedeName = (config.sedes_recojo || []).find(s => s.id === clientData.sedeId)?.nombre || 'Principal';
      const orderRef = `WEB-${Date.now().toString().slice(-6)}`;

      // 1. CREAR PEDIDO EN ODOO (Ventas -> sale.order)
      try {
        const client = new OdooClient(session.url, session.db, session.useProxy);
        
        // Buscar o crear cliente en Odoo
        const partnerSearch = await client.searchRead(session.uid, session.apiKey, 'res.partner', [['name', '=', clientData.nombre]], ['id'], { limit: 1 });
        let partnerId = partnerSearch.length > 0 ? partnerSearch[0].id : null;
        
        if (!partnerId) {
            partnerId = await client.create(session.uid, session.apiKey, 'res.partner', {
                name: clientData.nombre,
                phone: clientData.telefono,
                street: clientData.direccion || 'Pedido Web',
                company_id: session.companyId,
                customer_rank: 1
            });
        }

        // Líneas del pedido
        const orderLines = cart.map(item => [0, 0, {
            product_id: item.producto.id,
            product_uom_qty: item.cantidad,
            price_unit: item.producto.precio,
            name: item.producto.nombre
        }]);

        // Crear la venta como Presupuesto (Draft)
        await client.create(session.uid, session.apiKey, 'sale.order', {
            partner_id: partnerId,
            company_id: session.companyId,
            order_line: orderLines,
            origin: `CATALOGO WEB: ${orderRef}`,
            note: `Pedido desde la web. Pago: ${paymentMethod.toUpperCase()}. Cliente: ${clientData.nombre}. Voucher adjunto en Lemon BI.`,
            state: 'draft' 
        });
      } catch (e) { 
          console.error("No se pudo sincronizar con Odoo directamente:", e);
      }

      // 2. Registrar en Supabase (Respaldo Crítico)
      await supabase.from('pedidos_tienda').insert([{
        order_name: orderRef,
        cliente_nombre: clientData.nombre,
        monto: cartTotal,
        voucher_url: voucherImage || '',
        empresa_code: config.code,
        estado: 'pendiente'
      }]);

      // 3. WhatsApp (Notificación Inmediata)
      const message = `*NUEVO PEDIDO - ${config.nombreComercial || config.code}*\n` +
        `*Referencia:* ${orderRef}\n\n` +
        `*Cliente:* ${clientData.nombre}\n` +
        `*Teléfono:* ${clientData.telefono}\n` +
        `*Tipo:* ${deliveryType === 'recojo' ? 'Recojo (' + sedeName + ')' : 'Delivery'}\n` +
        `*Pago:* ${paymentMethod.toUpperCase()}\n\n` +
        `*PRODUCTOS:*\n` +
        cart.map(i => `• ${i.cantidad}x ${i.producto.nombre} - S/ ${(i.producto.precio * i.cantidad).toFixed(2)}`).join('\n') +
        `\n\n*TOTAL: S/ ${cartTotal.toFixed(2)}*` +
        `\n\n_El comprobante de pago fue adjuntado en la plataforma._`;

      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank');
      setCurrentStep('success');
    } catch (err) {
      alert("Hubo un error al procesar el pedido. Por favor intente de nuevo.");
    } finally {
      setIsOrderLoading(false);
    }
  };

  const bizIcons = {
    pharmacy: { main: Pill, label: 'Farmacia' },
    veterinary: { main: PawPrint, label: 'Veterinaria' },
    podiatry: { main: Footprints, label: 'Podología' },
    general: { main: Briefcase, label: 'Comercio' }
  }[bizType];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col relative overflow-x-hidden">
      
      {/* HEADER */}
      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><ArrowLeft className="w-5 h-5"/></button>}
            {config.logoUrl ? <img src={config.logoUrl} className="h-8 md:h-12 w-auto object-contain" /> : <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg" style={{backgroundColor: brandColor}}><bizIcons.main className="w-5 h-5" /></div>}
            <div className="hidden sm:block">
               <h1 className="font-black text-slate-900 uppercase text-[12px] md:text-[14px] leading-none tracking-tighter">{config.nombreComercial || config.code}</h1>
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Tienda Oficial</p>
            </div>
          </div>
          <div className="flex-1 max-w-lg">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
              <input type="text" placeholder="Buscar productos..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-[12px] font-bold outline-none focus:bg-white transition-all shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-3 bg-slate-900 text-white rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95">
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 text-white text-[9px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white" style={{backgroundColor: colorA}}>{cart.length}</span>}
          </button>
        </div>
      </header>

      {/* CAROUSEL */}
      <div className="px-4 md:px-6 pt-4">
        <div className="max-w-7xl mx-auto overflow-hidden rounded-[2rem] md:rounded-[3rem] shadow-xl relative h-[180px] md:h-[400px]">
          {slides.map((slide: any, idx) => (
            <div key={idx} className={`absolute inset-0 transition-all duration-1000 ${activeSlide === idx ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'}`}>
              {slide.image ? <img src={slide.image} className="w-full h-full object-cover" /> : (
                <div className="w-full h-full p-8 md:p-24 flex items-center" style={{ background: slide.bg }}>
                   <div className="max-w-lg text-white space-y-3 md:space-y-6">
                      <span className="text-[8px] md:text-[11px] font-black uppercase tracking-widest bg-white/20 px-4 py-1 rounded-full backdrop-blur-md">{slide.badge}</span>
                      <h2 className="text-xl md:text-5xl font-black uppercase tracking-tighter leading-none">{slide.title}</h2>
                      <p className="text-white/80 text-[10px] md:text-xl font-bold uppercase">{slide.desc}</p>
                   </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CATEGORÍAS */}
      <div className="w-full mt-6 px-4 overflow-x-auto no-scrollbar scroll-smooth">
         <div className="max-w-7xl mx-auto flex items-center gap-3 min-w-max pb-2">
            {availableCategories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`flex items-center gap-2 px-5 py-3 rounded-2xl transition-all border-2 font-black uppercase text-[9px] tracking-widest ${selectedCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-400 border-slate-50 hover:border-slate-200'}`}>
                {cat === 'Todas' ? <Layers className="w-4 h-4"/> : <Tag className="w-4 h-4"/>} {cat}
              </button>
            ))}
         </div>
      </div>

      {/* PRODUCT GRID */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
             <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vínculando con inventario de Odoo...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center gap-6 opacity-40">
             <SearchX className="w-16 h-16 text-slate-200" />
             <p className="text-sm font-black uppercase tracking-widest text-slate-400">No encontramos resultados</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => setSelectedProduct(p)} className="group bg-white rounded-[2rem] p-3 md:p-5 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col relative overflow-hidden">
                <div className="aspect-square bg-slate-50 rounded-[1.5rem] mb-3 md:mb-5 overflow-hidden flex items-center justify-center relative border border-slate-50">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500" /> : <Package className="w-10 h-10 text-slate-200"/>}
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest mb-2 px-3 py-1 bg-slate-50 rounded-lg w-fit text-slate-400 truncate max-w-full">{p.categoria_personalizada || p.categoria}</span>
                  <h3 className="text-[10px] md:text-[11px] font-black text-slate-800 line-clamp-2 uppercase h-8 mb-3 leading-tight tracking-tight">{p.nombre}</h3>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-auto">
                    <span className="text-xs md:text-lg font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    <button onClick={(e) => addToCart(p, e)} className="p-2.5 md:p-3.5 bg-slate-900 text-white rounded-xl shadow-md hover:scale-110 active:scale-95 transition-all"><Plus className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* DRAWER DEL CARRITO / CHECKOUT */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative bg-white w-full max-w-lg h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              
              <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                 <div><h3 className="text-lg font-black uppercase tracking-tighter">Mi Carrito</h3><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{cart.length} productos seleccionados</p></div>
                 <button onClick={() => setIsCartOpen(false)} className="p-3 bg-white border rounded-xl hover:bg-red-50 transition-colors group"><X className="w-5 h-5 group-hover:text-red-500"/></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {currentStep === 'cart' && (
                    <div className="space-y-4">
                       {cart.length === 0 ? (
                          <div className="py-20 text-center opacity-30 flex flex-col items-center gap-6"><ShoppingCart className="w-16 h-16"/><p className="font-black uppercase tracking-widest">El carrito está vacío</p></div>
                       ) : cart.map(item => (
                          <div key={item.producto.id} className="flex gap-4 p-4 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm hover:border-brand-200 transition-colors">
                             <div className="w-16 h-16 bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center border border-slate-50 shrink-0">
                                {item.producto.imagen ? <img src={`data:image/png;base64,${item.producto.imagen}`} className="w-full h-full object-contain" /> : <Package className="w-8 h-8 text-slate-200"/>}
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase truncate">{item.producto.nombre}</p>
                                <p className="text-sm font-black mt-1">S/ {item.producto.precio.toFixed(2)}</p>
                                <div className="flex items-center gap-4 mt-3">
                                   <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
                                      <button onClick={() => updateCartQuantity(item.producto.id, -1)} className="p-1 text-slate-500"><Minus className="w-3.5 h-3.5"/></button>
                                      <span className="text-xs font-black w-6 text-center">{item.cantidad}</span>
                                      <button onClick={() => updateCartQuantity(item.producto.id, 1)} className="p-1 text-slate-500"><Plus className="w-3.5 h-3.5"/></button>
                                   </div>
                                   <button onClick={() => updateCartQuantity(item.producto.id, -item.cantidad)} className="text-[9px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/> Quitar</button>
                                </div>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}

                 {currentStep === 'details' && (
                    <div className="space-y-6">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre Completo</label>
                          <input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:bg-white" placeholder="¿A nombre de quién?" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                       </div>
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">WhatsApp de contacto</label>
                          <input type="tel" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:bg-white" placeholder="Ej: 987654321" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                       </div>
                       <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Método de Entrega</label>
                          <div className="grid grid-cols-2 gap-3">
                             <button onClick={() => setDeliveryType('recojo')} className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${deliveryType === 'recojo' ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}><Building2 className="w-5 h-5"/> <span className="text-[10px] font-black uppercase">Recojo</span></button>
                             <button onClick={() => setDeliveryType('delivery')} className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${deliveryType === 'delivery' ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}><Truck className="w-5 h-5"/> <span className="text-[10px] font-black uppercase">Delivery</span></button>
                          </div>
                       </div>
                       {deliveryType === 'recojo' ? (
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Seleccionar Sede para Recojo</label>
                             <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none uppercase text-xs cursor-pointer shadow-inner" value={clientData.sedeId} onChange={e => setClientData({...clientData, sedeId: e.target.value})}>
                                <option value="">Sede Principal / Caja</option>
                                {(config.sedes_recojo || []).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                             </select>
                          </div>
                       ) : (
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Dirección de Entrega</label>
                             <textarea className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none h-24 shadow-inner" placeholder="Ej: Av. Las Flores 123, Departamento 401..." value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                          </div>
                       )}
                    </div>
                 )}

                 {currentStep === 'payment' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                       <div className="text-center space-y-2">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Monto Final</h4>
                          <p className="text-5xl font-black text-slate-900 tracking-tighter">S/ {cartTotal.toFixed(2)}</p>
                       </div>
                       <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Escoge cómo pagar</label>
                          <div className="grid grid-cols-2 gap-3">
                             <button onClick={() => setPaymentMethod('yape')} className={`p-6 rounded-[2.5rem] border-2 flex flex-col items-center gap-3 transition-all ${paymentMethod === 'yape' ? 'border-[#742284] bg-[#742284]/10 shadow-lg' : 'border-slate-50 bg-slate-50 opacity-60'}`}><div className="w-10 h-10 bg-[#742284] rounded-xl flex items-center justify-center text-white font-black">Y</div> <span className="text-[10px] font-black uppercase">Yape</span></button>
                             <button onClick={() => setPaymentMethod('plin')} className={`p-6 rounded-[2.5rem] border-2 flex flex-col items-center gap-3 transition-all ${paymentMethod === 'plin' ? 'border-[#00A9E0] bg-[#00A9E0]/10 shadow-lg' : 'border-slate-50 bg-slate-50 opacity-60'}`}><div className="w-10 h-10 bg-[#00A9E0] rounded-xl flex items-center justify-center text-white font-black">P</div> <span className="text-[10px] font-black uppercase">Plin</span></button>
                          </div>
                       </div>
                       
                       <div className="p-8 bg-slate-900 rounded-[3rem] text-white space-y-8 text-center shadow-2xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
                          
                          <div className="space-y-6 relative z-10">
                             <div className="flex flex-col items-center gap-2">
                                <QrCode className="w-8 h-8 text-brand-400 mb-1" />
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 italic">Realiza el pago antes de continuar</p>
                             </div>
                             
                             {(paymentMethod === 'yape' ? config.yapeQR : config.plinQR) ? (
                                <div className="w-64 h-64 mx-auto bg-white p-4 rounded-[2.5rem] shadow-2xl flex items-center justify-center transition-transform hover:scale-105">
                                   <img src={paymentMethod === 'yape' ? config.yapeQR : config.plinQR} className="max-w-full max-h-full object-contain rounded-2xl" />
                                </div>
                             ) : (
                                <div className="py-12 bg-white/5 rounded-[2.5rem] border border-white/10 flex flex-col items-center gap-4">
                                   <Smartphone className="w-12 h-12 text-brand-400" />
                                   <p className="text-[10px] font-black uppercase tracking-widest px-8">Escanea el código QR del comercio físico o paga al número:</p>
                                </div>
                             )}
                             
                             <div className="space-y-1">
                                <p className="text-3xl font-black tracking-widest text-brand-400">{paymentMethod === 'yape' ? (config.yapeNumber || '975615244') : (config.plinNumber || '975615244')}</p>
                                <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">{paymentMethod === 'yape' ? (config.yapeName || 'LEMON BI') : (config.plinName || 'LEMON BI')}</p>
                             </div>
                          </div>
                       </div>
                    </div>
                 )}

                 {currentStep === 'voucher' && (
                    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                        <div className="text-center space-y-3">
                           <div className="w-20 h-20 bg-brand-50 rounded-[2rem] flex items-center justify-center mx-auto text-brand-600 border border-brand-100 shadow-sm"><ImageIcon className="w-10 h-10"/></div>
                           <h3 className="text-2xl font-black uppercase tracking-tighter">Confirmar Pago</h3>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-8">Para validar tu orden es obligatorio subir una captura del comprobante.</p>
                        </div>

                        <div className="relative">
                           {voucherImage ? (
                              <div className="relative group rounded-[3rem] overflow-hidden border-8 border-slate-50 shadow-2xl aspect-[3/4]">
                                 <img src={voucherImage} className="w-full h-full object-cover" />
                                 <button onClick={() => setVoucherImage(null)} className="absolute top-6 right-6 bg-white/90 backdrop-blur-md p-5 rounded-2xl text-red-500 shadow-2xl transition-all hover:scale-110 active:scale-95"><Trash2 className="w-6 h-6"/></button>
                              </div>
                           ) : (
                              <label className="flex flex-col items-center justify-center w-full h-96 bg-slate-50 border-4 border-dashed border-slate-200 rounded-[3.5rem] cursor-pointer hover:bg-slate-100 hover:border-brand-300 transition-all group overflow-hidden">
                                 <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center p-8">
                                    <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all mb-6 border border-slate-100"><Camera className="w-10 h-10 text-slate-300" /></div>
                                    <p className="mb-2 text-lg text-slate-700 font-black uppercase tracking-tighter">SUBIR VOUCHER</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] max-w-[200px]">Carga la foto aquí para finalizar el pedido</p>
                                 </div>
                                 <input type="file" className="hidden" accept="image/*" onChange={handleVoucherUpload} />
                              </label>
                           )}
                        </div>
                    </div>
                 )}

                 {currentStep === 'success' && (
                    <div className="py-24 text-center space-y-8 flex flex-col items-center">
                       <div className="w-32 h-32 bg-brand-500 rounded-full flex items-center justify-center text-white shadow-[0_20px_50px_rgba(132,204,22,0.3)] animate-in zoom-in duration-500"><CheckCircle2 className="w-16 h-16"/></div>
                       <div className="space-y-3">
                          <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-900">¡GRACIAS POR TU COMPRA!</h3>
                          <p className="text-sm font-bold text-slate-500 leading-relaxed uppercase tracking-widest px-10">Tu pedido ha sido recibido y estamos verificando tu pago. Te contactaremos pronto.</p>
                       </div>
                       <button onClick={() => { setCart([]); setIsCartOpen(false); setCurrentStep('cart'); setVoucherImage(null); }} className="px-14 py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-[0.2em] shadow-2xl transition-all hover:scale-105 active:scale-95">REGRESAR AL INICIO</button>
                    </div>
                 )}
              </div>

              {/* FOOTER DRAWER CON VALIDACIONES */}
              {currentStep !== 'success' && cart.length > 0 && (
                 <div className="p-6 border-t bg-white sticky bottom-0 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                    <div className="flex justify-between items-center mb-6 px-2">
                       <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Pago Total</span>
                       <span className="text-3xl font-black text-slate-900 tracking-tighter">S/ {cartTotal.toFixed(2)}</span>
                    </div>
                    {currentStep === 'cart' && (
                       <button onClick={() => setCurrentStep('details')} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl transition-all hover:scale-[1.02] active:scale-95">DETALLES DE ENVÍO <ChevronRight className="w-5 h-5"/></button>
                    )}
                    {currentStep === 'details' && (
                       <div className="flex gap-4">
                          <button onClick={() => setCurrentStep('cart')} className="flex-1 py-6 bg-slate-100 text-slate-500 rounded-[2rem] font-black uppercase text-[11px] transition-colors hover:bg-slate-200">ATRÁS</button>
                          <button onClick={() => setCurrentStep('payment')} disabled={!clientData.nombre || !clientData.telefono} className="flex-[2.5] py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl disabled:opacity-50 transition-all active:scale-95">IR A PAGAR</button>
                       </div>
                    )}
                    {currentStep === 'payment' && (
                       <div className="flex gap-4">
                          <button onClick={() => setCurrentStep('details')} className="flex-1 py-6 bg-slate-100 text-slate-500 rounded-[2rem] font-black uppercase text-[11px]">ATRÁS</button>
                          <button onClick={() => setCurrentStep('voucher')} className="flex-[2.5] py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl transition-all active:scale-95">CARGAR VOUCHER</button>
                       </div>
                    )}
                    {currentStep === 'voucher' && (
                       <div className="flex gap-4">
                          <button onClick={() => setCurrentStep('payment')} className="flex-1 py-6 bg-slate-100 text-slate-500 rounded-[2rem] font-black uppercase text-[11px]">ATRÁS</button>
                          <button onClick={handleFinishOrder} disabled={isOrderLoading || !voucherImage} className="flex-[2.5] py-6 bg-brand-500 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] shadow-[0_15px_40px_rgba(132,204,22,0.4)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale transition-all active:scale-95">
                             {isOrderLoading ? <Loader2 className="w-6 h-6 animate-spin"/> : <CheckCircle2 className="w-6 h-6"/>} COMPLETAR PEDIDO
                          </button>
                       </div>
                    )}
                 </div>
              )}
           </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-auto py-20 px-8 text-center" style={{backgroundColor: brandColor}}>
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-10 text-white relative z-10">
           {config.footerLogoUrl ? <img src={config.footerLogoUrl} className="h-20 object-contain" /> : <div className="flex items-center gap-4 bg-white/10 p-5 rounded-[2.5rem] backdrop-blur-md"><bizIcons.main className="w-10 h-10 text-white" /><span className="font-black text-3xl tracking-tighter uppercase">{config.nombreComercial || config.code}</span></div>}
           <p className="text-[12px] font-bold italic opacity-90 uppercase tracking-[0.2em] max-w-2xl leading-relaxed">"{config.footer_description || 'Siempre a tu disposición con la mejor calidad en salud.'}"</p>
           <div className="flex gap-6">
               {config.facebook_url && <a href={config.facebook_url} target="_blank" rel="noreferrer" className="p-5 bg-white/10 rounded-full text-white hover:bg-white hover:text-slate-900 transition-all"><Facebook className="w-7 h-7"/></a>}
               {config.instagram_url && <a href={config.instagram_url} target="_blank" rel="noreferrer" className="p-5 bg-white/10 rounded-full text-white hover:bg-white hover:text-slate-900 transition-all"><Instagram className="w-7 h-7"/></a>}
               {config.whatsappHelpNumber && <a href={`https://wa.me/${config.whatsappHelpNumber}`} target="_blank" rel="noreferrer" className="p-5 bg-white/10 rounded-full text-white hover:bg-white hover:text-slate-900 transition-all"><MessageCircle className="w-7 h-7"/></a>}
           </div>
           <div className="opacity-40 text-[10px] font-black uppercase tracking-[0.5em] mt-8">POWERED BY LEMON BI • 2025</div>
        </div>
      </footer>
    </div>
  );
};

export default StoreView;
