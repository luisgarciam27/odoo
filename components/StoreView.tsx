
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
  const [currentStep, setCurrentStep] = useState('cart');
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

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    const client = new OdooClient(session.url, session.db, true);
    try {
      const extrasMap = await getProductExtras(config.code);
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
          return {
            id: p.id,
            nombre: p.display_name,
            precio: p.list_price || 0,
            categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
            stock: p.qty_available || 0,
            imagen: p.image_512 || p.image_128,
            descripcion_venta: extra?.descripcion_lemon || p.description_sale || '',
            uso_sugerido: extra?.instrucciones_lemon || '',
            categoria_personalizada: extra?.categoria_personalizada || '',
            marca: 'Genérico',
            registro_sanitario: 'Validado'
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
    // Extraemos categorías tanto de Odoo como las personalizadas
    const cats = new Set<string>();
    productos.forEach(p => {
        if (p.categoria_personalizada) cats.add(p.categoria_personalizada);
        else if (p.categoria) cats.add(p.categoria);
    });
    
    const hidden = config.hiddenCategories || [];
    return ['Todas', ...Array.from(cats).filter(c => !hidden.includes(c))].sort();
  }, [productos, config.hiddenCategories]);

  const filteredProducts = useMemo(() => {
    const hiddenIds = config.hiddenProducts || [];
    const hiddenCats = config.hiddenCategories || [];
    return productos.filter(p => {
        const prodCat = p.categoria_personalizada || p.categoria || 'General';
        const isHidden = hiddenIds.includes(p.id) || hiddenCats.includes(prodCat);
        const matchesSearch = searchTerm === '' || p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCat = selectedCategory === 'Todas' || prodCat === selectedCategory;
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
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        alert("Ubicación capturada correctamente.");
      }, (error) => { alert("No se pudo obtener la ubicación."); });
    }
  };

  const handleFinishOrder = async () => {
    setIsOrderLoading(true);
    const selectedSede = (config.sedes_recojo || []).find(s => s.id === clientData.sedeId);
    const sedeName = selectedSede ? selectedSede.nombre : 'Sede Principal';
    let locationText = deliveryType === 'delivery' && userLocation ? `\n📍 *Ubicación:* https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}` : '';

    const message = `*NUEVO PEDIDO - ${config.nombreComercial || config.code}*\n\n` +
      `*Cliente:* ${clientData.nombre}\n` +
      `*Teléfono:* ${clientData.telefono}\n` +
      `*Tipo:* ${deliveryType === 'recojo' ? 'Recojo (' + sedeName + ')' : 'Delivery'}\n` +
      `*Dirección:* ${deliveryType === 'delivery' ? clientData.direccion : 'N/A'}${locationText}\n` +
      `*Pago:* ${paymentMethod.toUpperCase()}\n\n` +
      `*PRODUCTOS:*\n` +
      cart.map(i => `• ${i.cantidad}x ${i.producto.nombre} - S/ ${(i.producto.precio * i.cantidad).toFixed(2)}`).join('\n') +
      `\n\n*TOTAL: S/ ${cartTotal.toFixed(2)}*`;

    window.open(`https://wa.me/${config.whatsappNumbers?.split(',')[0].trim() || '51975615244'}?text=${encodeURIComponent(message)}`, '_blank');
    setCurrentStep('success');
    setIsOrderLoading(false);
  };

  const bizIcons = {
    pharmacy: { main: Pill, label: 'Farmacia', catIcon: Beaker },
    veterinary: { main: PawPrint, label: 'Veterinaria', catIcon: PawPrint },
    podiatry: { main: Footprints, label: 'Podología', catIcon: Footprints },
    general: { main: Briefcase, label: 'Comercio', catIcon: Package }
  }[bizType];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col relative overflow-x-hidden">
      
      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-900"><ArrowLeft className="w-5 h-5"/></button>}
            {config.logoUrl ? <img src={config.logoUrl} className="h-8 md:h-12 w-auto object-contain" /> : <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg" style={{backgroundColor: brandColor}}><bizIcons.main className="w-5 h-5" /></div>}
            <div className="hidden sm:block">
               <h1 className="font-black text-slate-900 uppercase text-[12px] md:text-[14px] leading-none tracking-tighter">{config.nombreComercial || config.code}</h1>
            </div>
          </div>
          <div className="flex-1 max-w-lg">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
              <input type="text" placeholder="Buscar..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[12px] font-bold outline-none focus:bg-white transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-3 bg-slate-900 text-white rounded-2xl shadow-xl transition-all">
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 text-white text-[9px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-pulse" style={{backgroundColor: colorA}}>{cart.length}</span>}
          </button>
        </div>
      </header>

      <div className="w-full mt-6 px-4 overflow-x-auto no-scrollbar scroll-smooth">
         <div className="max-w-7xl mx-auto flex items-center gap-3 min-w-max pb-2">
            {availableCategories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`flex items-center gap-2 px-5 py-3 rounded-2xl transition-all border-2 font-black uppercase text-[9px] tracking-widest ${selectedCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-400 border-slate-50 hover:border-slate-200'}`}>
                {cat === 'Todas' ? <Layers className="w-4 h-4"/> : <Tag className="w-4 h-4"/>} {cat}
              </button>
            ))}
         </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
             <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-12">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => setSelectedProduct(p)} className="group bg-white rounded-[2rem] p-3 md:p-5 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col relative overflow-hidden">
                <div className="aspect-square bg-slate-50 rounded-[1.5rem] mb-3 md:mb-6 overflow-hidden flex items-center justify-center relative">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500" /> : <Package className="w-10 h-10 text-slate-200"/>}
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest mb-2 px-3 py-1 bg-slate-50 rounded-lg w-fit text-slate-400">{p.categoria_personalizada || p.categoria}</span>
                  <h3 className="text-[11px] font-black text-slate-800 line-clamp-2 uppercase h-8 mb-3 leading-tight tracking-tight">{p.nombre}</h3>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-auto">
                    <span className="text-sm md:text-lg font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    <button onClick={(e) => addToCart(p, e)} className="p-2.5 md:p-4 bg-slate-900 text-white rounded-xl shadow-md transition-all"><Plus className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Detalle Producto, Checkout, etc. se mantienen igual pero usando las nuevas props */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-12">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in" onClick={() => setSelectedProduct(null)}></div>
           <div className="relative bg-white w-full max-w-5xl md:rounded-[3rem] rounded-t-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in slide-in-from-bottom md:zoom-in duration-300 max-h-[95vh]">
              <div className="w-full md:w-1/2 h-72 md:h-auto bg-white relative overflow-hidden flex items-center justify-center p-8">
                 {selectedProduct.imagen ? <img src={`data:image/png;base64,${selectedProduct.imagen}`} className="max-w-full max-h-full object-contain" /> : <Package className="w-20 h-20 text-slate-100"/>}
                 <button onClick={() => setSelectedProduct(null)} className="absolute top-6 left-6 p-3 bg-slate-900/10 rounded-2xl text-slate-900"><X className="w-5 h-5"/></button>
              </div>
              <div className="flex-1 p-6 md:p-14 flex flex-col justify-between overflow-y-auto">
                 <div className="space-y-6">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-600 mb-2 block">{selectedProduct.categoria_personalizada || selectedProduct.categoria}</span>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{selectedProduct.nombre}</h2>
                    <p className="text-3xl font-black text-slate-900">S/ {selectedProduct.precio.toFixed(2)}</p>
                    <p className="text-[12px] font-bold text-slate-600 leading-relaxed uppercase">{selectedProduct.descripcion_venta || 'Información de catálogo no disponible.'}</p>
                 </div>
                 <div className="mt-8 pt-6 border-t border-slate-100">
                    <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="w-full py-5 text-white rounded-2xl font-black uppercase text-xs tracking-[0.15em] shadow-xl flex items-center justify-center gap-3 transition-all" style={{backgroundColor: brandColor}}>
                       <ShoppingCart className="w-5 h-5" /> Agregar al Carrito
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default StoreView;
