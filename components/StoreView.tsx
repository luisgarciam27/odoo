
import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Package, Search, ChevronRight, X, Image as ImageIcon, CheckCircle, ArrowLeft, Loader2, Citrus, Plus, Minus, Trash2, Send, Tag, Zap, Star, ShieldCheck, QrCode, MapPin, Truck, Info, Beaker, Pill, ClipboardList } from 'lucide-react';
import { Producto, CartItem, OdooSession, ClientConfig, SedeStore } from '../types';
import { OdooClient } from '../services/odoo';
import { supabase } from '../services/supabaseClient';

interface StoreViewProps {
  session: OdooSession;
  config: ClientConfig;
  onBack?: () => void;
}

const StoreView: React.FC<StoreViewProps> = ({ session, config, onBack }) => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'catalog' | 'shipping' | 'payment' | 'success'>('catalog');
  
  const [customerData, setCustomerData] = useState({ nombre: '', telefono: '', direccion: '', notas: '', metodoEntrega: 'delivery' as 'delivery' | 'pickup', sedeId: '' });
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'transferencia' | null>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const brandColor = config.colorPrimario || '#84cc16';
  const hiddenIds = config.hiddenProducts || [];

  useEffect(() => {
    fetchProducts();
  }, [session, config]);

  const fetchProducts = async () => {
    setLoading(true);
    const client = new OdooClient(session.url, session.db, true);
    try {
      const categoryNames = (config.tiendaCategoriaNombre || 'Catalogo').split(',').map(c => c.trim()).filter(c => c.length > 0);
      let categoryIds: number[] = [];
      if (categoryNames.length > 0) {
        const categories = await client.searchRead(session.uid, session.apiKey, 'product.category', 
          categoryNames.length === 1 ? [['name', 'ilike', categoryNames[0]]] : [['name', 'in', categoryNames]], ['id']
        );
        categoryIds = categories.map((c: any) => c.id);
      }

      const domain: any[] = [['sale_ok', '=', true]];
      if (categoryIds.length > 0) domain.push(['categ_id', 'child_of', categoryIds]);
      if (session.companyId) domain.push(['company_id', '=', session.companyId]);

      // Intentamos traer campos médicos (asumimos x_ si son personalizados en Odoo)
      const data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, 
        ['display_name', 'list_price', 'qty_available', 'categ_id', 'image_128', 'x_registro_sanitario', 'x_laboratorio', 'x_principio_activo'], 
        { limit: 200, order: 'qty_available desc' }
      );

      setProductos(data.map((p: any) => ({
        id: p.id,
        nombre: p.display_name,
        precio: p.list_price,
        costo: 0,
        categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
        stock: p.qty_available || 0,
        imagen: p.image_128,
        registro_sanitario: p.x_registro_sanitario,
        laboratorio: p.x_laboratorio,
        principio_activo: p.x_principio_activo
      })));
    } catch (e) {
      console.error("Error fetching products", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return productos
      .filter(p => !hiddenIds.includes(p.id))
      .filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [productos, searchTerm, hiddenIds]);

  const addToCart = (p: Producto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCart(prev => {
      const exists = prev.find(item => item.producto.id === p.id);
      if (exists) return prev.map(item => item.producto.id === p.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      return [...prev, { producto: p, cantidad: 1 }];
    });
    // Pequeña animación de feedback se podría añadir aquí
  };

  // Fix: Added updateQuantity helper function
  /**
   * Updates the quantity of a product in the cart
   */
  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => 
      item.producto.id === productId 
        ? { ...item, cantidad: Math.max(1, item.cantidad + delta) } 
        : item
    ));
  };

  // Fix: Added removeFromCart helper function
  /**
   * Removes a product from the cart
   */
  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.producto.id !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);

  const handleSubmitOrder = async () => {
    if (!paymentMethod || !comprobante) {
      alert("Por favor selecciona un método de pago y adjunta tu comprobante.");
      return;
    }

    setIsSubmitting(true);
    try {
      const fileExt = comprobante.name.split('.').pop();
      const fileName = `order_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('comprobantes').upload(`${config.code}/${fileName}`, comprobante);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('comprobantes').getPublicUrl(`${config.code}/${fileName}`);

      const sedeNombre = config.sedes_recojo?.find(s => s.id === customerData.sedeId)?.nombre || 'Sede Principal';

      const { data: supaOrder, error: supaError } = await supabase.from('pedidos_online').insert([{
        empresa_codigo: config.code,
        cliente_nombre: customerData.nombre,
        cliente_telefono: customerData.telefono,
        cliente_direccion: customerData.metodoEntrega === 'pickup' ? `RECOJO: ${sedeNombre}` : customerData.direccion,
        cliente_notas: customerData.notas,
        monto_total: cartTotal,
        metodo_pago: paymentMethod,
        comprobante_url: publicUrl,
        items: cart.map(i => ({ id: i.producto.id, nombre: i.producto.nombre, qty: i.cantidad, precio: i.producto.precio })),
        metodo_entrega: customerData.metodoEntrega,
        sede_recojo: customerData.metodoEntrega === 'pickup' ? sedeNombre : null,
        estado: 'pendiente'
      }]).select().single();

      if (supaError) throw supaError;

      const odoo = new OdooClient(session.url, session.db, true);
      const odooNote = `🛒 PEDIDO WEB #${supaOrder.id}\n` +
                       `👤 Cliente: ${customerData.nombre}\n` +
                       `📱 Telf: ${customerData.telefono}\n` +
                       `🚚 Entrega: ${customerData.metodoEntrega === 'pickup' ? 'RECOJO EN TIENDA (' + sedeNombre + ')' : 'DOMICILIO: ' + customerData.direccion}\n` +
                       `💳 Pago via: ${paymentMethod.toUpperCase()}\n` +
                       `📝 Notas: ${customerData.notas}\n\n` +
                       `🖼️ COMPROBANTE:\n${publicUrl}`;

      await odoo.create(session.uid, session.apiKey, 'sale.order', {
        partner_id: 1, 
        order_line: cart.map(item => [0, 0, { product_id: item.producto.id, product_uom_qty: item.cantidad, price_unit: item.producto.precio }]),
        note: odooNote,
        company_id: session.companyId,
        origin: `Tienda Web ${config.code}`
      });

      setCheckoutStep('success');
      setCart([]);
    } catch (e: any) {
      alert("Error al procesar pedido.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 text-slate-800">
      {/* Navbar con blur y estilo moderno */}
      <nav className="bg-white/70 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-40 px-6 py-4 flex items-center justify-between transition-all duration-500 shadow-sm">
        <div className="flex items-center gap-4">
          {onBack && <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-900 transition-all active:scale-90"><ArrowLeft/></button>}
          <div className="flex items-center gap-3">
             {config.logoUrl ? (
               <img src={config.logoUrl} className="h-10 w-10 object-contain rounded-xl shadow-sm" alt="Logo" />
             ) : (
               <div className="p-2.5 rounded-xl text-white shadow-lg" style={{backgroundColor: brandColor}}><Citrus className="w-5 h-5" /></div>
             )}
             <div>
               <h1 className="font-bold text-slate-900 uppercase text-xs tracking-widest">{config.nombreComercial || config.code}</h1>
               <div className="flex items-center gap-1">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                 <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Tienda Online Activa</p>
               </div>
             </div>
          </div>
        </div>

        <button onClick={() => setIsCartOpen(true)} className="relative p-3 bg-slate-100/50 hover:bg-white rounded-2xl transition-all shadow-inner group">
          <ShoppingCart className="w-5 h-5 text-slate-600 group-hover:scale-110 transition-transform" />
          {cart.length > 0 && <span className="absolute -top-1 -right-1 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-bounce" style={{backgroundColor: brandColor}}>{cart.length}</span>}
        </button>
      </nav>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Buscador Estilo Apple */}
        <div className="relative mb-12 max-w-2xl mx-auto group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
          <input 
            type="text" 
            placeholder="¿Qué medicamento o producto buscas?" 
            className="w-full pl-16 pr-6 py-5 bg-white border border-slate-100 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 outline-none focus:ring-4 focus:ring-brand-500/5 transition-all text-slate-800 text-lg placeholder:text-slate-300 font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Grid de Productos con Animaciones */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {[1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className="bg-white rounded-[2.5rem] aspect-[3/4] animate-pulse"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filteredProducts.map(p => (
              <div 
                key={p.id} 
                onClick={() => setSelectedProduct(p)}
                className="bg-white rounded-[2.5rem] p-4 border border-slate-50 shadow-sm hover:shadow-2xl hover:shadow-brand-500/10 transition-all duration-500 cursor-pointer group flex flex-col"
              >
                <div className="aspect-square bg-slate-50 rounded-[2rem] mb-4 overflow-hidden relative">
                  {p.imagen ? (
                    <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt={p.nombre} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-200"><Package className="w-12 h-12"/></div>
                  )}
                  <button 
                    onClick={(e) => addToCart(p, e)}
                    className="absolute bottom-3 right-3 p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl text-slate-800 hover:bg-brand-500 hover:text-white active:scale-90 transition-all translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1 block">{p.categoria}</span>
                  <h3 className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-brand-600 transition-colors h-10">{p.nombre}</h3>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xl font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    <Info className="w-4 h-4 text-slate-200 group-hover:text-brand-300 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detalle de Producto / Ficha Médica */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full z-10 hover:rotate-90 transition-all"><X /></button>
            <div className="w-full md:w-1/2 bg-slate-50 p-12 flex items-center justify-center">
               {selectedProduct.imagen ? (
                 <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="w-full max-h-[400px] object-contain drop-shadow-2xl" alt=""/>
               ) : <ImageIcon className="w-24 h-24 text-slate-200"/>}
            </div>
            <div className="w-full md:w-1/2 p-10 md:p-14 overflow-y-auto">
               <span className="px-4 py-1.5 bg-brand-50 text-brand-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 inline-block">Información del Producto</span>
               <h2 className="text-3xl font-black text-slate-900 leading-tight mb-2">{selectedProduct.nombre}</h2>
               <p className="text-4xl font-black mb-8" style={{color: brandColor}}>S/ {selectedProduct.precio.toFixed(2)}</p>
               
               <div className="space-y-4 mb-10">
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Especificaciones Salud</h4>
                 {selectedProduct.registro_sanitario && (
                   <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                     <ClipboardList className="w-5 h-5 text-slate-400" />
                     <div><p className="text-[10px] font-bold text-slate-400 uppercase leading-none">R.S. / N.S.O.</p><p className="text-sm font-bold text-slate-700">{selectedProduct.registro_sanitario}</p></div>
                   </div>
                 )}
                 {selectedProduct.laboratorio && (
                   <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                     <Beaker className="w-5 h-5 text-slate-400" />
                     <div><p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Laboratorio / Marca</p><p className="text-sm font-bold text-slate-700">{selectedProduct.laboratorio}</p></div>
                   </div>
                 )}
                 {selectedProduct.principio_activo && (
                   <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                     <Pill className="w-5 h-5 text-slate-400" />
                     <div><p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Principio Activo</p><p className="text-sm font-bold text-slate-700">{selectedProduct.principio_activo}</p></div>
                   </div>
                 )}
               </div>

               <div className="flex gap-4">
                 <button 
                  onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                  className="flex-1 py-5 text-white rounded-3xl font-black shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                  style={{backgroundColor: brandColor, boxShadow: `0 20px 30px -5px ${brandColor}40`}}
                 >
                   <ShoppingCart className="w-6 h-6"/> AGREGAR AL CARRITO
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar de Carrito Moderno */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-all" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 rounded-l-[3rem]">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black flex items-center gap-4 text-slate-900"><ShoppingCart className="w-8 h-8" style={{color: brandColor}}/> Carrito</h2>
                <p className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-widest">{cart.length} productos seleccionados</p>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-4 text-slate-400 hover:bg-slate-50 rounded-2xl transition-colors border border-slate-100"><X /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center">
                  <Package className="w-32 h-32 mb-8 opacity-10" />
                  <p className="text-xl font-bold text-slate-400">Tu carrito está esperando por ti</p>
                </div>
              ) : checkoutStep === 'catalog' ? (
                <div className="space-y-4">
                  {cart.map(item => (
                    <div key={item.producto.id} className="flex gap-6 items-center bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100 group transition-all hover:bg-white hover:shadow-xl">
                      <div className="w-24 h-24 bg-white rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm">
                         {item.producto.imagen ? <img src={`data:image/png;base64,${item.producto.imagen}`} className="w-full h-full object-cover" alt=""/> : <ImageIcon className="w-8 h-8 text-slate-100"/>}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-black text-slate-800 line-clamp-2 leading-tight">{item.producto.nombre}</h4>
                        <p className="text-lg font-black mt-2" style={{color: brandColor}}>S/ {item.producto.precio.toFixed(2)}</p>
                        <div className="flex items-center gap-5 mt-4">
                           <div className="flex items-center bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                              <button onClick={() => updateQuantity(item.producto.id, -1)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-50"><Minus className="w-3 h-3"/></button>
                              <span className="text-xs font-black w-8 text-center">{item.cantidad}</span>
                              <button onClick={() => updateQuantity(item.producto.id, 1)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-50"><Plus className="w-3 h-3"/></button>
                           </div>
                           <button onClick={() => removeFromCart(item.producto.id)} className="text-[10px] font-black text-red-300 hover:text-red-500 uppercase tracking-widest transition-colors">Eliminar</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-10">
                   {/* Método de Entrega */}
                   <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Método de Entrega</h4>
                      <div className="grid grid-cols-2 gap-4">
                         <button 
                           onClick={() => setCustomerData({...customerData, metodoEntrega: 'delivery'})}
                           className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-3 transition-all ${customerData.metodoEntrega === 'delivery' ? 'bg-brand-50 border-brand-500' : 'bg-white border-slate-100'}`}
                           style={{borderColor: customerData.metodoEntrega === 'delivery' ? brandColor : '#f1f5f9'}}
                         >
                            <Truck className={`w-8 h-8 ${customerData.metodoEntrega === 'delivery' ? 'text-brand-600' : 'text-slate-300'}`} />
                            <span className="text-xs font-black uppercase tracking-widest">Delivery</span>
                         </button>
                         <button 
                           onClick={() => setCustomerData({...customerData, metodoEntrega: 'pickup'})}
                           className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-3 transition-all ${customerData.metodoEntrega === 'pickup' ? 'bg-blue-50 border-blue-500' : 'bg-white border-slate-100'}`}
                         >
                            <MapPin className={`w-8 h-8 ${customerData.metodoEntrega === 'pickup' ? 'text-blue-600' : 'text-slate-300'}`} />
                            <span className="text-xs font-black uppercase tracking-widest">Recojo</span>
                         </button>
                      </div>
                   </div>

                   {/* Campos dinámicos según método */}
                   <div className="space-y-4">
                      <input type="text" placeholder="Tu nombre completo" className="w-full p-5 bg-slate-50 border-none rounded-2xl font-bold outline-none focus:ring-2" style={{'--tw-ring-color': brandColor} as any} value={customerData.nombre} onChange={e => setCustomerData({...customerData, nombre: e.target.value})} />
                      <input type="tel" placeholder="Tu WhatsApp" className="w-full p-5 bg-slate-50 border-none rounded-2xl font-bold outline-none focus:ring-2" style={{'--tw-ring-color': brandColor} as any} value={customerData.telefono} onChange={e => setCustomerData({...customerData, telefono: e.target.value})} />
                      
                      {customerData.metodoEntrega === 'delivery' ? (
                        <input type="text" placeholder="Dirección exacta de envío" className="w-full p-5 bg-slate-50 border-none rounded-2xl font-bold outline-none focus:ring-2" style={{'--tw-ring-color': brandColor} as any} value={customerData.direccion} onChange={e => setCustomerData({...customerData, direccion: e.target.value})} />
                      ) : (
                        <div className="space-y-3">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecciona tienda para recojo</p>
                           {(config.sedes_recojo && config.sedes_recojo.length > 0) ? config.sedes_recojo.map(sede => (
                             <button 
                                key={sede.id} 
                                onClick={() => setCustomerData({...customerData, sedeId: sede.id})}
                                className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${customerData.sedeId === sede.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}
                             >
                                <p className="font-black text-sm text-slate-900">{sede.nombre}</p>
                                <p className="text-[10px] text-slate-500 mt-1">{sede.direccion}</p>
                             </button>
                           )) : (
                             <div className="p-4 bg-amber-50 rounded-xl text-amber-700 text-xs font-bold border border-amber-100">Cerca de tu sede principal (Configuración pendiente)</div>
                           )}
                        </div>
                      )}
                      <textarea placeholder="Notas (Ej: No tocar timbre, dejar en portería)" className="w-full p-5 bg-slate-50 border-none rounded-2xl font-bold outline-none h-24 resize-none focus:ring-2" style={{'--tw-ring-color': brandColor} as any} value={customerData.notas} onChange={e => setCustomerData({...customerData, notas: e.target.value})}></textarea>
                   </div>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-10 border-t border-slate-100 bg-white">
                <div className="flex justify-between items-end mb-8">
                  <span className="text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">Total a Pagar</span>
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">S/ {cartTotal.toFixed(2)}</span>
                </div>
                
                <div className="flex gap-4">
                  {checkoutStep !== 'catalog' && (
                    <button onClick={() => setCheckoutStep('catalog')} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black hover:bg-slate-200 active:scale-95 transition-all">VOLVER</button>
                  )}
                  
                  {checkoutStep === 'catalog' ? (
                    <button onClick={() => setCheckoutStep('shipping')} className="w-full py-5 text-white rounded-3xl font-black shadow-2xl flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all" style={{backgroundColor: brandColor, boxShadow: `0 20px 30px -5px ${brandColor}40`}}>CONTINUAR COMPRA <ChevronRight className="w-5 h-5"/></button>
                  ) : checkoutStep === 'shipping' ? (
                    <button onClick={() => setCheckoutStep('payment')} disabled={!customerData.nombre || !customerData.telefono || (customerData.metodoEntrega === 'delivery' && !customerData.direccion) || (customerData.metodoEntrega === 'pickup' && !customerData.sedeId && (config.sedes_recojo?.length || 0) > 0)} className="flex-[2] py-5 text-white rounded-3xl font-black shadow-2xl disabled:opacity-30 transition-all hover:scale-[1.02]" style={{backgroundColor: brandColor, boxShadow: `0 20px 30px -5px ${brandColor}40`}}>IR AL PAGO</button>
                  ) : (
                    <button 
                      onClick={handleSubmitOrder} 
                      disabled={!paymentMethod || isSubmitting} 
                      className="flex-[2] py-5 bg-slate-900 text-white rounded-3xl font-black shadow-2xl flex items-center justify-center gap-4 disabled:opacity-30 transition-all hover:bg-black active:scale-95"
                    >
                      {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'FINALIZAR PEDIDO'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreView;
