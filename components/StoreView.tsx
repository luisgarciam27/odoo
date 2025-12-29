
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
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<StoreStep>('cart');
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'efectivo'>('yape');
  const [deliveryType, setDeliveryType] = useState<'recojo' | 'delivery'>('recojo');
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '', sedeId: '' });
  const [voucherImage, setVoucherImage] = useState<string | null>(null);
  const [isOrderLoading, setIsOrderLoading] = useState(false);

  const brandColor = config?.colorPrimario || '#84cc16'; 
  const colorA = config?.colorAcento || '#0ea5e9';

  // Fix: Calculate total amount of the cart
  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.producto.precio * item.cantidad, 0);
  }, [cart]);

  // Fix: Function to add products to the cart
  const addToCart = (producto: Producto) => {
    setCart(prev => {
      const existing = prev.find(item => item.producto.id === producto.id);
      if (existing) {
        return prev.map(item => item.producto.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  };

  // Fix: Function to update product quantity in the cart
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

  // Fix: Handle voucher image upload
  const handleVoucherUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setVoucherImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    const client = new OdooClient(session.url, session.db, session.useProxy);
    try {
      const extrasMap = await getProductExtras(config.code);
      // Incluimos 'uom_id' para Odoo 14
      const fields = ['display_name', 'list_price', 'categ_id', 'image_128', 'image_1920', 'description_sale', 'qty_available', 'uom_id'];
      const domain: any[] = [['sale_ok', '=', true], ['active', '=', true]];
      
      let data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, fields, { limit: 1000 });
      
      if (data) {
        setProductos(data.map((p: any) => {
          const extra = extrasMap[p.id];
          return {
            id: p.id,
            nombre: p.display_name,
            precio: p.list_price || 0,
            categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
            stock: p.qty_available || 0,
            imagen: p.image_128 || p.image_1920,
            descripcion_venta: extra?.descripcion_lemon || p.description_sale || '',
            uso_sugerido: extra?.instrucciones_lemon || '',
            categoria_personalizada: extra?.categoria_personalizada || '',
            uom_id: Array.isArray(p.uom_id) ? p.uom_id[0] : (typeof p.uom_id === 'number' ? p.uom_id : 1)
          };
        }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, [session, config.code]);

  const handleFinishOrder = async () => {
    if (isOrderLoading) return;
    setIsOrderLoading(true);

    try {
      const waNumber = config.whatsappNumbers?.split(',')[0].trim() || '51975615244';
      const orderRef = `WEB-${Date.now().toString().slice(-6)}`;

      // 1. CREAR PEDIDO EN ODOO (sale.order)
      try {
        const client = new OdooClient(session.url, session.db, session.useProxy);
        
        // Buscar o crear partner
        const partnerSearch = await client.searchRead(session.uid, session.apiKey, 'res.partner', [['name', '=', clientData.nombre]], ['id'], { limit: 1 });
        let partnerId = partnerSearch.length > 0 ? partnerSearch[0].id : null;
        
        if (!partnerId) {
            partnerId = await client.create(session.uid, session.apiKey, 'res.partner', {
                name: clientData.nombre,
                phone: clientData.telefono,
                street: clientData.direccion || 'Pedido Web',
                company_id: session.companyId
            });
        }

        // Líneas de pedido - Odoo 14 a veces requiere product_uom explícito
        const orderLines = cart.map(item => [0, 0, {
            product_id: item.producto.id,
            product_uom_qty: item.cantidad,
            price_unit: item.producto.precio,
            product_uom: item.producto.uom_id || 1, // Crucial para Odoo 14
            name: item.producto.nombre
        }]);

        await client.create(session.uid, session.apiKey, 'sale.order', {
            partner_id: partnerId,
            company_id: session.companyId,
            order_line: orderLines,
            origin: `WEB LEMON: ${orderRef}`,
            note: `Pedido WEB. Pago: ${paymentMethod.toUpperCase()}. Cliente: ${clientData.nombre}.`,
            state: 'draft' 
        });
      } catch (e) { console.error("Odoo Sync Fail:", e); }

      // 2. Supabase
      await supabase.from('pedidos_tienda').insert([{
        order_name: orderRef,
        cliente_nombre: clientData.nombre,
        monto: cartTotal,
        voucher_url: voucherImage || '',
        empresa_code: config.code,
        estado: 'pendiente'
      }]);

      // 3. WhatsApp
      const message = `*NUEVO PEDIDO - ${config.nombreComercial || config.code}*\n` +
        `*Referencia:* ${orderRef}\n\n` +
        `*Cliente:* ${clientData.nombre}\n` +
        `*Total:* S/ ${cartTotal.toFixed(2)}\n` +
        `*Pago:* ${paymentMethod.toUpperCase()}\n\n` +
        `_Voucher adjunto en Lemon BI._`;

      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank');
      setCurrentStep('success');
    } catch (err) { alert("Error al enviar pedido."); }
    finally { setIsOrderLoading(false); }
  };

  const renderQR = (url: string | undefined) => {
    if (!url) return null;
    const finalUrl = url.startsWith('data:') ? url : `data:image/png;base64,${url}`;
    return <img src={finalUrl} className="max-w-full max-h-full object-contain rounded-2xl" alt="QR de Pago" />;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col relative overflow-x-hidden">
      {/* HEADER simplificado para brevedad */}
      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
           <div className="flex items-center gap-3">
             {onBack && <button onClick={onBack} className="p-2 text-slate-400"><ArrowLeft/></button>}
             <h1 className="font-black text-slate-900 uppercase text-sm">{config.nombreComercial || config.code}</h1>
           </div>
           <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-3 bg-slate-900 text-white rounded-xl">
             <ShoppingCart className="w-5 h-5" />
             {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-[10px] w-5 h-5 rounded-full flex items-center justify-center">{cart.length}</span>}
           </button>
        </div>
      </header>

      {/* Grid de productos */}
      <main className="p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {loading ? <Loader2 className="animate-spin mx-auto col-span-full"/> : productos.map(p => (
           <div key={p.id} onClick={() => setSelectedProduct(p)} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm cursor-pointer">
              <div className="aspect-square bg-slate-50 rounded-2xl mb-3 flex items-center justify-center">
                 {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain" /> : <Package className="text-slate-200" />}
              </div>
              <p className="text-[10px] font-black uppercase truncate">{p.nombre}</p>
              <p className="font-black mt-1">S/ {p.precio.toFixed(2)}</p>
              <button onClick={(e) => { e.stopPropagation(); addToCart(p); }} className="mt-2 w-full py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">Agregar</button>
           </div>
        ))}
      </main>

      {/* DRAWER CARRITO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/60" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative bg-white w-full max-w-lg h-full shadow-2xl flex flex-col p-6 overflow-y-auto">
              {currentStep === 'cart' && (
                 <div className="space-y-4 flex-1">
                    <h2 className="text-xl font-black uppercase">Carrito</h2>
                    {cart.map(i => (
                       <div key={i.producto.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                          <span className="text-[10px] font-black uppercase flex-1">{i.producto.nombre}</span>
                          <span className="font-black mx-4">S/ {i.producto.precio.toFixed(2)}</span>
                          <button onClick={() => updateCartQuantity(i.producto.id, -1)} className="p-1"><Minus className="w-4 h-4"/></button>
                          <span className="mx-2 font-bold">{i.cantidad}</span>
                          <button onClick={() => updateCartQuantity(i.producto.id, 1)} className="p-1"><Plus className="w-4 h-4"/></button>
                       </div>
                    ))}
                    <button onClick={() => setCurrentStep('details')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase">Continuar</button>
                 </div>
              )}

              {currentStep === 'details' && (
                 <div className="space-y-4">
                    <h2 className="text-xl font-black uppercase">Tus Datos</h2>
                    <input type="text" placeholder="Nombre" className="w-full p-4 bg-slate-50 rounded-xl" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                    <input type="tel" placeholder="WhatsApp" className="w-full p-4 bg-slate-50 rounded-xl" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} />
                    <button onClick={() => setCurrentStep('payment')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase">Ir a Pagar</button>
                 </div>
              )}

              {currentStep === 'payment' && (
                 <div className="space-y-6">
                    <h2 className="text-xl font-black uppercase">Pagar S/ {cartTotal.toFixed(2)}</h2>
                    <div className="flex gap-2">
                       <button onClick={() => setPaymentMethod('yape')} className={`flex-1 p-4 rounded-xl border-2 ${paymentMethod === 'yape' ? 'border-purple-600 bg-purple-50' : ''}`}>Yape</button>
                       <button onClick={() => setPaymentMethod('plin')} className={`flex-1 p-4 rounded-xl border-2 ${paymentMethod === 'plin' ? 'border-blue-600 bg-blue-50' : ''}`}>Plin</button>
                    </div>
                    <div className="aspect-square bg-slate-900 rounded-[2.5rem] flex items-center justify-center p-8">
                       {renderQR(paymentMethod === 'yape' ? config.yapeQR : config.plinQR) || <QrCode className="text-white w-20 h-20 opacity-20"/>}
                    </div>
                    <div className="text-center">
                       <p className="text-2xl font-black text-slate-900">{paymentMethod === 'yape' ? config.yapeNumber : config.plinNumber}</p>
                       <p className="text-xs uppercase font-bold text-slate-400">{paymentMethod === 'yape' ? config.yapeName : config.plinName}</p>
                    </div>
                    <button onClick={() => setCurrentStep('voucher')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase">Ya pagué, subir voucher</button>
                 </div>
              )}

              {currentStep === 'voucher' && (
                 <div className="space-y-6">
                    <h2 className="text-xl font-black uppercase">Cargar Voucher</h2>
                    <div className="border-4 border-dashed rounded-[2.5rem] aspect-[3/4] flex flex-col items-center justify-center p-4 relative overflow-hidden bg-slate-50">
                       {voucherImage ? (
                          <>
                             <img src={voucherImage} className="w-full h-full object-cover" />
                             <button onClick={() => setVoucherImage(null)} className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-xl"><Trash2/></button>
                          </>
                       ) : (
                          <label className="cursor-pointer flex flex-col items-center">
                             <Camera className="w-12 h-12 text-slate-300 mb-2"/>
                             <p className="text-[10px] font-black uppercase">Toca para subir foto</p>
                             <input type="file" className="hidden" accept="image/*" onChange={handleVoucherUpload} />
                          </label>
                       )}
                    </div>
                    <button onClick={handleFinishOrder} disabled={!voucherImage || isOrderLoading} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase disabled:bg-slate-300">
                       {isOrderLoading ? <Loader2 className="animate-spin mx-auto"/> : "Finalizar Pedido"}
                    </button>
                 </div>
              )}

              {currentStep === 'success' && (
                 <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                    <CheckCircle2 className="text-green-500 w-20 h-20" />
                    <h3 className="text-2xl font-black uppercase">¡Recibido!</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase">Validaremos tu pago y te contactaremos.</p>
                    <button onClick={() => { setIsCartOpen(false); setCart([]); setCurrentStep('cart'); }} className="w-full py-4 bg-slate-900 text-white rounded-2xl uppercase font-black">Cerrar</button>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default StoreView;
