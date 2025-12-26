import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Package, Search, ChevronRight, X, Image as ImageIcon, CheckCircle, ArrowLeft, Loader2, Citrus, Plus, Minus, Trash2, Send, Tag, Zap, Star, ShieldCheck, QrCode } from 'lucide-react';
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
  const [checkoutStep, setCheckoutStep] = useState<'catalog' | 'shipping' | 'payment' | 'success'>('catalog');
  
  const [customerData, setCustomerData] = useState({ nombre: '', telefono: '', direccion: '', notas: '' });
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'transferencia' | null>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const brandColor = config.colorPrimario || '#84cc16';

  useEffect(() => {
    fetchProducts();
  }, [session, config]);

  const fetchProducts = async () => {
    setLoading(true);
    const client = new OdooClient(session.url, session.db, true);
    try {
      // Soporte para múltiples categorías separadas por comas
      const categoryNames = (config.tiendaCategoriaNombre || 'Catalogo')
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0);

      let categoryIds: number[] = [];
      
      if (categoryNames.length > 0) {
        // Buscamos todas las categorías indicadas
        const catDomain = ['|'.repeat(categoryNames.length - 1), ...categoryNames.flatMap(name => [['name', 'ilike', name]])].flat();
        // Nota: Odoo domain syntax para múltiples ORs es un poco especial, 
        // simplificamos buscando una por una o usando un domain plano si es solo una.
        const categories = await client.searchRead(session.uid, session.apiKey, 'product.category', 
          categoryNames.length === 1 ? [['name', 'ilike', categoryNames[0]]] : [['name', 'in', categoryNames]], 
          ['id']
        );
        categoryIds = categories.map((c: any) => c.id);
      }

      const domain: any[] = [['sale_ok', '=', true]];
      
      if (categoryIds.length > 0) {
        domain.push(['categ_id', 'child_of', categoryIds]);
      }

      if (session.companyId) domain.push(['company_id', '=', session.companyId]);

      const data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, 
        ['display_name', 'list_price', 'qty_available', 'categ_id', 'image_128'], 
        { limit: 100, order: 'qty_available desc' }
      );

      setProductos(data.map((p: any) => ({
        id: p.id,
        nombre: p.display_name,
        precio: p.list_price,
        costo: 0,
        categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
        stock: p.qty_available,
        imagen: p.image_128
      })));
    } catch (e) {
      console.error("Error fetching products", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return productos.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [productos, searchTerm]);

  const featuredProducts = useMemo(() => productos.filter(p => p.stock > 0).slice(0, 4), [productos]);

  const addToCart = (p: Producto) => {
    setCart(prev => {
      const exists = prev.find(item => item.producto.id === p.id);
      if (exists) return prev.map(item => item.producto.id === p.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      return [...prev, { producto: p, cantidad: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.producto.id === id) {
        const newQty = Math.max(1, item.cantidad + delta);
        return { ...item, cantidad: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.producto.id !== id));
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
      const { error: uploadError } = await supabase.storage
        .from('comprobantes')
        .upload(`${config.code}/${fileName}`, comprobante);

      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('comprobantes').getPublicUrl(`${config.code}/${fileName}`);

      const { data: supaOrder, error: supaError } = await supabase.from('pedidos_online').insert([{
        empresa_codigo: config.code,
        cliente_nombre: customerData.nombre,
        cliente_telefono: customerData.telefono,
        cliente_direccion: customerData.direccion,
        cliente_notas: customerData.notas,
        monto_total: cartTotal,
        metodo_pago: paymentMethod,
        comprobante_url: publicUrl,
        items: cart.map(i => ({ id: i.producto.id, nombre: i.producto.nombre, qty: i.cantidad, precio: i.producto.precio })),
        estado: 'pendiente'
      }]).select().single();

      if (supaError) throw supaError;

      const odoo = new OdooClient(session.url, session.db, true);
      const orderLines = cart.map(item => [0, 0, {
        product_id: item.producto.id,
        product_uom_qty: item.cantidad,
        price_unit: item.producto.precio
      }]);

      await odoo.create(session.uid, session.apiKey, 'sale.order', {
        partner_id: 1, 
        order_line: orderLines,
        note: `PEDIDO WEB #${supaOrder.id}\nCliente: ${customerData.nombre}\nTelf: ${customerData.telefono}\nPago: ${paymentMethod.toUpperCase()}\nComprobante: ${publicUrl}`,
        company_id: session.companyId
      });

      setCheckoutStep('success');
      setCart([]);
    } catch (e: any) {
      alert("Error al procesar: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkoutStep === 'success') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-brand-100 rounded-full flex items-center justify-center mb-6 animate-bounce" style={{backgroundColor: `${brandColor}20`, color: brandColor}}>
          <CheckCircle className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">¡Pedido enviado con éxito!</h2>
        <p className="text-slate-500 mb-8 max-w-xs">Tu pedido está siendo procesado. Te contactaremos vía WhatsApp para confirmar el despacho.</p>
        <button onClick={() => setCheckoutStep('catalog')} className="px-10 py-4 text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-all" style={{backgroundColor: brandColor}}>Volver al Inicio</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 text-slate-800">
      <nav className="bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          {onBack && <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors"><ArrowLeft/></button>}
          <div className="flex items-center gap-3">
             {config.logoUrl ? (
               <img src={config.logoUrl} alt={config.nombreComercial} className="h-10 w-10 object-contain rounded-lg" />
             ) : (
               <div className="p-2.5 rounded-xl shadow-lg shadow-brand-100 text-white" style={{backgroundColor: brandColor}}><Citrus className="w-5 h-5" /></div>
             )}
             <div className="hidden sm:block">
               <h1 className="font-bold text-slate-900 leading-tight uppercase text-sm tracking-tight">{config.nombreComercial || config.code}</h1>
               <div className="flex items-center gap-1">
                 <ShieldCheck className="w-3 h-3 text-emerald-500" />
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tienda Autorizada</p>
               </div>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <button onClick={() => setIsCartOpen(true)} className="relative p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all border border-slate-100">
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && <span className="absolute -top-1.5 -right-1.5 text-white text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-pulse" style={{backgroundColor: brandColor}}>{cart.length}</span>}
          </button>
        </div>
      </nav>

      {checkoutStep === 'catalog' && !searchTerm && (
        <div className="max-w-6xl mx-auto px-4 pt-6">
           <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative z-10 max-w-lg">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 uppercase tracking-widest mb-4">
                  <Zap className="w-3 h-3" /> Promoción de la Semana
                </span>
                <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">Lo mejor para tu salud a un clic</h2>
                <p className="text-slate-400 text-lg font-light mb-8">Catálogo digital conectado en tiempo real con nuestro inventario centralizado.</p>
                <div className="flex flex-wrap gap-4">
                  <button onClick={() => document.getElementById('catalog-grid')?.scrollIntoView({behavior: 'smooth'})} className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold hover:scale-105 transition-all">Explorar Todo</button>
                  <div className="flex items-center gap-2 text-white/60 text-sm font-medium">
                    <CheckCircle className="w-5 h-5 text-emerald-500" /> Stock Real Garantizado
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 right-0 p-12 opacity-20 hidden lg:block">
                 <Package className="w-64 h-64 text-white" />
              </div>
           </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="relative mb-10 -mt-6 sm:-mt-8 z-20 max-w-2xl mx-auto">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input 
            type="text" 
            placeholder="Buscar por nombre de producto..." 
            className="w-full pl-16 pr-6 py-5 bg-white border-none rounded-3xl shadow-xl shadow-slate-200/50 outline-none focus:ring-4 focus:ring-slate-100 transition-all text-slate-800 text-lg placeholder:text-slate-300"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {!searchTerm && checkoutStep === 'catalog' && featuredProducts.length > 0 && (
          <div className="mb-10">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Más Vendidos</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {featuredProducts.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 hover:border-brand-200 hover:shadow-lg transition-all text-left">
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover rounded-xl" alt=""/> : <Package className="w-5 h-5 text-slate-200"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{p.nombre}</p>
                    <p className="text-[10px] font-bold" style={{color: brandColor}}>S/ {p.precio.toFixed(2)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div id="catalog-grid" className="scroll-mt-24">
           <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-6 h-6" style={{color: brandColor}} /> 
                {searchTerm ? 'Resultados' : 'Catálogo'}
              </h3>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{filteredProducts.length} productos</span>
           </div>

           {loading ? (
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
               {[1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className="bg-white rounded-[2.5rem] h-72 animate-pulse"></div>)}
             </div>
           ) : filteredProducts.length === 0 ? (
             <div className="py-24 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                   <Package className="w-10 h-10 text-slate-300" />
                </div>
                <h4 className="text-xl font-bold text-slate-800">No hay productos disponibles</h4>
                <p className="text-slate-400 mt-2 max-w-xs mx-auto">Revisa el término de búsqueda o contacta con la tienda.</p>
             </div>
           ) : (
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
               {filteredProducts.map(p => (
                 <div key={p.id} className="bg-white rounded-[2.5rem] p-4 border border-slate-100 shadow-sm flex flex-col hover:shadow-2xl hover:shadow-brand-100/30 transition-all group relative overflow-hidden">
                   <div className="aspect-square bg-slate-50 rounded-[2rem] mb-4 overflow-hidden flex items-center justify-center relative">
                     {p.imagen ? (
                       <img src={`data:image/png;base64,${p.imagen}`} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                     ) : (
                       <ImageIcon className="w-12 h-12 text-slate-200" />
                     )}
                     {p.stock !== undefined && p.stock <= 0 ? (
                       <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                         <span className="bg-slate-800 text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-tighter">Sin Stock</span>
                       </div>
                     ) : (
                       <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                          <button onClick={() => addToCart(p)} className="p-2.5 bg-white text-slate-800 rounded-xl shadow-lg hover:bg-slate-50 active:scale-90 transition-all"><Plus className="w-5 h-5"/></button>
                       </div>
                     )}
                     {p.precio < 15 && p.stock > 0 && (
                        <div className="absolute top-3 left-3 bg-brand-500 text-white text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-widest shadow-lg" style={{backgroundColor: brandColor}}>Promo</div>
                     )}
                   </div>
                   <div className="flex-1 flex flex-col">
                     <span className="text-[10px] text-slate-400 font-bold uppercase mb-1 tracking-widest truncate">{p.categoria}</span>
                     <h3 className="text-sm font-bold text-slate-800 line-clamp-2 mb-3 leading-snug h-[2.5rem] group-hover:text-brand-600 transition-colors">{p.nombre}</h3>
                     <div className="mt-auto flex items-end justify-between">
                       <div>
                         <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">S/</p>
                         <span className="text-xl font-bold text-slate-900">{p.precio.toFixed(2)}</span>
                       </div>
                       <button 
                         onClick={() => addToCart(p)}
                         disabled={p.stock !== undefined && p.stock <= 0}
                         className="p-3 text-white rounded-2xl shadow-xl active:scale-90 disabled:bg-slate-200 disabled:shadow-none transition-all"
                         style={{backgroundColor: p.stock !== undefined && p.stock <= 0 ? '#e2e8f0' : brandColor, boxShadow: `0 10px 15px -3px ${brandColor}30`}}
                       >
                         <ShoppingCart className="w-5 h-5" />
                       </button>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 rounded-l-[3rem]">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-3 text-slate-900"><ShoppingCart className="w-6 h-6" style={{color: brandColor}}/> Mi Carrito</h2>
                <p className="text-xs text-slate-400 mt-1 font-medium">{cart.length} productos</p>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-3 text-slate-400 hover:bg-slate-50 rounded-2xl transition-colors border border-slate-100"><X /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center px-10">
                  <Package className="w-24 h-24 mb-6 opacity-20" />
                  <p className="text-xl font-bold text-slate-800">Carrito vacío</p>
                </div>
              ) : checkoutStep === 'catalog' ? (
                <div className="space-y-4">
                  {cart.map(item => (
                    <div key={item.producto.id} className="flex gap-5 items-center bg-slate-50 p-4 rounded-[2rem] border border-slate-100 hover:border-brand-100 transition-all">
                      <div className="w-20 h-20 bg-white rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-200">
                         {item.producto.imagen ? <img src={`data:image/png;base64,${item.producto.imagen}`} className="w-full h-full object-cover" alt=""/> : <ImageIcon className="w-8 h-8 text-slate-100"/>}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight">{item.producto.nombre}</h4>
                        <p className="text-sm font-bold mt-2" style={{color: brandColor}}>S/ {item.producto.precio.toFixed(2)}</p>
                        <div className="flex items-center gap-4 mt-3">
                           <button onClick={() => updateQuantity(item.producto.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg hover:bg-slate-50 active:scale-90"><Minus className="w-4 h-4"/></button>
                           <span className="text-sm font-bold w-6 text-center">{item.cantidad}</span>
                           <button onClick={() => updateQuantity(item.producto.id, 1)} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg hover:bg-slate-50 active:scale-90"><Plus className="w-4 h-4"/></button>
                        </div>
                      </div>
                      <button onClick={() => removeFromCart(item.producto.id)} className="p-3 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
                    </div>
                  ))}
                </div>
              ) : checkoutStep === 'shipping' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-brand-50 p-4 rounded-2xl flex items-center gap-3 border border-brand-100" style={{backgroundColor: `${brandColor}10`, borderColor: `${brandColor}20`}}>
                    <div className="p-2 bg-white rounded-lg" style={{color: brandColor}}><Send className="w-4 h-4"/></div>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{color: brandColor}}>Información de Envío</p>
                  </div>
                  <div className="space-y-4">
                    <input type="text" placeholder="Nombre completo" className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2" style={{'--tw-ring-color': brandColor} as any} value={customerData.nombre} onChange={e => setCustomerData({...customerData, nombre: e.target.value})} />
                    <input type="tel" placeholder="WhatsApp" className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2" style={{'--tw-ring-color': brandColor} as any} value={customerData.telefono} onChange={e => setCustomerData({...customerData, telefono: e.target.value})} />
                    <input type="text" placeholder="Dirección detallada" className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2" style={{'--tw-ring-color': brandColor} as any} value={customerData.direccion} onChange={e => setCustomerData({...customerData, direccion: e.target.value})} />
                    <textarea placeholder="Notas adicionales..." className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none h-24 resize-none focus:ring-2" style={{'--tw-ring-color': brandColor} as any} value={customerData.notas} onChange={e => setCustomerData({...customerData, notas: e.target.value})}></textarea>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-emerald-50 p-4 rounded-2xl flex items-center gap-3 border border-emerald-100">
                    <div className="p-2 bg-white rounded-lg text-emerald-600"><Star className="w-4 h-4"/></div>
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Seleccionar Pago</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setPaymentMethod('yape')} className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-3 transition-all ${paymentMethod === 'yape' ? 'border-brand-500 bg-brand-50 shadow-lg' : 'border-slate-100 bg-white'}`} style={{borderColor: paymentMethod === 'yape' ? brandColor : '#f1f5f9'}}>
                      <div className="w-12 h-12 bg-[#742d8a] rounded-2xl flex items-center justify-center text-white font-bold text-xs shadow-lg">Yape</div>
                      <span className="text-xs font-bold">Yape</span>
                    </button>
                    <button onClick={() => setPaymentMethod('plin')} className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-3 transition-all ${paymentMethod === 'plin' ? 'border-brand-500 bg-brand-50 shadow-lg' : 'border-slate-100 bg-white'}`} style={{borderColor: paymentMethod === 'plin' ? brandColor : '#f1f5f9'}}>
                      <div className="w-12 h-12 bg-cyan-500 rounded-2xl flex items-center justify-center text-white font-bold text-xs shadow-lg">Plin</div>
                      <span className="text-xs font-bold">Plin</span>
                    </button>
                  </div>

                  {paymentMethod && (
                    <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100 text-center animate-in zoom-in duration-300">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Pagar S/ {cartTotal.toFixed(2)}</p>
                       <div className="w-52 h-52 bg-white mx-auto mb-6 rounded-3xl border-8 border-white shadow-2xl flex items-center justify-center overflow-hidden">
                          {paymentMethod === 'yape' && config.yapeQR ? (
                            <img src={config.yapeQR} className="w-full h-full object-cover" alt="Yape QR" />
                          ) : paymentMethod === 'plin' && config.plinQR ? (
                            <img src={config.plinQR} className="w-full h-full object-cover" alt="Plin QR" />
                          ) : (
                            <div className="text-center p-4">
                               <QrCode className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                               <p className="text-[9px] text-slate-400 font-bold">Sin QR</p>
                            </div>
                          )}
                       </div>
                       <div className="space-y-2">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Titular:</p>
                          <p className="text-lg font-bold text-slate-900 uppercase tracking-tight">{paymentMethod === 'yape' ? (config.yapeName || config.nombreComercial) : (config.plinName || config.nombreComercial)}</p>
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
                            <span className="text-xl font-bold text-brand-600 font-mono" style={{color: brandColor}}>{paymentMethod === 'yape' ? (config.yapeNumber || '...') : (config.plinNumber || '...')}</span>
                          </div>
                       </div>
                       
                       <div className="mt-8 pt-8 border-t border-slate-200 text-left">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Adjunta captura de pago</label>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="w-full text-xs text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-2xl file:border-0 file:text-xs file:font-bold file:bg-white file:text-slate-800 file:shadow-md cursor-pointer"
                            onChange={(e) => setComprobante(e.target.files ? e.target.files[0] : null)}
                          />
                          {comprobante && <div className="mt-4 flex items-center justify-center gap-2 text-emerald-600 font-bold text-xs bg-emerald-50 py-2 rounded-xl border border-emerald-100"><CheckCircle className="w-4 h-4"/> Foto cargada</div>}
                       </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-10 border-t border-slate-50 bg-slate-50/50">
                <div className="flex justify-between items-center mb-6 px-4">
                  <span className="text-slate-400 font-bold uppercase text-xs tracking-widest">Total:</span>
                  <span className="text-4xl font-bold text-slate-900 tracking-tighter">S/ {cartTotal.toFixed(2)}</span>
                </div>
                
                <div className="flex gap-4">
                  {checkoutStep !== 'catalog' && (
                    <button onClick={() => setCheckoutStep(checkoutStep === 'payment' ? 'shipping' : 'catalog')} className="flex-1 py-5 bg-white border border-slate-200 text-slate-500 rounded-3xl font-bold hover:bg-slate-50 active:scale-95 transition-all">Atrás</button>
                  )}
                  
                  {checkoutStep === 'catalog' && (
                    <button onClick={() => setCheckoutStep('shipping')} className="w-full py-5 text-white rounded-3xl font-bold shadow-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all" style={{backgroundColor: brandColor, boxShadow: `0 20px 25px -5px ${brandColor}40`}}>Confirmar Pedido <ChevronRight className="w-5 h-5"/></button>
                  )}

                  {checkoutStep === 'shipping' && (
                    <button onClick={() => setCheckoutStep('payment')} disabled={!customerData.nombre || !customerData.telefono || !customerData.direccion} className="flex-[2] py-5 text-white rounded-3xl font-bold shadow-2xl disabled:opacity-40 transition-all hover:scale-[1.02]" style={{backgroundColor: brandColor, boxShadow: `0 20px 25px -5px ${brandColor}40`}}>Ir al Pago</button>
                  )}

                  {checkoutStep === 'payment' && (
                    <button 
                      onClick={handleSubmitOrder} 
                      disabled={!comprobante || isSubmitting} 
                      className="flex-[2] py-5 bg-slate-900 text-white rounded-3xl font-bold shadow-2xl flex items-center justify-center gap-3 disabled:opacity-40 transition-all hover:bg-black active:scale-95"
                    >
                      {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CheckCircle className="w-6 h-6" /> Finalizar Pedido</>}
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