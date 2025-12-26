
import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Package, Search, ChevronRight, X, Image as ImageIcon, CheckCircle, ArrowLeft, Loader2, Citrus, Plus, Minus, Trash2, Send } from 'lucide-react';
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

  useEffect(() => {
    fetchProducts();
  }, [session, config]);

  const fetchProducts = async () => {
    setLoading(true);
    const client = new OdooClient(session.url, session.db, true);
    try {
      const targetCategoryName = config.tiendaCategoriaNombre || 'Catalogo';
      const categories = await client.searchRead(session.uid, session.apiKey, 'product.category', 
        [['name', 'ilike', targetCategoryName]], 
        ['id']
      );

      const domain: any[] = [['sale_ok', '=', true]];
      
      if (categories && categories.length > 0) {
        const categoryIds = categories.map((c: any) => c.id);
        domain.push(['categ_id', 'child_of', categoryIds]);
      } else if (config.storeCategories) {
        const catIds = config.storeCategories.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (catIds.length > 0) domain.push(['categ_id', 'in', catIds]);
      }

      if (session.companyId) domain.push(['company_id', '=', session.companyId]);

      const data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, 
        ['display_name', 'list_price', 'qty_available', 'categ_id', 'image_128'], 
        { limit: 100 }
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
        <div className="w-24 h-24 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <CheckCircle className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">¡Pedido enviado con éxito!</h2>
        <p className="text-slate-500 mb-8 max-w-xs">Tu pedido está siendo procesado. El dueño del negocio se pondrá en contacto contigo por WhatsApp para coordinar la entrega.</p>
        <button onClick={() => setCheckoutStep('catalog')} className="px-10 py-4 bg-brand-500 text-white rounded-2xl font-bold shadow-xl shadow-brand-200 active:scale-95 transition-all">Volver al Inicio</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {onBack && <button onClick={onBack} className="p-2 -ml-2 text-slate-400"><ArrowLeft/></button>}
          <div className="bg-brand-500 p-2 rounded-xl shadow-lg shadow-brand-100"><Citrus className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="font-bold text-slate-800 leading-none uppercase">{config.code}</h1>
            <p className="text-[10px] text-brand-600 font-bold uppercase tracking-widest mt-0.5">Catálogo Digital</p>
          </div>
        </div>
        <button onClick={() => setIsCartOpen(true)} className="relative p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-brand-50 transition-all">
          <ShoppingCart className="w-5 h-5" />
          {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-brand-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">{cart.length}</span>}
        </button>
      </nav>

      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input 
            type="text" 
            placeholder="Buscar productos..." 
            className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-brand-400 transition-all text-slate-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="bg-white rounded-3xl h-64 animate-pulse"></div>)}
          </div>
        ) : productos.length === 0 ? (
          <div className="py-20 text-center opacity-40">
             <Package className="w-16 h-16 mx-auto mb-4" />
             <p className="font-bold">No hay productos disponibles por ahora.</p>
             <p className="text-sm mt-1">Asegúrate de que tus productos estén en la categoría: <b>{config.tiendaCategoriaNombre || 'Catalogo'}</b></p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map(p => (
              <div key={p.id} className="bg-white rounded-[2rem] p-3 border border-slate-100 shadow-sm flex flex-col hover:shadow-md transition-all group overflow-hidden">
                <div className="aspect-square bg-slate-50 rounded-[1.5rem] mb-3 overflow-hidden flex items-center justify-center relative">
                  {p.imagen ? (
                    <img src={`data:image/png;base64,${p.imagen}`} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-slate-200" />
                  )}
                  {p.stock !== undefined && p.stock <= 0 && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
                      <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-lg uppercase">Agotado</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col px-1">
                  <span className="text-[9px] text-brand-600 font-bold uppercase mb-1 tracking-widest">{p.categoria}</span>
                  <h3 className="text-sm font-bold text-slate-800 line-clamp-2 mb-2 leading-tight min-h-[2.5rem]">{p.nombre}</h3>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="text-lg font-bold text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    <button 
                      onClick={() => addToCart(p)}
                      disabled={p.stock !== undefined && p.stock <= 0}
                      className="p-2 bg-brand-500 text-white rounded-xl shadow-lg shadow-brand-100 active:scale-90 disabled:bg-slate-200 disabled:shadow-none transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Carrito Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800"><ShoppingCart className="w-5 h-5 text-brand-500"/> Tu Carrito</h2>
              <button onClick={() => setIsCartOpen(false)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-colors"><X /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                  <Package className="w-16 h-16 mb-4 opacity-20" />
                  <p className="font-bold">El carrito está vacío</p>
                </div>
              ) : checkoutStep === 'catalog' ? (
                <div className="space-y-4">
                  {cart.map(item => (
                    <div key={item.producto.id} className="flex gap-4 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="w-16 h-16 bg-white rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border">
                         {item.producto.imagen ? <img src={`data:image/png;base64,${item.producto.imagen}`} className="w-full h-full object-cover" alt={item.producto.nombre}/> : <ImageIcon className="w-6 h-6 text-slate-200"/>}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{item.producto.nombre}</h4>
                        <p className="text-xs text-brand-600 font-bold mt-1">S/ {item.producto.precio.toFixed(2)}</p>
                        <div className="flex items-center gap-3 mt-2">
                           <button onClick={() => updateQuantity(item.producto.id, -1)} className="p-1 bg-white border rounded-md hover:bg-slate-50"><Minus className="w-3 h-3"/></button>
                           <span className="text-xs font-bold w-4 text-center">{item.cantidad}</span>
                           <button onClick={() => updateQuantity(item.producto.id, 1)} className="p-1 bg-white border rounded-md hover:bg-slate-50"><Plus className="w-3 h-3"/></button>
                        </div>
                      </div>
                      <button onClick={() => removeFromCart(item.producto.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  ))}
                </div>
              ) : checkoutStep === 'shipping' ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Send className="w-4 h-4 text-brand-500"/> Datos de Entrega</h3>
                  <div className="space-y-3">
                    <input type="text" placeholder="Tu nombre completo" className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-200" value={customerData.nombre} onChange={e => setCustomerData({...customerData, nombre: e.target.value})} />
                    <input type="tel" placeholder="Número de WhatsApp" className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-200" value={customerData.telefono} onChange={e => setCustomerData({...customerData, telefono: e.target.value})} />
                    <input type="text" placeholder="Dirección de entrega" className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-200" value={customerData.direccion} onChange={e => setCustomerData({...customerData, direccion: e.target.value})} />
                    <textarea placeholder="Referencia o notas adicionales..." className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none h-24 resize-none focus:ring-2 focus:ring-brand-200" value={customerData.notas} onChange={e => setCustomerData({...customerData, notas: e.target.value})}></textarea>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="font-bold text-slate-800">Método de Pago</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setPaymentMethod('yape')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'yape' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 bg-white'}`}>
                      <div className="w-10 h-10 bg-[#742d8a] rounded-xl flex items-center justify-center text-white font-bold text-[10px]">Yape</div>
                      <span className="text-xs font-bold uppercase">Yape</span>
                    </button>
                    <button onClick={() => setPaymentMethod('plin')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'plin' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 bg-white'}`}>
                      <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center text-white font-bold text-[10px]">Plin</div>
                      <span className="text-xs font-bold uppercase">Plin</span>
                    </button>
                  </div>

                  {paymentMethod && (
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 text-center animate-in zoom-in duration-300">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Escanea para pagar</p>
                       <div className="w-44 h-44 bg-white mx-auto mb-4 rounded-3xl border-4 border-white shadow-sm flex items-center justify-center overflow-hidden">
                          {paymentMethod === 'yape' && config.yapeQR ? (
                            <img src={config.yapeQR} className="w-full h-full object-cover" alt="QR Yape"/>
                          ) : paymentMethod === 'plin' && config.plinQR ? (
                            <img src={config.plinQR} className="w-full h-full object-cover" alt="QR Plin" />
                          ) : (
                            <ImageIcon className="w-10 h-10 text-slate-100 opacity-20" />
                          )}
                       </div>
                       <div className="space-y-1">
                          <p className="text-xs text-slate-500 font-medium">Titular:</p>
                          <p className="font-bold text-slate-800 uppercase tracking-tight">{paymentMethod === 'yape' ? (config.yapeName || config.code) : (config.plinName || config.code)}</p>
                          <p className="text-xl font-bold text-brand-600 font-mono tracking-tighter">{paymentMethod === 'yape' ? (config.yapeNumber || '...') : (config.plinNumber || '...')}</p>
                       </div>
                       
                       <div className="mt-8 pt-6 border-t border-slate-200">
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-3">Adjunta el comprobante</label>
                          <div className="relative">
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                              onChange={(e) => setComprobante(e.target.files ? e.target.files[0] : null)}
                            />
                            {comprobante && <p className="mt-2 text-[10px] text-emerald-600 font-bold flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3"/> Imagen cargada con éxito</p>}
                          </div>
                       </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 border-t bg-slate-50/50">
                <div className="flex justify-between items-center mb-4 px-2">
                  <span className="text-slate-500 font-medium">Total a pagar:</span>
                  <span className="text-2xl font-bold text-slate-900">S/ {cartTotal.toFixed(2)}</span>
                </div>
                
                <div className="flex gap-3">
                  {checkoutStep !== 'catalog' && (
                    <button onClick={() => setCheckoutStep(checkoutStep === 'payment' ? 'shipping' : 'catalog')} className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-bold active:scale-95 transition-all">Volver</button>
                  )}
                  
                  {checkoutStep === 'catalog' && (
                    <button onClick={() => setCheckoutStep('shipping')} className="w-full py-4 bg-brand-500 text-white rounded-2xl font-bold shadow-xl shadow-brand-100 flex items-center justify-center gap-2 hover:bg-brand-600 active:scale-95 transition-all">Continuar Compra <ChevronRight className="w-5 h-5"/></button>
                  )}

                  {checkoutStep === 'shipping' && (
                    <button onClick={() => setCheckoutStep('payment')} disabled={!customerData.nombre || !customerData.telefono || !customerData.direccion} className="flex-[2] py-4 bg-brand-500 text-white rounded-2xl font-bold shadow-xl shadow-brand-100 disabled:opacity-40 transition-all">Elegir Pago</button>
                  )}

                  {checkoutStep === 'payment' && (
                    <button 
                      onClick={handleSubmitOrder} 
                      disabled={!comprobante || isSubmitting} 
                      className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                    >
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Finalizar Pedido'}
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
