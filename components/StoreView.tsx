
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, Facebook, Instagram, Pill, Beaker, CheckCircle2, 
  Loader2, Sparkles, RefreshCw, Trash2, Smartphone, 
  Layers, Tag, SearchX, Briefcase, PawPrint, Footprints, ChevronRight,
  Upload, Camera, Image as ImageIcon,
  Building2, QrCode, AlertCircle, ShieldCheck, CreditCard, Clock, ChevronLeft,
  Citrus
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<StoreStep>('cart');
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'efectivo'>('yape');
  const [deliveryType, setDeliveryType] = useState<'recojo' | 'delivery'>('recojo');
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '', sedeId: '' });
  const [voucherImage, setVoucherImage] = useState<string | null>(null);
  const [isOrderLoading, setIsOrderLoading] = useState(false);

  const brandColor = config?.colorPrimario || '#84cc16'; 
  const slideImages = config.slide_images || [];

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.producto.precio * item.cantidad, 0);
  }, [cart]);

  // Auto-play slider
  useEffect(() => {
    if (slideImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slideImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slideImages]);

  const addToCart = (producto: Producto) => {
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
        } catch (e) {
          console.warn(`Fallback: Falló intento con campos: ${fields.length}`);
        }
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
    } finally { 
      setLoading(false); 
    }
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
       return !isHidden && !isCatHidden && matchesSearch;
    });
  }, [productos, searchTerm, config]);

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
          partner_id: partnerId, company_id: session.companyId, order_line: orderLines, origin: `TIENDA WEB: ${orderRef}`, state: 'draft' 
      });

      await supabase.from('pedidos_tienda').insert([{
        order_name: orderRef, cliente_nombre: clientData.nombre, monto: cartTotal, voucher_url: voucherImage || '', empresa_code: config.code, estado: 'pendiente'
      }]);

      const message = `*NUEVO PEDIDO - ${config.nombreComercial || config.code}*\n` +
        `*Referencia:* ${orderRef}\n*Cliente:* ${clientData.nombre}\n*Total:* S/ ${cartTotal.toFixed(2)}\n*Pago:* ${paymentMethod.toUpperCase()}`;

      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank');
      setCurrentStep('success');
    } catch (err) { alert("Error al procesar pedido."); }
    finally { setIsOrderLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col relative overflow-x-hidden selection:bg-brand-100 selection:text-brand-900">
      
      {/* HEADER */}
      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
           <div className="flex items-center gap-3">
             {onBack && <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-900 transition-all"><ArrowLeft/></button>}
             {config.logoUrl ? (
               <img src={config.logoUrl} className="h-8 md:h-10 object-contain" alt="Logo" />
             ) : (
               <h1 className="font-black text-slate-900 uppercase text-[12px] md:text-sm tracking-tighter">{config.nombreComercial || config.code}</h1>
             )}
           </div>
           
           <div className="flex-1 max-w-sm hidden sm:block">
              <div className="relative group">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-500 transition-colors"/>
                 <input type="text" placeholder="¿Qué estás buscando hoy?" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl text-xs font-bold outline-none border border-slate-100 focus:bg-white focus:border-brand-200 transition-all shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
           </div>

           <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-3.5 bg-slate-900 text-white rounded-2xl shadow-xl transition-all active:scale-90 hover:shadow-slate-300">
             <ShoppingCart className="w-5 h-5" />
             {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-brand-500 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black border-2 border-white animate-bounce shadow-sm">{cart.length}</span>}
           </button>
        </div>
      </header>

      {/* HERO SLIDER (CABECERA) */}
      {!loading && slideImages.length > 0 && !searchTerm && (
        <section className="w-full h-[250px] md:h-[450px] relative overflow-hidden bg-slate-100 animate-in fade-in duration-1000">
           {slideImages.map((img, idx) => (
             <div 
               key={idx} 
               className={`absolute inset-0 transition-all duration-1000 ease-in-out transform ${idx === currentSlide ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-12 scale-105 pointer-events-none'}`}
             >
                <img src={img} className="w-full h-full object-cover" alt={`Promo ${idx}`} />
                <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent"></div>
             </div>
           ))}
           
           {slideImages.length > 1 && (
             <>
               <button onClick={() => setCurrentSlide(prev => (prev - 1 + slideImages.length) % slideImages.length)} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/30 transition-all z-20"><ChevronLeft/></button>
               <button onClick={() => setCurrentSlide(prev => (prev + 1) % slideImages.length)} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/30 transition-all z-20"><ChevronRight/></button>
               
               <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                  {slideImages.map((_, i) => (
                    <button key={i} onClick={() => setCurrentSlide(i)} className={`h-1.5 transition-all rounded-full ${i === currentSlide ? 'w-8 bg-white' : 'w-2 bg-white/40'}`}></button>
                  ))}
               </div>
             </>
           )}
        </section>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 md:p-12 max-w-7xl mx-auto w-full min-h-[50vh]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
             <div className="relative">
                <Loader2 className="w-12 h-12 animate-spin text-brand-500" />
                <div className="absolute inset-0 blur-xl bg-brand-500/20 rounded-full animate-pulse"></div>
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Sincronizando con Odoo...</p>
          </div>
        ) : errorMsg ? (
          <div className="py-40 text-center flex flex-col items-center gap-6 max-w-md mx-auto">
             <AlertCircle className="w-16 h-16 text-red-300" />
             <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{errorMsg}</p>
             <button onClick={fetchProducts} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all hover:scale-105 shadow-xl"><RefreshCw className="w-4 h-4"/> Reintentar Conexión</button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-40 text-center flex flex-col items-center gap-6 opacity-40">
             <SearchX className="w-20 h-20 text-slate-200" />
             <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">No hay productos en esta vista</p>
          </div>
        ) : (
          <>
            <div className="mb-10 flex items-center justify-between">
               <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Catálogo {searchTerm ? `(${filteredProducts.length})` : ''}</h2>
                  <div className="w-12 h-1.5 bg-brand-500 rounded-full mt-1"></div>
               </div>
               <div className="hidden md:flex gap-4">
                  <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                     <ShieldCheck className="w-4 h-4 text-brand-600"/>
                     <span className="text-[9px] font-black uppercase tracking-widest">Pago Seguro</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                     <Clock className="w-4 h-4 text-brand-600"/>
                     <span className="text-[9px] font-black uppercase tracking-widest">Entrega Veloz</span>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
              {filteredProducts.map(p => (
                <div key={p.id} className="bg-white p-3 md:p-5 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 relative overflow-hidden">
                  <div className="aspect-square bg-slate-50 rounded-[2rem] mb-4 flex items-center justify-center relative overflow-hidden border border-slate-50">
                    {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-700" alt={p.nombre} /> : <Package className="w-10 h-10 text-slate-200" />}
                    {p.stock <= 0 && <span className="absolute top-3 left-3 bg-white/80 backdrop-blur-md px-3 py-1 rounded-full text-[8px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">Sin Stock</span>}
                  </div>
                  <div className="flex-1 flex flex-col">
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest truncate mb-1">{p.categoria_personalizada || p.categoria}</p>
                    <h3 className="text-[11px] md:text-[12px] font-black text-slate-800 uppercase line-clamp-2 leading-tight h-8 mb-4 tracking-tight group-hover:text-brand-600 transition-colors">{p.nombre}</h3>
                    <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-sm md:text-lg font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                      <button onClick={() => addToCart(p)} className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg hover:bg-brand-500 hover:scale-110 active:scale-95 transition-all">
                        <Plus className="w-4 h-4"/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* FOOTER PROFESIONAL ANIMADO */}
      {!loading && (
        <footer className="bg-slate-900 text-white pt-20 pb-10 px-6 md:px-12 relative overflow-hidden">
           {/* Decoración de fondo */}
           <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
           <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

           <div className="max-w-7xl mx-auto relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
                 {/* Col 1: Branding */}
                 <div className="col-span-1 md:col-span-1 space-y-6">
                    <div className="flex items-center gap-3">
                       <div className="bg-brand-500 p-2.5 rounded-2xl transform rotate-6 shadow-xl shadow-brand-500/20">
                          <Pill className="w-6 h-6 text-white" />
                       </div>
                       <h2 className="text-2xl font-black uppercase tracking-tighter">{config.nombreComercial || config.code}</h2>
                    </div>
                    <p className="text-slate-400 text-[11px] font-bold uppercase leading-relaxed tracking-wider">
                       {config.footer_description || "Comprometidos con tu bienestar, ofreciendo soluciones de salud y cuidado personal con la garantía de Lemon BI."}
                    </p>
                    <div className="flex gap-4">
                       {config.facebook_url && <a href={config.facebook_url} target="_blank" className="p-3 bg-slate-800 rounded-xl hover:bg-brand-500 hover:scale-110 transition-all text-white"><Facebook className="w-5 h-5"/></a>}
                       {config.instagram_url && <a href={config.instagram_url} target="_blank" className="p-3 bg-slate-800 rounded-xl hover:bg-pink-500 hover:scale-110 transition-all text-white"><Instagram className="w-5 h-5"/></a>}
                       {config.tiktok_url && <a href={config.tiktok_url} target="_blank" className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 hover:scale-110 transition-all text-white"><Smartphone className="w-5 h-5"/></a>}
                    </div>
                 </div>

                 {/* Col 2: Info */}
                 <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-500">Enlaces Rápidos</h3>
                    <ul className="space-y-4">
                       <li><button onClick={onBack} className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors uppercase flex items-center gap-2 group"><ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform"/> Mi Perfil</button></li>
                       <li><a href="#" className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors uppercase flex items-center gap-2 group"><ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform"/> Términos y Condiciones</a></li>
                       <li><a href="#" className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors uppercase flex items-center gap-2 group"><ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform"/> Libro de Reclamaciones</a></li>
                       <li><a href="#" className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors uppercase flex items-center gap-2 group"><ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform"/> Trabaja con nosotros</a></li>
                    </ul>
                 </div>

                 {/* Col 3: Contacto */}
                 <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-500">Atención al Cliente</h3>
                    <div className="space-y-4">
                       <div className="flex items-center gap-4 group">
                          <div className="p-3 bg-slate-800 rounded-2xl group-hover:bg-brand-500 transition-colors"><MessageCircle className="w-5 h-5 text-white"/></div>
                          <div><p className="text-[9px] font-black uppercase text-slate-500">WhatsApp</p><p className="text-xs font-black">{config.whatsappHelpNumber || config.whatsappNumbers?.split(',')[0] || 'Consultas Online'}</p></div>
                       </div>
                       <div className="flex items-center gap-4 group">
                          <div className="p-3 bg-slate-800 rounded-2xl group-hover:bg-brand-500 transition-colors"><MapPin className="w-5 h-5 text-white"/></div>
                          <div><p className="text-[9px] font-black uppercase text-slate-500">Ubicación</p><p className="text-xs font-black">Visítanos en nuestras sedes</p></div>
                       </div>
                    </div>
                 </div>

                 {/* Col 4: Trust */}
                 <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-500">Garantía de Confianza</h3>
                    <div className="bg-slate-800/50 p-6 rounded-[2.5rem] border border-white/5 space-y-4">
                       <div className="flex items-center gap-3">
                          <ShieldCheck className="w-5 h-5 text-brand-500" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Productos Originales</span>
                       </div>
                       <div className="flex items-center gap-3">
                          <CreditCard className="w-5 h-5 text-brand-500" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Pagos 100% Seguros</span>
                       </div>
                       <div className="flex items-center gap-3">
                          <Truck className="w-5 h-5 text-brand-500" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Delivery a Todo el País</span>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Bottom Footer */}
              <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                 <div className="flex items-center gap-3 opacity-30">
                    <Citrus className="w-5 h-5 text-brand-500" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Powered by Lemon BI & Gaor System</p>
                 </div>
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">&copy; 2025 {config.nombreComercial}. Todos los derechos reservados.</p>
                 <div className="flex items-center gap-6">
                    <img src="https://logodownload.org/wp-content/uploads/2014/07/visa-logo-1.png" className="h-4 opacity-30 grayscale hover:grayscale-0 transition-all cursor-pointer" alt="Visa" />
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/1280px-Mastercard-logo.svg.png" className="h-6 opacity-30 grayscale hover:grayscale-0 transition-all cursor-pointer" alt="Mastercard" />
                 </div>
              </div>
           </div>
        </footer>
      )}

      {/* DRAWER CARRITO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative bg-white w-full max-w-lg h-full shadow-2xl flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
              <div className="flex justify-between items-center mb-10">
                 <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Mi Carrito</h2>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">({cart.length}) productos seleccionados</p>
                 </div>
                 <button onClick={() => setIsCartOpen(false)} className="p-3.5 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"><X/></button>
              </div>

              {currentStep === 'cart' && (
                 <div className="space-y-4 flex-1">
                    {cart.length === 0 ? (
                       <div className="py-20 text-center opacity-20 flex flex-col items-center gap-6">
                          <ShoppingCart className="w-16 h-16"/>
                          <p className="font-black uppercase tracking-widest text-[10px]">Tu carrito está vacío</p>
                       </div>
                    ) : (
                      <>
                        <div className="space-y-4">
                          {cart.map(i => (
                             <div key={i.producto.id} className="flex gap-4 items-center bg-slate-50 p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                                <div className="w-14 h-14 bg-white rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border border-slate-50">
                                   {i.producto.imagen ? <img src={`data:image/png;base64,${i.producto.imagen}`} className="w-full h-full object-contain" alt={i.producto.nombre} /> : <Package className="w-6 h-6 text-slate-200"/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                   <p className="text-[10px] font-black uppercase truncate text-slate-800">{i.producto.nombre}</p>
                                   <p className="font-black text-xs text-brand-600 mt-0.5">S/ {i.producto.precio.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-inner border border-slate-100">
                                   <button onClick={() => updateCartQuantity(i.producto.id, -1)} className="p-1.5 hover:bg-slate-50 rounded-lg"><Minus className="w-3.5 h-3.5"/></button>
                                   <span className="text-xs font-black w-5 text-center">{i.cantidad}</span>
                                   <button onClick={() => updateCartQuantity(i.producto.id, 1)} className="p-1.5 hover:bg-slate-50 rounded-lg"><Plus className="w-3.5 h-3.5"/></button>
                                </div>
                             </div>
                          ))}
                        </div>
                        <div className="mt-auto pt-8 space-y-4">
                           <div className="flex justify-between items-center px-4">
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total estimado</span>
                              <span className="text-3xl font-black text-slate-900 tracking-tighter">S/ {cartTotal.toFixed(2)}</span>
                           </div>
                           <button onClick={() => setCurrentStep('details')} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-brand-500 transition-all shadow-xl">Continuar Pedido</button>
                        </div>
                      </>
                    )}
                 </div>
              )}

              {currentStep === 'details' && (
                 <div className="space-y-6 animate-in slide-in-from-bottom-4">
                    <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Información de Envío</h2>
                    <input type="text" placeholder="Tu Nombre Completo" className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-bold shadow-inner text-sm" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                    <input type="tel" placeholder="Número de WhatsApp" className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-bold shadow-inner text-sm" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                    <div className="grid grid-cols-2 gap-3">
                       <button onClick={() => setDeliveryType('recojo')} className={`p-5 rounded-2xl border-2 font-black uppercase text-[10px] transition-all ${deliveryType === 'recojo' ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Recojo Sede</button>
                       <button onClick={() => setDeliveryType('delivery')} className={`p-5 rounded-2xl border-2 font-black uppercase text-[10px] transition-all ${deliveryType === 'delivery' ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Delivery</button>
                    </div>
                    {deliveryType === 'delivery' && (
                       <textarea placeholder="Dirección exacta para la entrega..." className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-bold h-32 shadow-inner text-sm" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                    )}
                    <div className="flex gap-4">
                       <button onClick={() => setCurrentStep('cart')} className="flex-1 py-5 bg-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest">Atrás</button>
                       <button onClick={() => setCurrentStep('payment')} disabled={!clientData.nombre || !clientData.telefono} className="flex-[2.5] py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest disabled:opacity-50 shadow-xl">Siguiente</button>
                    </div>
                 </div>
              )}

              {currentStep === 'payment' && (
                 <div className="space-y-6 animate-in slide-in-from-bottom-4 text-center">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter">S/ {cartTotal.toFixed(2)}</h2>
                    <div className="flex gap-3">
                       <button onClick={() => setPaymentMethod('yape')} className={`flex-1 p-5 rounded-2xl border-2 font-black uppercase text-[10px] transition-all ${paymentMethod === 'yape' ? 'border-purple-600 bg-purple-50 text-purple-600' : 'bg-slate-50 border-slate-100'}`}>Yape</button>
                       <button onClick={() => setPaymentMethod('plin')} className={`flex-1 p-5 rounded-2xl border-2 font-black uppercase text-[10px] transition-all ${paymentMethod === 'plin' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'bg-slate-50 border-slate-100'}`}>Plin</button>
                    </div>
                    <div className="aspect-square bg-slate-900 rounded-[3rem] flex items-center justify-center p-12 shadow-2xl relative group overflow-hidden">
                       {paymentMethod === 'yape' ? (
                          config.yapeQR ? <img src={config.yapeQR.startsWith('data:') ? config.yapeQR : `data:image/png;base64,${config.yapeQR}`} className="max-w-full max-h-full rounded-2xl" alt="Yape QR" /> : <QrCode className="text-white w-24 h-24 opacity-20"/>
                       ) : (
                          config.plinQR ? <img src={config.plinQR.startsWith('data:') ? config.plinQR : `data:image/png;base64,${config.plinQR}`} className="max-w-full max-h-full rounded-2xl" alt="Plin QR" /> : <QrCode className="text-white w-24 h-24 opacity-20"/>
                       )}
                    </div>
                    <div className="space-y-1">
                       <p className="text-2xl font-black text-slate-900 tracking-widest">{paymentMethod === 'yape' ? (config.yapeNumber || '975615244') : (config.plinNumber || '975615244')}</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{paymentMethod === 'yape' ? (config.yapeName || 'LEMON BI') : (config.plinName || 'LEMON BI')}</p>
                    </div>
                    <div className="flex gap-4 pt-4">
                       <button onClick={() => setCurrentStep('details')} className="flex-1 py-5 bg-slate-100 rounded-2xl font-black uppercase text-[10px]">Atrás</button>
                       <button onClick={() => setCurrentStep('voucher')} className="flex-[2.5] py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Ya pagué, subir voucher</button>
                    </div>
                 </div>
              )}

              {currentStep === 'voucher' && (
                 <div className="space-y-6 animate-in slide-in-from-bottom-4">
                    <h2 className="text-lg font-black uppercase text-center text-slate-900">Adjuntar Comprobante</h2>
                    <div className="border-4 border-dashed rounded-[3rem] aspect-[3/4] flex flex-col items-center justify-center p-4 bg-slate-50 relative overflow-hidden group hover:border-brand-500 transition-all shadow-inner">
                       {voucherImage ? (
                          <>
                             <img src={voucherImage} className="w-full h-full object-cover" alt="Voucher" />
                             <button onClick={() => setVoucherImage(null)} className="absolute top-6 right-6 bg-red-500 text-white p-4 rounded-2xl shadow-2xl hover:scale-110 active:scale-95 transition-all"><Trash2 className="w-6 h-6"/></button>
                          </>
                       ) : (
                          <label className="cursor-pointer flex flex-col items-center text-slate-300 group-hover:text-brand-500 transition-colors">
                             <Camera className="w-20 h-20 mb-4 animate-bounce"/>
                             <p className="text-[10px] font-black uppercase tracking-widest">Toca para Seleccionar Imagen</p>
                             <input type="file" className="hidden" accept="image/*" onChange={handleVoucherUpload} />
                          </label>
                       )}
                    </div>
                    <div className="flex gap-4">
                       <button onClick={() => setCurrentStep('payment')} className="flex-1 py-6 bg-slate-100 rounded-[2rem] font-black uppercase text-[10px]">Atrás</button>
                       <button onClick={handleFinishOrder} disabled={!voucherImage || isOrderLoading} className="flex-[2.5] py-6 bg-brand-500 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-brand-200">
                          {isOrderLoading ? <Loader2 className="animate-spin w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>} FINALIZAR PEDIDO
                       </button>
                    </div>
                 </div>
              )}

              {currentStep === 'success' && (
                 <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 p-6">
                    <div className="w-32 h-32 bg-brand-500 text-white rounded-full flex items-center justify-center shadow-[0_25px_60px_-15px_rgba(132,204,22,0.5)] animate-in zoom-in duration-700"><CheckCircle2 className="w-16 h-16"/></div>
                    <div className="space-y-4">
                       <h3 className="text-4xl font-black uppercase tracking-tighter text-slate-900">¡TODO LISTO!</h3>
                       <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Tu orden ha sido registrada en nuestro sistema Odoo. En breve nos comunicaremos contigo vía WhatsApp para confirmar el despacho.</p>
                    </div>
                    <button onClick={() => { setIsCartOpen(false); setCart([]); setCurrentStep('cart'); setVoucherImage(null); }} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl hover:bg-slate-800 transition-all">Regresar a la Tienda</button>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default StoreView;
