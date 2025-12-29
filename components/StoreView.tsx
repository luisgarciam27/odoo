
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, Image as ImageIcon, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, ShieldCheck, 
  Star, Facebook, Instagram, Pill, Beaker, ClipboardCheck, AlertCircle,
  Stethoscope, Footprints, PawPrint, Calendar, Wallet, CheckCircle2, Camera, ChevronRight,
  Loader2, BadgeCheck, Send, UserCheck, Sparkles, Zap, Award, HeartHandshake, ShieldAlert,
  RefreshCw, Trash2, CreditCard, Building2, Smartphone, CheckCircle, QrCode, Music2, Upload, Briefcase,
  Dog, Cat, Syringe, Tag, Layers, SearchX, Wand2, Boxes, Phone
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

type StoreStep = 'cart' | 'details' | 'payment' | 'processing' | 'success';

const StoreView: React.FC<StoreViewProps> = ({ session, config, onBack }) => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<StoreStep>('cart');
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'efectivo'>('yape');
  const [deliveryType, setDeliveryType] = useState<'recojo' | 'delivery'>('recojo');
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '', sede: '' });
  const [voucherFile, setVoucherFile] = useState<File | null>(null);

  const colorP = config?.colorPrimario || '#84cc16'; 
  const colorA = config?.colorAcento || '#0ea5e9';
  const bizType = config?.businessType || 'pharmacy';
  // Fix: Define brandColor as an alias of colorP to resolve reference errors
  const brandColor = colorP;

  const parseOdooDescription = (rawText: string = "") => {
    const lines = rawText.split('\n');
    let marca = ""; let especie = ""; let peso = ""; let registro = "";
    let descripcionLimpiaLines: string[] = [];

    lines.forEach(line => {
      const upperLine = line.toUpperCase();
      if (upperLine.includes("MARCA:")) marca = line.split(":")[1]?.trim();
      else if (upperLine.includes("ESPECIE:")) especie = line.trim();
      else if (upperLine.includes("PESO:")) peso = line.trim();
      else if (upperLine.includes("R.S.") || upperLine.includes("REGISTRO")) registro = line.split(":")[1]?.trim() || line.trim();
      else if (line.trim().length > 0 && !upperLine.includes("IMÁGENES REFERENCIALES")) descripcionLimpiaLines.push(line.trim());
    });

    return { marca: marca || "Genérico", especie: especie || "General", peso: peso, registro: registro, cleanDesc: descripcionLimpiaLines.join(' ') };
  };

  const slides = useMemo(() => {
    if (config.slide_images && config.slide_images.some(img => img)) {
      return config.slide_images.filter(img => img).map((url) => ({ image: url }));
    }
    return [
      { title: "Calidad y Bienestar", desc: "Sincronizado con inventarios reales.", icon: ShieldCheck, badge: "Garantía Oficial", bg: `linear-gradient(135deg, ${colorP}, ${colorA})` },
      { title: "Atención Especializada", desc: "Expertos cuidando de lo que más quieres.", icon: HeartHandshake, badge: "Confianza", bg: `linear-gradient(135deg, ${colorA}, ${colorP})` }
    ];
  }, [config.slide_images, colorP, colorA]);

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
      const extras = await getProductExtras(config.code);
      const fields = ['display_name', 'list_price', 'categ_id', 'image_128', 'description_sale', 'qty_available'];
      
      let domain: any[] = [['sale_ok', '=', true], ['active', '=', true]];
      let data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, fields, { limit: 1000 });

      if (!data || data.length === 0) {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], fields, { limit: 500 });
      }

      setProductos((data || []).map((p: any) => {
        const extra = extras[p.id];
        const parsed = parseOdooDescription(p.description_sale);
        return {
          id: p.id,
          nombre: p.display_name,
          precio: p.list_price || 0,
          categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
          stock: p.qty_available || 0,
          imagen: p.image_128,
          descripcion_venta: extra?.descripcion_lemon || parsed.cleanDesc || p.description_sale || '',
          uso_sugerido: extra?.instrucciones_lemon || '',
          marca: parsed.marca,
          especie: parsed.especie,
          registro_sanitario: parsed.registro || 'S/N'
        };
      }));
    } catch (e) { console.error("Odoo Sync Error:", e); }
    finally { setLoading(false); }
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

  const cartTotal = cart.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);

  const bizIcons = {
    pharmacy: { main: Pill, label: 'Farmacia', catIcon: Beaker },
    veterinary: { main: PawPrint, label: 'Veterinaria', catIcon: PawPrint },
    podiatry: { main: Footprints, label: 'Podología', catIcon: Footprints },
    general: { main: Briefcase, label: 'Comercio', catIcon: Package }
  }[bizType];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col">
      
      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {onBack && <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-900"><ArrowLeft className="w-5 h-5"/></button>}
            {config.logoUrl ? <img src={config.logoUrl} className="h-10 md:h-12 object-contain" /> : <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{backgroundColor: colorP}}><bizIcons.main className="w-6 h-6" /></div>}
            <div className="hidden md:block">
               <h1 className="font-black text-slate-900 uppercase text-[14px] leading-none tracking-tighter">{config.nombreComercial || config.code}</h1>
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5 text-brand-500" /> {bizIcons.label} Certificada</p>
            </div>
          </div>
          <div className="flex-1 max-w-lg">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input type="text" placeholder="Buscar por nombre..." className="w-full pl-12 pr-6 py-3.5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-sm font-bold outline-none focus:bg-white shadow-inner transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-4 bg-slate-900 text-white rounded-[1.5rem] shadow-xl hover:scale-105 active:scale-95 transition-all">
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 text-white text-[9px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-pulse" style={{backgroundColor: colorA}}>{cart.length}</span>}
          </button>
        </div>
      </header>

      <div className="px-6 pt-6">
        <div className="max-w-7xl mx-auto overflow-hidden rounded-[3rem] shadow-2xl relative h-[200px] md:h-[400px]">
          {slides.map((slide: any, idx) => (
            <div key={idx} className={`absolute inset-0 transition-all duration-1000 ${activeSlide === idx ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'}`}>
              {slide.image ? <img src={slide.image} className="w-full h-full object-cover" /> : (
                <div className="w-full h-full p-12 md:p-24 flex items-center" style={{ background: slide.bg }}>
                   <div className="max-w-lg text-white space-y-6">
                      <span className="text-[11px] font-black uppercase tracking-widest bg-white/20 px-6 py-2 rounded-full backdrop-blur-md">{slide.badge}</span>
                      <h2 className="text-3xl md:text-6xl font-black uppercase tracking-tighter leading-none">{slide.title}</h2>
                      <p className="text-white/80 text-sm md:text-xl font-bold">{slide.desc}</p>
                   </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="w-full mt-10 px-6 overflow-x-auto no-scrollbar scroll-smooth">
         <div className="max-w-7xl mx-auto flex items-center gap-4 min-w-max pb-4">
            {availableCategories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`flex items-center gap-3 px-8 py-5 rounded-[2rem] transition-all border-2 font-black uppercase text-[11px] tracking-widest ${selectedCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-50 hover:border-slate-300'}`}>
                {cat === 'Todas' ? <Layers className="w-5 h-5"/> : <bizIcons.catIcon className="w-5 h-5"/>} {cat}
              </button>
            ))}
         </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full p-8 md:p-12">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {[1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className="bg-white rounded-[2.5rem] aspect-[3/4] animate-pulse border border-slate-100"></div>)}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-32 text-center flex flex-col items-center gap-8 opacity-40">
             <SearchX className="w-20 h-20 text-slate-200" />
             <h3 className="text-2xl font-black uppercase tracking-widest text-slate-400">Sin productos disponibles</h3>
             <button onClick={fetchProducts} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-3 shadow-xl"><RefreshCw className="w-4 h-4" /> Recargar Catálogo</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 md:gap-12">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => setSelectedProduct(p)} className="group bg-white rounded-[2.5rem] p-5 border border-slate-50 shadow-sm hover:shadow-2xl hover:-translate-y-3 transition-all duration-500 cursor-pointer flex flex-col relative overflow-hidden">
                <div className="aspect-square bg-slate-50 rounded-[2rem] mb-6 overflow-hidden flex items-center justify-center relative">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" /> : <Package className="w-12 h-12 text-slate-200"/>}
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest mb-3 px-4 py-1.5 bg-slate-100 rounded-lg w-fit text-slate-400">{p.categoria}</span>
                  <h3 className="text-[12px] font-black text-slate-800 line-clamp-2 uppercase h-10 mb-6 leading-tight tracking-tight">{p.nombre}</h3>
                  <div className="flex items-center justify-between pt-5 border-t border-slate-50 mt-auto">
                    <span className="text-lg font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    <button onClick={(e) => addToCart(p, e)} className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all"><Plus className="w-5 h-5"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* FOOTER CON IDENTIDAD DE MARCA */}
      <footer className="mt-auto py-24 relative overflow-hidden" style={{backgroundColor: brandColor}}>
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="max-w-7xl mx-auto px-10 flex flex-col md:flex-row justify-between items-center gap-16 relative z-10 text-white">
           <div className="space-y-8 max-w-md text-center md:text-left">
              <div className="flex items-center gap-6 justify-center md:justify-start">
                 {config.footerLogoUrl ? (
                   <img src={config.footerLogoUrl} className="h-16 object-contain drop-shadow-xl" />
                 ) : (
                   <div className="flex items-center gap-4">
                     <div className="p-5 rounded-3xl bg-white shadow-2xl transform -rotate-3"><bizIcons.main className="w-8 h-8" style={{color: brandColor}} /></div>
                     <span className="font-black text-3xl tracking-tighter uppercase">{config.nombreComercial || config.code}</span>
                   </div>
                 )}
              </div>
              <p className="text-sm font-bold leading-relaxed italic border-l-4 border-white/30 pl-8 uppercase tracking-widest opacity-90">"{config.footer_description || 'Cuidado experto y garantía total en cada entrega.'}"</p>
           </div>
           <div className="text-right flex flex-col items-center md:items-end gap-6">
              <div className="flex gap-4">
                  {config.facebook_url && <a href={config.facebook_url} target="_blank" rel="noreferrer" className="p-5 bg-white/10 rounded-[2rem] hover:bg-white hover:text-slate-900 transition-all shadow-xl"><Facebook className="w-7 h-7"/></a>}
                  {config.instagram_url && <a href={config.instagram_url} target="_blank" rel="noreferrer" className="p-5 bg-white/10 rounded-[2rem] hover:bg-white hover:text-slate-900 transition-all shadow-xl"><Instagram className="w-7 h-7"/></a>}
                  {config.tiktok_url && <a href={config.tiktok_url} target="_blank" rel="noreferrer" className="p-5 bg-white/10 rounded-[2rem] hover:bg-white hover:text-slate-900 transition-all shadow-xl"><Music2 className="w-7 h-7"/></a>}
                  {config.whatsappHelpNumber && <a href={`https://wa.me/${config.whatsappHelpNumber}`} target="_blank" rel="noreferrer" className="p-5 bg-white/10 rounded-[2rem] hover:bg-white hover:text-slate-900 transition-all shadow-xl"><MessageCircle className="w-7 h-7"/></a>}
              </div>
              <div className="space-y-2 opacity-50 text-center md:text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.5em]">LEMON BI ANALYTICS • GAORSYSTEM 2025</p>
                <p className="text-[8px] font-black uppercase tracking-widest">Tecnología Inteligente para el Sector Salud</p>
              </div>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default StoreView;
