
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingCart, Package, Search, X, Image as ImageIcon, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, ShieldCheck, 
  Star, Facebook, Instagram, Pill, Beaker, ClipboardCheck, AlertCircle,
  Stethoscope, Footprints, PawPrint, Calendar, Wallet, CheckCircle2, Camera, Upload
} from 'lucide-react';
import { Producto, CartItem, OdooSession, ClientConfig } from '../types';
import { OdooClient } from '../services/odoo';

interface StoreViewProps {
  session: OdooSession;
  config: ClientConfig;
  onBack?: () => void;
}

type StoreStep = 'browsing' | 'checkout';

const StoreView: React.FC<StoreViewProps> = ({ session, config, onBack }) => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<StoreStep>('browsing');
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'tech' | 'usage'>('info');
  
  // Estados de Pago/Envío
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'efectivo'>('yape');
  const [deliveryType, setDeliveryType] = useState<'recojo' | 'delivery'>('recojo');
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '', sede: '' });
  const [voucherAttached, setVoucherAttached] = useState<File | null>(null);

  const colorP = config?.colorPrimario || '#84cc16'; 
  const colorS = config?.colorSecundario || '#0F172A';
  const colorA = config?.colorAcento || '#0ea5e9';
  const bizType = config?.businessType || 'pharmacy';

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    setFetchError(null);
    const client = new OdooClient(session.url, session.db, true);
    const context = { allowed_company_ids: [session.companyId], company_id: session.companyId };

    try {
      // FILTRO ESTRICTO: Solo productos de la compañía actual o globales (false)
      const domain: any[] = [
        ['sale_ok', '=', true],
        ['company_id', 'in', [session.companyId, false]]
      ];

      const fields = ['display_name', 'list_price', 'categ_id', 'image_128', 'description_sale', 'qty_available', 'x_registro_sanitario', 'x_laboratorio', 'x_principio_activo', 'x_uso_sugerido', 'x_especie', 'x_duracion_sesion'];

      const data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, fields, { limit: 500, context });

      const mapped = data.map((p: any) => ({
        id: Number(p.id),
        nombre: p.display_name,
        precio: p.list_price || 0,
        categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
        stock: p.qty_available || 0,
        imagen: p.image_128,
        descripcion_venta: p.description_sale || '',
        registro_sanitario: p.x_registro_sanitario || '',
        laboratorio: p.x_laboratorio || '',
        principio_activo: p.x_principio_activo || '',
        uso_sugerido: p.x_uso_sugerido || '',
        especie: p.x_especie || '',
        duracion_sesion: p.x_duracion_sesion || ''
      }));
      setProductos(mapped);
    } catch (e: any) {
      setFetchError(e.message || "Error al conectar con Odoo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [session]);

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
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(i => i.producto.id === id ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i));
  };

  const removeFromCart = (id: number) => setCart(prev => prev.filter(i => i.producto.id !== id));

  const cartTotal = cart.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);

  // Mapeo Dinámico según tipo de Negocio
  const bizMeta = {
    pharmacy: { icon: Pill, label: 'Farmacia Autorizada', reg: 'Registro Sanitario', lab: 'Laboratorio' },
    veterinary: { icon: PawPrint, label: 'Clínica Veterinaria', reg: 'Reg. SENASA', lab: 'Marca / Laboratorio' },
    podiatry: { icon: Footprints, label: 'Salud Podológica', reg: 'Procedimiento', lab: 'Especialista' }
  }[bizType] || { icon: Package, label: 'Catálogo Pro', reg: 'Referencia', lab: 'Fabricante' };

  const handleFinalOrder = () => {
    const itemsText = cart.map(i => `• ${i.cantidad}x ${i.producto.nombre} (S/ ${ (i.producto.precio * i.cantidad).toFixed(2) })`).join('%0A');
    const paymentText = paymentMethod === 'efectivo' ? 'Efectivo' : `${paymentMethod.toUpperCase()} (Se adjunta voucher)`;
    const deliveryText = deliveryType === 'recojo' ? `Recojo en Sede: ${clientData.sede}` : `Delivery a: ${clientData.direccion}`;
    
    const message = `*NUEVO PEDIDO - ${config.nombreComercial || config.code}*%0A%0A*Cliente:* ${clientData.nombre}%0A*WhatsApp:* ${clientData.telefono}%0A%0A*Productos:*%0A${itemsText}%0A%0A*Total:* S/ ${cartTotal.toFixed(2)}%0A*Pago:* ${paymentText}%0A*Entrega:* ${deliveryText}%0A%0A_Favor de confirmar disponibilidad._`;
    
    window.open(`https://wa.me/${config.whatsappNumbers?.split(',')[0]}?text=${message}`);
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans text-slate-800 flex flex-col overflow-x-hidden relative">
      
      {/* Header Premium Adaptativo */}
      <header className="bg-white/90 backdrop-blur-2xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {onBack && (
              <button onClick={onBack} className="p-3 text-slate-400 hover:text-slate-900 rounded-2xl transition-all">
                <ArrowLeft className="w-5 h-5"/>
              </button>
            )}
            <div className="flex items-center gap-4">
               {config.logoUrl ? <img src={config.logoUrl} className="h-10 md:h-12 object-contain" alt="Logo" /> : <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{backgroundColor: colorP}}><bizMeta.icon className="w-6 h-6 text-white" /></div>}
               <div className="hidden lg:block">
                 <h1 className="font-black text-slate-900 uppercase text-sm tracking-tighter leading-none">{config.nombreComercial || config.code}</h1>
                 <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-widest flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" /> {bizMeta.label}
                 </p>
               </div>
            </div>
          </div>
          <div className="flex-1 max-w-2xl hidden md:block">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
              <input type="text" placeholder={`¿Qué buscas en ${config.nombreComercial || 'la tienda'}?`} className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-100 rounded-[2rem] outline-none font-medium text-sm focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <button onClick={() => setIsCartOpen(true)} className="relative p-4 bg-slate-900 text-white rounded-[1.5rem] shadow-xl hover:scale-105 active:scale-95 transition-all">
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && <span className="absolute -top-1.5 -right-1.5 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center animate-bounce shadow-xl" style={{backgroundColor: colorA}}>{cart.length}</span>}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-10">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {[1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className="bg-white rounded-[3rem] aspect-[3/4] animate-pulse border border-slate-50 shadow-sm"></div>)}
          </div>
        ) : fetchError ? (
           <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="w-16 h-16 text-red-400 mb-6" />
              <h3 className="text-2xl font-black uppercase text-slate-900">Sincronización Fallida</h3>
              <p className="text-sm text-slate-500 max-w-xs mt-2">{fetchError}</p>
              <button onClick={fetchProducts} className="mt-8 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl">Reintentar</button>
           </div>
        ) : filteredProducts.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-12 bg-slate-100 text-slate-300 rounded-[4rem] mb-8"><Package className="w-24 h-24"/></div>
              <h3 className="text-xl font-black uppercase text-slate-900">No hay productos disponibles</h3>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">En la compañía: {session.companyName}</p>
           </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 animate-in fade-in duration-1000">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => { setSelectedProduct(p); setActiveTab('info'); }} className="group bg-white rounded-[3rem] p-5 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer flex flex-col relative overflow-hidden">
                <div className="aspect-square bg-slate-50 rounded-[2.5rem] mb-6 overflow-hidden flex items-center justify-center relative">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" /> : <Package className="w-12 h-12 text-slate-100"/>}
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] mb-2 block px-2.5 py-1 bg-slate-100 rounded-full w-fit text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">{p.categoria}</span>
                  <h3 className="text-xs font-bold text-slate-800 line-clamp-2 uppercase h-9 mb-4 leading-tight">{p.nombre}</h3>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-auto">
                    <div>
                        <p className="text-[8px] font-black text-slate-300 uppercase leading-none mb-1">Inversión Salud</p>
                        <span className="text-base font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    </div>
                    <button onClick={(e) => addToCart(p, e)} className="p-3.5 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-900 hover:text-white transition-all active:scale-90 shadow-sm"><Plus className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL DETALLE PRODUCTO INTERACTIVO */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative bg-white w-full max-w-5xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row animate-in zoom-in-95 duration-300 max-h-[90vh]">
             <button onClick={() => setSelectedProduct(null)} className="absolute top-8 right-8 p-3 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-full z-20 transition-all"><X className="w-5 h-5"/></button>
             
             <div className="lg:w-1/2 bg-slate-50/50 flex items-center justify-center p-12 shrink-0">
               <div className="w-full aspect-square bg-white rounded-[4rem] shadow-sm p-12 flex items-center justify-center border border-slate-100 relative group/img">
                 {selectedProduct.imagen ? <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-h-full max-w-full object-contain group-hover/img:scale-105 transition-transform duration-700" /> : <ImageIcon className="w-24 h-24 text-slate-100"/>}
                 <div className="absolute bottom-8 right-8 bg-white/80 backdrop-blur px-4 py-2 rounded-2xl border border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400">Zoom Interactivo</div>
               </div>
             </div>

             <div className="lg:w-1/2 p-12 flex flex-col min-h-0">
                <div className="mb-8">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-xl bg-brand-50 text-brand-600 mb-4 inline-block">{selectedProduct.categoria}</span>
                  <h2 className="text-3xl font-black text-slate-900 leading-tight tracking-tighter uppercase mb-4">{selectedProduct.nombre}</h2>
                  <div className="flex gap-2">
                     <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-500 uppercase"><CheckCircle2 className="w-3.5 h-3.5"/> Autenticidad Garantizada</span>
                  </div>
                </div>

                <div className="flex border-b border-slate-100 mb-8 gap-8">
                  {['info', 'tech', 'usage'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`pb-4 text-[11px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-slate-900' : 'text-slate-300 hover:text-slate-500'}`}>
                      {tab === 'info' ? 'Resumen' : tab === 'tech' ? 'Ficha Técnica' : 'Instrucciones'}
                      {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand-500 rounded-full animate-in slide-in-from-left duration-300"></div>}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                   {activeTab === 'info' && (
                     <div className="animate-in fade-in slide-in-from-right-4">
                       <p className="text-sm text-slate-500 leading-relaxed font-medium mb-8">{selectedProduct.descripcion_venta || 'Nuestro equipo profesional garantiza la calidad de este producto.'}</p>
                       <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] flex items-center justify-between shadow-2xl">
                         <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio Online</p><p className="text-4xl font-black">S/ {selectedProduct.precio.toFixed(2)}</p></div>
                         <div className="text-right flex flex-col items-end"><div className="flex items-center gap-2 font-black text-brand-400 uppercase text-xs mb-1"><div className="w-2.5 h-2.5 bg-brand-400 rounded-full animate-pulse"></div> En Stock</div><p className="text-[9px] text-slate-500 font-bold uppercase">Envío Inmediato</p></div>
                       </div>
                     </div>
                   )}

                   {activeTab === 'tech' && (
                     <div className="animate-in fade-in slide-in-from-right-4 space-y-4 pb-4">
                        <div className="grid grid-cols-2 gap-4">
                           {selectedProduct.laboratorio && <div className="p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">{bizMeta.lab}</p><p className="text-xs font-bold text-slate-800 uppercase">{selectedProduct.laboratorio}</p></div>}
                           {selectedProduct.principio_activo && <div className="p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Composición</p><p className="text-xs font-bold text-slate-800 uppercase">{selectedProduct.principio_activo}</p></div>}
                           {selectedProduct.registro_sanitario && <div className="p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100 col-span-2"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">{bizMeta.reg}</p><p className="text-xs font-bold text-slate-800 uppercase tracking-tighter">{selectedProduct.registro_sanitario}</p></div>}
                           {bizType === 'veterinary' && selectedProduct.especie && <div className="p-5 bg-brand-50 rounded-[1.5rem] border border-brand-100"><p className="text-[9px] font-black text-brand-500 uppercase mb-1">Especie</p><p className="text-xs font-black text-brand-700 uppercase">{selectedProduct.especie}</p></div>}
                           {bizType === 'podiatry' && selectedProduct.duracion_sesion && <div className="p-5 bg-brand-50 rounded-[1.5rem] border border-brand-100"><p className="text-[9px] font-black text-brand-500 uppercase mb-1">Duración</p><p className="text-xs font-black text-brand-700 uppercase">{selectedProduct.duracion_sesion}</p></div>}
                        </div>
                     </div>
                   )}

                   {activeTab === 'usage' && (
                     <div className="animate-in fade-in slide-in-from-right-4 h-full flex flex-col">
                        <div className="p-8 border-l-8 border-brand-500 bg-brand-50/30 rounded-r-[2.5rem] flex-1">
                           <h4 className="text-[10px] font-black uppercase text-brand-600 mb-4 tracking-widest">Recomendaciones del Especialista</h4>
                           <p className="text-sm font-bold text-slate-700 leading-relaxed italic">"{selectedProduct.uso_sugerido || 'Consulte con su profesional de confianza para el uso correcto de este producto.'}"</p>
                        </div>
                     </div>
                   )}
                </div>

                <div className="pt-8 mt-auto border-t border-slate-50 flex gap-4">
                   <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="flex-1 py-6 bg-brand-500 text-white rounded-[2rem] font-black uppercase text-[11px] shadow-2xl flex items-center justify-center gap-4 hover:brightness-110 active:scale-95 transition-all" style={{backgroundColor: colorA}}>
                     <ShoppingCart className="w-5 h-5" /> Añadir al Pedido
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* CARRITO Y CHECKOUT FLOW */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 rounded-l-[4rem]">
            
            <div className="p-10 border-b border-slate-50 flex items-center justify-between shrink-0">
               <div>
                 <h2 className="text-2xl font-black text-slate-900 uppercase leading-none">{currentStep === 'browsing' ? 'Mi Carrito' : 'Finalizar Pedido'}</h2>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{cart.length} Productos seleccionados</p>
               </div>
               <button onClick={() => { setIsCartOpen(false); setCurrentStep('browsing'); }} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all"><X className="w-5 h-5"/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {currentStep === 'browsing' ? (
                 <>
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                       <div className="p-10 bg-slate-50 rounded-full text-slate-200"><ShoppingCart className="w-16 h-16"/></div>
                       <p className="text-xs font-black uppercase text-slate-400 tracking-widest">El carrito está vacío</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.producto.id} className="flex gap-5 items-center bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-20 h-20 bg-slate-50 rounded-[1.5rem] overflow-hidden flex items-center justify-center shrink-0">
                          {item.producto.imagen ? <img src={`data:image/png;base64,${item.producto.imagen}`} className="w-full h-full object-cover"/> : <Package className="w-8 h-8 text-slate-200"/>}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-[11px] font-black text-slate-800 uppercase line-clamp-1">{item.producto.nombre}</h4>
                          <p className="text-sm font-black text-brand-600 mt-1">S/ {(item.producto.precio * item.cantidad).toFixed(2)}</p>
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-100">
                              <button onClick={() => updateQuantity(item.producto.id, -1)} className="p-1.5 bg-white rounded-lg shadow-sm text-slate-400 hover:text-slate-900"><Minus className="w-3 h-3"/></button>
                              <span className="text-xs font-black px-4">{item.cantidad}</span>
                              <button onClick={() => updateQuantity(item.producto.id, 1)} className="p-1.5 bg-white rounded-lg shadow-sm text-slate-400 hover:text-slate-900"><Plus className="w-3 h-3"/></button>
                            </div>
                            <button onClick={() => removeFromCart(item.producto.id)} className="text-[9px] font-black text-red-300 hover:text-red-500 uppercase tracking-widest">Eliminar</button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                 </>
              ) : (
                <div className="animate-in slide-in-from-right-10 space-y-8">
                  {/* FORMULARIO DE PAGO */}
                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Datos del Solicitante</label>
                     <input type="text" placeholder="NOMBRE COMPLETO" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})}/>
                     <input type="tel" placeholder="NRO DE WHATSAPP" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})}/>
                  </div>

                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Método de Entrega</label>
                     <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setDeliveryType('recojo')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${deliveryType === 'recojo' ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-50 text-slate-300'}`}><MapPin className="w-5 h-5"/> <span className="text-[10px] font-black uppercase">Recojo</span></button>
                        <button onClick={() => setDeliveryType('delivery')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${deliveryType === 'delivery' ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-50 text-slate-300'}`}><Truck className="w-5 h-5"/> <span className="text-[10px] font-black uppercase">Delivery</span></button>
                     </div>
                     {deliveryType === 'recojo' ? (
                       <select className="w-full p-4 bg-slate-50 rounded-2xl text-[10px] font-black uppercase outline-none" value={clientData.sede} onChange={e => setClientData({...clientData, sede: e.target.value})}>
                          <option value="">Selecciona una sede...</option>
                          {config.sedes_recojo?.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                       </select>
                     ) : (
                       <input type="text" placeholder="DIRECCIÓN DE ENTREGA" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})}/>
                     )}
                  </div>

                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Forma de Pago</label>
                     <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                        {['yape', 'plin', 'efectivo'].map(m => (
                          <button key={m} onClick={() => setPaymentMethod(m as any)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${paymentMethod === m ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>{m}</button>
                        ))}
                     </div>
                     
                     {(paymentMethod === 'yape' || paymentMethod === 'plin') && (
                       <div className="p-6 bg-slate-900 rounded-[2rem] text-white space-y-4 animate-in zoom-in-95">
                          <div className="flex justify-between items-center">
                             <div>
                               <p className="text-[9px] font-black text-brand-400 uppercase tracking-widest">{paymentMethod === 'yape' ? 'Yapear a:' : 'Pagar vía Plin:'}</p>
                               <p className="text-lg font-black">{paymentMethod === 'yape' ? config.yapeNumber : config.plinNumber}</p>
                               <p className="text-[10px] text-slate-400 font-bold uppercase">{paymentMethod === 'yape' ? config.yapeName : config.plinName}</p>
                             </div>
                             <div className="w-16 h-16 bg-white p-1 rounded-xl">
                                { (paymentMethod === 'yape' ? config.yapeQR : config.plinQR) ? (
                                  <img src={paymentMethod === 'yape' ? config.yapeQR : config.plinQR} className="w-full h-full object-contain" alt="QR"/>
                                ) : <div className="w-full h-full bg-slate-100 flex items-center justify-center"><Wallet className="text-slate-300"/></div>}
                             </div>
                          </div>
                          <div className="pt-4 border-t border-white/10">
                             <button onClick={() => document.getElementById('voucher_upload')?.click()} className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 text-[10px] font-black uppercase transition-all ${voucherAttached ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                                {voucherAttached ? <><CheckCircle2 className="w-4 h-4"/> Voucher Adjuntado</> : <><Camera className="w-4 h-4"/> Adjuntar Voucher Pago</>}
                             </button>
                             <input type="file" id="voucher_upload" className="hidden" accept="image/*" onChange={(e) => setVoucherAttached(e.target.files?.[0] || null)}/>
                          </div>
                       </div>
                     )}
                  </div>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-10 border-t border-slate-50 bg-white rounded-t-[4rem] shadow-[-0px_-10px_40px_-15px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inversión Total</p>
                    <p className="text-4xl font-black text-slate-900">S/ {cartTotal.toFixed(2)}</p>
                  </div>
                  {currentStep === 'browsing' && (
                    <button onClick={() => setCurrentStep('browsing')} className="text-[10px] font-black text-brand-500 uppercase hover:underline">Limpiar Todo</button>
                  )}
                </div>

                {currentStep === 'browsing' ? (
                  <button onClick={() => setCurrentStep('checkout')} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[11px] shadow-2xl flex items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95">
                    Continuar al Pago <ArrowLeft className="w-5 h-5 rotate-180" />
                  </button>
                ) : (
                  <div className="flex gap-4">
                    <button onClick={() => setCurrentStep('browsing')} className="p-6 bg-slate-100 text-slate-500 rounded-[2rem]"><ArrowLeft className="w-5 h-5"/></button>
                    <button 
                      onClick={handleFinalOrder} 
                      disabled={!clientData.nombre || !clientData.telefono}
                      className="flex-1 py-6 bg-emerald-500 text-white rounded-[2rem] font-black uppercase text-[11px] shadow-2xl flex items-center justify-center gap-4 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:grayscale"
                    >
                      <MessageCircle className="w-5 h-5" /> Enviar a WhatsApp
                    </button>
                  </div>
                )}
                
                <p className="text-[8px] text-center font-black text-slate-300 uppercase mt-6 tracking-widest flex items-center justify-center gap-2 italic">
                   <ShieldCheck className="w-3 h-3"/> Transacción Segura encriptada vía WhatsApp
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER PREMIUM REUTILIZADO */}
      <footer className="mt-20 py-16 text-white overflow-hidden relative" style={{backgroundColor: colorS}}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 blur-[100px] rounded-full -translate-y-1/2"></div>
        <div className="max-w-7xl mx-auto px-10 relative z-10">
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-16 mb-20">
              <div className="lg:col-span-1 space-y-8">
                 <div className="flex items-center gap-4">
                    <div className="p-3.5 rounded-2xl shadow-xl" style={{backgroundColor: colorP}}>
                      <bizMeta.icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-black text-2xl tracking-tighter uppercase">{config.nombreComercial || config.code}</span>
                 </div>
                 <p className="text-xs text-slate-400 font-medium leading-relaxed italic opacity-80">"{config.footer_description || 'Su bienestar es nuestra prioridad. Ofrecemos calidad garantizada por profesionales.'}"</p>
                 <div className="flex gap-4">
                    {config.facebook_url && <a href={config.facebook_url} target="_blank" className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-brand-500 transition-all border border-white/5"><Facebook className="w-5 h-5"/></a>}
                    {config.instagram_url && <a href={config.instagram_url} target="_blank" className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-brand-500 transition-all border border-white/5"><Instagram className="w-5 h-5"/></a>}
                 </div>
              </div>
              <div className="space-y-8">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-500 border-b border-white/10 pb-4">Servicios Digitales</h4>
                <ul className="space-y-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <li className="flex items-center gap-3 hover:text-white transition-colors cursor-pointer"><Star className="w-3.5 h-3.5 text-brand-400"/> Pedidos Programados</li>
                  <li className="flex items-center gap-3 hover:text-white transition-colors cursor-pointer"><Star className="w-3.5 h-3.5 text-brand-400"/> Consulta Online</li>
                  <li className="flex items-center gap-3 hover:text-white transition-colors cursor-pointer"><Star className="w-3.5 h-3.5 text-brand-400"/> Historial de Salud</li>
                </ul>
              </div>
              <div className="lg:col-span-2 space-y-8">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-500 border-b border-white/10 pb-4">Garantía de Establecimiento</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                   <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 hover:bg-white/[0.08] transition-all group">
                      <ShieldCheck className="w-8 h-8 text-emerald-400 mb-4 group-hover:scale-110 transition-transform"/>
                      <p className="text-[10px] font-black text-slate-300 uppercase leading-snug tracking-wider">{config.quality_text || 'Productos certificados y registrados por las entidades correspondientes.'}</p>
                   </div>
                   <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 hover:bg-white/[0.08] transition-all group">
                      <MessageCircle className="w-8 h-8 text-brand-400 mb-4 group-hover:scale-110 transition-transform"/>
                      <p className="text-[10px] font-black text-slate-300 uppercase leading-snug tracking-wider">{config.support_text || 'Atención personalizada 24/7 a través de nuestros canales digitales.'}</p>
                   </div>
                </div>
              </div>
           </div>
           <div className="pt-10 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                &copy; 2025 {config.nombreComercial || config.code} <span className="w-1.5 h-1.5 bg-slate-800 rounded-full"></span> Powered by GaorSystem
              </p>
           </div>
        </div>
      </footer>

      {/* Floating Buttons */}
      <a href={`https://wa.me/${config.whatsappNumbers?.split(',')[0]}?text=Hola, solicito asesoría profesional`} target="_blank" className="fixed bottom-10 right-10 z-[100] w-16 h-16 bg-emerald-500 text-white rounded-[1.5rem] flex items-center justify-center shadow-[0_20px_50px_rgba(16,185,129,0.3)] hover:scale-110 active:scale-95 transition-all">
         <MessageCircle className="w-8 h-8 fill-white/10" />
      </a>
    </div>
  );
};

export default StoreView;
