
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, Image as ImageIcon, ArrowLeft, 
  Loader2, Citrus, Plus, Minus, Info, CheckCircle2, MapPin, Truck, 
  CreditCard, Upload, MessageCircle, Instagram, Facebook, ShieldCheck, 
  Smartphone, Star, HeartPulse, Rocket
} from 'lucide-react';
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
    const context = session.companyId ? { allowed_company_ids: [session.companyId], company_id: session.companyId } : {};

    const coreFields = ['display_name', 'list_price', 'categ_id', 'image_128', 'description_sale'];
    const extraFields = ['qty_available', 'x_registro_sanitario', 'x_laboratorio', 'x_principio_activo'];

    try {
      let data: any[] = [];
      const configCategory = (config.tiendaCategoriaNombre || '').trim();

      try {
        const domain: any[] = [['sale_ok', '=', true]];
        let finalDomain = [...domain];
        if (configCategory && !['TODAS', 'CATALOGO', ''].includes(configCategory.toUpperCase())) {
          const cats = await client.searchRead(session.uid, session.apiKey, 'product.category', [['name', 'ilike', configCategory]], ['id'], { context });
          if (cats && cats.length > 0) {
            finalDomain.push(['categ_id', 'child_of', cats[0].id]);
          }
        }
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', finalDomain, [...coreFields, ...extraFields], { limit: 500, context });
      } catch (e: any) {
        const errorMessage = e.message || '';
        const isInvalidField = errorMessage.includes('Invalid field') || errorMessage.includes('ValueError');
        console.debug(isInvalidField ? "Odoo no cuenta con campos médicos personalizados. Usando campos estándar." : "Reintentando carga básica...", e);
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], coreFields, { limit: 500, context });
      }

      if (data.length === 0) {
        data = await client.searchRead(session.uid, session.apiKey, 'product.template', [['sale_ok', '=', true]], coreFields, { limit: 200, context });
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
      console.error("Error crítico de visibilidad:", e);
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
      const context = session.companyId ? { allowed_company_ids: [session.companyId], company_id: session.companyId } : {};
      
      let odooPartnerId = 1; 
      try {
        const partners = await odoo.searchRead(session.uid, session.apiKey, 'res.partner', 
          [['mobile', '=', customerData.telefono]], ['id'], { limit: 1, context });
        if (partners && partners.length > 0) {
          odooPartnerId = partners[0].id;
        } else {
          odooPartnerId = await odoo.create(session.uid, session.apiKey, 'res.partner', {
            name: customerData.nombre,
            mobile: customerData.telefono,
            street: customerData.metodoEntrega === 'delivery' ? customerData.direccion : 'Recojo en Sede',
            comment: 'Cliente registrado desde Tienda Online LEMON BI'
          }, context);
        }
      } catch (err) {
        console.warn("Fallo al gestionar partner, usando ID 1", err);
      }

      await odoo.create(session.uid, session.apiKey, 'sale.order', {
        partner_id: odooPartnerId, 
        order_line: cart.map(item => [0, 0, { product_id: item.producto.id, product_uom_qty: item.cantidad, price_unit: item.producto.precio }]),
        note: `🛒 PEDIDO WEB #${supaOrder.id}\n👤 Cliente: ${customerData.nombre}\n📍 Entrega: ${customerData.metodoEntrega === 'pickup' ? 'RECOJO EN ' + sedeNombre : customerData.direccion}\n📱 Teléfono: ${customerData.telefono}\n💳 Pago: ${paymentMethod.toUpperCase()}\n🖼️ Comprobante: ${publicUrl}`,
        company_id: session.companyId
      }, context);

      setCheckoutStep('success');
      setCart([]);
    } catch (e: any) {
      console.error(e);
      alert("Error al procesar pedido.");
    } finally { setIsSubmitting(false); }
  };

  if (!config || !session) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-slate-800 flex flex-col overflow-x-hidden relative">
      
      {/* 💚 WHATSAPP FLOTANTE PREMIUM */}
      <a 
        href={`https://wa.me/${config.whatsappNumbers?.split(',')[0] || ''}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-8 right-8 z-[60] group flex items-center gap-3"
      >
        <div className="bg-white px-4 py-2 rounded-2xl shadow-xl border border-slate-100 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 pointer-events-none">
          <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest whitespace-nowrap">Chatea con nosotros</p>
        </div>
        <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all animate-bounce-slow">
           <MessageCircle className="w-8 h-8 fill-white/20" />
           <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
        </div>
      </a>

      {/* 🔝 BANNER DE PROMOCIÓN SUPERIOR */}
      <div className="bg-slate-900 text-white py-2 text-center overflow-hidden">
        <div className="animate-pulse flex items-center justify-center gap-4">
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">🚚 Delivery gratuito por compras mayores a S/ 100</span>
          <div className="h-1 w-1 bg-white/30 rounded-full"></div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">🔒 Compra 100% segura</span>
        </div>
      </div>

      {/* 🧭 HEADER / NAVBAR */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-40 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {onBack && (
              <button onClick={onBack} className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all">
                <ArrowLeft className="w-5 h-5"/>
              </button>
            )}
            <div className="flex items-center gap-3">
               {config.logoUrl ? (
                 <img src={config.logoUrl} className="h-9 md:h-11 rounded-lg object-contain" alt="Logo" />
               ) : (
                 <div className="p-2 rounded-xl text-white shadow-lg" style={{backgroundColor: brandColor}}>
                   <Citrus className="w-5 h-5" />
                 </div>
               )}
               <div className="hidden sm:block">
                 <h1 className="font-black text-slate-900 uppercase text-xs md:text-sm tracking-tighter leading-none">
                    {config.nombreComercial || config.code}
                 </h1>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Tienda Oficial</p>
               </div>
            </div>
          </div>

          <div className="flex-1 max-w-xl hidden md:block relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input 
              type="text" 
              placeholder="¿Qué producto necesitas hoy?" 
              className="w-full pl-11 pr-4 py-3 bg-slate-100/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:bg-white transition-all text-sm font-medium" 
              style={{'--tw-ring-color': brandColor} as any}
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>

          <div className="flex items-center gap-2">
            <button className="p-3 text-slate-400 hover:text-slate-900 md:hidden">
              <Search className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsCartOpen(true)} 
              className="relative p-3 bg-slate-100 rounded-2xl transition-all hover:bg-slate-900 hover:text-white group"
            >
              <ShoppingCart className="w-5 h-5 text-slate-600 group-hover:text-white" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow-lg" style={{backgroundColor: brandColor}}>
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-12">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {[1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className="bg-white rounded-[2.5rem] aspect-[3/4] animate-pulse border border-slate-100"></div>)}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-[3rem] border border-slate-100">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200"><Package className="w-12 h-12" /></div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Catálogo en Proceso</h3>
            <p className="text-slate-400 text-sm mt-2 font-medium">No encontramos productos con tu búsqueda actual.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-in fade-in duration-500">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => setSelectedProduct(p)} className="group relative bg-white rounded-[2.5rem] p-4 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer flex flex-col">
                <div className="aspect-square bg-[#F1F3F5] rounded-[2rem] mb-4 overflow-hidden relative border border-slate-50 flex items-center justify-center">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={p.nombre} /> : <Package className="w-12 h-12 text-slate-200"/>}
                  <button onClick={(e) => addToCart(p, e)} className="absolute bottom-3 right-3 p-3 bg-white rounded-2xl shadow-xl text-slate-800 hover:bg-slate-900 hover:text-white transition-all md:opacity-0 group-hover:opacity-100"><Plus className="w-5 h-5"/></button>
                  {(p.stock ?? 0) <= 5 && (p.stock ?? 0) > 0 && <span className="absolute top-3 left-3 bg-red-500 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest">Últimas uds</span>}
                </div>
                <div className="flex-1 px-1">
                  <span className="text-[9px] font-black text-brand-600 uppercase tracking-widest mb-1 block">{p.categoria}</span>
                  <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight h-8 mb-2 group-hover:text-brand-600 transition-colors">{p.nombre}</h3>
                  <div className="mt-auto flex items-center justify-between">
                    <div>
                      <span className="text-lg font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-brand-50 group-hover:border-brand-200 group-hover:text-brand-600 transition-all">
                      <Info className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 🦶 FOOTER COMPACTO Y ELEGANTE */}
      <footer className="bg-[#0F172A] text-white mt-12 py-10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-10">
           {/* Col 1: Marca & Logo */}
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-brand-500 rounded-xl shadow-lg">
                   {config.logoUrl ? (
                     <img src={config.logoUrl} className="w-6 h-6 object-contain brightness-0 invert" alt="logo" />
                   ) : (
                     <Citrus className="w-6 h-6 text-white" />
                   )}
                 </div>
                 <span className="font-black text-xl tracking-tighter uppercase">{config.nombreComercial || config.code}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-medium max-w-sm">
                {config.footer_description}
              </p>
              <div className="flex gap-3 pt-2">
                {config.facebook_url && (
                  <a href={config.facebook_url} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-brand-500 transition-all">
                    <Facebook className="w-4 h-4 fill-white/10"/>
                  </a>
                )}
                {config.instagram_url && (
                  <a href={config.instagram_url} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-brand-500 transition-all">
                    <Instagram className="w-4 h-4"/>
                  </a>
                )}
              </div>
           </div>

           {/* Col 2: Soporte al Cliente */}
           <div className="space-y-4 md:text-right md:flex md:flex-col md:items-end">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 flex items-center gap-2 md:justify-end">
                   Soporte al Cliente
                   <div className="w-1 h-3 bg-brand-500 rounded-full hidden md:block"></div>
                </h4>
                <p className="text-xs text-slate-400 font-medium leading-relaxed mb-4">
                  {config.support_text}
                </p>
              </div>
              
              <a 
                href={`https://wa.me/${config.whatsappNumbers?.split(',')[0] || ''}`} 
                className="inline-flex items-center justify-center gap-3 bg-[#10B981] text-white px-6 py-4 rounded-xl font-black text-[10px] uppercase shadow-xl hover:bg-emerald-600 transition-all active:scale-95"
              >
                 <MessageCircle className="w-4 h-4 fill-white/20"/> Chatear por WhatsApp
              </a>
              
              <div className="flex items-center gap-2 text-slate-500 pt-2">
                <Smartphone className="w-4 h-4 text-brand-500" />
                <span className="text-xs font-black tracking-widest">{config.whatsappNumbers?.split(',')[0]}</span>
              </div>
           </div>
        </div>

        {/* Bottom Bar: Certificada & GaorSystem */}
        <div className="max-w-7xl mx-auto px-6 mt-10 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em]">
            &copy; 2025 {config.nombreComercial || config.code}.
          </p>
          <div className="flex items-center gap-8">
             <div className="flex items-center gap-2 text-slate-500">
               <Star className="w-3.5 h-3.5 fill-brand-500 text-brand-500" />
               <span className="text-[9px] font-black uppercase tracking-[0.2em]">Tienda Certificada</span>
             </div>
             <a href="https://gaorsystem.vercel.app/" target="_blank" rel="noreferrer" className="flex items-center gap-2 group">
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest group-hover:text-slate-400 transition-colors">
                  Powered by <span className="text-white">GaorSystem</span>
                </span>
                <Rocket className="w-3 h-3 text-violet-500 group-hover:scale-110 transition-transform" />
             </a>
          </div>
        </div>
      </footer>

      {/* 🔍 PRODUCT DETAIL MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative bg-white w-full max-w-6xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row animate-in zoom-in-95 max-h-[90vh]">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-6 right-6 p-4 bg-white/50 backdrop-blur-md shadow-lg rounded-full z-10 hover:bg-slate-100 transition-all"><X className="w-6 h-6"/></button>
            <div className="w-full lg:w-1/2 bg-[#F8F9FA] flex flex-col items-center justify-center p-8 lg:p-16 relative">
               <div className="w-full aspect-square bg-white rounded-[3rem] shadow-sm p-12 flex items-center justify-center border border-slate-100 group">
                  {selectedProduct.imagen ? (
                    <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-700" alt=""/>
                  ) : (
                    <ImageIcon className="w-32 h-32 text-slate-100"/>
                  )}
               </div>
               <div className="absolute left-0 bottom-12 bg-slate-900 text-white px-6 py-2 rounded-r-2xl font-black text-[10px] uppercase tracking-widest">
                 Producto Original
               </div>
            </div>
            <div className="w-full lg:w-1/2 p-8 lg:p-16 overflow-y-auto bg-white">
               <div className="mb-10">
                  <span className="inline-block px-3 py-1 bg-brand-50 text-brand-600 text-[10px] font-black uppercase tracking-widest rounded-lg mb-4">{selectedProduct.categoria}</span>
                  <h2 className="text-3xl lg:text-5xl font-black text-slate-900 leading-[1.1] mb-6 tracking-tight">{selectedProduct.nombre}</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">{selectedProduct.laboratorio || 'PRODUCTO ODOO'} {selectedProduct.presentacion && ` • ${selectedProduct.presentacion.toUpperCase()}`}</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-8 mb-10 py-8 border-y border-slate-50">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio Regular</p>
                      <p className="text-xl font-bold text-slate-400 line-through">S/ {selectedProduct.precio.toFixed(2)}</p>
                    </div>
                    <div className="bg-brand-50 p-6 rounded-3xl flex-1 flex items-center justify-between border border-brand-100 shadow-sm">
                       <div>
                         <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-1">Precio Online</p>
                         <p className="text-4xl font-black text-brand-600 leading-none">S/ {(selectedProduct.precio * 0.95).toFixed(2)}</p>
                       </div>
                       <div className="h-10 w-10 bg-brand-500 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg animate-pulse">-5%</div>
                    </div>
                  </div>
                  <div className="mb-10 space-y-4">
                     <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Información del Producto</h4>
                     {selectedProduct.descripcion_venta ? (
                       <ul className="space-y-4">
                         {selectedProduct.descripcion_venta.split('\n').filter(line => line.trim()).map((line, i) => (
                           <li key={i} className="flex gap-4 text-sm font-medium text-slate-600 leading-relaxed">
                             <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5"><CheckCircle2 className="w-3 h-3"/></div>
                             {line}
                           </li>
                         ))}
                       </ul>
                     ) : (
                       <p className="text-sm italic text-slate-400 font-medium leading-relaxed">Este producto cuenta con todas las certificaciones de salud requeridas. Solicita más detalles a nuestros asesores.</p>
                     )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                     <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
                        <div className="p-3 bg-white rounded-xl shadow-sm"><ShieldCheck className="w-5 h-5 text-slate-400" /></div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">R. Sanitario</p>
                          <p className="text-xs font-bold text-slate-800">{selectedProduct.registro_sanitario || 'RS-VIGENTE'}</p>
                        </div>
                     </div>
                     <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
                        <div className="p-3 bg-white rounded-xl shadow-sm"><Package className="w-5 h-5 text-slate-400" /></div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Sede</p>
                          <p className="text-xs font-bold text-brand-600">{config.nombreComercial}</p>
                        </div>
                     </div>
                  </div>
                  <div className="flex gap-4 sticky bottom-0 bg-white pt-4">
                     <button 
                       onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} 
                       className="flex-1 py-6 text-white rounded-[2rem] font-black shadow-2xl active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3" 
                       style={{backgroundColor: brandColor, boxShadow: `0 20px 30px -5px ${brandColor}40`}}
                     >
                       <ShoppingCart className="w-5 h-5" />
                       Añadir a mi pedido
                     </button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* 🛒 SHOPPING CART / CHECKOUT DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Mi Pedido</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{cart.length} productos seleccionados</p>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-3 text-slate-400 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all"><X /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F8F9FA]">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-300">
                  <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                    <ShoppingCart className="w-16 h-16"/>
                  </div>
                  <p className="font-black uppercase tracking-widest text-xs">Tu carrito está vacío</p>
                </div>
              ) : checkoutStep === 'catalog' ? (
                cart.map(item => (
                  <div key={item.producto.id} className="flex gap-4 items-center bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4">
                    <div className="w-20 h-20 bg-slate-50 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center shrink-0">
                      {item.producto.imagen ? <img src={`data:image/png;base64,${item.producto.imagen}`} className="w-full h-full object-cover" alt=""/> : <Package className="w-8 h-8 text-slate-200"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[11px] font-black text-slate-800 line-clamp-1 uppercase tracking-tight mb-1">{item.producto.nombre}</h4>
                      <p className="text-sm font-black text-brand-600 mb-2">S/ {item.producto.precio.toFixed(2)}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-100">
                          <button onClick={() => updateQuantity(item.producto.id, -1)} className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-slate-50 transition-all"><Minus className="w-3 h-3"/></button>
                          <span className="text-xs font-black px-4">{item.cantidad}</span>
                          <button onClick={() => updateQuantity(item.producto.id, 1)} className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-slate-50 transition-all"><Plus className="w-3 h-3"/></button>
                        </div>
                        <button onClick={() => removeFromCart(item.producto.id)} className="p-2 text-red-200 hover:text-red-500 transition-colors"><X className="w-4 h-4"/></button>
                      </div>
                    </div>
                  </div>
                ))
              ) : checkoutStep === 'shipping' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5">
                   <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setCustomerData({...customerData, metodoEntrega: 'delivery'})} className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-3 transition-all ${customerData.metodoEntrega === 'delivery' ? 'bg-white border-brand-500 shadow-xl' : 'bg-slate-100 border-transparent opacity-60'}`}>
                         <div className={`p-3 rounded-2xl ${customerData.metodoEntrega === 'delivery' ? 'bg-brand-500 text-white' : 'bg-white text-slate-400'}`}>
                           <Truck className="w-6 h-6" />
                         </div>
                         <span className="text-[10px] font-black uppercase tracking-widest">Delivery</span>
                      </button>
                      <button onClick={() => setCustomerData({...customerData, metodoEntrega: 'pickup'})} className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-3 transition-all ${customerData.metodoEntrega === 'pickup' ? 'bg-white border-blue-500 shadow-xl' : 'bg-slate-100 border-transparent opacity-60'}`}>
                         <div className={`p-3 rounded-2xl ${customerData.metodoEntrega === 'pickup' ? 'bg-blue-500 text-white' : 'bg-white text-slate-400'}`}>
                           <MapPin className="w-6 h-6" />
                         </div>
                         <span className="text-[10px] font-black uppercase tracking-widest">Recojo</span>
                      </button>
                   </div>
                   <div className="space-y-4">
                      <div className="group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Nombre Completo</label>
                        <input type="text" placeholder="Ej: Luis Garcia" className="w-full p-5 bg-white rounded-3xl font-bold border border-slate-100 outline-none focus:ring-2 shadow-sm transition-all" style={{'--tw-ring-color': brandColor} as any} value={customerData.nombre} onChange={e => setCustomerData({...customerData, nombre: e.target.value})} />
                      </div>
                      <div className="group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">WhatsApp de Contacto</label>
                        <input type="tel" placeholder="987 654 321" className="w-full p-5 bg-white rounded-3xl font-bold border border-slate-100 outline-none focus:ring-2 shadow-sm transition-all" style={{'--tw-ring-color': brandColor} as any} value={customerData.telefono} onChange={e => setCustomerData({...customerData, telefono: e.target.value})} />
                      </div>
                      {customerData.metodoEntrega === 'delivery' ? (
                        <div className="group animate-in slide-in-from-top-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Dirección Exacta</label>
                          <input type="text" placeholder="Ej: Av. Brasil 1234, Dpto 201" className="w-full p-5 bg-white rounded-3xl font-bold border border-slate-100 outline-none focus:ring-2 shadow-sm transition-all" style={{'--tw-ring-color': brandColor} as any} value={customerData.direccion} onChange={e => setCustomerData({...customerData, direccion: e.target.value})} />
                        </div>
                      ) : (
                        <div className="group animate-in slide-in-from-top-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Selecciona Sede</label>
                          <select className="w-full p-5 bg-white rounded-3xl font-bold border border-slate-100 outline-none focus:ring-2 appearance-none shadow-sm transition-all" style={{'--tw-ring-color': brandColor} as any} value={customerData.sedeId} onChange={e => setCustomerData({...customerData, sedeId: e.target.value})}>
                             <option value="">Seleccionar Local...</option>
                             {config.sedes_recojo?.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Referencia o Notas</label>
                        <textarea placeholder="Ej: Portería, timbre malogrado..." className="w-full p-5 bg-white rounded-3xl font-bold border border-slate-100 outline-none h-28 shadow-sm transition-all" value={customerData.notas} onChange={e => setCustomerData({...customerData, notas: e.target.value})}></textarea>
                      </div>
                   </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5">
                   <div className="flex items-center gap-3 mb-2 px-2">
                     <div className="p-2 bg-brand-50 rounded-xl text-brand-600"><CreditCard className="w-5 h-5" /></div>
                     <h3 className="text-lg font-black text-slate-800">Método de Pago</h3>
                   </div>
                   <div className="grid grid-cols-1 gap-3">
                      {[
                        { id: 'yape', label: 'Yape', number: config.yapeNumber, qr: config.yapeQR, color: 'text-purple-600 bg-purple-50' },
                        { id: 'plin', label: 'Plin', number: config.plinNumber, qr: config.plinQR, color: 'text-cyan-600 bg-cyan-50' },
                        { id: 'transferencia', label: 'Transferencia', number: 'BCP/BBVA/Interbank', color: 'text-blue-600 bg-blue-50' }
                      ].map(method => (
                        <button 
                          key={method.id} 
                          onClick={() => setPaymentMethod(method.id as any)}
                          className={`p-5 rounded-[2rem] border-2 text-left transition-all ${paymentMethod === method.id ? 'bg-white border-brand-500 shadow-xl scale-[1.02]' : 'bg-white border-slate-100 opacity-60'}`}
                        >
                           <div className="flex justify-between items-center mb-1">
                             <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${method.color}`}>{method.label}</div>
                             {paymentMethod === method.id && <CheckCircle2 className="w-6 h-6 text-brand-600 animate-in zoom-in" />}
                           </div>
                           <p className="text-xs font-bold text-slate-800 mt-2">{method.number}</p>
                           {paymentMethod === method.id && method.qr && (
                             <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in slide-in-from-top-2">
                               <img src={method.qr} className="w-40 h-40 mx-auto rounded-xl shadow-inner" alt="QR" />
                               <p className="text-[9px] text-center font-black text-slate-400 mt-3 uppercase tracking-widest">Escanea y sube tu comprobante</p>
                             </div>
                           )}
                        </button>
                      ))}
                   </div>
                   <div className={`p-8 border-2 border-dashed rounded-[2.5rem] text-center relative group transition-all ${comprobante ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-200 hover:border-brand-300'}`}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        onChange={e => setComprobante(e.target.files?.[0] || null)}
                      />
                      {comprobante ? (
                        <div className="flex flex-col items-center gap-3 text-emerald-600">
                          <div className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center"><CheckCircle2 className="w-8 h-8" /></div>
                          <div><p className="text-xs font-black uppercase tracking-widest">¡Listo!</p><p className="text-[10px] font-bold opacity-70 truncate max-w-[200px]">{comprobante.name}</p></div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4 text-slate-400">
                           <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-brand-50 group-hover:text-brand-500 transition-all"><Upload className="w-8 h-8" /></div>
                           <div><p className="text-xs font-black uppercase tracking-widest">Subir Comprobante</p><p className="text-[9px] font-bold opacity-60 mt-1">Captura de pantalla o foto de la operación</p></div>
                        </div>
                      )}
                   </div>
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-8 border-t border-slate-100 bg-white space-y-5">
                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">Total a Pagar</span>
                  <div className="text-right"><span className="text-3xl font-black text-slate-900 leading-none block">S/ {cartTotal.toFixed(2)}</span><span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mt-1">Incluye impuestos</span></div>
                </div>
                <div className="flex gap-3">
                  {checkoutStep !== 'catalog' && (
                    <button onClick={() => { if (checkoutStep === 'payment') setCheckoutStep('shipping'); else setCheckoutStep('catalog'); }} className="p-5 bg-slate-100 text-slate-500 rounded-3xl hover:bg-slate-200 transition-all active:scale-95 shadow-sm"><ArrowLeft className="w-6 h-6"/></button>
                  )}
                  {checkoutStep === 'catalog' ? (
                    <button onClick={() => setCheckoutStep('shipping')} className="flex-1 py-6 text-white rounded-[2rem] font-black shadow-2xl transition-all active:scale-95 uppercase tracking-widest text-[11px]" style={{backgroundColor: brandColor, boxShadow: `0 15px 30px -5px ${brandColor}50`}}>Continuar Pedido</button>
                  ) : checkoutStep === 'shipping' ? (
                    <button onClick={() => setCheckoutStep('payment')} disabled={!customerData.nombre || !customerData.telefono} className="flex-1 py-6 text-white rounded-[2rem] font-black shadow-2xl transition-all active:scale-95 disabled:opacity-30 uppercase tracking-widest text-[11px]" style={{backgroundColor: brandColor}}>Ir al Pago</button>
                  ) : (
                    <button onClick={handleSubmitOrder} disabled={isSubmitting || !paymentMethod || !comprobante} className="flex-1 py-6 bg-slate-900 text-white rounded-[2rem] font-black transition-all active:scale-95 flex items-center justify-center uppercase tracking-widest text-[11px] shadow-2xl">{isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Confirmar y Enviar'}</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {checkoutStep === 'success' && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
           <div className="relative mb-12">
             <div className="w-40 h-40 bg-emerald-50 rounded-full flex items-center justify-center animate-ping absolute opacity-20"></div>
             <div className="w-40 h-40 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center relative shadow-xl shadow-emerald-100"><CheckCircle2 className="w-20 h-20"/></div>
           </div>
           <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">¡Pedido Recibido!</h2>
           <div className="bg-slate-50 px-8 py-6 rounded-[2.5rem] border border-slate-100 max-sm mb-12"><p className="text-slate-500 font-medium leading-relaxed">Estamos procesando tu pedido. Recibirás una confirmación vía WhatsApp en los próximos minutos.</p></div>
           <button onClick={() => { setCheckoutStep('catalog'); setIsCartOpen(false); setCart([]); }} className="w-full max-w-xs py-6 bg-slate-900 text-white rounded-[2rem] font-black transition-all active:scale-95 shadow-xl uppercase tracking-widest text-xs">Volver a la Tienda</button>
        </div>
      )}
    </div>
  );
};

export default StoreView;
