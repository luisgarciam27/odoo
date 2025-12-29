
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
    
    // Motor de carga en cascada para Odoo 14-17
    const fieldSets = [
      ['display_name', 'list_price', 'categ_id', 'image_128', 'qty_available', 'uom_id', 'description_sale'],
      ['display_name', 'list_price', 'categ_id', 'image_128', 'uom_id'], // Sin stock
      ['display_name', 'list_price', 'categ_id', 'image_small'], // Imagen antigua
      ['display_name', 'list_price'] // Mínimo
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
        setErrorMsg("Odoo no devolvió productos. Revisa si hay productos activos para la venta.");
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col relative overflow-x-hidden">
      
      {/* TIENDA HEADER */}
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

      {/* CATÁLOGO PRINCIPAL */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
             <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">Sincronizando Catálogo Odoo...</p>
          </div>
        ) : errorMsg ? (
          <div className="py-40 text-center flex flex-col items-center gap-6 max-w-md mx-auto">
             <AlertCircle className="w-16 h-16 text-red-300" />
             <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{errorMsg}</p>
             <button onClick={fetchProducts} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2"><RefreshCw className="w-4 h-4"/> Reintentar</button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-40 text-center flex flex-col items-center gap-6 opacity-40">
             <SearchX className="w-20 h-20 text-slate-200" />
             <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">No hay productos en esta vista</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 animate-in fade-in duration-500">
            {filteredProducts.map(p => (
              <div key={p.id} className="bg-white p-3 md:p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-xl transition-all">
                <div className="aspect-square bg-slate-50 rounded-2xl mb-3 flex items-center justify-center relative overflow-hidden">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain" /> : <Package className="w-8 h-8 text-slate-200" />}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest truncate">{p.categoria_personalizada || p.categoria}</p>
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

      {/* DRAWER CARRITO (RESUMEN) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative bg-white w-full max-w-lg h-full shadow-2xl flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-xl font-black uppercase tracking-tighter">Mi Pedido</h2>
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
                          <div className="flex-1 min-w-0">
                             <p className="text-[9px] font-black uppercase truncate text-slate-800">{i.producto.nombre}</p>
                             <p className="font-black text-xs text-brand-600">S/ {i.producto.precio.toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-2 bg-white p-1 rounded-lg">
                             <button onClick={() => updateCartQuantity(i.producto.id, -1)} className="p-1"><Minus className="w-3.5 h-3.5"/></button>
                             <span className="text-xs font-black w-4 text-center">{i.cantidad}</span>
                             <button onClick={() => updateCartQuantity(i.producto.id, 1)} className="p-1"><Plus className="w-3.5 h-3.5"/></button>
                          </div>
                       </div>
                    ))}
                    {cart.length > 0 && (
                       <div className="pt-8 mt-auto space-y-4">
                          <div className="flex justify-between items-center px-4">
                             <span className="text-[10px] font-black uppercase text-slate-400">Total a pagar</span>
                             <span className="text-2xl font-black text-slate-900">S/ {cartTotal.toFixed(2)}</span>
                          </div>
                          <button onClick={() => setCurrentStep('details')} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all">Siguiente Paso</button>
                       </div>
                    )}
                 </div>
              )}

              {currentStep === 'details' && (
                 <div className="space-y-6 animate-in slide-in-from-bottom-4">
                    <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Información del Cliente</h2>
                    <input type="text" placeholder="Nombre completo" className="w-full p-4 bg-slate-50 rounded-xl outline-none font-bold shadow-inner" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                    <input type="tel" placeholder="WhatsApp / Celular" className="w-full p-4 bg-slate-50 rounded-xl outline-none font-bold shadow-inner" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                    <div className="grid grid-cols-2 gap-2">
                       <button onClick={() => setDeliveryType('recojo')} className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] ${deliveryType === 'recojo' ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}>Recojo Sede</button>
                       <button onClick={() => setDeliveryType('delivery')} className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] ${deliveryType === 'delivery' ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}>Delivery</button>
                    </div>
                    {deliveryType === 'delivery' && (
                       <textarea placeholder="Dirección exacta para el envío..." className="w-full p-4 bg-slate-50 rounded-xl outline-none font-bold h-24 shadow-inner" value={clientData.direccion} onChange={e => setClientData({...clientData, direccion: e.target.value})} />
                    )}
                    <div className="flex gap-3">
                       <button onClick={() => setCurrentStep('cart')} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black uppercase text-[10px]">Atrás</button>
                       <button onClick={() => setCurrentStep('payment')} disabled={!clientData.nombre || !clientData.telefono} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase disabled:opacity-50">Siguiente</button>
                    </div>
                 </div>
              )}

              {currentStep === 'payment' && (
                 <div className="space-y-6 animate-in slide-in-from-bottom-4">
                    <h2 className="text-xl font-black text-center">Monto: S/ {cartTotal.toFixed(2)}</h2>
                    <div className="flex gap-2">
                       <button onClick={() => setPaymentMethod('yape')} className={`flex-1 p-4 rounded-xl border-2 font-black uppercase text-[10px] ${paymentMethod === 'yape' ? 'border-purple-600 bg-purple-50 text-purple-600' : 'bg-slate-50'}`}>Yape</button>
                       <button onClick={() => setPaymentMethod('plin')} className={`flex-1 p-4 rounded-xl border-2 font-black uppercase text-[10px] ${paymentMethod === 'plin' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'bg-slate-50'}`}>Plin</button>
                    </div>
                    <div className="aspect-square bg-slate-900 rounded-[2.5rem] flex items-center justify-center p-8 shadow-2xl">
                       {paymentMethod === 'yape' ? (config.yapeQR && <img src={config.yapeQR.startsWith('data:') ? config.yapeQR : `data:image/png;base64,${config.yapeQR}`} className="max-w-full max-h-full rounded-2xl" />) : (config.plinQR && <img src={config.plinQR.startsWith('data:') ? config.plinQR : `data:image/png;base64,${config.plinQR}`} className="max-w-full max-h-full rounded-2xl" />)}
                       {!config.yapeQR && !config.plinQR && <QrCode className="text-white w-20 h-20 opacity-20"/>}
                    </div>
                    <div className="text-center">
                       <p className="text-2xl font-black text-slate-900 tracking-widest">{paymentMethod === 'yape' ? (config.yapeNumber || '975615244') : (config.plinNumber || '975615244')}</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{paymentMethod === 'yape' ? (config.yapeName || 'LEMON BI') : (config.plinName || 'LEMON BI')}</p>
                    </div>
                    <div className="flex gap-3">
                       <button onClick={() => setCurrentStep('details')} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black uppercase text-[10px]">Atrás</button>
                       <button onClick={() => setCurrentStep('voucher')} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase">Subir Voucher</button>
                    </div>
                 </div>
              )}

              {currentStep === 'voucher' && (
                 <div className="space-y-6 animate-in slide-in-from-bottom-4">
                    <h2 className="text-lg font-black uppercase text-center">Enviar Comprobante</h2>
                    <div className="border-4 border-dashed rounded-[3rem] aspect-[3/4] flex flex-col items-center justify-center p-4 bg-slate-50 relative overflow-hidden group hover:border-brand-500 transition-all">
                       {voucherImage ? (
                          <>
                             <img src={voucherImage} className="w-full h-full object-cover" />
                             <button onClick={() => setVoucherImage(null)} className="absolute top-4 right-4 bg-red-500 text-white p-3 rounded-2xl shadow-xl hover:scale-110 active:scale-90 transition-all"><Trash2 className="w-5 h-5"/></button>
                          </>
                       ) : (
                          <label className="cursor-pointer flex flex-col items-center text-slate-300">
                             <Camera className="w-16 h-16 mb-2"/>
                             <p className="text-[10px] font-black uppercase tracking-widest">Toca para Seleccionar Imagen</p>
                             <input type="file" className="hidden" accept="image/*" onChange={handleVoucherUpload} />
                          </label>
                       )}
                    </div>
                    <button onClick={() => {}} disabled={!voucherImage || isOrderLoading} className="w-full py-5 bg-brand-500 text-white rounded-2xl font-black uppercase disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-brand-200">
                       {isOrderLoading ? <Loader2 className="animate-spin w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>} FINALIZAR PEDIDO
                    </button>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default StoreView;
