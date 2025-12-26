
import React, { useState, useEffect, useMemo } from 'react';
// Added RefreshCw to imports
import { ShoppingCart, Package, Search, X, Image as ImageIcon, ArrowLeft, Loader2, Citrus, Plus, Minus, MapPin, Truck, Info, Beaker, Pill, ClipboardList, CheckCircle2, CreditCard, Upload, MessageCircle, ShieldCheck, HelpCircle, RefreshCw } from 'lucide-react';
import { Producto, CartItem, OdooSession, ClientConfig } from '../types';
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
  
  const [customerData, setCustomerData] = useState({ 
    nombre: '', 
    telefono: '', 
    direccion: '', 
    notas: '', 
    metodoEntrega: 'delivery' as 'delivery' | 'pickup', 
    sedeId: '' 
  });
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'transferencia' | null>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const brandColor = config?.colorPrimario || '#84cc16';
  
  // Sincronización robusta de filtros
  const hiddenIds = useMemo(() => Array.isArray(config?.hiddenProducts) ? config.hiddenProducts.map(Number) : [], [config?.hiddenProducts]);
  const hiddenCats = useMemo(() => Array.isArray(config?.hiddenCategories) ? config.hiddenCategories : [], [config?.hiddenCategories]);

  useEffect(() => {
    if (session && config) {
      fetchProducts();
    }
  }, [session, config]);

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    const client = new OdooClient(session.url, session.db, true);
    try {
      const categoryNames = (config.tiendaCategoriaNombre || 'Catalogo').split(',').map(c => c.trim()).filter(c => c.length > 0);
      const domain: any[] = [['sale_ok', '=', true]];
      if (session.companyId) domain.push(['company_id', '=', session.companyId]);
      if (categoryNames.length > 0) domain.push(['categ_id', 'child_of', categoryNames]);

      const data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, 
        ['display_name', 'list_price', 'qty_available', 'categ_id', 'image_128', 'x_registro_sanitario', 'x_laboratorio', 'x_principio_activo'], 
        { limit: 300, order: 'qty_available desc' }
      );

      setProductos(data.map((p: any) => ({
        id: Number(p.id),
        nombre: p.display_name,
        precio: p.list_price,
        costo: 0,
        categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
        stock: p.qty_available || 0,
        imagen: p.image_128,
        registro_sanitario: p.x_registro_sanitario || '',
        laboratorio: p.x_laboratorio || '',
        principio_activo: p.x_principio_activo || ''
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
      .filter(p => !hiddenCats.includes(p.categoria || ''))
      .filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [productos, searchTerm, hiddenIds, hiddenCats]);

  const addToCart = (p: Producto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCart(prev => {
      const exists = prev.find(item => item.producto.id === p.id);
      if (exists) return prev.map(item => item.producto.id === p.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      return [...prev, { producto: p, cantidad: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => 
      item.producto.id === productId ? { ...item, cantidad: Math.max(1, item.cantidad + delta) } : item
    ));
  };

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
      await supabase.storage.from('comprobantes').upload(`${config.code}/${fileName}`, comprobante);
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
      await odoo.create(session.uid, session.apiKey, 'sale.order', {
        partner_id: 1, 
        order_line: cart.map(item => [0, 0, { product_id: item.producto.id, product_uom_qty: item.cantidad, price_unit: item.producto.precio }]),
        note: `🛒 PEDIDO WEB #${supaOrder.id}\n👤 Cliente: ${customerData.nombre}\n📍 Entrega: ${customerData.metodoEntrega === 'pickup' ? 'RECOJO EN ' + sedeNombre : customerData.direccion}\n💳 Pago: ${paymentMethod.toUpperCase()}\n🖼️ Comprobante: ${publicUrl}`,
        company_id: session.companyId
      });

      setCheckoutStep('success');
      setCart([]);
    } catch (e: any) {
      console.error(e);
      alert("Error al procesar pedido.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!config || !session) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-12">
        <Loader2 className="w-12 h-12 animate-spin text-brand-500 mb-4" />
        <p className="font-black uppercase tracking-widest text-xs text-slate-400">Iniciando Tienda...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col overflow-x-hidden">
      {/* Navbar - Siempre visible */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          {onBack && <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-900 transition-all"><ArrowLeft/></button>}
          <div className="flex items-center gap-3">
             {config.logoUrl ? <img src={config.logoUrl} className="h-10 rounded-lg object-contain" alt="Logo" /> : <div className="p-2 rounded-xl text-white" style={{backgroundColor: brandColor}}><Citrus className="w-5 h-5" /></div>}
             <h1 className="font-black text-slate-900 uppercase text-xs tracking-tighter leading-none">{config.nombreComercial || config.code}</h1>
          </div>
        </div>
        <button onClick={() => setIsCartOpen(true)} className="relative p-3 bg-slate-100 rounded-2xl transition-all hover:bg-slate-200">
          <ShoppingCart className="w-5 h-5 text-slate-600" />
          {cart.length > 0 && <span className="absolute -top-1 -right-1 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center animate-bounce" style={{backgroundColor: brandColor}}>{cart.length}</span>}
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-12">
        <div className="relative max-w-2xl mx-auto animate-in fade-in slide-in-from-top-4 duration-700">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o síntoma..." 
            className="w-full pl-16 pr-6 py-5 bg-white border-none rounded-3xl shadow-xl shadow-slate-200/50 outline-none focus:ring-2 transition-all text-lg font-medium"
            style={{'--tw-ring-color': brandColor} as any}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {[1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className="bg-white rounded-[2.5rem] aspect-[3/4] animate-pulse border border-slate-50 shadow-sm"></div>)}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center animate-in fade-in">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-300">
              <Package className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-black text-slate-800 uppercase">No se encontraron productos</h3>
            <p className="text-slate-500 max-w-xs mt-2 text-sm">Verifica que los productos pertenezcan a la categoría configurada o que no estén marcados como ocultos.</p>
            <button onClick={fetchProducts} className="mt-8 px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2">
              <RefreshCw className="w-4 h-4"/> Reintentar Carga
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filteredProducts.map(p => (
              <div 
                key={p.id} 
                onClick={() => setSelectedProduct(p)}
                className="group relative bg-white rounded-[2.5rem] p-4 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 cursor-pointer flex flex-col"
              >
                <div className="aspect-square bg-slate-50 rounded-[2rem] mb-4 overflow-hidden relative border border-slate-50">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={p.nombre} /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package className="w-12 h-12"/></div>}
                  <button onClick={(e) => addToCart(p, e)} className="absolute bottom-3 right-3 p-3 bg-white rounded-2xl shadow-xl text-slate-800 hover:bg-slate-900 hover:text-white transition-all opacity-0 group-hover:opacity-100"><Plus className="w-5 h-5"/></button>
                </div>
                <div className="flex-1 px-1">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{p.categoria}</span>
                  <h3 className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight mt-1 h-10">{p.nombre}</h3>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xl font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    <Info className="w-4 h-4 text-slate-200 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer Pro - Nueva sección */}
      <footer className="bg-white border-t border-slate-100 pt-16 pb-8 mt-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
           <div className="space-y-4">
              <div className="flex items-center justify-center md:justify-start gap-3">
                 <Citrus className="w-8 h-8 text-brand-500" />
                 <span className="font-black text-xl tracking-tighter uppercase">{config.nombreComercial || config.code}</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed font-medium">Tu salud y bienestar en buenas manos. Compra online y recibe en tu puerta o recoge en nuestra sede más cercana.</p>
           </div>
           
           <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-300">Nuestros Servicios</h4>
              <ul className="space-y-3">
                 <li className="flex items-center justify-center md:justify-start gap-3 text-sm font-bold text-slate-600"><Truck className="w-4 h-4 text-brand-500"/> Delivery Rápido</li>
                 <li className="flex items-center justify-center md:justify-start gap-3 text-sm font-bold text-slate-600"><MapPin className="w-4 h-4 text-brand-500"/> Recojo en Sucursal</li>
                 <li className="flex items-center justify-center md:justify-start gap-3 text-sm font-bold text-slate-600"><ShieldCheck className="w-4 h-4 text-brand-500"/> Productos Garantizados</li>
              </ul>
           </div>

           <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-300">Atención al Cliente</h4>
              <div className="flex flex-col items-center md:items-start gap-4">
                 <a href={`https://wa.me/${config.whatsappNumbers?.split(',')[0] || ''}`} target="_blank" className="flex items-center gap-3 bg-emerald-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-xl shadow-emerald-200 hover:brightness-110 transition-all">
                    <MessageCircle className="w-5 h-5"/> Escribir por WhatsApp
                 </a>
                 <button className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-800 transition-colors">
                    <HelpCircle className="w-4 h-4"/> ¿Necesitas ayuda?
                 </button>
              </div>
           </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex items-center gap-6 opacity-30 grayscale">
              <img src="https://logodownload.org/wp-content/uploads/2014/07/visa-logo-1.png" className="h-4 object-contain" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/1280px-Mastercard-logo.svg.png" className="h-6 object-contain" />
              <img src="https://cdn.icon-icons.com/icons2/2699/PNG/512/yape_logo_icon_169466.png" className="h-6 object-contain" />
           </div>
           <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Powered by LEMON BI &copy; 2025</p>
        </div>
      </footer>

      {/* Modals y Cart Drawer (Se mantienen pero con mejoras de carga) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full z-10"><X /></button>
            <div className="w-full md:w-1/2 bg-slate-50 p-10 flex items-center justify-center">
               {selectedProduct.imagen ? <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-h-[350px] object-contain" alt=""/> : <ImageIcon className="w-24 h-24 text-slate-200"/>}
            </div>
            <div className="w-full md:w-1/2 p-8 md:p-12 overflow-y-auto max-h-[80vh]">
               <h2 className="text-3xl font-black text-slate-900 leading-tight mb-4">{selectedProduct.nombre}</h2>
               <p className="text-4xl font-black mb-8" style={{color: brandColor}}>S/ {selectedProduct.precio.toFixed(2)}</p>
               
               <div className="space-y-4 mb-8">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Ficha Técnica Salud</h4>
                 {config.campos_medicos_visibles?.includes('registro') && selectedProduct.registro_sanitario && (
                   <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                     <ClipboardList className="w-5 h-5 text-slate-400" />
                     <div><p className="text-[10px] font-bold text-slate-400 uppercase">Registro Sanitario</p><p className="text-sm font-bold text-slate-700">{selectedProduct.registro_sanitario}</p></div>
                   </div>
                 )}
                 {config.campos_medicos_visibles?.includes('laboratorio') && selectedProduct.laboratorio && (
                   <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                     <Beaker className="w-5 h-5 text-slate-400" />
                     <div><p className="text-[10px] font-bold text-slate-400 uppercase">Laboratorio / Marca</p><p className="text-sm font-bold text-slate-700">{selectedProduct.laboratorio}</p></div>
                   </div>
                 )}
                 {config.campos_medicos_visibles?.includes('principio') && selectedProduct.principio_activo && (
                   <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                     <Pill className="w-5 h-5 text-slate-400" />
                     <div><p className="text-[10px] font-bold text-slate-400 uppercase">Principio Activo</p><p className="text-sm font-bold text-slate-700">{selectedProduct.principio_activo}</p></div>
                   </div>
                 )}
               </div>

               <button 
                onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                className="w-full py-5 text-white rounded-[2rem] font-black shadow-2xl active:scale-95 transition-all"
                style={{backgroundColor: brandColor}}
               >
                 AÑADIR AL CARRITO
               </button>
            </div>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900">Tu Pedido</h2>
              <button onClick={() => setIsCartOpen(false)} className="p-3 text-slate-400 bg-slate-50 rounded-2xl"><X /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20"><Package className="w-24 h-24 mb-4"/><p className="font-bold uppercase tracking-widest text-xs">Carrito Vacío</p></div>
              ) : checkoutStep === 'catalog' ? (
                cart.map(item => (
                  <div key={item.producto.id} className="flex gap-4 items-center bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    <div className="w-16 h-16 bg-white rounded-xl overflow-hidden shadow-sm">{item.producto.imagen && <img src={`data:image/png;base64,${item.producto.imagen}`} className="w-full h-full object-cover" alt=""/>}</div>
                    <div className="flex-1">
                      <h4 className="text-xs font-black text-slate-800 line-clamp-1">{item.producto.nombre}</h4>
                      <p className="text-sm font-black text-brand-600">S/ {item.producto.precio.toFixed(2)}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <button onClick={() => updateQuantity(item.producto.id, -1)} className="p-1.5 bg-white rounded-lg"><Minus className="w-3 h-3"/></button>
                        <span className="text-xs font-black">{item.cantidad}</span>
                        <button onClick={() => updateQuantity(item.producto.id, 1)} className="p-1.5 bg-white rounded-lg"><Plus className="w-3 h-3"/></button>
                        <button onClick={() => removeFromCart(item.producto.id)} className="ml-auto text-red-300 hover:text-red-500 transition-colors"><X className="w-4 h-4"/></button>
                      </div>
                    </div>
                  </div>
                ))
              ) : checkoutStep === 'shipping' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5">
                   <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setCustomerData({...customerData, metodoEntrega: 'delivery'})} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${customerData.metodoEntrega === 'delivery' ? 'bg-brand-50 border-brand-500' : 'bg-white border-slate-100'}`}>
                         <Truck className={`w-6 h-6 ${customerData.metodoEntrega === 'delivery' ? 'text-brand-600' : 'text-slate-300'}`} />
                         <span className="text-[10px] font-black uppercase tracking-widest">Delivery</span>
                      </button>
                      <button onClick={() => setCustomerData({...customerData, metodoEntrega: 'pickup'})} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${customerData.metodoEntrega === 'pickup' ? 'bg-blue-50 border-blue-500' : 'bg-white border-slate-100'}`}>
                         <MapPin className={`w-6 h-6 ${customerData.metodoEntrega === 'pickup' ? 'text-blue-600' : 'text-slate-300'}`} />
                         <span className="text-[10px] font-black uppercase tracking-widest">Recojo</span>
                      </button>
                   </div>

                   <div className="space-y-3">
                      <input type="text" placeholder="Tu Nombre" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2" value={customerData.nombre} onChange={e => setCustomerData({...customerData, nombre: e.target.value})} />
                      <input type="tel" placeholder="Tu WhatsApp" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2" value={customerData.telefono} onChange={e => setCustomerData({...customerData, telefono: e.target.value})} />
                      
                      {customerData.metodoEntrega === 'delivery' ? (
                        <input type="text" placeholder="Dirección de Envío" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2" value={customerData.direccion} onChange={e => setCustomerData({...customerData, direccion: e.target.value})} />
                      ) : (
                        <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 appearance-none" value={customerData.sedeId} onChange={e => setCustomerData({...customerData, sedeId: e.target.value})}>
                           <option value="">Selecciona una tienda...</option>
                           {config.sedes_recojo?.map(s => <option key={s.id} value={s.id}>{s.nombre} - {s.direccion}</option>)}
                        </select>
                      )}
                      <textarea placeholder="Notas adicionales..." className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none h-24" value={customerData.notas} onChange={e => setCustomerData({...customerData, notas: e.target.value})}></textarea>
                   </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5">
                   <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><CreditCard className="w-6 h-6 text-brand-500" /> Método de Pago</h3>
                   <div className="grid grid-cols-1 gap-3">
                      {[
                        { id: 'yape', label: 'Yape', number: config.yapeNumber, qr: config.yapeQR },
                        { id: 'plin', label: 'Plin', number: config.plinNumber, qr: config.plinQR },
                        { id: 'transferencia', label: 'Transferencia', number: 'BCP/Interbank' }
                      ].map(method => (
                        <button 
                          key={method.id} 
                          onClick={() => setPaymentMethod(method.id as any)}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${paymentMethod === method.id ? 'bg-brand-50 border-brand-500' : 'bg-white border-slate-100'}`}
                        >
                           <div className="flex justify-between items-center">
                             <span className="font-black uppercase text-xs">{method.label}</span>
                             {paymentMethod === method.id && <CheckCircle2 className="w-5 h-5 text-brand-600" />}
                           </div>
                           {method.number && <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{method.number}</p>}
                           {paymentMethod === method.id && method.qr && (
                             <img src={method.qr} className="mt-4 w-32 h-32 mx-auto rounded-xl border border-slate-100" alt="QR" />
                           )}
                        </button>
                      ))}
                   </div>
                   
                   <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 text-center relative group">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        onChange={e => setComprobante(e.target.files?.[0] || null)}
                      />
                      {comprobante ? (
                        <div className="flex flex-col items-center gap-2 text-brand-600">
                          <CheckCircle2 className="w-10 h-10" />
                          <p className="text-xs font-black truncate max-w-full">{comprobante.name}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                           <Upload className="w-10 h-10" />
                           <p className="text-xs font-black uppercase tracking-widest">Subir Comprobante</p>
                        </div>
                      )}
                   </div>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-8 border-t border-slate-100 bg-white space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-slate-400 font-black uppercase text-[10px]">Total</span>
                  <span className="text-3xl font-black text-slate-900">S/ {cartTotal.toFixed(2)}</span>
                </div>
                
                <div className="flex gap-2">
                  {checkoutStep !== 'catalog' && (
                    <button 
                      onClick={() => {
                        if (checkoutStep === 'payment') setCheckoutStep('shipping');
                        else if (checkoutStep === 'shipping') setCheckoutStep('catalog');
                      }} 
                      className="p-5 bg-slate-100 rounded-3xl text-slate-500 font-black"
                    >
                      <ArrowLeft className="w-6 h-6"/>
                    </button>
                  )}
                  
                  {checkoutStep === 'catalog' ? (
                    <button onClick={() => setCheckoutStep('shipping')} className="flex-1 py-5 text-white rounded-3xl font-black shadow-xl" style={{backgroundColor: brandColor}}>SIGUIENTE</button>
                  ) : checkoutStep === 'shipping' ? (
                    <button 
                      onClick={() => setCheckoutStep('payment')} 
                      disabled={!customerData.nombre || !customerData.telefono || (customerData.metodoEntrega === 'delivery' && !customerData.direccion) || (customerData.metodoEntrega === 'pickup' && !customerData.sedeId)}
                      className="flex-1 py-5 text-white rounded-3xl font-black shadow-xl disabled:opacity-30" 
                      style={{backgroundColor: brandColor}}
                    >
                      PAGAR AHORA
                    </button>
                  ) : (
                    <button 
                      onClick={handleSubmitOrder} 
                      disabled={isSubmitting || !paymentMethod || !comprobante} 
                      className="flex-1 py-5 bg-slate-900 text-white rounded-3xl font-black disabled:opacity-30 shadow-2xl"
                    >
                      {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'FINALIZAR PEDIDO'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {checkoutStep === 'success' && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
           <div className="w-32 h-32 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-8 animate-bounce"><CheckCircle2 className="w-16 h-16"/></div>
           <h2 className="text-4xl font-black text-slate-900 mb-4">¡Pedido Recibido!</h2>
           <p className="text-slate-500 font-medium max-w-sm mb-12">Estamos procesando tu solicitud. Te enviaremos un mensaje de WhatsApp para coordinar la entrega.</p>
           <button onClick={() => { setCheckoutStep('catalog'); setIsCartOpen(false); }} className="px-12 py-5 bg-slate-900 text-white rounded-[2rem] font-black">VOLVER AL INICIO</button>
        </div>
      )}
    </div>
  );
};

export default StoreView;
