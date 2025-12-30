
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, ArrowLeft, ArrowRight,
  Plus, Minus, MapPin, Truck,
  MessageCircle, CheckCircle2, 
  Loader2, QrCode, Citrus, 
  Copy, Check, Info,
  HeartHandshake, Send, ReceiptText, CreditCard,
  Smartphone, Wallet
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

type StoreStep = 'cart' | 'details' | 'payment' | 'processing' | 'success';

const StoreView: React.FC<StoreViewProps> = ({ session, config, onBack }) => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<StoreStep>('cart');
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  
  const [deliveryType, setDeliveryType] = useState<'recojo' | 'delivery'>('recojo');
  const [selectedSede, setSelectedSede] = useState<SedeStore | null>(null);
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '' });
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin'>('yape');
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [orderRef, setOrderRef] = useState('');
  const [copyStatus, setCopyStatus] = useState(false);

  const brandColor = config?.colorPrimario || '#84cc16'; 

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

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    const client = new OdooClient(session.url, session.db, session.useProxy);
    try {
      const extrasMap = await getProductExtras(config.code);
      const data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], ['display_name', 'list_price', 'categ_id', 'image_128', 'description_sale'], { limit: 1000, order: 'display_name asc' });
      
      if (data && Array.isArray(data)) {
        setProductos(data.map((p: any) => {
          const extra = extrasMap[p.id];
          return {
            id: p.id,
            nombre: p.display_name,
            precio: p.list_price || 0,
            costo: 0,
            categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
            imagen: p.image_128,
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
       const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
       const matchesCategory = selectedCategory === 'Todas' || p.categoria === selectedCategory || p.categoria_personalizada === selectedCategory;
       return !isHidden && !hiddenCats.includes(p.categoria || '') && matchesSearch && matchesCategory;
    });
  }, [productos, searchTerm, selectedCategory, config]);

  const addToCart = (producto: Producto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCart(prev => {
      const existing = prev.find(item => item.producto.id === producto.id);
      if (existing) return prev.map(item => item.producto.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      return [...prev, { producto, cantidad: 1 }];
    });
  };

  const updateCartQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => item.producto.id === id ? { ...item, cantidad: Math.max(0, item.cantidad + delta) } : item).filter(item => item.cantidad > 0));
  };

  const handleFinishOrder = async () => {
    if (isOrderLoading) return;
    setIsOrderLoading(true);
    setCurrentStep('processing');
    
    try {
      const waNumber = (config.whatsappNumbers || config.whatsappHelpNumber || '51975615244').replace(/\D/g, '');
      const ref = `WEB-${Date.now().toString().slice(-6)}`;
      setOrderRef(ref);

      const addressDetail = deliveryType === 'delivery' 
        ? clientData.direccion 
        : `RECOJO EN PUNTO: ${selectedSede?.nombre} (${selectedSede?.direccion})`;
      
      const client = new OdooClient(session.url, session.db, session.useProxy);
      await client.createSaleOrder(
        session.uid, 
        session.apiKey, 
        { 
          name: clientData.nombre.toUpperCase(), 
          phone: clientData.telefono, 
          address: addressDetail.toUpperCase(),
          paymentMethod: paymentMethod.toUpperCase()
        },
        cart.map(i => ({ productId: i.producto.id, qty: i.cantidad, price: i.producto.precio })),
        session.companyId || 1
      );

      await supabase.from('pedidos_tienda').insert([{
        order_name: ref, 
        cliente_nombre: clientData.nombre, 
        monto: cartTotal, 
        empresa_code: config.code, 
        dueno_wa: waNumber,
        estado: 'pendiente',
        metadata: {
          telefono: clientData.telefono,
          entrega: deliveryType,
          direccion: addressDetail,
          metodo_pago: paymentMethod.toUpperCase(),
          carrito: cart.map(i => `${i.cantidad}x ${i.producto.nombre}`)
        }
      }]);

      const itemsList = cart.map(i => `• ${i.cantidad}x ${i.producto.nombre} (S/ ${i.producto.precio.toFixed(2)})`).join('\n');
      const message = `*NUEVO PEDIDO WEB - REF: ${ref}*\n\n` +
                      `👤 *Cliente:* ${clientData.nombre}\n` +
                      `📞 *Teléfono:* ${clientData.telefono}\n` +
                      `📍 *Punto/Dirección:* ${addressDetail}\n` +
                      `💳 *Medio de Pago:* ${paymentMethod.toUpperCase()}\n\n` +
                      `🛒 *Productos:* \n${itemsList}\n\n` +
                      `💰 *TOTAL: S/ ${cartTotal.toFixed(2)}*\n\n` +
                      `_Hola, acabo de realizar mi pedido en su web. Adjunto aquí la captura de pantalla de mi transferencia:_`;
      
      setTimeout(() => {
        window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank');
      }, 500);

      setCurrentStep('success');
    } catch (err: any) { 
      console.error(err);
      alert("Error al sincronizar con Odoo: " + (err.message || "Fallo desconocido")); 
      setCurrentStep('payment');
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
              {onBack && <button onClick={onBack} className="p-2 text-slate-400"><ArrowLeft className="w-5 h-5"/></button>}
              {config.logoUrl ? <img src={config.logoUrl} className="h-10 object-contain" /> : <h1 className="font-black text-slate-900 uppercase text-lg">{config.nombreComercial || config.code}</h1>}
           </div>
           
           <div className="flex-1 max-w-xl hidden md:block">
              <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"/>
                 <input type="text" placeholder="¿Qué necesitas buscar?" className="w-full pl-12 pr-6 py-3 bg-slate-50 border border-slate-100 rounded-full text-xs font-bold outline-none focus:ring-4 focus:ring-brand-500/5 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
           </div>

           <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-3 bg-slate-900 text-white rounded-2xl shadow-xl transform active:scale-95 transition-transform">
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && <span className="absolute -top-2 -right-2 bg-brand-500 text-white text-[10px] w-6 h-6 rounded-full flex items-center justify-center font-black border-2 border-white">{totalItems}</span>}
           </button>
        </div>
      </header>

      <div className="h-[72px]"></div>

      {/* CATEGORÍAS */}
      {!loading && (
         <div className="bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-[72px] z-50 py-6">
            <div className="max-w-7xl mx-auto px-4 overflow-x-auto flex gap-6 no-scrollbar items-start">
               {availableCategories.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className="flex flex-col items-center gap-3 shrink-0 group transition-all">
                     <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center overflow-hidden border-4 transition-all duration-300 ${selectedCategory === cat ? 'scale-110 shadow-xl border-brand-500' : 'scale-100 grayscale-[0.5] opacity-60 border-transparent'}`}>
                        {config.category_metadata?.[cat]?.imageUrl ? (
                           <img src={config.category_metadata[cat].imageUrl} className="w-full h-full object-cover" />
                        ) : (
                           <div className="w-full h-full bg-slate-100 flex items-center justify-center"><Citrus className="w-6 h-6 text-slate-300" /></div>
                        )}
                     </div>
                     <span className={`text-[9px] font-black uppercase tracking-widest text-center max-w-[80px] leading-tight transition-colors ${selectedCategory === cat ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}`}>{cat}</span>
                  </button>
               ))}
            </div>
         </div>
      )}

      {/* PRODUCTOS */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-40">
             <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
             <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando Catálogo...</p>
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

      {/* CHECKOUT DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => !isOrderLoading && setIsCartOpen(false)}></div>
           <div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col p-8 animate-in slide-in-from-right duration-500 overflow-y-auto">
              <div className="flex justify-between items-center mb-10">
                 <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">Mi Compra</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-2">Paso {currentStep === 'cart' ? '1' : currentStep === 'details' ? '2' : '3'} de 3</p>
                 </div>
                 {!isOrderLoading && <button onClick={() => setIsCartOpen(false)} className="p-4 bg-slate-50 rounded-2xl text-slate-400"><X className="w-6 h-6"/></button>}
              </div>

              {currentStep === 'cart' && (
                 <div className="flex-1 flex flex-col">
                    <div className="flex-1 space-y-4">
                       {cart.length === 0 ? (
                          <div className="py-20 text-center opacity-20 flex flex-col items-center gap-6"><ShoppingCart className="w-20 h-20"/><p className="font-black uppercase tracking-widest text-[10px]">Tu bolsa está vacía</p></div>
                       ) : cart.map(i => (
                          <div key={i.producto.id} className="flex gap-4 items-center bg-slate-50 p-4 rounded-3xl border border-slate-100 group">
                             <div className="w-16 h-16 bg-white rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border border-slate-100">
                                {i.producto.imagen ? <img src={`data:image/png;base64,${i.producto.imagen}`} className="w-full h-full object-contain mix-blend-multiply" /> : <Package className="w-6 h-6 text-slate-100"/>}
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase truncate tracking-tight mb-1">{i.producto.nombre}</p>
                                <p className="font-black text-sm text-brand-600">S/ {i.producto.precio.toFixed(2)}</p>
                             </div>
                             <div className="flex items-center gap-3 bg-white p-2 rounded-2xl">
                                <button onClick={() => updateCartQuantity(i.producto.id, -1)} className="p-1.5 text-slate-400"><Minus className="w-4 h-4"/></button>
                                <span className="text-xs font-black w-4 text-center">{i.cantidad}</span>
                                <button onClick={() => updateCartQuantity(i.producto.id, 1)} className="p-1.5 text-slate-400"><Plus className="w-4 h-4"/></button>
                             </div>
                          </div>
                       ))}
                    </div>
                    <div className="pt-8 border-t border-slate-100 mt-8">
                       <div className="flex justify-between items-end mb-8">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Monto Final</span>
                          <span className="text-4xl font-black tracking-tighter">S/ {cartTotal.toFixed(2)}</span>
                       </div>
                       <button onClick={() => setCurrentStep('details')} disabled={cart.length === 0} className="w-full py-7 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl disabled:opacity-20 flex items-center justify-center gap-3 active:scale-95 transition-all">Siguiente <ArrowRight className="w-5 h-5"/></button>
                    </div>
                 </div>
              )}

              {currentStep === 'details' && (
                 <div className="space-y-6 flex-1 flex flex-col">
                    <div className="space-y-4">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Información del Cliente</label>
                       <input type="text" placeholder="NOMBRE Y APELLIDO COMPLETO" className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-xs font-bold uppercase outline-none focus:ring-4 focus:ring-brand-500/10 transition-all" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                       <input type="tel" placeholder="CELULAR / WHATSAPP" className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-xs font-bold outline-none focus:ring-4 focus:ring-brand-500/10 transition-all" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                    </div>
                    
                    <div className="space-y-4">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Método de Envío</label>
                       <div className="flex gap-4">
                          <button onClick={() => setDeliveryType('recojo')} className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-[1.5rem] text-[10px] font-black uppercase border-2 transition-all ${deliveryType === 'recojo' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'border-slate-100 text-slate-400'}`}>
                             <MapPin className="w-5 h-5"/> Recojo
                          </button>
                          <button onClick={() => setDeliveryType('delivery')} className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-[1.5rem] text-[10px] font-black uppercase border-2 transition-all ${deliveryType === 'delivery' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'border-slate-100 text-slate-400'}`}>
                             <Truck className="w-5 h-5"/> Delivery
                          </button>
                       </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
                       {deliveryType === 'recojo' ? (
                          (config.sedes_recojo || []).map(sede => (
                             <button key={sede.id} onClick={() => setSelectedSede(sede)} className={`w-full p-6 rounded-3xl text-left border-2 transition-all ${selectedSede?.id === sede.id ? 'bg-brand-50 border-brand-500 shadow-lg' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex items-center justify-between mb-1">
                                   <p className="text-[10px] font-black uppercase text-brand-600">{sede.nombre}</p>
                                   {selectedSede?.id === sede.id && <CheckCircle2 className="w-4 h-4 text-brand-500"/>}
                                </div>
                                <p className="text-xs font-bold text-slate-600 uppercase leading-tight">{sede.direccion}</p>
                             </button>
                          ))
                       ) : (
                          <textarea placeholder="DIRECCIÓN EXACTA, DISTRITO Y REFERENCIAS PARA DESPACHO" className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-xs font-bold uppercase h-32 outline-none focus:ring-4 focus:ring-brand-500/10 transition-all resize-none" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                       )}
                    </div>
                    
                    <div className="flex gap-4 pt-6 border-t border-slate-100 mt-auto">
                       <button onClick={() => setCurrentStep('cart')} className="flex-1 py-6 bg-slate-100 rounded-[2rem] text-[10px] font-black uppercase text-slate-400">Atrás</button>
                       <button onClick={() => setCurrentStep('payment')} disabled={!clientData.nombre || clientData.telefono.length < 9 || (deliveryType === 'recojo' && !selectedSede) || (deliveryType === 'delivery' && !clientData.direccion)} className="flex-[2] py-6 bg-slate-900 text-white rounded-[2rem] text-[10px] font-black uppercase shadow-xl disabled:opacity-20 transition-all active:scale-95">Continuar</button>
                    </div>
                 </div>
              )}

              {currentStep === 'payment' && (
                 <div className="space-y-6 flex-1 flex flex-col">
                    <div className="flex gap-4 p-2 bg-slate-100 rounded-[2rem] shrink-0">
                       <button onClick={() => setPaymentMethod('yape')} className={`flex-1 py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest transition-all ${paymentMethod === 'yape' ? 'bg-purple-600 text-white shadow-xl' : 'text-slate-400'}`}>Yape</button>
                       <button onClick={() => setPaymentMethod('plin')} className={`flex-1 py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest transition-all ${paymentMethod === 'plin' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400'}`}>Plin</button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-6 min-h-0 pr-1">
                       <div className="bg-white rounded-[3rem] border border-slate-100 flex flex-col items-center justify-center p-8 shadow-inner">
                          <p className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest">Paga tu pedido aquí</p>
                          <div className="w-56 h-56 bg-slate-50 rounded-[2rem] flex items-center justify-center overflow-hidden mb-6 border border-slate-100 shadow-sm relative group">
                             {paymentMethod === 'yape' ? (
                                config.yapeQR ? <img src={config.yapeQR} className="w-full h-full object-contain p-4" /> : <QrCode className="w-16 h-16 opacity-10"/>
                             ) : (
                                config.plinQR ? <img src={config.plinQR} className="w-full h-full object-contain p-4" /> : <QrCode className="w-16 h-16 opacity-10"/>
                             )}
                          </div>
                          
                          <div className="w-full space-y-4 text-center">
                             <div>
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Titular de Cuenta</p>
                                <p className="text-sm font-black text-slate-900 uppercase leading-none">{paymentMethod === 'yape' ? (config.yapeName || 'Empresa Registrada') : (config.plinName || 'Empresa Registrada')}</p>
                             </div>
                             
                             <button 
                               onClick={() => {
                                  const num = paymentMethod === 'yape' ? (config.yapeNumber || '') : (config.plinNumber || '');
                                  navigator.clipboard.writeText(num);
                                  setCopyStatus(true);
                                  setTimeout(() => setCopyStatus(false), 2000);
                               }}
                               className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group active:scale-95 transition-all"
                             >
                                <div className="text-left">
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Número</p>
                                   <p className="text-xl font-black text-slate-900 tracking-[0.2em]">{paymentMethod === 'yape' ? (config.yapeNumber || '---') : (config.plinNumber || '---')}</p>
                                </div>
                                <div className={`p-3 rounded-xl transition-all ${copyStatus ? 'bg-brand-500 text-white' : 'bg-white text-slate-400 shadow-sm'}`}>
                                   {copyStatus ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4"/>}
                                </div>
                             </button>
                          </div>
                       </div>

                       <div className="bg-brand-50 p-6 rounded-[2rem] border border-brand-100 flex gap-4 items-start">
                          <Info className="w-6 h-6 text-brand-600 shrink-0 mt-1"/>
                          <p className="text-[11px] font-bold text-brand-800 leading-relaxed uppercase tracking-tight">
                             Paga ahora escaneando el QR o usando el número. Luego presiona confirmar para registrar tu pedido en Odoo y enviarnos tu voucher por WhatsApp.
                          </p>
                       </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 mt-auto flex gap-4">
                       <button onClick={() => setCurrentStep('details')} className="flex-1 py-6 bg-slate-100 rounded-[2rem] text-[10px] font-black uppercase text-slate-400">Atrás</button>
                       <button onClick={handleFinishOrder} className="flex-[2] py-6 bg-brand-500 text-white rounded-[2rem] text-[10px] font-black uppercase shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-brand-500/30">
                          Confirmar y enviar <Send className="w-5 h-5"/>
                       </button>
                    </div>
                 </div>
              )}

              {currentStep === 'processing' && (
                 <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in">
                    <div className="relative">
                       <div className="w-24 h-24 border-4 border-slate-100 rounded-full"></div>
                       <div className="w-24 h-24 border-4 border-brand-500 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                       <ReceiptText className="w-10 h-10 text-slate-900 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"/>
                    </div>
                    <div className="space-y-3 px-10">
                       <h3 className="text-2xl font-black uppercase tracking-tighter">Sincronizando Odoo</h3>
                       <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-relaxed">Estamos registrando tu orden de venta y tus datos de contacto para que el negocio proceda con el despacho de inmediato.</p>
                    </div>
                 </div>
              )}

              {currentStep === 'success' && (
                 <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 pb-10 animate-in zoom-in duration-500">
                    <div className="w-32 h-32 bg-brand-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-brand-500/30">
                      <HeartHandshake className="w-16 h-16"/>
                    </div>
                    <div className="space-y-6">
                       <div className="space-y-1">
                          <h3 className="text-4xl font-black uppercase tracking-tighter leading-none">¡Excelente!</h3>
                          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Referencia: {orderRef}</p>
                       </div>
                       <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100 mx-4">
                          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest leading-relaxed">
                            Tu pedido fue recibido exitosamente. Si no se abrió WhatsApp, usa el botón de abajo para enviarnos la captura de tu pago.
                          </p>
                       </div>
                    </div>
                    <div className="w-full space-y-4 px-4">
                       <button 
                         onClick={() => {
                           const waNumber = (config.whatsappNumbers || config.whatsappHelpNumber || '51975615244').replace(/\D/g, '');
                           window.open(`https://wa.me/${waNumber}`, '_blank');
                         }}
                         className="w-full py-8 bg-brand-500 text-white rounded-[2.5rem] font-black uppercase text-[11px] tracking-[0.3em] shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-brand-500/30"
                       >
                         Enviar Comprobante <MessageCircle className="w-5 h-5"/>
                       </button>
                       <button onClick={() => { setIsCartOpen(false); setCart([]); setCurrentStep('cart'); }} className="w-full py-4 text-slate-400 font-black uppercase text-[9px] tracking-[0.3em]">Seguir Comprando</button>
                    </div>
                 </div>
              )}
           </div>
        </div>
      )}

      {/* DETALLE PRODUCTO MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setSelectedProduct(null)}></div>
           <div className="relative bg-white w-full max-w-3xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in duration-300">
              <button onClick={() => setSelectedProduct(null)} className="absolute top-8 right-8 z-10 p-4 bg-slate-50 text-slate-600 rounded-full hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                <X className="w-6 h-6"/>
              </button>
              <div className="w-full md:w-1/2 bg-slate-50 flex items-center justify-center p-12">
                 {selectedProduct.imagen ? <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-h-[400px] w-auto object-contain mix-blend-multiply drop-shadow-2xl" /> : <Package className="w-24 h-24 text-slate-200" />}
              </div>
              <div className="w-full md:w-1/2 p-12 flex flex-col justify-center">
                 <div className="mb-8">
                    <p className="text-[10px] font-black uppercase text-brand-600 tracking-[0.3em] mb-4">Información del Producto</p>
                    <h2 className="text-3xl font-black uppercase text-slate-900 tracking-tighter leading-tight mb-4">{selectedProduct.nombre}</h2>
                    <p className="text-4xl font-black text-slate-900 tracking-tighter">S/ {selectedProduct.precio.toFixed(2)}</p>
                 </div>
                 <p className="text-xs text-slate-600 uppercase font-bold leading-relaxed mb-10">{selectedProduct.descripcion_venta || "Calidad y servicio garantizado por Lemon BI."}</p>
                 <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="w-full py-7 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                    <Plus className="w-5 h-5"/> Añadir a la Bolsa
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default StoreView;
