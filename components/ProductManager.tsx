
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
    
    // Niveles de carga: Si uno falla, el siguiente es más simple
    const fieldSets = [
      ['display_name', 'list_price', 'categ_id', 'image_128', 'qty_available', 'uom_id'],
      ['display_name', 'list_price', 'categ_id', 'image_128', 'uom_id'], // Sin stock
      ['display_name', 'list_price', 'categ_id', 'image_small'], // Imagen antigua
      ['display_name', 'list_price'] // Mínimo absoluto
    ];

    try {
      const extrasMap = await getProductExtras(config.code);
      
      // Intentar cargar categorías
      try {
        const cats = await client.searchRead(session.uid, session.apiKey, 'product.category', [], ['name'], { order: 'name asc' });
        setOdooCategories(cats.map((c: any) => ({ id: c.id, name: c.name })));
      } catch (e) { console.warn("Fallo carga categorías"); }

      let data = null;
      let usedFields: string[] = [];

      for (const fields of fieldSets) {
        try {
          console.log(`Intentando sincronizar con campos: ${fields.join(',')}`);
          data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], fields, { limit: 1000, order: 'display_name asc' });
          if (data && Array.isArray(data)) {
            usedFields = fields;
            break;
          }
        } catch (err: any) {
          console.warn(`Intento fallido: ${err.message}`);
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
            imagen: p.image_128 || p.image_medium || p.image_small || p.image_1920,
            descripcion_venta: extra?.descripcion_lemon || p.description_sale || '',
            uso_sugerido: extra?.instrucciones_lemon || '',
            categoria_personalizada: extra?.categoria_personalizada || '',
            uom_id: Array.isArray(p.uom_id) ? p.uom_id[0] : (typeof p.uom_id === 'number' ? p.uom_id : 1)
          };
        }));
      } else {
        setErrorMsg("El servidor Odoo no devolvió productos. Verifica que tus productos tengan marcado 'Venta'.");
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

  const brandColor = config.colorPrimario || '#84cc16';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 pb-32 animate-in fade-in duration-500">
      
      {/* HEADER DE GESTIÓN */}
      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 bg-brand-50 rounded-3xl flex items-center justify-center text-brand-600 shadow-inner">
              <Boxes className="w-8 h-8" />
           </div>
           <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Mi Catálogo Web</h2>
              <div className="flex items-center gap-3 mt-1">
                 <span className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest ${loading ? 'text-amber-500' : 'text-brand-600'}`}>
                    {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Odoo Sync {loading ? 'En curso' : 'Activo'}
                 </span>
                 <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{productos.length} Productos Sincronizados</span>
              </div>
           </div>
        </div>
        
        <div className="flex gap-3">
          <button onClick={fetchCatalogData} disabled={loading} className="px-6 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-white transition-all">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Recargar de Odoo
          </button>
          <button onClick={handleSaveAll} disabled={saving || loading} className="px-10 py-3.5 bg-brand-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-brand-100 flex items-center gap-2 hover:bg-brand-600 transition-all">
             {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar Cambios
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-100 p-5 rounded-2xl flex items-center gap-4 text-red-600 animate-in shake duration-500">
           <AlertCircle className="w-6 h-6 shrink-0" />
           <p className="text-xs font-bold">{errorMsg}</p>
        </div>
      )}

      {/* TABS */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm w-fit">
         <button onClick={() => setActiveTab('productos')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'productos' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
            <Package className="w-4 h-4" /> Lista de Productos
         </button>
         <button onClick={() => setActiveTab('categorias')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'categorias' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
            <Layers className="w-4 h-4" /> Categorías Odoo
         </button>
      </div>

      {/* TAB CONTENIDO: PRODUCTOS */}
      {activeTab === 'productos' ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
          <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row gap-4">
             <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input type="text" placeholder="Buscar producto en el catálogo..." className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl outline-none text-sm font-medium focus:ring-2 focus:ring-brand-500/20" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             </div>
             <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-6 py-3.5 bg-white border border-slate-200 rounded-xl outline-none text-[10px] font-black uppercase tracking-widest cursor-pointer">
                <option value="Todas">Todas las Categorías</option>
                {odooCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
             </select>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-40">
                    <Loader2 className="w-12 h-12 animate-spin text-brand-500" />
                    <p className="font-black uppercase tracking-widest text-[10px]">Consultando Odoo {session.db}...</p>
                </div>
            ) : productos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40 gap-6 text-center px-10">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                       <PackageSearch className="w-10 h-10" />
                    </div>
                    <div>
                       <p className="font-black uppercase tracking-widest text-slate-400 text-sm">No hay productos vinculados</p>
                       <p className="text-[10px] text-slate-300 font-bold uppercase mt-2">Asegúrate de tener productos con la casilla 'Puede ser vendido' marcada en Odoo.</p>
                    </div>
                    <button onClick={fetchCatalogData} className="px-8 py-3.5 bg-slate-200 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all">Vincular Odoo Ahora</button>
                </div>
            ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <tr>
                      <th className="px-10 py-5">Info Producto</th>
                      <th className="px-8 py-5">Categoría</th>
                      <th className="px-8 py-5 text-right">Precio</th>
                      <th className="px-10 py-5 text-right">Visibilidad Web</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map(p => {
                       const isHidden = hiddenIds.includes(p.id);
                       const prodCat = p.categoria_personalizada || p.categoria || 'General';
                       const isCatHidden = hiddenCats.includes(prodCat);
                       return (
                          <tr key={p.id} className={`hover:bg-slate-50/50 transition-all ${isHidden || isCatHidden ? 'opacity-40 grayscale' : ''}`}>
                             <td className="px-10 py-5 flex items-center gap-5">
                                <div className="w-12 h-12 bg-white rounded-xl overflow-hidden border border-slate-100 flex items-center justify-center shrink-0">
                                   {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-100" />}
                                </div>
                                <div className="min-w-0">
                                   <p className="font-black text-[12px] uppercase text-slate-800 truncate max-w-[280px]">{p.nombre}</p>
                                   <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Ref Odoo: {p.id}</p>
                                </div>
                             </td>
                             <td className="px-8 py-5">
                                <span className="text-[9px] font-black bg-slate-100 px-3 py-1 rounded-lg uppercase text-slate-500">{prodCat}</span>
                             </td>
                             <td className="px-8 py-5 text-right font-black text-slate-900 text-sm">S/ {p.precio.toFixed(2)}</td>
                             <td className="px-10 py-5 text-right flex justify-end gap-3 items-center">
                                <button onClick={() => setEditingProduct(p)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all"><Edit className="w-4 h-4" /></button>
                                <button 
                                   onClick={() => setHiddenIds(prev => isHidden ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                                   className={`px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest min-w-[110px] transition-all ${isHidden ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-brand-50 text-brand-700 border border-brand-100'}`}
                                >
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
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-10">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {odooCategories.length === 0 ? (
                 <div className="col-span-full py-20 text-center opacity-20"><Layers className="w-12 h-12 mx-auto mb-4" /><p className="font-black uppercase">Sin categorías detectadas</p></div>
              ) : odooCategories.map(cat => {
                const isHidden = hiddenCats.includes(cat.name);
                return (
                  <div key={cat.id} className={`p-6 rounded-2xl border-2 transition-all flex items-center justify-between ${isHidden ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100 shadow-sm'}`}>
                     <span className="font-black text-[11px] uppercase tracking-widest text-slate-800">{cat.name}</span>
                     <button onClick={() => setHiddenCats(prev => isHidden ? prev.filter(c => c !== cat.name) : [...prev, cat.name])} className={`p-4 rounded-xl shadow-lg transition-all ${isHidden ? 'bg-slate-200 text-slate-500' : 'bg-brand-500 text-white'}`}>
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
          <div className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 animate-in zoom-in duration-300 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-8">
              <div>
                 <h3 className="text-xl font-black uppercase text-slate-900">{editingProduct.nombre}</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configuración Comercial Web</p>
              </div>
              <button onClick={() => setEditingProduct(null)} className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría Personalizada (Sobrescribe Odoo)</label>
                 <input 
                    type="text" 
                    placeholder="Ej: ANTIBIOTICOS, MEDICAMENTOS..." 
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none font-black text-sm uppercase shadow-inner" 
                    value={editingProduct.categoria_personalizada} 
                    onChange={e => setEditingProduct({...editingProduct, categoria_personalizada: e.target.value.toUpperCase()})} 
                 />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción Web</label>
                    <textarea 
                       className="w-full p-6 bg-slate-50 border-none rounded-[2rem] text-xs font-bold uppercase h-40 outline-none shadow-inner resize-none" 
                       value={editingProduct.descripcion_venta} 
                       onChange={e => setEditingProduct({...editingProduct, descripcion_venta: e.target.value})} 
                    />
                 </div>
                 <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Indicaciones de Uso</label>
                    <textarea 
                       className="w-full p-6 bg-slate-50 border-none rounded-[2rem] text-xs font-bold uppercase h-40 outline-none shadow-inner resize-none" 
                       value={editingProduct.uso_sugerido} 
                       onChange={e => setEditingProduct({...editingProduct, uso_sugerido: e.target.value})} 
                    />
                 </div>
              </div>
            </div>

            <div className="flex gap-4 mt-10 pt-8 border-t border-slate-100">
               <button onClick={() => setEditingProduct(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancelar</button>
               <button onClick={saveExtraInfo} disabled={saving} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3">
                  {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />} Actualizar Producto
               </button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
         <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-10 py-4 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 border border-white/10">
            <CheckCircle2 className="text-brand-400 w-5 h-5"/>
            <span className="text-[10px] font-black uppercase tracking-widest">Catálogo Actualizado Correctamente</span>
         </div>
      )}
    </div>
  );
};

export default ProductManager;
