
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, Image as ImageIcon, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, ShieldCheck, 
  Star, Facebook, Instagram, Pill, Beaker, ClipboardCheck, AlertCircle,
  Stethoscope, Footprints, PawPrint, Calendar, Wallet, CheckCircle2, Camera, ChevronRight,
  Loader2, BadgeCheck, Send
} from 'lucide-react';
import { Producto, CartItem, OdooSession, ClientConfig } from '../types';
import { OdooClient } from '../services/odoo';

interface StoreViewProps {
  session: OdooSession;
  config: ClientConfig;
  onBack?: () => void;
}

type StoreStep = 'browsing' | 'cart' | 'checkout' | 'payment' | 'processing' | 'success';

const StoreView: React.FC<StoreViewProps> = ({ session, config, onBack }) => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrdering, setIsOrdering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<StoreStep>('browsing');
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'tech' | 'usage'>('info');
  
  // Estados de Pago/Envío
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'efectivo'>('yape');
  const [deliveryType, setDeliveryType] = useState<'recojo' | 'delivery'>('recojo');
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '', sede: '' });
  const [voucherAttached, setVoucherAttached] = useState<boolean>(false);

  const colorP = config?.colorPrimario || '#84cc16'; 
  const colorA = config?.colorAcento || '#0ea5e9';
  const bizType = config?.businessType || 'pharmacy';

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    setFetchError(null);
    const client = new OdooClient(session.url, session.db, true);
    const context = { allowed_company_ids: [session.companyId], company_id: session.companyId };

    try {
      const domain: any[] = [
        ['sale_ok', '=', true],
        ['company_id', '=', session.companyId]
      ];

      const baseFields = ['display_name', 'list_price', 'categ_id', 'image_128', 'description_sale', 'qty_available'];
      const customFields = ['x_registro_sanitario', 'x_laboratorio', 'x_principio_activo', 'x_uso_sugerido', 'x_especie', 'x_duracion_sesion'];

      let data: any[] = [];
      try {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, [...baseFields, ...customFields], { limit: 500, context });
      } catch (err: any) {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, baseFields, { limit: 500, context });
      }

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

  // PROCESO DE INTEGRACIÓN CON ODOO
  const handleFinalOrder = async () => {
    setIsOrdering(true);
    setCurrentStep('processing');
    const client = new OdooClient(session.url, session.db, true);
    
    try {
      // 1. Buscar o Crear Cliente
      let partnerId: number;
      const partners = await client.searchRead(session.uid, session.apiKey, 'res.partner', [['phone', '=', clientData.telefono]], ['id'], { limit: 1 });
      
      if (partners.length > 0) {
        partnerId = partners[0].id;
      } else {
        partnerId = await client.create(session.uid, session.apiKey, 'res.partner', {
          name: clientData.nombre.toUpperCase(),
          phone: clientData.telefono,
          company_type: 'person',
          company_id: session.companyId
        });
      }

      // 2. Preparar líneas del pedido
      const orderLines = cart.map(item => [0, 0, {
        product_id: item.producto.id,
        product_uom_qty: item.cantidad,
        price_unit: item.producto.precio,
        name: item.producto.nombre
      }]);

      // 3. Crear Sale Order
      const note = `PAGO: ${paymentMethod.toUpperCase()} | ENTREGA: ${deliveryType.toUpperCase()} | ${deliveryType === 'recojo' ? 'SEDE: '+clientData.sede : 'DIR: '+clientData.direccion}`;
      
      const newOrderId = await client.create(session.uid, session.apiKey, 'sale.order', {
        partner_id: partnerId,
        company_id: session.companyId,
        order_line: orderLines,
        note: note,
        origin: 'TIENDA VIRTUAL LEMONBI'
      });

      // 4. Obtener el nombre del pedido (S000XXX)
      const orderInfo = await client.searchRead(session.uid, session.apiKey, 'sale.order', [['id', '=', newOrderId]], ['name']);
      const odooOrderName = orderInfo[0]?.name || `#${newOrderId}`;
      setLastOrderId(odooOrderName);
      
      // 5. Mostrar Éxito
      setCurrentStep('success');
      setCart([]); // Limpiar carrito

      // 6. Notificación WhatsApp (Opcional pero recomendado para avisar a la empresa)
      const itemsText = orderLines.map((l: any) => `• ${l[2].product_uom_qty}x ${l[2].name}`).join('%0A');
      const message = `*ORDEN CREADA EN ODOO: ${odooOrderName}*%0A%0A*Cliente:* ${clientData.nombre}%0A*WhatsApp:* ${clientData.telefono}%0A*Total:* S/ ${cartTotal.toFixed(2)}%0A*Pago:* ${paymentMethod.toUpperCase()}%0A%0A*Productos:*%0A${itemsText}%0A%0A_Favor de procesar el pedido en Odoo._`;
      
      window.open(`https://wa.me/${config.whatsappNumbers?.split(',')[0]}?text=${message}`);

    } catch (error: any) {
      console.error("Order Creation Error", error);
      alert("Hubo un problema al registrar tu pedido en Odoo: " + error.message);
      setCurrentStep('payment');
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans text-slate-800 flex flex-col overflow-x-hidden relative">
      
      {/* Header Dinámico */}
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
              <input type="text" placeholder={`¿Buscas algo en especial?`} className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-100 rounded-[2rem] outline-none font-medium text-sm focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-4 bg-slate-900 text-white rounded-[1.5rem] shadow-xl hover:scale-105 active:scale-95 transition-all">
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
              <h3 className="text-2xl font-black uppercase text-slate-900">Error en Conexión</h3>
              <p className="text-sm text-slate-500 max-w-xs mt-2">{fetchError}</p>
              <button onClick={fetchProducts} className="mt-8 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl tracking-widest">Reintentar Sincronización</button>
           </div>
        ) : filteredProducts.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-12 bg-slate-100 text-slate-300 rounded-[4rem] mb-8"><Package className="w-24 h-24"/></div>
              <h3 className="text-xl font-black uppercase text-slate-900">Catálogo Vacío</h3>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">Cargando datos de {session.companyName}</p>
           </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 animate-in fade-in duration-1000">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => { setSelectedProduct(p); setActiveTab('info'); }} className="group bg-white rounded-[3rem] p-5 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer flex flex-col relative overflow-hidden">
                <div className="aspect-square bg-slate-50 rounded-[2.5rem] mb-6 overflow-hidden flex items-center justify-center relative">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" /> : <Package className="w-12 h-12 text-slate-100"/>}
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] mb-2 block px-2.5 py-1 bg-slate-100 rounded-full w-fit text-slate-500">{p.categoria}</span>
                  <h3 className="text-xs font-bold text-slate-800 line-clamp-2 uppercase h-9 mb-4 leading-tight">{p.nombre}</h3>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-auto">
                    <div>
                        <p className="text-[8px] font-black text-slate-300 uppercase leading-none mb-1">Inversión Salud</p>
                        <span className="text-base font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    </div>
                    <button onClick={(e) => addToCart(p, e)} className="p-3.5 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-90"><Plus className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL DETALLE PRODUCTO */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-xl animate-in fade-in" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative bg-white w-full max-w-5xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row animate-in zoom-in-95 max-h-[90vh]">
             <button onClick={() => setSelectedProduct(null)} className="absolute top-8 right-8 p-3 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-full z-20"><X className="w-5 h-5"/></button>
             
             <div className="lg:w-1/2 bg-slate-50/50 flex items-center justify-center p-12 shrink-0">
               <div className="w-full aspect-square bg-white rounded-[4rem] shadow-sm p-12 flex items-center justify-center border border-slate-100 relative">
                 {selectedProduct.imagen ? <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-h-full max-w-full object-contain" /> : <ImageIcon className="w-24 h-24 text-slate-100"/>}
               </div>
             </div>

             <div className="lg:w-1/2 p-12 flex flex-col min-h-0">
                <div className="mb-8">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-xl bg-brand-50 text-brand-600 mb-4 inline-block">{selectedProduct.categoria}</span>
                  <h2 className="text-3xl font-black text-slate-900 leading-tight tracking-tighter uppercase mb-2">{selectedProduct.nombre}</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> {bizMeta.label} Certificado</p>
                </div>

                <div className="flex border-b border-slate-100 mb-8 gap-8">
                  {['info', 'tech', 'usage'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`pb-4 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'border-b-4 border-brand-500 text-slate-900' : 'text-slate-300'}`}>
                      {tab === 'info' ? 'Resumen' : tab === 'tech' ? 'Ficha Técnica' : 'Instrucciones'}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                   {activeTab === 'info' && (
                     <div className="animate-in fade-in">
                       <p className="text-sm text-slate-500 leading-relaxed font-medium mb-8 italic">{selectedProduct.descripcion_venta || 'Nuestro compromiso es ofrecer productos de la más alta calidad para su bienestar.'}</p>
                       <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] flex items-center justify-between shadow-xl">
                         <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio Web</p><p className="text-4xl font-black">S/ {selectedProduct.precio.toFixed(2)}</p></div>
                         <div className="text-right flex flex-col items-end"><div className="flex items-center gap-2 font-black text-emerald-400 uppercase text-xs mb-1"><div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"></div> En Stock</div><p className="text-[9px] text-slate-500 uppercase font-bold">Entrega Inmediata</p></div>
                       </div>
                     </div>
                   )}

                   {activeTab === 'tech' && (
                     <div className="animate-in fade-in space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">{bizMeta.lab}</p><p className="text-xs font-bold text-slate-800 uppercase">{selectedProduct.laboratorio || 'Genérico'}</p></div>
                           <div className="p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Composición</p><p className="text-xs font-bold text-slate-800 uppercase">{selectedProduct.principio_activo || 'No detallado'}</p></div>
                           <div className="p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100 col-span-2"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">{bizMeta.reg}</p><p className="text-xs font-bold text-slate-800 uppercase tracking-tighter">{selectedProduct.registro_sanitario || 'Validado por Odoo'}</p></div>
                           {bizType === 'veterinary' && selectedProduct.especie && <div className="p-5 bg-brand-50 rounded-[1.5rem] border border-brand-100 col-span-2"><p className="text-[9px] font-black text-brand-500 uppercase mb-1">Especie Objetivo</p><p className="text-xs font-black text-brand-700 uppercase">{selectedProduct.especie}</p></div>}
                        </div>
                     </div>
                   )}

                   {activeTab === 'usage' && (
                     <div className="animate-in fade-in h-full flex flex-col">
                        <div className="p-8 border-l-8 border-brand-500 bg-brand-50/30 rounded-r-[2.5rem]">
                           <h4 className="text-[10px] font-black uppercase text-brand-600 mb-4 tracking-widest">Recomendaciones del Especialista</h4>
                           <p className="text-sm font-bold text-slate-700 leading-relaxed italic">"{selectedProduct.uso_sugerido || 'Para una correcta administración, consulte con su profesional de confianza.'}"</p>
                        </div>
                     </div>
                   )}
                </div>

                <div className="pt-8 mt-auto border-t border-slate-50 flex gap-4">
                   <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="flex-1 py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[11px] shadow-2xl flex items-center justify-center gap-4 hover:brightness-110 active:scale-95 transition-all">
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
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => { if(currentStep !== 'processing' && currentStep !== 'success') setIsCartOpen(false); }}></div>
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 rounded-l-[4rem]">
            
            <div className="p-10 border-b border-slate-50 flex items-center justify-between shrink-0">
               <div>
                 <h2 className="text-2xl font-black text-slate-900 uppercase leading-none tracking-tighter">
                    {currentStep === 'cart' ? 'Mi Carrito' : currentStep === 'checkout' ? 'Mis Datos' : currentStep === 'payment' ? 'Método Pago' : currentStep === 'success' ? 'Pedido Exitoso' : 'Procesando...'}
                 </h2>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{currentStep === 'success' ? '¡Gracias por tu compra!' : `${cart.length} productos en orden`}</p>
               </div>
               {(currentStep !== 'processing' && currentStep !== 'success') && <button onClick={() => setIsCartOpen(false)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all"><X className="w-5 h-5"/></button>}
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {currentStep === 'cart' && (
                 <>
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                       <div className="p-10 bg-slate-50 rounded-full text-slate-200"><ShoppingCart className="w-16 h-16"/></div>
                       <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Carrito vacío</p>
                       <button onClick={() => setIsCartOpen(false)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Explorar Productos</button>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.producto.id} className="flex gap-5 items-center bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-20 h-20 bg-slate-50 rounded-[1.5rem] overflow-hidden flex items-center justify-center shrink-0">
                          {item.producto.imagen ? <img src={`data:image/png;base64,${item.producto.imagen}`} className="w-full h-full object-cover"/> : <Package className="w-8 h-8 text-slate-200"/>}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-[11px] font-black text-slate-800 uppercase line-clamp-1">{item.producto.nombre}</h4>
                          <p className="text-sm font-black text-emerald-600 mt-1">S/ {(item.producto.precio * item.cantidad).toFixed(2)}</p>
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-100">
                              <button onClick={() => updateQuantity(item.producto.id, -1)} className="p-1.5 bg-white rounded-lg text-slate-400 shadow-sm active:scale-90"><Minus className="w-3 h-3"/></button>
                              <span className="text-xs font-black px-4">{item.cantidad}</span>
                              <button onClick={() => updateQuantity(item.producto.id, 1)} className="p-1.5 bg-white rounded-lg text-slate-400 shadow-sm active:scale-90"><Plus className="w-3 h-3"/></button>
                            </div>
                            <button onClick={() => removeFromCart(item.producto.id)} className="text-[9px] font-black text-red-300 hover:text-red-500 uppercase tracking-widest transition-colors">Eliminar</button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {cart.length > 0 && (
                    <button onClick={() => setIsCartOpen(false)} className="w-full py-5 border-2 border-dashed border-slate-200 rounded-[2rem] text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] hover:border-brand-500 hover:text-brand-500 transition-all">Seguir Comprando</button>
                  )}
                 </>
              )}

              {currentStep === 'checkout' && (
                <div className="animate-in slide-in-from-right-10 space-y-8">
                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Identificación Cliente</label>
                     <input type="text" placeholder="NOMBRE Y APELLIDO" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-brand-500" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})}/>
                     <input type="tel" placeholder="NRO DE WHATSAPP (ODOO ID)" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-[11px] font-black outline-none focus:ring-2 focus:ring-brand-500" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})}/>
                  </div>

                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Entrega del Producto</label>
                     <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setDeliveryType('recojo')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${deliveryType === 'recojo' ? 'border-slate-900 bg-slate-900 text-white shadow-xl' : 'border-slate-100 text-slate-300'}`}><MapPin className="w-5 h-5"/> <span className="text-[10px] font-black uppercase">Recojo Sede</span></button>
                        <button onClick={() => setDeliveryType('delivery')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${deliveryType === 'delivery' ? 'border-slate-900 bg-slate-900 text-white shadow-xl' : 'border-slate-100 text-slate-300'}`}><Truck className="w-5 h-5"/> <span className="text-[10px] font-black uppercase">Delivery</span></button>
                     </div>
                     {deliveryType === 'recojo' ? (
                       <select className="w-full p-4 bg-slate-50 rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-brand-500" value={clientData.sede} onChange={e => setClientData({...clientData, sede: e.target.value})}>
                          <option value="">Selecciona la sede...</option>
                          {config.sedes_recojo?.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                       </select>
                     ) : (
                       <input type="text" placeholder="DIRECCIÓN EXACTA" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-brand-500 shadow-inner" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})}/>
                     )}
                  </div>
                </div>
              )}

              {currentStep === 'payment' && (
                <div className="animate-in slide-in-from-right-10 space-y-8">
                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Forma de Pago</label>
                     <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                        {['yape', 'plin', 'efectivo'].map(m => (
                          <button key={m} onClick={() => setPaymentMethod(m as any)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${paymentMethod === m ? 'bg-white shadow-lg text-slate-900 border border-slate-100' : 'text-slate-400'}`}>{m}</button>
                        ))}
                     </div>
                     
                     {(paymentMethod === 'yape' || paymentMethod === 'plin') && (
                       <div className="p-8 bg-slate-900 rounded-[3rem] text-white space-y-6 shadow-2xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                          <div className="flex justify-between items-start relative z-10">
                             <div>
                               <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">{paymentMethod === 'yape' ? 'Yapear a:' : 'Pagar vía Plin:'}</p>
                               <p className="text-2xl font-black tracking-tighter">{paymentMethod === 'yape' ? config.yapeNumber : config.plinNumber}</p>
                               <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 opacity-80">{paymentMethod === 'yape' ? config.yapeName : config.plinName}</p>
                             </div>
                             <div className="w-20 h-20 bg-white p-1 rounded-2xl flex items-center justify-center shadow-lg">
                                { (paymentMethod === 'yape' ? config.yapeQR : config.plinQR) ? (
                                  <img src={paymentMethod === 'yape' ? config.yapeQR : config.plinQR} className="w-full h-full object-contain" alt="QR"/>
                                ) : <Wallet className="text-slate-100 w-10 h-10"/> }
                             </div>
                          </div>
                          <div className="pt-6 border-t border-white/10 relative z-10">
                             <button onClick={() => setVoucherAttached(true)} className={`w-full py-5 rounded-[1.5rem] flex items-center justify-center gap-3 text-[10px] font-black uppercase transition-all ${voucherAttached ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                                {voucherAttached ? <><CheckCircle2 className="w-5 h-5"/> Voucher Adjuntado</> : <><Camera className="w-5 h-5"/> Simular Adjuntar Voucher</>}
                             </button>
                             <p className="text-[8px] text-center text-slate-500 uppercase mt-4 font-bold tracking-widest">Tu seguridad es nuestra prioridad</p>
                          </div>
                       </div>
                     )}
                  </div>
                </div>
              )}

              {currentStep === 'processing' && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-8 py-20 animate-in fade-in zoom-in-95">
                   <div className="relative">
                      <div className="w-24 h-24 border-8 border-brand-100 border-t-brand-500 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                         <Send className="w-8 h-8 text-brand-500 animate-pulse" />
                      </div>
                   </div>
                   <div className="space-y-4">
                      <h3 className="text-xl font-black uppercase text-slate-900 tracking-tighter">Sincronizando con Odoo</h3>
                      <p className="text-sm font-bold text-slate-500 max-w-xs uppercase leading-relaxed">Estamos registrando tu pedido y verificando disponibilidad de stock en tiempo real...</p>
                   </div>
                </div>
              )}

              {currentStep === 'success' && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-8 py-10 animate-in slide-in-from-bottom-20 duration-1000">
                   <div className="p-10 bg-emerald-50 rounded-[4rem] border-2 border-emerald-100 shadow-xl relative">
                      <BadgeCheck className="w-24 h-24 text-emerald-500 animate-in zoom-in-75 duration-500" />
                      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white px-6 py-2 rounded-full shadow-lg border border-slate-100 text-[10px] font-black uppercase text-emerald-600 tracking-tighter">Pedido Confirmado</div>
                   </div>
                   <div className="space-y-4">
                      <h3 className="text-3xl font-black uppercase text-slate-900 tracking-tighter">¡Listo, {clientData.nombre}!</h3>
                      <div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 inline-block w-full">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tu Pedido en Odoo es:</p>
                         <p className="text-4xl font-black text-slate-900 tracking-tight">{lastOrderId}</p>
                      </div>
                      <p className="text-sm font-bold text-slate-600 leading-relaxed uppercase max-w-xs mx-auto">Nuestro equipo está validando el pago para proceder con la salida de tus productos. ¡Te avisaremos por WhatsApp!</p>
                   </div>
                   <button onClick={() => { setIsCartOpen(false); setCurrentStep('browsing'); }} className="px-12 py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 transition-all">Seguir Comprando</button>
                </div>
              )}
            </div>

            {(cart.length > 0 || currentStep === 'processing' || currentStep === 'success') && (
              <div className="p-10 border-t border-slate-50 bg-white rounded-t-[4rem] shadow-[-0px_-10px_40px_-15px_rgba(0,0,0,0.05)]">
                {(currentStep !== 'processing' && currentStep !== 'success') && (
                  <>
                    <div className="flex justify-between items-end mb-8">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inversión Final</p>
                        <p className="text-4xl font-black text-slate-900">S/ {cartTotal.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      {currentStep === 'cart' && (
                        <button onClick={() => setCurrentStep('checkout')} className="flex-1 py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[11px] shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all">
                          Siguiente Paso <ChevronRight className="w-5 h-5"/>
                        </button>
                      )}
                      {currentStep === 'checkout' && (
                        <>
                          <button onClick={() => setCurrentStep('cart')} className="p-6 bg-slate-100 text-slate-500 rounded-[2rem] active:scale-90 transition-all"><ArrowLeft className="w-5 h-5"/></button>
                          <button 
                            onClick={() => setCurrentStep('payment')} 
                            disabled={!clientData.nombre || !clientData.telefono || (deliveryType === 'delivery' && !clientData.direccion)}
                            className="flex-1 py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[11px] shadow-2xl flex items-center justify-center gap-4 disabled:opacity-50 active:scale-95 transition-all"
                          >
                            Ir al Pago <ChevronRight className="w-5 h-5"/>
                          </button>
                        </>
                      )}
                      {currentStep === 'payment' && (
                        <>
                          <button onClick={() => setCurrentStep('checkout')} className="p-6 bg-slate-100 text-slate-500 rounded-[2rem] active:scale-90 transition-all"><ArrowLeft className="w-5 h-5"/></button>
                          <button 
                            onClick={handleFinalOrder} 
                            disabled={(paymentMethod !== 'efectivo' && !voucherAttached)}
                            className="flex-1 py-6 bg-emerald-500 text-white rounded-[2rem] font-black uppercase text-[11px] shadow-2xl flex items-center justify-center gap-4 hover:brightness-110 active:scale-95 transition-all"
                          >
                            <Send className="w-5 h-5" /> Confirmar Pedido
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
                
                <p className="text-[8px] text-center font-black text-slate-300 uppercase mt-6 tracking-widest flex items-center justify-center gap-2 italic">
                   <ShieldCheck className="w-3 h-3"/> Transacción Protegida e Integrada con Odoo ERP
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER PREMIUM */}
      <footer className="mt-20 py-20 bg-slate-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-10 relative z-10">
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-16 mb-20">
              <div className="lg:col-span-1 space-y-8">
                 <div className="flex items-center gap-4">
                    <div className="p-3.5 rounded-2xl" style={{backgroundColor: colorP}}>
                      <bizMeta.icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-black text-2xl tracking-tighter uppercase">{config.nombreComercial || config.code}</span>
                 </div>
                 <p className="text-xs text-slate-400 font-medium leading-relaxed italic opacity-80">"{config.footer_description || 'Excelencia profesional a su servicio.'}"</p>
              </div>
              <div className="space-y-8">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 border-b border-white/10 pb-4">Servicios Digitales</h4>
                <ul className="space-y-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <li className="flex items-center gap-3">Pedidos Odoo</li>
                  <li className="flex items-center gap-3">Consultas Online</li>
                </ul>
              </div>
              <div className="lg:col-span-2 space-y-8">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 border-b border-white/10 pb-4">Seguridad Garantizada</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                   <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10">
                      <ShieldCheck className="w-8 h-8 text-emerald-400 mb-4"/>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-wider">{config.quality_text || 'Productos certificados.'}</p>
                   </div>
                   <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10">
                      <MessageCircle className="w-8 h-8 text-brand-400 mb-4"/>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-wider">Atención Profesional.</p>
                   </div>
                </div>
              </div>
           </div>
           <div className="pt-10 border-t border-white/10">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                &copy; 2025 Powered by LemonBI & GaorSystem
              </p>
           </div>
        </div>
      </footer>

      {/* Botón WhatsApp Asesoría */}
      <a href={`https://wa.me/${config.whatsappNumbers?.split(',')[0]}?text=Hola, solicito asesoría profesional`} target="_blank" className="fixed bottom-10 right-10 z-[100] w-16 h-16 bg-emerald-500 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all">
         <MessageCircle className="w-8 h-8 fill-white/10" />
      </a>
    </div>
  );
};

export default StoreView;
