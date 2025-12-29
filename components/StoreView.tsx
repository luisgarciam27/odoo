
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<StoreStep>('cart');
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'efectivo'>('yape');
  const [deliveryType, setDeliveryType] = useState<'recojo' | 'delivery'>('recojo');
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '', sedeId: '' });
  const [voucherImage, setVoucherImage] = useState<string | null>(null);
  const [isOrderLoading, setIsOrderLoading] = useState(false);

  const brandColor = config?.colorPrimario || '#84cc16'; 

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.producto.precio * item.cantidad, 0);
  }, [cart]);

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
    
    // Configuraciones de campos en cascada para Odoo 14-17
    const fieldSets = [
      ['display_name', 'list_price', 'categ_id', 'image_128', 'qty_available', 'uom_id', 'description_sale'],
      ['display_name', 'list_price', 'categ_id', 'image_medium', 'qty_available'],
      ['display_name', 'list_price', 'categ_id', 'image_small'],
      ['display_name', 'list_price']
    ];

    try {
      const extrasMap = await getProductExtras(config.code);
      let data = null;
      
      // Intento en cascada
      for (const fields of fieldSets) {
        try {
          console.log(`Intentando cargar con ${fields.length} campos...`);
          data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true], ['active', '=', true]], fields, { limit: 500 });
          if (data && Array.isArray(data)) break;
        } catch (e) {
          console.warn(`Error con campos ${fields.join(',')}. Probando fallback...`);
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
        setErrorMsg("No se recibieron productos del servidor.");
      }
    } catch (e: any) { 
      console.error(e);
      setErrorMsg(`Error de conexión: ${e.message || 'Odoo no responde'}`);
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchProducts(); }, [session, config.code]);

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
          partner_id: partnerId, company_id: session.companyId, order_line: orderLines, origin: `WEB LEMON: ${orderRef}`, note: `Pago: ${paymentMethod.toUpperCase()}`, state: 'draft' 
      });

      await supabase.from('pedidos_tienda').insert([{
        order_name: orderRef, cliente_nombre: clientData.nombre, monto: cartTotal, voucher_url: voucherImage || '', empresa_code: config.code, estado: 'pendiente'
      }]);

      const message = `*NUEVO PEDIDO - ${config.nombreComercial || config.code}*\n` +
        `*Referencia:* ${orderRef}\n*Cliente:* ${clientData.nombre}\n*Total:* S/ ${cartTotal.toFixed(2)}\n*Pago:* ${paymentMethod.toUpperCase()}`;

      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank');
      setCurrentStep('success');
    } catch (err) { alert("Error al enviar pedido."); }
    finally { setIsOrderLoading(false); }
  };

  const filteredProducts = useMemo(() => {
    return productos.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [productos, searchTerm]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col relative overflow-x-hidden">
      
      {/* HEADER */}
      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
           <div className="flex items-center gap-3">
             {onBack && <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-900 transition-all"><ArrowLeft/></button>}
             <h1 className="font-black text-slate-900 uppercase text-[12px] md:text-sm tracking-tighter">{config.nombreComercial || config.code}</h1>
           </div>
           
           <div className="flex-1 max-w-sm hidden sm:block">
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"/>
                 <input type="text" placeholder="Buscar productos..." className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl text-xs font-bold outline-none border border-slate-100" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
           </div>

           <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-3 bg-slate-900 text-white rounded-xl shadow-lg transition-transform active:scale-95">
             <ShoppingCart className="w-5 h-5" />
             {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-brand-500 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black border-2 border-white">{cart.length}</span>}
           </button>
        </div>
      </header>

      {/* CONTENIDO */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
             <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">Sincronizando con {session.db}...</p>
          </div>
        ) : errorMsg ? (
          <div className="py-40 text-center flex flex-col items-center gap-6 max-w-md mx-auto">
             <AlertCircle className="w-16 h-16 text-red-300" />
             <div className="space-y-2">
                <p className="text-sm font-black uppercase text-slate-800">Error de Conexión</p>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">{errorMsg}</p>
             </div>
             <button onClick={fetchProducts} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2"><RefreshCw className="w-4 h-4"/> Reintentar</button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-40 text-center flex flex-col items-center gap-6 opacity-40">
             <SearchX className="w-20 h-20 text-slate-200" />
             <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">No se encontraron productos disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 animate-in fade-in duration-500">
            {filteredProducts.map(p => (
              <div key={p.id} className="bg-white p-3 md:p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-xl transition-all">
                <div className="aspect-square bg-slate-50 rounded-2xl mb-3 flex items-center justify-center relative overflow-hidden">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain" /> : <Package className="w-8 h-8 text-slate-200" />}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{p.categoria}</p>
                  <h3 className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase line-clamp-2 leading-tight h-8 mb-4">{p.nombre}</h3>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                    <span className="text-sm font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    <button onClick={() => addToCart(p)} className="p-2 bg-slate-900 text-white rounded-lg shadow-md hover:scale-110 active:scale-95 transition-all"><Plus className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* DRAWER CARRITO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative bg-white w-full max-w-lg h-full shadow-2xl flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-xl font-black uppercase tracking-tighter">Tu Compra</h2>
                 <button onClick={() => setIsCartOpen(false)} className="p-2 bg-slate-50 rounded-xl"><X/></button>
              </div>

              {currentStep === 'cart' && (
                 <div className="space-y-4 flex-1">
                    {cart.length === 0 ? (
                       <div className="py-20 text-center opacity-30 flex flex-col items-center gap-6"><ShoppingCart className="w-16 h-16"/><p className="font-black uppercase tracking-widest">Carrito vacío</p></div>
                    ) : cart.map(i => (
                       <div key={i.producto.id} className="flex gap-3 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <div className="w-12 h-12 bg-white rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                             {i.producto.imagen ? <img src={`data:image/png;base64,${i.producto.imagen}`} className="w-full h-full object-contain" /> : <Package className="w-6 h-6 text-slate-200"/>}
                          </div>
                          <div className="flex-1">
                             <p className="text-[9px] font-black uppercase truncate">{i.producto.nombre}</p>
                             <p className="font-black text-xs">S/ {i.producto.precio.toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-2 bg-white p-1 rounded-lg">
                             <button onClick={() => updateCartQuantity(i.producto.id, -1)} className="p-1"><Minus className="w-3.5 h-3.5"/></button>
                             <span className="text-xs font-black w-4 text-center">{i.cantidad}</span>
                             <button onClick={() => updateCartQuantity(i.producto.id, 1)} className="p-1"><Plus className="w-3.5 h-3.5"/></button>
                          </div>
                       </div>
                    ))}
                    <button onClick={() => setCurrentStep('details')} disabled={cart.length === 0} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest mt-auto">Continuar</button>
                 </div>
              )}

              {currentStep === 'details' && (
                 <div className="space-y-6">
                    <h2 className="text-lg font-black uppercase">Tus Datos</h2>
                    <input type="text" placeholder="Nombre completo" className="w-full p-4 bg-slate-50 rounded-xl outline-none font-bold shadow-inner" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                    <input type="tel" placeholder="WhatsApp / Celular" className="w-full p-4 bg-slate-50 rounded-xl outline-none font-bold shadow-inner" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                    <div className="grid grid-cols-2 gap-2">
                       <button onClick={() => setDeliveryType('recojo')} className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] ${deliveryType === 'recojo' ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}>Recojo Sede</button>
                       <button onClick={() => setDeliveryType('delivery')} className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] ${deliveryType === 'delivery' ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}>Delivery</button>
                    </div>
                    {deliveryType === 'delivery' && (
                       <textarea placeholder="Dirección exacta..." className="w-full p-4 bg-slate-50 rounded-xl outline-none font-bold h-24 shadow-inner" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                    )}
                    <button onClick={() => setCurrentStep('payment')} disabled={!clientData.nombre || !clientData.telefono} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase disabled:opacity-50">Siguiente</button>
                 </div>
              )}

              {currentStep === 'payment' && (
                 <div className="space-y-6">
                    <h2 className="text-lg font-black uppercase text-center">Total: S/ {cartTotal.toFixed(2)}</h2>
                    <div className="flex gap-2">
                       <button onClick={() => setPaymentMethod('yape')} className={`flex-1 p-4 rounded-xl border-2 font-black uppercase text-[10px] ${paymentMethod === 'yape' ? 'border-purple-600 bg-purple-50' : 'bg-slate-50'}`}>Yape</button>
                       <button onClick={() => setPaymentMethod('plin')} className={`flex-1 p-4 rounded-xl border-2 font-black uppercase text-[10px] ${paymentMethod === 'plin' ? 'border-blue-600 bg-blue-50' : 'bg-slate-50'}`}>Plin</button>
                    </div>
                    <div className="aspect-square bg-slate-900 rounded-[2.5rem] flex items-center justify-center p-8 shadow-xl">
                       {paymentMethod === 'yape' ? (config.yapeQR && <img src={config.yapeQR.startsWith('data:') ? config.yapeQR : `data:image/png;base64,${config.yapeQR}`} className="max-w-full max-h-full rounded-2xl" />) : (config.plinQR && <img src={config.plinQR.startsWith('data:') ? config.plinQR : `data:image/png;base64,${config.plinQR}`} className="max-w-full max-h-full rounded-2xl" />)}
                       {!config.yapeQR && !config.plinQR && <QrCode className="text-white w-20 h-20 opacity-20"/>}
                    </div>
                    <div className="text-center">
                       <p className="text-2xl font-black text-slate-900 tracking-widest">{paymentMethod === 'yape' ? (config.yapeNumber || '975615244') : (config.plinNumber || '975615244')}</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{paymentMethod === 'yape' ? (config.yapeName || 'LEMON BI') : (config.plinName || 'LEMON BI')}</p>
                    </div>
                    <button onClick={() => setCurrentStep('voucher')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase">Ya pagué, subir voucher</button>
                 </div>
              )}

              {currentStep === 'voucher' && (
                 <div className="space-y-6">
                    <h2 className="text-lg font-black uppercase text-center">Subir Comprobante</h2>
                    <div className="border-4 border-dashed rounded-[2.5rem] aspect-[3/4] flex flex-col items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
                       {voucherImage ? (
                          <>
                             <img src={voucherImage} className="w-full h-full object-cover" />
                             <button onClick={() => setVoucherImage(null)} className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-xl"><Trash2/></button>
                          </>
                       ) : (
                          <label className="cursor-pointer flex flex-col items-center text-slate-400">
                             <Camera className="w-12 h-12 mb-2"/>
                             <p className="text-[10px] font-black uppercase">Seleccionar Imagen</p>
                             <input type="file" className="hidden" accept="image/*" onChange={handleVoucherUpload} />
                          </label>
                       )}
                    </div>
                    <button onClick={handleFinishOrder} disabled={!voucherImage || isOrderLoading} className="w-full py-4 bg-brand-500 text-white rounded-2xl font-black uppercase disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-brand-200">
                       {isOrderLoading ? <Loader2 className="animate-spin w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>} FINALIZAR PEDIDO
                    </button>
                 </div>
              )}

              {currentStep === 'success' && (
                 <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-24 h-24 bg-brand-500 text-white rounded-full flex items-center justify-center shadow-2xl animate-in zoom-in duration-500"><CheckCircle2 className="w-12 h-12"/></div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter">¡Pedido Enviado!</h3>
                    <p className="text-sm font-bold text-slate-400 leading-relaxed uppercase">Tu orden ha sido registrada. Pronto nos pondremos en contacto contigo.</p>
                    <button onClick={() => { setIsCartOpen(false); setCart([]); setCurrentStep('cart'); }} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase">Cerrar y Regresar</button>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default StoreView;
