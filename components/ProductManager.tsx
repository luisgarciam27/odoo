
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Package, Save, RefreshCw, Loader2, Edit, X, Pill, Beaker, 
  ClipboardCheck, Heart, Footprints, AlertCircle, Filter, CheckCircle2, 
  UploadCloud, Boxes, EyeOff, Eye, Layers, Tag, ChevronRight, Info, SearchX
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'productos' | 'categorias'>('productos');
  
  // Estados locales para guardado diferido
  const [hiddenIds, setHiddenIds] = useState<number[]>(config.hiddenProducts || []);
  const [hiddenCats, setHiddenCats] = useState<string[]>(config.hiddenCategories || []);

  const fetchCatalogData = async () => {
    setLoading(true);
    const client = new OdooClient(session.url, session.db, true);
    try {
      const extrasMap = await getProductExtras(config.code);
      
      // 1. Cargar Categorías
      const cats = await client.searchRead(session.uid, session.apiKey, 'product.category', [], ['name'], { order: 'name asc' });
      setOdooCategories(cats.map((c: any) => ({ id: c.id, name: c.name })));

      // 2. Cargar Productos con Estrategia de Seguridad
      // Primero intentamos con filtros de compañía si existen
      let domain: any[] = [['sale_ok', '=', true], ['active', '=', true]];
      const fields = ['display_name', 'list_price', 'qty_available', 'categ_id', 'image_128', 'description_sale'];
      
      let data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, fields, { limit: 1000, order: 'display_name asc' });

      // Si falla o viene vacío, intentamos sin el filtro de activos (algunos Odoo 14 tienen problemas con ese campo en search_read)
      if (!data || data.length === 0) {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], fields, { limit: 500 });
      }

      setProductos((data || []).map((p: any) => {
        const extra = extrasMap[p.id];
        return {
          id: p.id,
          nombre: p.display_name,
          precio: p.list_price || 0,
          costo: 0,
          categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
          stock: p.qty_available || 0,
          imagen: p.image_128,
          descripcion_venta: extra?.descripcion_lemon || p.description_sale || '',
          uso_sugerido: extra?.instrucciones_lemon || '',
          laboratorio: 'Genérico',
          registro_sanitario: 'Validado'
        };
      }));
    } catch (e) {
      console.error("Error catálogo Odoo:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCatalogData(); }, [session, config.code]);

  const filteredProducts = useMemo(() => {
    return productos.filter(p => {
        const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'Todas' || p.categoria === categoryFilter;
        return matchesSearch && matchesCategory;
    });
  }, [productos, searchTerm, categoryFilter]);

  const handleSaveAll = async () => {
    setSaving(true);
    const newConfig = { 
      ...config, 
      hiddenProducts: hiddenIds.map(Number),
      hiddenCategories: hiddenCats
    };
    const result = await saveClient(newConfig, false);
    if (result.success) {
      onUpdate(newConfig);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
    setSaving(false);
  };

  const toggleCategory = (catName: string) => {
    setHiddenCats(prev => prev.includes(catName) ? prev.filter(c => c !== catName) : [...prev, catName]);
  };

  const saveExtraInfo = async () => {
    if (!editingProduct) return;
    setSaving(true);
    const result = await saveProductExtra({
      odoo_id: editingProduct.id,
      empresa_code: config.code,
      descripcion_lemon: editingProduct.descripcion_venta,
      instrucciones_lemon: editingProduct.uso_sugerido
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
      
      {/* Header Superior */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-6">
           <div className="p-4 rounded-[1.8rem] shadow-inner" style={{backgroundColor: `${brandColor}15`}}>
              <Boxes className="w-10 h-10" style={{color: brandColor}} />
           </div>
           <div>
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Control de Tienda Online</h2>
              <div className="flex gap-4 mt-2">
                 <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-2"><RefreshCw className="w-3 h-3"/> Odoo Sync Activo</p>
                 <p className="text-brand-600 text-[9px] font-black uppercase tracking-widest flex items-center gap-2"><CheckCircle2 className="w-3 h-3"/> {productos.length} Productos Sincronizados</p>
              </div>
           </div>
        </div>
        <div className="flex gap-4 w-full lg:w-auto">
          <button onClick={fetchCatalogData} disabled={loading} className="flex-1 lg:flex-none px-8 py-5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-100 transition-all">
             <RefreshCw className={loading ? 'animate-spin' : ''} /> Recargar Odoo
          </button>
          <button onClick={handleSaveAll} disabled={saving || loading} className="flex-1 lg:flex-none px-12 py-5 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95" style={{backgroundColor: brandColor}}>
             {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />} Guardar Visibilidad
          </button>
        </div>
      </div>

      {/* Tabs de Navegación */}
      <div className="flex bg-white p-2 rounded-3xl border border-slate-100 shadow-sm w-fit">
         <button onClick={() => setActiveTab('productos')} className={`px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all ${activeTab === 'productos' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
            <Package className="w-4 h-4" /> Mis Productos
         </button>
         <button onClick={() => setActiveTab('categorias')} className={`px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all ${activeTab === 'categorias' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
            <Layers className="w-4 h-4" /> Categorías Web
         </button>
      </div>

      {activeTab === 'productos' ? (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row gap-6 items-center">
            <div className="relative flex-1 group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input type="text" placeholder="Buscar por nombre o ID de Odoo..." className="w-full pl-14 pr-6 py-5 bg-white border border-slate-100 rounded-[2rem] outline-none font-bold text-sm shadow-inner focus:ring-4 focus:ring-brand-500/5 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full md:w-64 p-5 bg-white border border-slate-100 rounded-[2rem] outline-none font-black text-[10px] uppercase tracking-widest shadow-inner">
               <option value="Todas">Todas las Categorías</option>
               {odooCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                <tr><th className="px-12 py-7">Ficha Odoo</th><th className="px-10 py-7">Categoría</th><th className="px-10 py-7 text-right">Precio Público</th><th className="px-12 py-7 text-right">Estado en Tienda</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredProducts.map(p => {
                  const isHidden = hiddenIds.includes(p.id);
                  const isCatHidden = hiddenCats.includes(p.categoria || 'General');
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors ${isHidden || isCatHidden ? 'opacity-40 grayscale bg-slate-50/50' : ''}`}>
                      <td className="px-12 py-6 flex items-center gap-6">
                        <div className="w-14 h-14 bg-white rounded-2xl overflow-hidden flex items-center justify-center shrink-0 shadow-sm border border-slate-100">{p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover"/> : <Package className="w-6 h-6 text-slate-100"/>}</div>
                        <div>
                           <p className="font-black text-[12px] uppercase leading-tight text-slate-900 max-w-[250px] truncate">{p.nombre}</p>
                           <p className="text-[9px] text-slate-400 font-black tracking-widest uppercase mt-1">ID: {p.id}</p>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                         <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black bg-slate-100 px-4 py-1.5 rounded-full uppercase text-slate-500 w-fit">{p.categoria}</span>
                            {isCatHidden && <span className="text-[7px] font-black text-red-500 uppercase ml-2 flex items-center gap-1"><EyeOff className="w-2.5 h-2.5"/> Categoría Oculta</span>}
                         </div>
                      </td>
                      <td className="px-10 py-6 text-right font-black text-slate-900 text-sm">S/ {p.precio.toFixed(2)}</td>
                      <td className="px-12 py-6 text-right flex justify-end items-center gap-4">
                        <button onClick={() => setEditingProduct(p)} className="p-4 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-900 hover:text-white transition-all shadow-sm flex items-center gap-2 group"><Edit className="w-4 h-4"/><span className="hidden group-hover:block text-[9px] font-black uppercase">Ficha</span></button>
                        <button 
                          type="button"
                          onClick={() => setHiddenIds(prev => isHidden ? prev.filter(id => id !== p.id) : [...prev, p.id])} 
                          className={`px-6 py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all min-w-[120px] flex items-center justify-center gap-2 ${isHidden ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-brand-50 text-brand-700 border border-brand-100'}`}
                        >
                           {isHidden ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                           {isHidden ? 'Oculto' : 'Visible'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredProducts.length === 0 && !loading && (
              <div className="p-24 text-center flex flex-col items-center gap-6 opacity-30"><SearchX className="w-20 h-20 text-slate-200"/><div className="space-y-2"><p className="text-sm font-black uppercase tracking-[0.2em]">No se encontraron productos</p><p className="text-[10px] font-bold uppercase">Intenta refrescar la conexión con el servidor.</p></div></div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl p-10 animate-in slide-in-from-right-4">
           <div className="flex items-center gap-4 mb-10">
              <div className="p-4 bg-indigo-50 rounded-2xl"><Layers className="w-6 h-6 text-indigo-600" /></div>
              <div><h3 className="text-xl font-black text-slate-900 uppercase">Menú de Navegación</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Activa o desactiva secciones enteras de tu tienda online</p></div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {odooCategories.map(cat => {
                const isHidden = hiddenCats.includes(cat.name);
                return (
                  <div key={cat.id} className={`p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between group ${isHidden ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100 hover:border-brand-500 shadow-sm hover:shadow-xl'}`}>
                     <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${isHidden ? 'bg-slate-200 text-slate-400' : 'bg-brand-50 text-brand-600'}`}><Tag className="w-5 h-5"/></div>
                        <span className="font-black text-xs uppercase tracking-tight text-slate-800">{cat.name}</span>
                     </div>
                     <button 
                        onClick={() => toggleCategory(cat.name)}
                        className={`p-4 rounded-2xl transition-all ${isHidden ? 'bg-slate-200 text-slate-500' : 'bg-brand-500 text-white shadow-lg'}`}
                     >
                        {isHidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                     </button>
                  </div>
                );
              })}
           </div>
           
           {odooCategories.length === 0 && (
             <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30"><Tag className="w-12 h-12"/><p className="text-[10px] font-black uppercase tracking-widest">Sin categorías disponibles</p></div>
           )}
        </div>
      )}

      {/* Modal de Ficha Técnica */}
      {editingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl animate-in fade-in" onClick={() => setEditingProduct(null)}></div>
          <div className="relative bg-white w-full max-w-4xl rounded-[4rem] shadow-2xl p-12 animate-in zoom-in-95 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <div className="flex justify-between items-start mb-10">
              <div className="flex items-center gap-6">
                 <div className="w-20 h-20 bg-slate-50 rounded-[2rem] overflow-hidden border-2 border-slate-100">{editingProduct.imagen ? <img src={`data:image/png;base64,${editingProduct.imagen}`} className="w-full h-full object-cover"/> : <Package className="w-10 h-10 text-slate-200"/>}</div>
                 <div><h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{editingProduct.nombre}</h3><p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mt-1 flex items-center gap-2"><Info className="w-3.5 h-3.5"/> Ficha Especial Lemon BI</p></div>
              </div>
              <button onClick={() => setEditingProduct(null)} className="p-4 bg-slate-50 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"><X className="w-6 h-6"/></button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Descripción de Marketing</label>
                <textarea placeholder="Escribe una descripción atractiva para tus clientes..." className="w-full p-8 bg-slate-50 border-none rounded-[2.5rem] text-sm font-bold uppercase h-48 outline-none shadow-inner focus:ring-4 focus:ring-brand-500/5 transition-all" value={editingProduct.descripcion_venta} onChange={e => setEditingProduct({...editingProduct, descripcion_venta: e.target.value})} />
              </div>
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Instrucciones / Uso sugerido</label>
                <textarea placeholder="¿Cómo deben usarlo tus clientes?..." className="w-full p-8 bg-slate-50 border-none rounded-[2.5rem] text-sm font-bold uppercase h-48 outline-none shadow-inner focus:ring-4 focus:ring-brand-500/5 transition-all" value={editingProduct.uso_sugerido} onChange={e => setEditingProduct({...editingProduct, uso_sugerido: e.target.value})} />
              </div>
            </div>
            
            <div className="flex gap-4">
              <button onClick={() => setEditingProduct(null)} className="flex-1 py-6 bg-slate-100 text-slate-500 rounded-[2.2rem] font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={saveExtraInfo} disabled={saving} className="flex-[2] py-6 text-white rounded-[2.2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95" style={{backgroundColor: brandColor}}>{saving ? <Loader2 className="animate-spin w-5 h-5" /> : <UploadCloud className="w-5 h-5" />} Actualizar Catálogo Cloud</button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
         <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-12 py-6 rounded-full shadow-2xl animate-in slide-in-from-bottom-12 flex items-center gap-5 border border-white/10">
            <div className="p-2 bg-brand-500 rounded-lg"><CheckCircle2 className="text-white w-5 h-5"/></div>
            <span className="text-sm font-black uppercase tracking-widest">¡Tienda Sincronizada!</span>
         </div>
      )}
    </div>
  );
};

export default ProductManager;
