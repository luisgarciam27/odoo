
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Package, Save, RefreshCw, Loader2, Edit, X, CheckCircle2, 
  UploadCloud, Boxes, EyeOff, Eye, Layers, Tag, Info, AlertCircle
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
      ['display_name', 'list_price', 'categ_id', 'image_128', 'qty_available', 'uom_id', 'description_sale'],
      ['display_name', 'list_price', 'categ_id', 'image_medium', 'qty_available'],
      ['display_name', 'list_price', 'categ_id', 'image_small'],
      ['display_name', 'list_price']
    ];

    try {
      const extrasMap = await getProductExtras(config.code);
      
      try {
        const cats = await client.searchRead(session.uid, session.apiKey, 'product.category', [], ['name'], { order: 'name asc' });
        setOdooCategories(cats.map((c: any) => ({ id: c.id, name: c.name })));
      } catch (e) { console.warn("Fallo carga de categorías"); }

      let data = null;
      for (const fields of fieldSets) {
        try {
          data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true], ['active', '=', true]], fields, { limit: 1000, order: 'display_name asc' });
          if (data && Array.isArray(data)) break;
        } catch (err) {
          console.warn(`Intento fallido con campos: ${fields.length}`);
        }
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
            imagen: p.image_128 || p.image_medium || p.image_small,
            descripcion_venta: extra?.descripcion_lemon || p.description_sale || '',
            uso_sugerido: extra?.instrucciones_lemon || '',
            categoria_personalizada: extra?.categoria_personalizada || '',
            uom_id: Array.isArray(p.uom_id) ? p.uom_id[0] : (typeof p.uom_id === 'number' ? p.uom_id : 1)
          };
        }));
      } else {
        setErrorMsg("No se pudo recuperar la lista de productos.");
      }
    } catch (e: any) {
      setErrorMsg(`Error de sincronización: ${e.message}`);
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

  const brandColor = config.colorPrimario || '#84cc16';

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
      
      {/* HEADER MANAGER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-6">
           <div className="p-4 rounded-[1.8rem] shadow-inner" style={{backgroundColor: `${brandColor}15`}}><Boxes className="w-10 h-10" style={{color: brandColor}} /></div>
           <div>
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Inventario Lemon BI</h2>
              <div className="flex gap-4 mt-2">
                 <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-2"><RefreshCw className="w-3 h-3"/> Motor Resiliente v14/17</p>
                 <p className="text-brand-600 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3"/>} 
                    {productos.length} Items Encontrados
                 </p>
              </div>
           </div>
        </div>
        <div className="flex gap-4 w-full lg:w-auto">
          <button onClick={fetchCatalogData} disabled={loading} className="flex-1 lg:flex-none px-8 py-5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-inner">
             <RefreshCw className={loading ? 'animate-spin' : ''} /> Refrescar Servidor
          </button>
          <button onClick={handleSaveAll} disabled={saving || loading} className="flex-1 lg:flex-none px-12 py-5 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 transition-all" style={{backgroundColor: brandColor}}>
             {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />} Aplicar Cambios Web
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-100 p-6 rounded-[2rem] flex items-center gap-4 text-red-600">
           <AlertCircle className="w-8 h-8 shrink-0" />
           <div className="flex-1">
              <p className="font-black uppercase text-[10px] tracking-widest">Fallo de Sincronización</p>
              <p className="text-xs font-medium opacity-80">{errorMsg}</p>
           </div>
           <button onClick={fetchCatalogData} className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase">Reintentar</button>
        </div>
      )}

      <div className="flex bg-white p-2 rounded-3xl border border-slate-100 shadow-sm w-fit">
         <button onClick={() => setActiveTab('productos')} className={`px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all ${activeTab === 'productos' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400'}`}>
            <Package className="w-4 h-4" /> Catálogo
         </button>
         <button onClick={() => setActiveTab('categorias')} className={`px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all ${activeTab === 'categorias' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400'}`}>
            <Layers className="w-4 h-4" /> Categorías
         </button>
      </div>

      {activeTab === 'productos' ? (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden min-h-[500px]">
          <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row gap-6 items-center">
            <div className="relative flex-1 group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input type="text" placeholder="Buscar por nombre..." className="w-full pl-14 pr-6 py-5 bg-white border border-slate-100 rounded-[2rem] outline-none font-bold text-sm shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full md:w-64 p-5 bg-white border border-slate-100 rounded-[2rem] outline-none font-black text-[10px] uppercase tracking-widest cursor-pointer shadow-inner">
               <option value="Todas">Todas las Categorías</option>
               {odooCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          
          <div className="overflow-x-auto">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-30">
                    <RefreshCw className="w-12 h-12 animate-spin" />
                    <p className="font-black uppercase tracking-widest text-xs">Conectando con Odoo...</p>
                </div>
            ) : productos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-30 text-center px-10">
                    <Package className="w-16 h-16" />
                    <p className="font-black uppercase tracking-widest text-xs">No se detectaron productos</p>
                </div>
            ) : (
                <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <tr><th className="px-12 py-7">Producto</th><th className="px-10 py-7">Categoría</th><th className="px-10 py-7 text-right">Precio</th><th className="px-12 py-7 text-right">Estado Web</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {filteredProducts.map(p => {
                    const isHidden = hiddenIds.includes(p.id);
                    const prodCat = p.categoria_personalizada || p.categoria || 'General';
                    const isCatHidden = hiddenCats.includes(prodCat);
                    return (
                        <tr key={p.id} className={`hover:bg-slate-50/80 transition-all ${isHidden || isCatHidden ? 'opacity-40 grayscale' : ''}`}>
                        <td className="px-12 py-6 flex items-center gap-6">
                            <div className="w-16 h-16 bg-white rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">{p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover"/> : <Package className="w-8 h-8 text-slate-100"/>}</div>
                            <div><p className="font-black text-[13px] uppercase leading-tight text-slate-900 max-w-[300px] truncate">{p.nombre}</p><p className="text-[9px] text-slate-400 font-black tracking-widest uppercase mt-1">ID: {p.id}</p></div>
                        </td>
                        <td className="px-10 py-6">
                            <span className="text-[9px] font-black bg-slate-100 px-4 py-1.5 rounded-full uppercase text-slate-500 w-fit">{prodCat}</span>
                        </td>
                        <td className="px-10 py-6 text-right font-black text-slate-900 text-sm">S/ {p.precio.toFixed(2)}</td>
                        <td className="px-12 py-6 text-right flex justify-end items-center gap-4">
                            <button onClick={() => setEditingProduct(p)} className="p-4 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"><Edit className="w-4 h-4"/></button>
                            <button onClick={() => setHiddenIds(prev => isHidden ? prev.filter(id => id !== p.id) : [...prev, p.id])} className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all min-w-[140px] shadow-sm ${isHidden ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-brand-50 text-brand-700 border border-brand-100'}`}>
                            {isHidden ? 'Oculto' : 'Visible'}
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
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl p-12">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {odooCategories.map(cat => {
                const isHidden = hiddenCats.includes(cat.name);
                return (
                  <div key={cat.id} className={`p-8 rounded-[2.5rem] border-2 transition-all flex items-center justify-between ${isHidden ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100 shadow-sm'}`}>
                     <span className="font-black text-[11px] uppercase tracking-widest text-slate-800">{cat.name}</span>
                     <button onClick={() => setHiddenCats(prev => isHidden ? prev.filter(c => c !== cat.name) : [...prev, cat.name])} className={`p-5 rounded-2xl transition-all shadow-lg ${isHidden ? 'bg-slate-200 text-slate-500' : 'bg-brand-500 text-white'}`}>{isHidden ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}</button>
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {/* MODAL FICHA TÉCNICA */}
      {editingProduct && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl animate-in fade-in" onClick={() => setEditingProduct(null)}></div>
          <div className="relative bg-white w-full max-w-4xl rounded-[4rem] shadow-2xl p-12 overflow-y-auto max-h-[90vh] animate-in zoom-in duration-300">
            <div className="flex justify-between items-start mb-10">
              <div>
                 <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{editingProduct.nombre}</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Configuración Web</p>
              </div>
              <button onClick={() => setEditingProduct(null)} className="p-4 bg-slate-50 rounded-2xl"><X className="w-6 h-6"/></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
              <div className="col-span-1 md:col-span-2 space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Nueva Categoría Web (Sobrescribe Odoo)</label>
                <input type="text" placeholder="Ej: ANTIBIÓTICOS, GOLOSINAS, CUIDADO..." className="w-full p-6 bg-slate-50 border-none rounded-[2rem] text-sm font-black uppercase shadow-inner" value={editingProduct.categoria_personalizada} onChange={e => setEditingProduct({...editingProduct, categoria_personalizada: e.target.value.toUpperCase()})} />
              </div>
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción Comercial</label>
                <textarea className="w-full p-8 bg-slate-50 border-none rounded-[2.5rem] text-sm font-bold uppercase h-48 outline-none shadow-inner" value={editingProduct.descripcion_venta} onChange={e => setEditingProduct({...editingProduct, descripcion_venta: e.target.value})} />
              </div>
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Instrucciones / Uso Sugerido</label>
                <textarea className="w-full p-8 bg-slate-50 border-none rounded-[2.5rem] text-sm font-bold uppercase h-48 outline-none shadow-inner" value={editingProduct.uso_sugerido} onChange={e => setEditingProduct({...editingProduct, uso_sugerido: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setEditingProduct(null)} className="flex-1 py-7 bg-slate-100 rounded-[2.2rem] font-black uppercase text-xs">Cancelar</button>
              <button onClick={saveExtraInfo} disabled={saving} className="flex-[2.5] py-7 text-white rounded-[2.2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3" style={{backgroundColor: brandColor}}>{saving ? <Loader2 className="animate-spin w-5 h-5" /> : "Guardar Ficha"}</button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
         <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-12 py-6 rounded-full shadow-2xl flex items-center gap-5 border border-white/10 animate-in slide-in-from-bottom-12">
            <CheckCircle2 className="text-brand-400 w-6 h-6"/>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Configuración Actualizada</span>
         </div>
      )}
    </div>
  );
};

export default ProductManager;
