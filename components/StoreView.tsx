
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Package, Search, X, Image as ImageIcon, ArrowLeft, 
  Plus, Minus, Info, MapPin, Truck,
  MessageCircle, ShieldCheck, 
  Star, Facebook, Instagram, Pill, Beaker, ClipboardCheck, AlertCircle,
  Stethoscope, Footprints, PawPrint, Calendar, Wallet, CheckCircle2, Camera, ChevronRight,
  Loader2, BadgeCheck, Send, UserCheck, Sparkles, Zap, Award, HeartHandshake, ShieldAlert,
  RefreshCw, Trash2, CreditCard, Building2, Smartphone, CheckCircle, QrCode, Music2, Upload, Briefcase,
  Dog, Cat, Syringe, Tag, Layers, SearchX, Wand2, Boxes
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
  const [activeTab, setActiveTab] = useState<'info' | 'tech' | 'usage'>('info');
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'efectivo'>('yape');
  const [deliveryType, setDeliveryType] = useState<'recojo' | 'delivery'>('recojo');
  const [clientData, setClientData] = useState({ nombre: '', telefono: '', direccion: '', sede: '' });
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [voucherPreview, setVoucherPreview] = useState<string | null>(null);

  const colorP = config?.colorPrimario || '#84cc16'; 
  const colorA = config?.colorAcento || '#0ea5e9';
  const bizType = config?.businessType || 'pharmacy';

  const parseOdooDescription = (rawText: string = "") => {
    const lines = rawText.split('\n');
    let marca = "";
    let especie = "";
    let peso = "";
    let registro = "";
    let descripcionLimpiaLines: string[] = [];

    lines.forEach(line => {
      const upperLine = line.toUpperCase();
      if (upperLine.includes("MARCA:")) {
        marca = line.split(":")[1]?.trim();
      } else if (upperLine.includes("ESPECIE:") || upperLine.includes("PERROS") || upperLine.includes("GATOS")) {
        especie = line.trim();
      } else if (upperLine.includes("PESO:") || upperLine.includes("KG")) {
        peso = line.trim();
      } else if (upperLine.includes("R.S.") || upperLine.includes("REGISTRO")) {
        registro = line.split(":")[1]?.trim() || line.trim();
      } else if (line.trim().length > 0 && !upperLine.includes("IMÁGENES REFERENCIALES")) {
        descripcionLimpiaLines.push(line.trim());
      }
    });

    return {
      marca: marca || "Genérico",
      especie: especie || "General",
      peso: peso,
      registro: registro,
      cleanDesc: descripcionLimpiaLines.join(' ')
    };
  };

  const slides = useMemo(() => {
    if (config.slide_images && config.slide_images.some(img => img)) {
      return config.slide_images.filter(img => img).map((url) => ({
        image: url,
        title: config.nombreComercial || "Tienda Online",
        desc: "Excelencia en cada pedido.",
        badge: "Especial"
      }));
    }
    return [
      { title: "Calidad y Bienestar Garantizado", desc: "Sincronizado con nuestros inventarios reales.", icon: ShieldCheck, badge: "Garantía Oficial", bg: `linear-gradient(135deg, ${colorP}, ${colorA})` },
      { title: "Atención Especializada", desc: "Expertos cuidando de lo que más quieres.", icon: HeartHandshake, badge: "Confianza", bg: `linear-gradient(135deg, ${colorA}, ${colorP})` }
    ];
  }, [config.slide_images, config.nombreComercial, colorP, colorA]);

  useEffect(() => {
    if (slides.length > 1) {
      const timer = setInterval(() => {
        setActiveSlide(s => (s + 1) % slides.length);
      }, 6000);
      return () => clearInterval(timer);
    }
  }, [slides.length]);

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    const client = new OdooClient(session.url, session.db, true);
    try {
      const extras = await getProductExtras(config.code);
      
      // ESTRATEGIA MULTI-INTENTO PARA ODOO 14/17
      // 1. Intentar con filtro de empresa y activo (Estándar)
      let domain: any[] = [['sale_ok', '=', true], ['active', '=', true]];
      if (session.companyId) {
          domain.push('|');
          domain.push(['company_id', '=', session.companyId]);
          domain.push(['company_id', '=', false]);
      }

      const fields = ['display_name', 'list_price', 'categ_id', 'image_128', 'description_sale', 'qty_available'];
      let data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, fields, { limit: 1000, order: 'display_name asc' });
      
      // 2. Si falló, intentar búsqueda global (Sin filtro de empresa)
      if (!data || data.length === 0) {
          console.warn("[LemonBI] Intento 1 sin resultados. Probando búsqueda global...");
          data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], fields, { limit: 500 });
      }
      
      // 3. Si falló el global, intentar con Odoo 14 legacy fields si es necesario (qty_available a veces no está en search_read simple)
      if (!data || data.length === 0) {
          console.warn("[LemonBI] Intento 2 sin resultados. Probando búsqueda mínima...");
          data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], ['display_name', 'list_price', 'categ_id', 'image_128'], { limit: 300 });
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
          descripcion_raw: p.description_sale,
          descripcion_venta: extra?.descripcion_lemon || parsed.cleanDesc || p.description_sale || '',
          uso_sugerido: extra?.instrucciones_lemon || '',
          laboratorio: parsed.marca,
          marca: parsed.marca,
          especie: parsed.especie,
          peso_rango: parsed.peso,
          registro_sanitario: parsed.registro || 'S/N'
        };
      }));
    } catch (e) { 
      console.error("Error sincronización Odoo:", e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchProducts(); }, [session, config.code]);

  const availableCategories = useMemo(() => {
    const allCats = Array.from(new Set(productos.map(p => p.categoria || 'General')));
    const hidden = config.hiddenCategories || [];
    return ['Todas', ...allCats.filter(cat => !hidden.includes(cat))].sort();
  }, [productos, config.hiddenCategories]);

  const filteredProducts = useMemo(() => {
    const hiddenIds = config.hiddenProducts || [];
    const hiddenCats = config.hiddenCategories || [];

    return productos.filter(p => {
        const isHiddenById = hiddenIds.includes(p.id);
        const isHiddenByCat = hiddenCats.includes(p.categoria || 'General');
        const matchesSearch = searchTerm === '' || p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCat = selectedCategory === 'Todas' || p.categoria === selectedCategory;
        return !isHiddenById && !isHiddenByCat && matchesSearch && matchesCat;
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

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(i => i.producto.id === id ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i));
  };

  const removeFromCart = (id: number) => setCart(prev => prev.filter(i => i.producto.id !== id));
  const cartTotal = cart.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);

  const handleFinalOrder = async () => {
    if (clientData.nombre.length < 3 || clientData.telefono.length < 9) {
      alert("Completa tus datos de contacto.");
      setCurrentStep('details');
      return;
    }
    
    if ((paymentMethod === 'yape' || paymentMethod === 'plin') && !voucherFile) {
      alert("Por favor, adjunta la captura de tu pago para validar el pedido.");
      return;
    }

    setCurrentStep('processing');
    try {
      const client = new OdooClient(session.url, session.db, true);
      let partnerId: number;
      const partners = await client.searchRead(session.uid, session.apiKey, 'res.partner', [['phone', '=', clientData.telefono]], ['id'], { limit: 1 });
      if (partners.length > 0) partnerId = partners[0].id;
      else partnerId = await client.create(session.uid, session.apiKey, 'res.partner', { name: clientData.nombre.toUpperCase(), phone: clientData.telefono });

      const orderLines = cart.map(item => [0, 0, { 
        product_id: item.producto.id, 
        product_uom_qty: item.cantidad, 
        price_unit: item.producto.precio, 
        name: item.producto.nombre 
      }]);
      
      const note = `[PEDIDO ONLINE]\nMétodo: ${paymentMethod.toUpperCase()}\nEntrega: ${deliveryType.toUpperCase()}\nSede/Dir: ${deliveryType === 'recojo' ? clientData.sede : clientData.direccion}`;
      
      const newOrderId = await client.create(session.uid, session.apiKey, 'sale.order', { 
        partner_id: partnerId, 
        order_line: orderLines, 
        note: note 
      });

      const orderInfo = await client.searchRead(session.uid, session.apiKey, 'sale.order', [['id', '=', newOrderId]], ['name']);
      const orderName = orderInfo[0]?.name || `#${newOrderId}`;
      setLastOrderId(orderName);

      let voucherUrl = "";
      if (voucherFile) {
        const fileName = `${config.code}/${orderName}_${Date.now()}.png`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('vouchers').upload(fileName, voucherFile);
        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from('vouchers').getPublicUrl(fileName);
          voucherUrl = publicUrlData.publicUrl;
        }
      }

      await supabase.from('pedidos_tienda').insert([{
        order_name: orderName,
        cliente_nombre: clientData.nombre,
        monto: cartTotal,
        voucher_url: voucherUrl,
        empresa_code: config.code,
        estado: 'pendiente'
      }]);

      setCurrentStep('success');
      const msg = `*🚀 NUEVO PEDIDO: ${orderName}*%0A👤 *Cliente:* ${clientData.nombre}%0A💰 *Total:* S/ ${cartTotal.toFixed(2)}%0A📍 *Entrega:* ${deliveryType.toUpperCase()}%0A%0A_Generado por Lemon BI Store_`;
      setTimeout(() => {
        window.open(`https://wa.me/${config.whatsappNumbers?.split(',')[0]}?text=${msg}`);
        setCart([]);
      }, 2500);

    } catch (e: any) {
      alert("Error procesando pedido: " + e.message);
      setCurrentStep('payment');
    }
  };

  const bizIcons = {
    pharmacy: { main: Pill, tag: 'FARMACÉUTICO', label: 'Farmacia', catIcon: Beaker },
    veterinary: { main: PawPrint, tag: 'VETERINARIO', label: 'Veterinaria', catIcon: PawPrint },
    podiatry: { main: Footprints, tag: 'PODOLOGÍA', label: 'Podología', catIcon: Footprints },
    general: { main: Briefcase, tag: 'PRODUCTO', label: 'Comercio', catIcon: Package }
  }[bizType];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col overflow-x-hidden">
      
      {config.whatsappHelpNumber && (
        <a href={`https://wa.me/${config.whatsappHelpNumber}`} target="_blank" rel="noreferrer" className="fixed bottom-8 right-8 z-[80] bg-emerald-500 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all flex items-center justify-center animate-bounce"><MessageCircle className="w-6 h-6" /></a>
      )}

      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            {onBack && <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-900"><ArrowLeft className="w-5 h-5"/></button>}
            {config.logoUrl ? <img src={config.logoUrl} className="h-8 md:h-10 object-contain" /> : <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{backgroundColor: colorP}}><bizIcons.main className="w-5 h-5" /></div>}
            <div className="hidden sm:block">
               <h1 className="font-black text-slate-900 uppercase text-[12px] leading-none tracking-tight">{config.nombreComercial || config.code}</h1>
               <p className="text-[8px] font-black text-brand-600 uppercase tracking-widest mt-1.5 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {bizIcons.label} Oficial</p>
            </div>
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input type="text" placeholder="Buscar en el catálogo..." className="w-full pl-10 pr-4 py-2.5 bg-slate-100 rounded-2xl text-[11px] font-bold outline-none focus:bg-white shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <button onClick={() => { setIsCartOpen(true); setCurrentStep('cart'); }} className="relative p-3 bg-slate-900 text-white rounded-2xl shadow-xl">
            <ShoppingCart className="w-4 h-4" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 text-white text-[8px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-pulse" style={{backgroundColor: colorA}}>{cart.length}</span>}
          </button>
        </div>
      </header>

      <div className="px-4 md:px-6 pt-4">
        <div className="max-w-7xl mx-auto overflow-hidden rounded-[2rem] md:rounded-[3rem] shadow-xl relative h-[160px] md:h-[320px]">
          {slides.map((slide: any, idx) => (
            <div key={idx} className={`absolute inset-0 transition-all duration-1000 ${activeSlide === idx ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'}`}>
              {slide.image ? <img src={slide.image} className="w-full h-full object-cover" /> : (
                <div className="w-full h-full p-8 md:p-14 flex items-center" style={{ background: slide.bg }}>
                   <div className="max-w-sm text-white space-y-4">
                      <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-4 py-1.5 rounded-full backdrop-blur-md">{slide.badge}</span>
                      <h2 className="text-2xl md:text-5xl font-black uppercase tracking-tighter leading-none">{slide.title}</h2>
                      <p className="text-white/80 text-[10px] md:text-lg font-medium">{slide.desc}</p>
                   </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="w-full mt-8 px-4 md:px-10 overflow-x-auto no-scrollbar scroll-smooth">
         <div className="max-w-7xl mx-auto flex items-center gap-4 min-w-max pb-4">
            {availableCategories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`flex items-center gap-3 px-6 py-4 rounded-[1.8rem] transition-all border-2 font-black uppercase text-[10px] tracking-widest whitespace-nowrap ${selectedCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}>
                {cat === 'Todas' ? <Layers className="w-4 h-4"/> : <bizIcons.catIcon className="w-4 h-4"/>} {cat}
              </button>
            ))}
         </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-10">
        <div className="flex items-center justify-between mb-10 pb-4 border-b border-slate-100">
           <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-900">{selectedCategory === 'Todas' ? 'Catálogo Completo' : selectedCategory}</h2>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2"><Boxes className="w-3.5 h-3.5"/> Sincronizado vía Odoo Cloud (Real-Time)</p>
           </div>
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{filteredProducts.length} Ítems</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
            {[1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className="bg-white rounded-[2.5rem] aspect-[3/4] animate-pulse border border-slate-100"></div>)}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center gap-8 animate-in fade-in zoom-in">
             <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center border-4 border-dashed border-slate-100"><SearchX className="w-12 h-12 text-slate-200" /></div>
             <div className="space-y-4 max-w-sm">
                <h3 className="text-xl font-black uppercase tracking-widest text-slate-400">No hay productos visibles</h3>
                <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest px-8">Asegúrate de que los productos tengan marcada la opción "Puede ser Vendido" en Odoo.</p>
                <button onClick={fetchProducts} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest flex items-center gap-3 mx-auto shadow-xl hover:scale-105 transition-all"><RefreshCw className="w-4 h-4" /> Reintentar Carga</button>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-10">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => { setSelectedProduct(p); setActiveTab('info'); }} className="group bg-white rounded-[2.5rem] p-4 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer flex flex-col relative">
                <div className="aspect-square bg-slate-50 rounded-[2rem] mb-5 overflow-hidden flex items-center justify-center group-hover:bg-white transition-colors relative">
                  {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" /> : <Package className="w-10 h-10 text-slate-200"/>}
                  {p.marca && <div className="absolute top-2 left-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-slate-100 shadow-sm"><p className="text-[8px] font-black uppercase text-brand-600 truncate max-w-[70px]">{p.marca}</p></div>}
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest mb-2 px-3 py-1 bg-slate-100 rounded-lg w-fit text-slate-400">{p.categoria}</span>
                  <h3 className="text-[11px] font-bold text-slate-800 line-clamp-2 uppercase h-8 mb-5 leading-tight">{p.nombre}</h3>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-auto">
                    <span className="text-sm font-black text-slate-900">S/ {p.precio.toFixed(2)}</span>
                    <button onClick={(e) => addToCart(p, e)} className="p-3 bg-slate-900 text-white rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all"><Plus className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="mt-auto py-20 bg-slate-900 text-white border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-12">
           <div className="space-y-6 max-w-sm text-center md:text-left">
              <div className="flex items-center gap-4 justify-center md:justify-start">
                 <div className="p-4 rounded-2xl bg-brand-500 shadow-2xl transform -rotate-3"><bizIcons.main className="w-7 h-7 text-white" /></div>
                 <span className="font-black text-2xl tracking-tighter uppercase">{config.nombreComercial || config.code}</span>
              </div>
              <p className="text-xs text-slate-400 font-medium leading-relaxed italic border-l-2 border-slate-700 pl-6 uppercase tracking-wider opacity-70">"{config.footer_description || 'Excelencia profesional y cuidado integral con tecnología Lemon BI.'}"</p>
           </div>
           <div className="text-right flex flex-col items-center md:items-end gap-2">
              <div className="flex gap-5 mb-6">
                  {config.facebook_url && <a href={config.facebook_url} target="_blank" rel="noreferrer" className="p-4 bg-white/5 rounded-[1.5rem] hover:bg-brand-500 transition-all"><Facebook className="w-6 h-6"/></a>}
                  {config.instagram_url && <a href={config.instagram_url} target="_blank" rel="noreferrer" className="p-4 bg-white/5 rounded-[1.5rem] hover:bg-brand-500 transition-all"><Instagram className="w-6 h-6"/></a>}
                  {config.tiktok_url && <a href={config.tiktok_url} target="_blank" rel="noreferrer" className="p-4 bg-white/5 rounded-[1.5rem] hover:bg-brand-500 transition-all"><Music2 className="w-6 h-6"/></a>}
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">© 2025 LEMON BI ANALYTICS • GAORSYSTEM</p>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default StoreView;
