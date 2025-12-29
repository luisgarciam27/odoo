
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Package, Save, RefreshCw, Loader2, Edit, X, CheckCircle2, 
  UploadCloud, Boxes, EyeOff, Eye, Layers, Tag, Info, AlertCircle,
  Database, Zap, ArrowRight, PackageSearch
} from 'lucide-react';
import { Producto, OdooSession, ClientConfig } from '../types';
import { OdooClient } from '../services/odoo';
import { saveClient, saveProductExtra, getProductExtras } from '../services/clientManager';

interface ProductManagerProps {
  session: OdooSession;
  config: ClientConfig;
  onUpdate: (newConfig: ClientConfig) => void;
}

const ProductManager: React.FC<ProductManagerProps> = ({ session, config, onUpdate }) => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [odooCategories, setOdooCategories] = useState<{id: number, name: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'productos' | 'categorias'>('productos');
  
  const [hiddenIds, setHiddenIds] = useState<number[]>(config.hiddenProducts || []);
  const [hiddenCats, setHiddenCats] = useState<string[]>(config.hiddenCategories || []);

  const fetchCatalogData = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg(null);
    const client = new OdooClient(session.url, session.db, session.useProxy);
    
    const fieldSets = [
      ['display_name', 'list_price', 'categ_id', 'image_128', 'qty_available', 'uom_id'],
      ['display_name', 'list_price', 'categ_id', 'image_128', 'uom_id'], 
      ['display_name', 'list_price', 'categ_id', 'image_small'], 
      ['display_name', 'list_price'] 
    ];

    try {
      const extrasMap = await getProductExtras(config.code);
      
      try {
        const cats = await client.searchRead(session.uid, session.apiKey, 'product.category', [], ['name'], { order: 'name asc' });
        setOdooCategories(cats.map((c: any) => ({ id: c.id, name: c.name })));
      } catch (e) { console.warn("Fallo carga categorías"); }

      let data = null;
      for (const fields of fieldSets) {
        try {
          data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], fields, { limit: 1000, order: 'display_name asc' });
          if (data && Array.isArray(data)) break;
        } catch (err: any) { console.warn(`Intento fallido: ${err.message}`); }
      }

      if (data && Array.isArray(data)) {
        setProductos(data.map((p: any) => {
          const extra = extrasMap[p.id];
          return {
            id: p.id,
            nombre: p.display_name,
            precio: p.list_price || 0,
            costo: 0,
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
        setErrorMsg("El servidor Odoo no devolvió productos.");
      }
    } catch (e: any) {
      setErrorMsg(`Error de Red: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (session && config.code) {
      fetchCatalogData(); 
    }
  }, [session, config.code]);

  const filteredProducts = useMemo(() => {
    return productos.filter(p => {
        const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'Todas' || p.categoria === categoryFilter || p.categoria_personalizada === categoryFilter;
        return matchesSearch && matchesCategory;
    });
  }, [productos, searchTerm, categoryFilter]);

  const handleSaveAll = async () => {
    setSaving(true);
    const newConfig = { ...config, hiddenProducts: hiddenIds.map(Number), hiddenCategories: hiddenCats };
    const result = await saveClient(newConfig, false);
    if (result.success) {
      onUpdate(newConfig);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
    setSaving(false);
  };

  const saveExtraInfo = async () => {
    if (!editingProduct) return;
    setSaving(true);
    const result = await saveProductExtra({
      odoo_id: editingProduct.id,
      empresa_code: config.code,
      descripcion_lemon: editingProduct.descripcion_venta,
      instrucciones_lemon: editingProduct.uso_sugerido,
      categoria_personalizada: editingProduct.categoria_personalizada
    });
    if (result.success) {
      setProductos(prev => prev.map(p => p.id === editingProduct.id ? editingProduct : p));
      setEditingProduct(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
    setSaving(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 pb-32 animate-in fade-in duration-500 font-sans">
      
      {/* HEADER GESTIÓN */}
      <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-6">
           <div className="w-20 h-20 bg-brand-50 rounded-[2.5rem] flex items-center justify-center text-brand-600 shadow-inner">
              <PackageSearch className="w-10 h-10" />
           </div>
           <div>
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Mi Vitrina Digital</h2>
              <div className="flex items-center gap-3 mt-2">
                 <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] ${loading ? 'text-amber-500' : 'text-brand-600'}`}>
                    {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    Sincronización Odoo v17
                 </span>
                 <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{productos.length} Ítems</span>
              </div>
           </div>
        </div>
        
        <div className="flex gap-4">
          <button onClick={fetchCatalogData} disabled={loading} className="px-8 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-white transition-all">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sincronizar
          </button>
          <button onClick={handleSaveAll} disabled={saving || loading} className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl flex items-center gap-3 hover:bg-brand-500 transition-all">
             {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar Visibilidad
          </button>
        </div>
      </div>

      {/* TABS NAVEGACIÓN */}
      <div className="flex bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm w-fit">
         <button onClick={() => setActiveTab('productos')} className={`px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all ${activeTab === 'productos' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
            <Package className="w-4.5 h-4.5" /> Productos
         </button>
         <button onClick={() => setActiveTab('categorias')} className={`px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all ${activeTab === 'categorias' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
            <Layers className="w-4.5 h-4.5" /> Categorías Odoo
         </button>
      </div>

      {activeTab === 'productos' ? (
        <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-xl overflow-hidden min-h-[600px]">
          <div className="p-8 border-b border-slate-100 bg-slate-50/20 flex flex-col md:flex-row gap-6">
             <div className="relative flex-1 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
                <input type="text" placeholder="Busca un producto por nombre..." className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-2xl outline-none text-[11px] font-bold uppercase tracking-tight focus:ring-4 focus:ring-brand-500/10 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             </div>
             <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:block">Filtro:</span>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-8 py-4 bg-white border border-slate-100 rounded-2xl outline-none text-[10px] font-black uppercase tracking-widest cursor-pointer shadow-sm focus:ring-4 focus:ring-brand-500/10">
                    <option value="Todas">Todas las Secciones</option>
                    {odooCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    {config.customCategories?.map(cat => <option key={cat} value={cat}>{cat} (VIRTUAL)</option>)}
                </select>
             </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-52 gap-6 opacity-40">
                    <Loader2 className="w-16 h-16 animate-spin text-brand-500" />
                    <p className="font-black uppercase tracking-[0.4em] text-[10px]">Cargando base de datos...</p>
                </div>
            ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b">
                    <tr>
                      <th className="px-10 py-6">Producto Sincronizado</th>
                      <th className="px-8 py-6">Categoría Web</th>
                      <th className="px-8 py-6 text-right">Precio Actual</th>
                      <th className="px-10 py-6 text-right">Visibilidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map(p => {
                       const isHidden = hiddenIds.includes(p.id);
                       const prodCat = p.categoria_personalizada || p.categoria || 'General';
                       const isCatHidden = hiddenCats.includes(prodCat);
                       return (
                          <tr key={p.id} className={`hover:bg-slate-50 transition-all ${isHidden || isCatHidden ? 'bg-slate-50/50' : ''}`}>
                             <td className="px-10 py-6 flex items-center gap-6">
                                <div className="w-16 h-16 bg-white rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center shrink-0 shadow-inner">
                                   {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-contain mix-blend-multiply" /> : <Package className="w-6 h-6 text-slate-100" />}
                                </div>
                                <div className="min-w-0">
                                   <p className={`font-black text-[12px] uppercase tracking-tight truncate max-w-[300px] transition-colors ${isHidden || isCatHidden ? 'text-slate-300' : 'text-slate-800'}`}>{p.nombre}</p>
                                   <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Sincronizado via Odoo</p>
                                </div>
                             </td>
                             <td className="px-8 py-6">
                                <div className="flex flex-col gap-1">
                                   <span className={`text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest w-fit shadow-sm ${p.categoria_personalizada ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                      {prodCat}
                                   </span>
                                   {p.categoria_personalizada && <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest ml-1">Virtual</span>}
                                </div>
                             </td>
                             <td className={`px-8 py-6 text-right font-black text-base tracking-tighter ${isHidden || isCatHidden ? 'text-slate-300' : 'text-slate-900'}`}>S/ {p.precio.toFixed(2)}</td>
                             <td className="px-10 py-6 text-right flex justify-end gap-3 items-center">
                                <button onClick={() => setEditingProduct(p)} className="p-4 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"><Edit className="w-5 h-5" /></button>
                                <button 
                                   onClick={() => setHiddenIds(prev => isHidden ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                                   className={`px-8 py-3.5 rounded-2xl font-black text-[9px] uppercase tracking-[0.2em] min-w-[130px] transition-all shadow-lg ${isHidden ? 'bg-red-50 text-red-500 border border-red-100 shadow-red-500/10' : 'bg-brand-500 text-white shadow-brand-500/20'}`}
                                >
                                   {isHidden ? 'Oculto' : 'En Vitrina'}
                                </button>
                             </td>
                          </tr>
                       );
                    })}
                  </tbody>
                </table>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-xl p-12">
           <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-10">Ocultar Categorías de Odoo</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {odooCategories.map(cat => {
                const isHidden = hiddenCats.includes(cat.name);
                return (
                  <div key={cat.id} className={`p-8 rounded-3xl border-2 transition-all flex items-center justify-between group ${isHidden ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-100 shadow-sm hover:border-brand-200'}`}>
                     <span className={`font-black text-[11px] uppercase tracking-[0.2em] ${isHidden ? 'text-slate-300' : 'text-slate-800'}`}>{cat.name}</span>
                     <button onClick={() => setHiddenCats(prev => isHidden ? prev.filter(c => c !== cat.name) : [...prev, cat.name])} className={`p-4 rounded-2xl shadow-xl transition-all ${isHidden ? 'bg-slate-200 text-slate-400' : 'bg-brand-500 text-white hover:scale-110 active:scale-90'}`}>
                        {isHidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                     </button>
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {/* MODAL EDICIÓN PRODUCTO */}
      {editingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative bg-white w-full max-w-2xl rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] p-12 animate-in zoom-in duration-300 overflow-y-auto max-h-[90vh] font-sans">
            <div className="flex justify-between items-start mb-10">
              <div>
                 <h3 className="text-2xl font-black uppercase text-slate-900 tracking-tighter leading-none mb-2">{editingProduct.nombre}</h3>
                 <p className="text-[10px] font-bold text-brand-600 uppercase tracking-[0.3em]">Personalización Web Lemon BI</p>
              </div>
              <button onClick={() => setEditingProduct(null)} className="p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all"><X className="w-6 h-6"/></button>
            </div>
            
            <div className="space-y-10">
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Categoría Virtual (Para Filtros)</label>
                    <span className="text-[8px] font-black uppercase text-orange-500 px-3 py-1 bg-orange-50 rounded-full">Organización Web</span>
                 </div>
                 <select 
                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] font-black text-xs uppercase shadow-inner outline-none focus:ring-4 focus:ring-orange-500/10 cursor-pointer appearance-none" 
                    value={editingProduct.categoria_personalizada || ''} 
                    onChange={e => setEditingProduct({...editingProduct, categoria_personalizada: e.target.value})} 
                 >
                    <option value="">-- SELECCIONAR CATEGORÍA CREADA --</option>
                    {(config.customCategories || []).map(cat => (
                       <option key={cat} value={cat}>{cat}</option>
                    ))}
                 </select>
                 <p className="text-[9px] font-bold text-slate-400 uppercase ml-4">Si seleccionas <b>"PERROS"</b>, este producto aparecerá en esa pestaña en tu tienda online.</p>
              </div>
              
              <div className="space-y-4">
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Descripción Atractiva para Clientes</label>
                 <textarea 
                    className="w-full p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] text-[11px] font-bold uppercase h-40 outline-none shadow-inner resize-none focus:ring-4 focus:ring-brand-500/10" 
                    placeholder="Describe los beneficios de este producto para tus clientes web..."
                    value={editingProduct.descripcion_venta || ''} 
                    onChange={e => setEditingProduct({...editingProduct, descripcion_venta: e.target.value})} 
                 />
              </div>
            </div>

            <div className="flex gap-4 mt-12 pt-10 border-t border-slate-100">
               <button onClick={() => setEditingProduct(null)} className="flex-1 py-5 bg-slate-50 rounded-[2rem] font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-slate-600 transition-all">Cancelar</button>
               <button onClick={saveExtraInfo} disabled={saving} className="flex-[2] py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 hover:bg-brand-500 transition-all">
                  {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />} Actualizar Producto
               </button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
         <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-12 py-5 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-12 border border-white/10">
            <CheckCircle2 className="text-brand-400 w-6 h-6 animate-pulse"/>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Catálogo Actualizado Correctamente</span>
         </div>
      )}
    </div>
  );
};

export default ProductManager;
