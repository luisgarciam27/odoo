
import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Package, Search, X, Image as ImageIcon, ArrowLeft, Loader2, Citrus, Plus, Minus, Info, CheckCircle2, MapPin, Truck, CreditCard, Upload, MessageCircle } from 'lucide-react';
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

  const brandColor = config?.colorPrimario || '#009a51'; 
  
  const hiddenIds = useMemo(() => (config?.hiddenProducts || []).map(id => Number(id)), [config?.hiddenProducts]);
  const hiddenCats = useMemo(() => (config?.hiddenCategories || []).map(c => c.trim().toUpperCase()), [config?.hiddenCategories]);

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    const client = new OdooClient(session.url, session.db, true);
    try {
      const fields = [
        'display_name', 'list_price', 'qty_available', 'categ_id', 'image_128', 
        'description_sale', 'x_registro_sanitario', 'x_laboratorio', 'x_principio_activo'
      ];

      const configCategory = (config.tiendaCategoriaNombre || '').trim();
      let data: any[] = [];

      // NIVEL 1: Intento por categoría específica (si existe configuración)
      if (configCategory && configCategory.toUpperCase() !== 'TODAS' && configCategory.toUpperCase() !== 'CATALOGO') {
        try {
          const cats = await client.searchRead(session.uid, session.apiKey, 'product.category', [['name', 'ilike', configCategory]], ['id']);
          if (cats && cats.length > 0) {
            const catIds = cats.map((c: any) => c.id);
            data = await client.searchRead(session.uid, session.apiKey, 'product.product', 
              [['sale_ok', '=', true], ['categ_id', 'in', catIds]], 
              fields, { limit: 500, order: 'image_128 desc, display_name asc' }
            );
          }
        } catch (e) {
          console.warn("Fallo por categoría, reintentando carga general...");
        }
      }

      // NIVEL 2: Carga general de productos para la venta (Fallback principal)
      if (data.length === 0) {
        try {
          data = await client.searchRead(session.uid, session.apiKey, 'product.product', 
            [['sale_ok', '=', true]], 
            fields, 
            { limit: 500, order: 'image_128 desc, display_name asc' }
          );
        } catch (e) {
          console.warn("Fallo general, intentando carga sin filtros de venta...");
          // NIVEL 3: Carga de emergencia (sin filtros)
          data = await client.searchRead(session.uid, session.apiKey, 'product.product', [], fields, { limit: 100 });
        }
      }

      const mapped = data.map((p: any) => ({
        id: Number(p.id),
        nombre: p.display_name,
        precio: p.list_price || 0,
        costo: 0,
        categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
        stock: p.qty_available || 0,
        imagen: p.image_128,
        descripcion_venta: p.description_sale || '',
        registro_sanitario: p.x_registro_sanitario || '',
        laboratorio: p.x_laboratorio || (Array.isArray(p.categ_id) ? p.categ_id[1] : 'Laboratorio'),
        principio_activo: p.x_principio_activo || '',
        presentacion: p.display_name.split(',').pop()?.trim() || ''
      }));
      setProductos(mapped);
    } catch (e) {
      console.error("Error definitivo cargando productos:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [session, config.tiendaCategoriaNombre]);

  const filteredProducts = useMemo(() => {
    return productos.filter(p => {
      if (hiddenIds.includes(p.id)) return false;
      const catName = (p.categoria || 'General').trim().toUpperCase();
      if (hiddenCats.includes(catName)) return false;
      if (searchTerm && !p.nombre.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
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
        empresa_codigo: config.code, cliente_nombre: customerData.nombre, cliente_telefono: customerData.telefono,
        cliente_direccion: customerData.metodoEntrega === 'pickup' ? `RECOJO: ${sedeNombre}` : customerData.direccion,
        cliente_notas: customerData.notas, monto_total: cartTotal, metodo_pago: paymentMethod, comprobante_url: publicUrl,
        items: cart.map(i => ({ id: i.producto.id, nombre: i.producto.nombre, qty: i.cantidad, precio: i.producto.precio })),
        metodo_entrega: customerData.metodoEntrega, sede_recojo: customerData.metodoEntrega === 'pickup' ? sedeNombre : null, estado: 'pendiente'
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
    } finally { setIsSubmitting(false); }
  };

  if (!config || !session) return null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col overflow-x-hidden">
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

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-12">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input type="text" placeholder="¿Qué estás buscando hoy?" className="w-full pl-16 pr-6 py-5 bg-white border-none rounded-3xl shadow-xl outline-none focus:ring-2 transition-all text-lg font-medium" style={{'--tw-ring-color': brandColor} as any} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {[1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className="bg-white rounded-[2.5rem] aspect-[3/4] animate-pulse border border-slate-50 shadow-sm"></div>)}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-300"><Package className="w-12 h-12" /></div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Catálogo Disponible</h3>
            <p className="text-slate-400 text-sm mt-2 font-medium">Estamos actualizando nuestra lista de productos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-in fade-in duration-500">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => setSelectedProduct(p)} className="group relative bg-white rounded-[2.5rem] p-4 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 cursor-pointer flex flex-col">
                <div className="aspect-square bg-slate-50 rounded-[2rem] mb-4 overflow-hidden relative border border-slate-50 flex items-center justify-center">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={p.nombre} /> : <Package className="w-12 h-12 text-slate-200"/>}
                  <button onClick={(e) => addToCart(p, e)} className="absolute bottom-3 right-3 p-3 bg-white rounded-2xl shadow-xl text-slate-800 hover:bg-slate-900 hover:text-white transition-all opacity-0 group-hover:opacity-100"><Plus className="w-5 h-5"/></button>
                </div>
                <div className="flex-1 px-1">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{p.categoria}</span>
                  <h3 className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight mt-1 h-10">{p.nombre}</h3>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xl font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    <Info className="w-4 h-4 text-slate-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-100 py-20 mt-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
           <div className="space-y-4">
              <div className="flex items-center justify-center md:justify-start gap-3">
                 <Citrus className="w-8 h-8 text-brand-500" />
                 <span className="font-black text-xl tracking-tighter uppercase">{config.nombreComercial || config.code}</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed font-medium">Cuidado experto para tu bienestar y salud diaria.</p>
           </div>
           <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-300">Servicios Online</h4>
              <ul className="space-y-3">
                 <li className="flex items-center justify-center md:justify-start gap-3 text-sm font-bold text-slate-600"><Truck className="w-4 h-4 text-brand-500"/> Delivery a Domicilio</li>
                 <li className="flex items-center justify-center md:justify-start gap-3 text-sm font-bold text-slate-600"><MapPin className="w-4 h-4 text-brand-500"/> Recojo en Local</li>
              </ul>
           </div>
           <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-300">Contacto Directo</h4>
              <a href={`https://wa.me/${config.whatsappNumbers?.split(',')[0] || ''}`} className="inline-flex items-center gap-3 bg-emerald-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-xl hover:brightness-110 transition-all">
                 <MessageCircle className="w-5 h-5"/> WhatsApp
              </a>
           </div>
        </div>
        <div className="text-center mt-12 pt-8 border-t border-slate-50">
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Powered by LEMON BI &copy; 2025</p>
        </div>
      </footer>

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative bg-white w-full max-w-6xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row animate-in zoom-in-95 max-h-[95vh]">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-6 right-6 p-3 bg-white shadow-lg rounded-full z-10 hover:bg-slate-50 transition-all"><X className="w-6 h-6"/></button>
            
            <div className="w-full lg:w-1/2 bg-slate-50 flex flex-col items-center justify-center p-8 lg:p-20 relative min-h-[400px]">
               <div className="w-full aspect-square bg-white rounded-[3rem] shadow-inner p-10 flex items-center justify-center border border-slate-100">
                  {selectedProduct.imagen ? <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-h-full max-w-full object-contain" alt=""/> : <ImageIcon className="w-32 h-32 text-slate-100"/>}
               </div>
               <div className="absolute right-0 top-1/2 -translate-y-1/2 h-4/5 w-16 bg-brand-500 rounded-l-3xl flex items-center justify-center overflow-hidden">
                  <span className="text-white font-black uppercase text-xl tracking-widest origin-center -rotate-90 whitespace-nowrap opacity-40">{selectedProduct.categoria}</span>
               </div>
            </div>

            <div className="w-full lg:w-1/2 p-8 lg:p-14 overflow-y-auto bg-white border-l border-slate-50">
               <div className="mb-8">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">{selectedProduct.laboratorio || 'PRODUCTO ODOO'} {selectedProduct.presentacion && ` • ${selectedProduct.presentacion.toUpperCase()}`}</span>
                  <h2 className="text-3xl lg:text-4xl font-black text-slate-900 leading-[1.1] mb-6">{selectedProduct.nombre}</h2>
                  
                  <div className="flex flex-col sm:flex-row sm:items-end gap-6 mb-8 py-6 border-y border-slate-50">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio Regular</p>
                      <p className="text-xl font-bold text-slate-400 line-through">S/ {selectedProduct.precio.toFixed(2)}</p>
                    </div>
                    <div className="bg-brand-50 p-4 rounded-2xl flex-1 flex items-center justify-between border border-brand-100">
                       <div>
                         <p className="text-[9px] font-black text-brand-600 uppercase tracking-widest mb-0.5">Precio Online</p>
                         <p className="text-4xl font-black text-brand-600">S/ {(selectedProduct.precio * 0.95).toFixed(2)}</p>
                       </div>
                    </div>
                  </div>

                  <div className="mb-10">
                     <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">Detalles</h4>
                     {selectedProduct.descripcion_venta ? (
                       <ul className="space-y-3">
                         {selectedProduct.descripcion_venta.split('\n').filter(line => line.trim()).map((line, i) => (
                           <li key={i} className="flex gap-3 text-sm font-medium text-slate-600">
                             <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 shrink-0"></div>
                             {line}
                           </li>
                         ))}
                       </ul>
                     ) : (
                       <p className="text-sm italic text-slate-400 font-medium">Información pendiente de actualización.</p>
                     )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Registro Sanitario</p>
                        <p className="text-xs font-bold text-slate-800">{selectedProduct.registro_sanitario || 'Consultar RS'}</p>
                     </div>
                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Empresa</p>
                        <p className="text-xs font-bold text-brand-600">{config.nombreComercial}</p>
                     </div>
                  </div>

                  <div className="flex gap-4 sticky bottom-0 bg-white pt-4">
                     <button 
                       onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} 
                       className="flex-1 py-5 text-white rounded-[2rem] font-black shadow-2xl active:scale-95 transition-all uppercase tracking-widest text-xs" 
                       style={{backgroundColor: brandColor}}
                     >
                       Añadir a mi pedido
                     </button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Mi Pedido</h2>
              <button onClick={() => setIsCartOpen(false)} className="p-3 text-slate-400 bg-slate-50 rounded-2xl"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20"><Package className="w-24 h-24 mb-4"/><p className="font-bold uppercase tracking-widest text-xs">Carrito Vacío</p></div>
              ) : checkoutStep === 'catalog' ? (
                cart.map(item => (
                  <div key={item.producto.id} className="flex gap-4 items-center bg-slate-50 p-4 rounded-3xl">
                    <div className="w-16 h-16 bg-white rounded-xl overflow-hidden shadow-sm flex items-center justify-center">{item.producto.imagen ? <img src={`data:image/png;base64,${item.producto.imagen}`} className="w-full h-full object-cover" alt=""/> : <Package className="w-6 h-6 text-slate-200"/>}</div>
                    <div className="flex-1">
                      <h4 className="text-xs font-black text-slate-800 line-clamp-1">{item.producto.nombre}</h4>
                      <p className="text-sm font-black text-brand-600">S/ {item.producto.precio.toFixed(2)}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <button onClick={() => updateQuantity(item.producto.id, -1)} className="p-1 bg-white rounded-lg shadow-sm"><Minus className="w-3 h-3"/></button>
                        <span className="text-xs font-black">{item.cantidad}</span>
                        <button onClick={() => updateQuantity(item.producto.id, 1)} className="p-1 bg-white rounded-lg shadow-sm"><Plus className="w-3 h-3"/></button>
                        <button onClick={() => removeFromCart(item.producto.id)} className="ml-auto text-red-300 hover:text-red-500"><X className="w-4 h-4"/></button>
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
                      <input type="text" placeholder="Tu Nombre" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 shadow-sm" style={{'--tw-ring-color': brandColor} as any} value={customerData.nombre} onChange={e => setCustomerData({...customerData, nombre: e.target.value})} />
                      <input type="tel" placeholder="Tu WhatsApp" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 shadow-sm" style={{'--tw-ring-color': brandColor} as any} value={customerData.telefono} onChange={e => setCustomerData({...customerData, telefono: e.target.value})} />
                      {customerData.metodoEntrega === 'delivery' ? (
                        <input type="text" placeholder="Dirección de Envío" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 shadow-sm" style={{'--tw-ring-color': brandColor} as any} value={customerData.direccion} onChange={e => setCustomerData({...customerData, direccion: e.target.value})} />
                      ) : (
                        <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 appearance-none shadow-sm" style={{'--tw-ring-color': brandColor} as any} value={customerData.sedeId} onChange={e => setCustomerData({...customerData, sedeId: e.target.value})}>
                           <option value="">Selecciona una tienda...</option>
                           {config.sedes_recojo?.map(s => <option key={s.id} value={s.id}>{s.nombre} - {s.direccion}</option>)}
                        </select>
                      )}
                      <textarea placeholder="Notas adicionales..." className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none h-24 shadow-sm" value={customerData.notas} onChange={e => setCustomerData({...customerData, notas: e.target.value})}></textarea>
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
                <div className="flex justify-between items-end"><span className="text-slate-400 font-black uppercase text-[10px]">Total de Compra</span><span className="text-3xl font-black text-slate-900">S/ {cartTotal.toFixed(2)}</span></div>
                <div className="flex gap-2">
                  {checkoutStep !== 'catalog' && (
                    <button onClick={() => { if (checkoutStep === 'payment') setCheckoutStep('shipping'); else setCheckoutStep('catalog'); }} className="p-5 bg-slate-100 rounded-3xl text-slate-500 font-black transition-all active:scale-95"><ArrowLeft className="w-6 h-6"/></button>
                  )}
                  {checkoutStep === 'catalog' ? (
                    <button onClick={() => setCheckoutStep('shipping')} className="flex-1 py-5 text-white rounded-3xl font-black shadow-xl transition-all active:scale-95 uppercase tracking-widest text-xs" style={{backgroundColor: brandColor}}>Paso Siguiente</button>
                  ) : checkoutStep === 'shipping' ? (
                    <button onClick={() => setCheckoutStep('payment')} disabled={!customerData.nombre || !customerData.telefono} className="flex-1 py-5 text-white rounded-3xl font-black shadow-xl transition-all active:scale-95 disabled:opacity-30 uppercase tracking-widest text-xs" style={{backgroundColor: brandColor}}>Ir al Pago</button>
                  ) : (
                    <button onClick={handleSubmitOrder} disabled={isSubmitting || !paymentMethod || !comprobante} className="flex-1 py-5 bg-slate-900 text-white rounded-3xl font-black transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center uppercase tracking-widest text-xs">
                      {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Confirmar Pedido'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {checkoutStep === 'success' && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
           <div className="w-32 h-32 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-8 animate-bounce shadow-xl shadow-emerald-100"><CheckCircle2 className="w-16 h-16"/></div>
           <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">¡Pedido Recibido!</h2>
           <p className="text-slate-500 mb-10 max-w-sm font-medium">Muchas gracias por tu compra. Nos pondremos en contacto contigo vía WhatsApp para confirmar la entrega.</p>
           <button onClick={() => { setCheckoutStep('catalog'); setIsCartOpen(false); setCart([]); }} className="px-12 py-5 bg-slate-900 text-white rounded-[2rem] font-black transition-all active:scale-95 shadow-xl uppercase tracking-widest text-xs">Volver al Inicio</button>
        </div>
      )}
    </div>
  );
};

export default StoreView;
