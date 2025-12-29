
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, Image as ImageIcon, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, ShieldCheck, 
  Star, Facebook, Instagram, Pill, Beaker, ClipboardCheck, AlertCircle,
  Stethoscope, Footprints, PawPrint, Calendar, Wallet, CheckCircle2, Camera, ChevronRight,
  Loader2, BadgeCheck, Send, UserCheck, Sparkles, Zap, Award, HeartHandshake, ShieldAlert,
  RefreshCw, Trash2, CreditCard, Building2, Smartphone, CheckCircle, QrCode, Music2, Upload, Briefcase,
  Dog, Cat, Syringe, Tag, Layers, SearchX, Wand2, Boxes, Phone, ShoppingBag, ExternalLink, Navigation
} from 'lucide-react';
import { Producto, CartItem, OdooSession, ClientConfig, SedeStore } from '../types';
import { OdooClient } from '../services/odoo';
import { getProductExtras } from '../services/clientManager';
import { supabase } from '../services/supabaseClient';

interface StoreViewProps {
  session: OdooSession;
  config: ClientConfig;
  onBack?: () => void;
}

type StoreStep = 'cart' | 'details' | 'payment' | 'processing' | 'success';

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
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  const brandColor = config?.colorPrimario || '#84cc16'; 
  const colorA = config?.colorAcento || '#0ea5e9';
  const bizType = config?.businessType || 'pharmacy';

  const parseOdooDescription = (rawText: string = "") => {
    if (!rawText) return { marca: "Genérico", especie: "General", registro: "S/N", cleanDesc: "" };
    const lines = rawText.split('\n');
    let marca = ""; let especie = ""; let registro = "";
    let descripcionLimpiaLines: string[] = [];
    lines.forEach(line => {
      const upperLine = line.toUpperCase();
      if (upperLine.includes("MARCA:")) marca = line.split(":")[1]?.trim();
      else if (upperLine.includes("ESPECIE:")) especie = line.trim();
      else if (upperLine.includes("R.S.") || upperLine.includes("REGISTRO")) registro = line.split(":")[1]?.trim() || line.trim();
      else if (line.trim().length > 0 && !upperLine.includes("IMÁGENES REFERENCIALES")) descripcionLimpiaLines.push(line.trim());
    });
    return { marca: marca || "Genérico", especie: especie || "General", registro: registro, cleanDesc: descripcionLimpiaLines.join(' ') };
  };

  const slides = useMemo(() => {
    if (config.slide_images && config.slide_images.some(img => img)) {
      return config.slide_images.filter(img => img).map((url) => ({ image: url }));
    }
    return [
      { title: "Salud y Bienestar", desc: "Tus productos de confianza ahora online.", icon: ShieldCheck, badge: "Garantía", bg: `linear-gradient(135deg, ${brandColor}, ${colorA})` },
      { title: "Atención Especializada", desc: "Expertos cuidando de ti.", icon: HeartHandshake, badge: "Confianza", bg: `linear-gradient(135deg, ${colorA}, ${brandColor})` }
    ];
  }, [config.slide_images, brandColor, colorA]);

  useEffect(() => {
    if (slides.length > 1) {
      const timer = setInterval(() => { setActiveSlide(s => (s + 1) % slides.length); }, 6000);
      return () => clearInterval(timer);
    }
  }, [slides.length]);

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    const client = new OdooClient(session.url, session.db, true);
    try {
      const extrasMap = await getProductExtras(config.code);
      // USAMOS image_512 PARA EVITAR PIXELACIÓN
      const fields = ['display_name', 'list_price', 'categ_id', 'image_512', 'description_sale', 'qty_available'];
      
      const domain: any[] = [['sale_ok', '=', true]];
      if (session.companyId) {
          domain.push(['company_id', 'in', [false, session.companyId]]);
      }

      let data = [];
      try {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, fields, { limit: 1000 });
      } catch (e) {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], fields, { limit: 1000 });
      }

      if (!data || data.length === 0) {
        data = await client.searchRead(session.uid, session.apiKey, 'product.template', [['sale_ok', '=', true]], fields, { limit: 500 });
      }

      if (data && data.length > 0) {
        setProductos(data.map((p: any) => {
          const extra = extrasMap[p.id];
          const parsed = parseOdooDescription(p.description_sale);
          return {
            id: p.id,
            nombre: p.display_name,
            precio: p.list_price || 0,
            categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
            stock: p.qty_available || 0,
            imagen: p.image_512 || p.image_128, // Intentamos 512, fallback a 128
            descripcion_venta: extra?.descripcion_lemon || parsed.cleanDesc || p.description_sale || '',
            uso_sugerido: extra?.instrucciones_lemon || '',
            marca: parsed.marca,
            especie: parsed.especie,
            registro_sanitario: parsed.registro || 'S/N'
          };
        }));
      } else {
        setProductos([]);
      }
    } catch (e) { 
      setProductos([]);
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchProducts(); }, [session, config.code]);

  const availableCategories = useMemo(() => {
    const cats = Array.from(new Set(productos.map(p => p.categoria || 'General')));
    const hidden = config.hiddenCategories || [];
    return ['Todas', ...cats.filter(c => !hidden.includes(c))].sort();
  }, [productos, config.hiddenCategories]);

  const filteredProducts = useMemo(() => {
    const hiddenIds = config.hiddenProducts || [];
    const hiddenCats = config.hiddenCategories || [];
    return productos.filter(p => {
        const isHidden = hiddenIds.includes(p.id) || hiddenCats.includes(p.categoria || 'General');
        const matchesSearch = searchTerm === '' || p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCat = selectedCategory === 'Todas' || p.categoria === selectedCategory;
        return !isHidden && matchesSearch && matchesCat;
    });
  }, [productos, searchTerm, selectedCategory, config.hiddenProducts, config.hiddenCategories]);

  const addToCart = (p: Producto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCart(prev => {
      const exists = prev.find(item => item.producto.id === p.id);
      if (exists) return prev.map(item => item.producto.id === p.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      return [...prev, { producto: p, cantidad: 1 }];
    });
    setIsCartOpen(true);
    setCurrentStep('cart');
  };

  const updateCartQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => item.producto.id === id ? { ...item, cantidad: Math.max(0, item.cantidad + delta) } : item).filter(item => item.cantidad > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);

  const getCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        alert("Ubicación capturada correctamente.");
      }, (error) => {
        alert("No se pudo obtener la ubicación. Por favor, asegúrate de dar permisos.");
      });
    } else {
      alert("Geolocalización no disponible en este navegador.");
    }
  };

  const handleFinishOrder = async () => {
    setIsOrderLoading(true);
    
    const selectedSede = (config.sedes_recojo || []).find(s => s.id === clientData.sedeId);
    const sedeName = selectedSede ? selectedSede.nombre : 'Sede Principal';
    
    let locationText = '';
    if (deliveryType === 'delivery' && userLocation) {
      locationText = `\n📍 *Ubicación Exacta:* https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}`;
    }

    const message = `*NUEVO PEDIDO - ${config.nombreComercial || config.code}*\n\n` +
      `*Cliente:* ${clientData.nombre}\n` +
      `*Teléfono:* ${clientData.telefono}\n` +
      `*Tipo:* ${deliveryType === 'recojo' ? 'Recojo en Sede (' + sedeName + ')' : 'Delivery'}\n` +
      `*Dirección:* ${deliveryType === 'delivery' ? clientData.direccion : 'N/A'}${locationText}\n` +
      `*Pago:* ${paymentMethod.toUpperCase()}\n\n` +
      `*PRODUCTOS:*\n` +
      cart.map(i => `• ${i.cantidad}x ${i.producto.nombre} - S/ ${(i.producto.precio * i.cantidad).toFixed(2)}`).join('\n') +
      `\n\n*TOTAL: S/ ${cartTotal.toFixed(2)}*`;

    const waNumber = config.whatsappNumbers?.split(',')[0].trim() || '51975615244';
    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
    
    window.open(waUrl, '_blank');
    setCurrentStep('success');
    setIsOrderLoading(false);
  };

  const bizIcons = {
    pharmacy: { main: Pill, label: 'Farmacia', catIcon: Beaker },
    veterinary: { main: PawPrint, label: 'Veterinaria', catIcon: PawPrint },
    podiatry: { main: Footprints, label: 'Podología', catIcon: Footprints },
    general: { main: Briefcase, label: 'Comercio', catIcon: Package }
  }[bizType];

  const selectedSede = useMemo(() => 
    (config.sedes_recojo || []).find(s => s.id === clientData.sedeId)
  , [config.sedes_recojo, clientData.sedeId]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col relative overflow-x-hidden">
      
      {/* Header Compacto para Móvil */}
      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-900"><ArrowLeft className="w-5 h-5"/></button>}
            {config.logoUrl ? (
                <img src={config.logoUrl} className="h-8 md:h-12 w-auto object-contain" />
            ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg" style={{backgroundColor: brandColor}}><bizIcons.main className="w-5 h-5" /></div>
            )}
            <div className="hidden sm:block">
               <h1 className="font-black text-slate-900 uppercase text-[12px] md:text-[14px] leading-none tracking-tighter">{config.nombreComercial || config.code}</h1>
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1"><BadgeCheck className="w-3 h-3 text-brand-500" /> Tienda Online</p>
            </div>
          </div>
          <div className="flex-1 max-w-lg">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
              <input type="text" placeholder="Buscar..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[12px] font-bold outline-none focus:bg-white shadow-inner transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-3 bg-slate-900 text-white rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all">
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 text-white text-[9px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-pulse" style={{backgroundColor: colorA}}>{cart.length}</span>}
          </button>
        </div>
      </header>

      {/* Hero / Slides */}
      <div className="px-4 md:px-6 pt-4">
        <div className="max-w-7xl mx-auto overflow-hidden rounded-[2rem] md:rounded-[3rem] shadow-xl relative h-[160px] md:h-[450px]">
          {slides.map((slide: any, idx) => (
            <div key={idx} className={`absolute inset-0 transition-all duration-1000 ${activeSlide === idx ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'}`}>
              {slide.image ? <img src={slide.image} className="w-full h-full object-cover" /> : (
                <div className="w-full h-full p-8 md:p-24 flex items-center" style={{ background: slide.bg }}>
                   <div className="max-w-lg text-white space-y-4">
                      <span className="text-[9px] md:text-[11px] font-black uppercase tracking-widest bg-white/20 px-4 py-1 rounded-full backdrop-blur-md">{slide.badge}</span>
                      <h2 className="text-2xl md:text-6xl font-black uppercase tracking-tighter leading-none">{slide.title}</h2>
                      <p className="text-white/80 text-[10px] md:text-xl font-bold">{slide.desc}</p>
                   </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Categorías Scrolleables */}
      <div className="w-full mt-6 px-4 overflow-x-auto no-scrollbar scroll-smooth">
         <div className="max-w-7xl mx-auto flex items-center gap-3 min-w-max pb-2">
            {availableCategories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`flex items-center gap-2 px-5 py-3 rounded-2xl transition-all border-2 font-black uppercase text-[9px] tracking-widest ${selectedCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-400 border-slate-50 hover:border-slate-200'}`}>
                {cat === 'Todas' ? <Layers className="w-4 h-4"/> : <bizIcons.catIcon className="w-4 h-4"/>} {cat}
              </button>
            ))}
         </div>
      </div>

      {/* Listado de Productos Grid Móvil Optimizada */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
             <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Sincronizando...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center gap-6 opacity-40">
             <SearchX className="w-16 h-16 text-slate-200" />
             <div className="space-y-2">
                <h3 className="text-lg font-black uppercase tracking-widest text-slate-400">Sin productos</h3>
             </div>
             <button onClick={fetchProducts} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center gap-2 shadow-lg"><RefreshCw className="w-3 h-3" /> Reintentar</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-12">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => setSelectedProduct(p)} className="group bg-white rounded-[2rem] p-3 md:p-5 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col relative overflow-hidden">
                <div className="aspect-square bg-slate-50 rounded-[1.5rem] mb-3 md:mb-6 overflow-hidden flex items-center justify-center relative border border-slate-50">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500" /> : <Package className="w-10 h-10 text-slate-200"/>}
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest mb-2 px-3 py-1 bg-slate-50 rounded-lg w-fit text-slate-400">{p.categoria}</span>
                  <h3 className="text-[11px] font-black text-slate-800 line-clamp-2 uppercase h-8 mb-3 leading-tight tracking-tight">{p.nombre}</h3>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-auto">
                    <span className="text-sm md:text-lg font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    <button onClick={(e) => addToCart(p, e)} className="p-2.5 md:p-4 bg-slate-900 text-white rounded-xl shadow-md hover:scale-110 active:scale-95 transition-all"><Plus className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Ficha de Producto Optimizada para Móvil */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-12">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in" onClick={() => setSelectedProduct(null)}></div>
           <div className="relative bg-white w-full max-w-5xl md:rounded-[3rem] rounded-t-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in slide-in-from-bottom md:zoom-in duration-300 max-h-[95vh]">
              <div className="w-full md:w-1/2 h-72 md:h-auto bg-white relative overflow-hidden border-b md:border-b-0 md:border-r border-slate-100 p-8 flex items-center justify-center">
                 {selectedProduct.imagen ? <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-w-full max-h-full object-contain" /> : <Package className="w-20 h-20 text-slate-100"/>}
                 <button onClick={() => setSelectedProduct(null)} className="absolute top-6 left-6 p-3 bg-slate-900/10 hover:bg-slate-900/20 backdrop-blur-md rounded-2xl text-slate-900 transition-all"><X className="w-5 h-5"/></button>
              </div>
              <div className="flex-1 p-6 md:p-14 flex flex-col justify-between overflow-y-auto">
                 <div className="space-y-6 md:space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                       <div className="flex-1">
                          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-600 mb-2 block">{selectedProduct.categoria}</span>
                          <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{selectedProduct.nombre}</h2>
                       </div>
                       <div className="text-left md:text-right bg-brand-50 md:bg-transparent p-4 md:p-0 rounded-2xl w-full md:w-auto border border-brand-100 md:border-none">
                          <p className="text-3xl font-black text-slate-900">S/ {selectedProduct.precio.toFixed(2)}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Precio Web Garantizado</p>
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                       <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Marca / Lab</p><p className="font-bold text-slate-700 text-[11px] truncate uppercase">{selectedProduct.marca || 'Genérico'}</p></div>
                       <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Reg. Sanitario</p><p className="font-bold text-slate-700 text-[11px] truncate uppercase">{selectedProduct.registro_sanitario || 'S/N'}</p></div>
                    </div>

                    <div className="space-y-3">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Info className="w-3.5 h-3.5 text-brand-500" /> Descripción</h4>
                       <p className="text-[12px] font-bold text-slate-600 leading-relaxed uppercase">{selectedProduct.descripcion_venta || 'Información de catálogo no disponible.'}</p>
                    </div>

                    {selectedProduct.uso_sugerido && (
                       <div className="p-5 bg-brand-50 rounded-2xl border border-brand-100 space-y-2">
                          <h4 className="text-[9px] font-black text-brand-700 uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-3.5 h-3.5" /> Recomendación de Uso</h4>
                          <p className="text-[11px] font-black text-brand-900 leading-relaxed uppercase italic">{selectedProduct.uso_sugerido}</p>
                       </div>
                    )}
                 </div>

                 <div className="mt-8 pt-6 border-t border-slate-100 sticky bottom-0 bg-white">
                    <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="w-full py-5 text-white rounded-2xl font-black uppercase text-xs tracking-[0.15em] shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95" style={{backgroundColor: brandColor}}>
                       <ShoppingCart className="w-5 h-5" /> Agregar al Carrito
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Footer mejorado para Móvil */}
      <footer className="mt-auto py-16 px-6 relative overflow-hidden text-center md:text-left" style={{backgroundColor: brandColor}}>
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12 relative z-10 text-white">
           <div className="space-y-6 max-w-md">
              <div className="flex flex-col md:flex-row items-center gap-4">
                 {config.footerLogoUrl ? (
                   <img src={config.footerLogoUrl} className="h-14 md:h-16 object-contain drop-shadow-lg" />
                 ) : (
                   <div className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl border border-white/20">
                     <bizIcons.main className="w-8 h-8 text-white" />
                     <span className="font-black text-2xl tracking-tighter uppercase text-white leading-none">{config.nombreComercial || config.code}</span>
                   </div>
                 )}
              </div>
              <p className="text-[11px] md:text-sm font-bold leading-relaxed italic border-t md:border-t-0 md:border-l-4 border-white/40 pt-4 md:pt-0 md:pl-6 uppercase tracking-widest opacity-90 text-white">"{config.footer_description || 'Salud y confianza garantizada.'}"</p>
           </div>
           
           <div className="flex flex-col items-center md:items-end gap-6">
              <div className="flex gap-3">
                  {config.facebook_url && <a href={config.facebook_url} target="_blank" rel="noreferrer" className="p-4 bg-white/10 rounded-full hover:bg-white hover:text-slate-900 transition-all text-white"><Facebook className="w-6 h-6"/></a>}
                  {config.instagram_url && <a href={config.instagram_url} target="_blank" rel="noreferrer" className="p-4 bg-white/10 rounded-full hover:bg-white hover:text-slate-900 transition-all text-white"><Instagram className="w-6 h-6"/></a>}
                  {config.whatsappHelpNumber && <a href={`https://wa.me/${config.whatsappHelpNumber}`} target="_blank" rel="noreferrer" className="p-4 bg-white/10 rounded-full hover:bg-white hover:text-slate-900 transition-all text-white"><MessageCircle className="w-6 h-6"/></a>}
              </div>
              <div className="space-y-1.5 opacity-60">
                <p className="text-[9px] font-black uppercase tracking-[0.4em]">LEMON BI • 2025</p>
                <p className="text-[8px] font-black uppercase tracking-widest italic text-white/70">Powered by Gaor System</p>
              </div>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default StoreView;
