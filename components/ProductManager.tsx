
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, Eye, EyeOff, Save, RefreshCw, CheckCircle2, Loader2, Layers, CheckCircle, XCircle, Info, AlertCircle } from 'lucide-react';
import { Producto, OdooSession, ClientConfig } from '../types';
import { OdooClient } from '../services/odoo';
import { saveClient } from '../services/clientManager';

interface ProductManagerProps {
  session: OdooSession;
  config: ClientConfig;
  onUpdate: (newConfig: ClientConfig) => void;
}

const ProductManager: React.FC<ProductManagerProps> = ({ session, config, onUpdate }) => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'individual' | 'categories'>('individual');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [showSuccess, setShowSuccess] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [hiddenIds, setHiddenIds] = useState<number[]>(config.hiddenProducts || []);
  const [hiddenCats, setHiddenCats] = useState<string[]>(config.hiddenCategories || []);

  const fetchProducts = async () => {
    setLoading(true);
    setFetchError(null);
    const client = new OdooClient(session.url, session.db, true);
    try {
      const configCategory = (config.tiendaCategoriaNombre || '').trim();
      const domain: any[] = [['sale_ok', '=', true]];
      
      if (configCategory && !['TODAS', 'CATALOGO', ''].includes(configCategory.toUpperCase())) {
        domain.push('|', ['categ_id', 'child_of', configCategory], ['categ_id', 'ilike', configCategory]);
      }

      if (session.companyId) {
        domain.push('|', ['company_id', '=', false], ['company_id', '=', session.companyId]);
      }

      let data: any[] = [];
      try {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, 
          ['display_name', 'list_price', 'qty_available', 'categ_id', 'image_128'], 
          { limit: 2000, order: 'display_name asc' }
        );
      } catch (innerError: any) {
        console.warn("Retrying with simple domain...");
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], 
          ['display_name', 'list_price', 'qty_available', 'categ_id', 'image_128'], 
          { limit: 1000, order: 'display_name asc' }
        );
      }

      const mapped = data.map((p: any) => ({
        id: p.id,
        nombre: p.display_name,
        precio: p.list_price || 0,
        costo: 0,
        categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
        stock: p.qty_available || 0,
        imagen: p.image_128
      }));
      setProductos(mapped);
    } catch (e: any) {
      console.error("Error sincronizando:", e);
      setFetchError(e.message || "Error al conectar con Odoo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [session, config.tiendaCategoriaNombre]);

  const categories = useMemo(() => {
    return Array.from(new Set(productos.map(p => p.categoria || 'General'))).sort();
  }, [productos]);

  const filteredProducts = useMemo(() => {
    return productos.filter(p => {
      const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'Todas' || p.categoria === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [productos, searchTerm, categoryFilter]);

  const toggleProductVisibility = (id: number) => {
    setHiddenIds(prev => prev.includes(id) ? prev.filter(hid => hid !== id) : [...prev, id]);
  };

  const toggleCategoryVisibility = (cat: string) => {
    setHiddenCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const handleBulkAction = (action: 'show' | 'hide') => {
    const currentIds = filteredProducts.map(p => p.id);
    if (action === 'show') {
      setHiddenIds(prev => prev.filter(id => !currentIds.includes(id)));
    } else {
      setHiddenIds(prev => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  const handleSave = async () => {
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

  const brandColor = config.colorPrimario || '#84cc16';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-32">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
             <div className="p-2 bg-brand-50 rounded-xl"><Package className="w-6 h-6 text-brand-600" /></div>
             <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Visibilidad del Catálogo</h2>
          </div>
          <p className="text-slate-500 text-sm font-medium">Gestiona qué productos de Odoo son visibles en tu tienda online.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchProducts} disabled={loading} className="px-6 py-3.5 bg-white border border-slate-200 rounded-2xl font-black text-xs hover:bg-slate-50 flex items-center gap-2">
            <RefreshCw className={loading ? 'animate-spin' : ''} /> SINCRONIZAR
          </button>
          <button onClick={handleSave} disabled={saving || loading} className="px-8 py-3.5 text-white rounded-2xl font-black text-xs shadow-xl flex items-center gap-2" style={{backgroundColor: brandColor}}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} GUARDAR CAMBIOS
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100 flex items-center gap-4 text-red-600">
          <AlertCircle />
          <div><p className="font-bold uppercase text-xs">Error de Conexión</p><p className="text-xs">{fetchError}</p></div>
        </div>
      )}

      <div className="flex bg-slate-100 p-1.5 rounded-[2rem] w-full max-w-sm mx-auto shadow-inner">
        <button onClick={() => setActiveTab('individual')} className={`flex-1 py-3.5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest ${activeTab === 'individual' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>Productos</button>
        <button onClick={() => setActiveTab('categories')} className={`flex-1 py-3.5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest ${activeTab === 'categories' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>Categorías</button>
      </div>

      {activeTab === 'individual' ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex flex-col xl:flex-row gap-6 items-center justify-between">
            <div className="flex gap-4 w-full xl:w-auto">
              <div className="relative flex-1 md:w-80">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input type="text" placeholder="Buscar..." className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <select className="p-4 bg-slate-50 rounded-2xl text-[10px] font-black uppercase outline-none" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="Todas">Todas</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                <tr><th className="px-10 py-6">Producto</th><th className="px-10 py-6">Categoría</th><th className="px-10 py-6 text-right">Precio</th><th className="px-10 py-6 text-right">Acción</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredProducts.map(p => {
                  const visible = !hiddenIds.includes(p.id);
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50 ${!visible ? 'opacity-50 grayscale' : ''}`}>
                      <td className="px-10 py-5 flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden">{p.imagen && <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover"/>}</div>
                        <div className="font-bold text-sm">{p.nombre}</div>
                      </td>
                      <td className="px-10 py-5"><span className="text-[10px] font-black bg-slate-100 px-3 py-1.5 rounded-xl uppercase">{p.categoria}</span></td>
                      <td className="px-10 py-5 text-right font-black">S/ {p.precio.toFixed(2)}</td>
                      <td className="px-10 py-5 text-right">
                        <button onClick={() => toggleProductVisibility(p.id)} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase ${visible ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{visible ? 'PUBLICADO' : 'OCULTO'}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {categories.map(cat => (
            <div key={cat} onClick={() => toggleCategoryVisibility(cat)} className={`p-8 rounded-[2.5rem] border-2 cursor-pointer transition-all ${hiddenCats.includes(cat) ? 'bg-slate-50 border-slate-100 opacity-50' : 'bg-white border-white shadow-xl'}`}>
              <h3 className="text-sm font-black uppercase text-slate-900">{cat}</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">{hiddenCats.includes(cat) ? 'OCULTA' : 'VISIBLE'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductManager;
