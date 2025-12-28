
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, Image as ImageIcon, ArrowLeft, 
  Citrus, Plus, Minus, Info, MapPin, 
  MessageCircle, ShieldCheck, 
  Star, Rocket, Facebook, Instagram, Pill, Beaker, ClipboardCheck, Truck, ShieldAlert
} from 'lucide-react';
import { Producto, CartItem, OdooSession, ClientConfig } from '../types';
import { OdooClient } from '../services/odoo';

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
  
  // Paleta de colores dinámica
  const colorP = config?.colorPrimario || '#84cc16'; 
  const colorS = config?.colorSecundario || '#0F172A';
  const colorA = config?.colorAcento || '#0ea5e9';
  
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

      const domain: any[] = [['sale_ok', '=', true]];
      let finalDomain = [...domain];
      
      if (configCategory && !['TODAS', 'CATALOGO', ''].includes(configCategory.toUpperCase())) {
        try {
          const cats = await client.searchRead(session.uid, session.apiKey, 'product.category', [['name', 'ilike', configCategory]], ['id'], { context });
          if (cats && cats.length > 0) finalDomain.push(['categ_id', 'child_of', cats[0].id]);
        } catch(e) { console.error("Category fetch failed", e); }
      }

      data = await client.searchRead(session.uid, session.apiKey, 'product.product', finalDomain, [...coreFields, ...extraFields], { limit: 500, context });

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
      console.error("Error fetching products:", e);
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

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans text-slate-800 flex flex-col overflow-x-hidden relative scroll-smooth">
      
      {/* Botón Flotante WhatsApp Premium */}
      <a 
        href={`https://wa.me/${config.whatsappNumbers?.split(',')[0] || '51975615244'}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-10 right-10 z-[60] flex items-center gap-3 hover:scale-105 transition-transform"
      >
        <div className="bg-white px-5 py-2.5 rounded-2xl shadow-2xl border border-slate-100 hidden md:block">
          <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Atención Farmacéutica</p>
        </div>
        <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-[0_15px_40px_-10px_rgba(16,185,129,0.5)] transition-all">
           <MessageCircle className="w-8 h-8 fill-white/10" />
        </div>
      </a>

      {/* Header Premium con Blur */}
      <header className="bg-white/80 backdrop-blur-2xl border-b border-slate-100 sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {onBack && (
              <button onClick={onBack} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all">
                <ArrowLeft className="w-5 h-5"/>
              </button>
            )}
            <div className="flex items-center gap-4">
               {config.logoUrl ? (
                 <img src={config.logoUrl} className="h-10 md:h-12 object-contain" alt="Logo" />
               ) : (
                 <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{backgroundColor: colorP}}>
                   <Citrus className="w-6 h-6 text-white" />
                 </div>
               )}
               <div className="hidden lg:block">
                 <h1 className="font-black text-slate-900 uppercase text-sm tracking-tighter leading-none">
                    {config.nombreComercial || config.code}
                 </h1>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                   <ShieldCheck className="w-3 h-3 text-emerald-500" /> Establecimiento Autorizado
                 </p>
               </div>
            </div>
          </div>

          {/* Barra de Búsqueda Flotante Central */}
          <div className="flex-1 max-w-2xl hidden md:relative md:block">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Busca medicamentos, laboratorios o productos..." 
                className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-100 rounded-[2rem] outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all text-sm font-medium" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsCartOpen(true)} 
              className="relative p-4 bg-slate-900 text-white rounded-[1.5rem] shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              <ShoppingCart className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center animate-bounce shadow-xl" style={{backgroundColor: colorA}}>
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner Minimalista */}
      <section className="bg-slate-50 pt-10 pb-6">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center gap-5 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0"><Truck className="w-6 h-6"/></div>
            <div><p className="font-black text-xs uppercase text-slate-900 leading-none mb-1">Envío Express</p><p className="text-[10px] text-slate-400 font-medium">Recibe en minutos</p></div>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center gap-5 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0"><ShieldCheck className="w-6 h-6"/></div>
            <div><p className="font-black text-xs uppercase text-slate-900 leading-none mb-1">Garantía Médica</p><p className="text-[10px] text-slate-400 font-medium">Productos Certificados</p></div>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center gap-5 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0"><Beaker className="w-6 h-6"/></div>
            <div><p className="font-black text-xs uppercase text-slate-900 leading-none mb-1">Farmacéutico Online</p><p className="text-[10px] text-slate-400 font-medium">Consultas por WhatsApp</p></div>
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-10 space-y-12">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {[1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className="bg-white rounded-[3rem] aspect-[3/4] animate-pulse border border-slate-50 shadow-sm"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => setSelectedProduct(p)} className="group bg-white rounded-[3rem] p-5 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer flex flex-col relative overflow-hidden">
                <div className="aspect-square bg-slate-50 rounded-[2.5rem] mb-6 overflow-hidden relative flex items-center justify-center group-hover:bg-white transition-colors">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt={p.nombre} /> : <Package className="w-12 h-12 text-slate-100"/>}
                  <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/5 transition-all"></div>
                </div>
                
                <div className="flex-1">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] mb-2 block px-2.5 py-1 bg-slate-100 rounded-full w-fit text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">{p.categoria}</span>
                  <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug h-9 mb-4 group-hover:text-slate-900 transition-colors uppercase tracking-tighter">{p.nombre}</h3>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-auto">
                    <div>
                      <p className="text-[8px] font-black text-slate-300 uppercase leading-none mb-1">Precio Online</p>
                      <span className="text-base font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    </div>
                    <button 
                      onClick={(e) => addToCart(p, e)} 
                      className="p-3.5 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-90"
                    >
                      <Plus className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer Estilo Corporativo */}
      <footer className="text-white mt-20 pt-16 pb-12 border-t border-white/5" style={{backgroundColor: colorS}}>
        <div className="max-w-7xl mx-auto px-10">
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 mb-16">
              <div className="lg:col-span-1 space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl shadow-xl" style={{backgroundColor: colorP}}>
                      <Citrus className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-black text-xl tracking-tighter uppercase">{config.nombreComercial || config.code}</span>
                 </div>
                 <p className="text-xs text-slate-400 font-medium leading-relaxed italic opacity-80">
                   "{config.footer_description || 'Cuidamos tu salud con los mejores estándares de calidad y confianza.'}"
                 </p>
                 <div className="flex gap-4">
                    {config.facebook_url && <a href={config.facebook_url} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-blue-600 transition-all"><Facebook className="w-5 h-5"/></a>}
                    {config.instagram_url && <a href={config.instagram_url} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-pink-600 transition-all"><Instagram className="w-5 h-5"/></a>}
                 </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/10 pb-4">Servicios</h4>
                <ul className="space-y-4 text-xs font-bold text-slate-400">
                  <li className="hover:text-white cursor-pointer transition-colors flex items-center gap-2"><ArrowLeft className="w-3 h-3 rotate-180"/> Envío a Domicilio</li>
                  <li className="hover:text-white cursor-pointer transition-colors flex items-center gap-2"><ArrowLeft className="w-3 h-3 rotate-180"/> Recojo en Botica</li>
                  <li className="hover:text-white cursor-pointer transition-colors flex items-center gap-2"><ArrowLeft className="w-3 h-3 rotate-180"/> Consulta Farmacéutica</li>
                </ul>
              </div>

              <div className="lg:col-span-2 space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/10 pb-4">Confianza y Calidad</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <div className="p-5 bg-white/5 rounded-3xl border border-white/5">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 mb-3"/>
                      <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">{config.quality_text || 'Todos nuestros productos cuentan con Registro Sanitario vigente y cadena de frío garantizada.'}</p>
                   </div>
                   <div className="p-5 bg-white/5 rounded-3xl border border-white/5">
                      <Star className="w-5 h-5 text-amber-400 mb-3"/>
                      <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">{config.support_text || 'Atención personalizada por profesionales colegiados para tu total tranquilidad.'}</p>
                   </div>
                </div>
              </div>
           </div>

           <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                &copy; 2025 {config.nombreComercial || config.code}. Todos los derechos reservados.
              </p>
              <div className="flex items-center gap-8">
                 <a href="https://gaorsystem.vercel.app/" target="_blank" rel="noreferrer" className="flex items-center gap-3 group grayscale hover:grayscale-0 transition-all opacity-40 hover:opacity-100">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-white transition-colors">
                      E-commerce by <span className="text-white font-black">GaorSystem</span>
                    </span>
                    <Rocket className="w-4 h-4 text-brand-500 group-hover:translate-x-1 transition-transform" />
                 </a>
              </div>
           </div>
        </div>
      </footer>

      {/* Modal de Detalle de Producto Premium */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative bg-white w-full max-w-5xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row animate-in zoom-in-95 duration-300">
             <button onClick={() => setSelectedProduct(null)} className="absolute top-8 right-8 p-3 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-full z-10 transition-all"><X className="w-5 h-5"/></button>
             
             <div className="lg:w-1/2 bg-slate-50/50 flex items-center justify-center p-12">
               <div className="w-full aspect-square bg-white rounded-[3rem] shadow-sm p-12 flex items-center justify-center border border-slate-100 group">
                 {selectedProduct.imagen ? <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-1000" alt=""/> : <ImageIcon className="w-24 h-24 text-slate-100"/>}
               </div>
             </div>

             <div className="lg:w-1/2 p-12 space-y-8 overflow-y-auto max-h-[90vh]">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-xl bg-brand-50 text-brand-600 mb-4 inline-block">{selectedProduct.categoria}</span>
                  <h2 className="text-4xl font-black text-slate-900 leading-tight tracking-tighter uppercase">{selectedProduct.nombre}</h2>
                </div>

                <div className="flex flex-wrap gap-3">
                  {selectedProduct.principio_activo && <span className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-bold text-slate-600 uppercase flex items-center gap-2"><Pill className="w-3 h-3"/> {selectedProduct.principio_activo}</span>}
                  {selectedProduct.laboratorio && <span className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-bold text-slate-600 uppercase flex items-center gap-2"><Beaker className="w-3 h-3"/> {selectedProduct.laboratorio}</span>}
                  {selectedProduct.registro_sanitario && <span className="px-4 py-2 bg-emerald-50 rounded-xl text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-2"><ClipboardCheck className="w-3 h-3"/> RS: {selectedProduct.registro_sanitario}</span>}
                </div>

                <div className="p-8 rounded-[2.5rem] flex items-center justify-between border-2" style={{borderColor: `${colorP}30`, backgroundColor: `${colorP}05`}}>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inversión Salud</p>
                    <p className="text-5xl font-black" style={{color: colorP}}>S/ {selectedProduct.precio.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Disponibilidad</p>
                    <div className="flex items-center gap-2 font-black text-slate-900 uppercase">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      {selectedProduct.stock > 0 ? `${selectedProduct.stock} UDS` : 'Consultar'}
                    </div>
                  </div>
                </div>

                {selectedProduct.descripcion_venta && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Indicaciones</h4>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">{selectedProduct.descripcion_venta}</p>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-6">
                  <button 
                     onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} 
                     className="flex-1 py-6 text-white rounded-[2rem] font-black shadow-2xl shadow-brand-200 hover:brightness-110 active:scale-95 transition-all uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-4" 
                     style={{backgroundColor: colorA}}
                   >
                     <ShoppingCart className="w-5 h-5" />
                     Añadir al Pedido
                   </button>
                </div>
                
                <div className="flex items-center gap-2 justify-center text-[10px] font-bold text-slate-400 uppercase">
                  <ShieldCheck className="w-4 h-4 text-emerald-500"/> Transacción protegida y segura
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Carrito Estilo Drawer Premium */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 rounded-l-[3rem]">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Tu Pedido</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{cart.length} Artículos seleccionados</p>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-4 bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white rounded-2xl transition-all"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/20">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="p-8 bg-slate-100 rounded-full text-slate-300">
                    <ShoppingCart className="w-12 h-12" />
                  </div>
                  <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Tu carrito está vacío</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.producto.id} className="flex gap-5 items-center bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 group hover:border-brand-100 transition-colors">
                    <div className="w-20 h-20 bg-slate-50 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border border-slate-50">
                      {item.producto.imagen ? <img src={`data:image/png;base64,${item.producto.imagen}`} className="w-full h-full object-cover" alt=""/> : <Package className="w-8 h-8 text-slate-200"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[11px] font-black text-slate-800 line-clamp-1 uppercase tracking-tight">{item.producto.nombre}</h4>
                      <p className="text-sm font-black mt-1" style={{color: colorP}}>S/ {(item.producto.precio * item.cantidad).toFixed(2)}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                          <button onClick={() => updateQuantity(item.producto.id, -1)} className="p-1.5 bg-white rounded-lg shadow-sm hover:text-brand-500 transition-colors"><Minus className="w-3 h-3"/></button>
                          <span className="text-xs font-black px-4">{item.cantidad}</span>
                          <button onClick={() => updateQuantity(item.producto.id, 1)} className="p-1.5 bg-white rounded-lg shadow-sm hover:text-brand-500 transition-colors"><Plus className="w-3 h-3"/></button>
                        </div>
                        <button onClick={() => removeFromCart(item.producto.id)} className="text-[10px] font-black text-red-300 hover:text-red-500 transition-colors ml-auto uppercase tracking-widest">Eliminar</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-10 border-t border-slate-50 space-y-6 bg-white rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] mb-1 block">Inversión Total</span>
                    <span className="text-4xl font-black text-slate-900 leading-none tracking-tighter">S/ {cartTotal.toFixed(2)}</span>
                  </div>
                </div>
                <div className="space-y-3">
                   <button 
                    onClick={() => {
                        const msg = `Hola ${config.nombreComercial}, quiero realizar el siguiente pedido:\n\n` + 
                        cart.map(i => `- ${i.cantidad}x ${i.producto.nombre} (S/ ${i.producto.precio.toFixed(2)})`).join('\n') + 
                        `\n\nTotal: S/ ${cartTotal.toFixed(2)}`;
                        window.open(`https://wa.me/${config.whatsappNumbers?.split(',')[0]}?text=${encodeURIComponent(msg)}`);
                    }} 
                    className="w-full py-6 text-white rounded-[2rem] font-black shadow-[0_15px_40px_-5px_rgba(16,185,129,0.3)] transition-all active:scale-95 uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-4" 
                    style={{backgroundColor: '#10B981'}}
                  >
                    <MessageCircle className="w-5 h-5 fill-white/20" />
                    Confirmar por WhatsApp
                  </button>
                  <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest">Atención profesional garantizada</p>
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
