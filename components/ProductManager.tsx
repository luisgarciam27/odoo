
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, Eye, EyeOff, Save, RefreshCw, CheckCircle2, Loader2, Layers } from 'lucide-react';
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
  
  // Sincronizar estados locales con config
  const [hiddenIds, setHiddenIds] = useState<number[]>(config.hiddenProducts || []);
  const [hiddenCats, setHiddenCats] = useState<string[]>(config.hiddenCategories || []);

  useEffect(() => {
    fetchProducts();
  }, [session, config.tiendaCategoriaNombre]);

  const fetchProducts = async () => {
    setLoading(true);
    const client = new OdooClient(session.url, session.db, true);
    try {
      const categoryNames = (config.tiendaCategoriaNombre || 'Catalogo').split(',').map(c => c.trim()).filter(c => c.length > 0);
      const domain: any[] = [['sale_ok', '=', true]];
      if (categoryNames.length > 0) domain.push(['categ_id', 'child_of', categoryNames]);
      if (session.companyId) domain.push(['company_id', '=', session.companyId]);

      const data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, 
        ['display_name', 'list_price', 'qty_available', 'categ_id', 'image_128'], 
        { limit: 500, order: 'display_name asc' }
      );

      setProductos(data.map((p: any) => ({
        id: p.id,
        nombre: p.display_name,
        precio: p.list_price,
        costo: 0,
        categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
        stock: p.qty_available || 0,
        imagen: p.image_128
      })));
    } catch (e) {
      console.error("Error fetching products", e);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSave = async () => {
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
    } else {
      alert("Error al guardar cambios");
    }
    setSaving(false);
  };

  const brandColor = config.colorPrimario || '#84cc16';

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Visibilidad del Catálogo</h2>
          <p className="text-slate-500 text-sm mt-1 font-medium">Gestiona qué productos y categorías son visibles para tus clientes.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={fetchProducts} className="flex items-center gap-2 px-5 py-3 bg-white text-slate-600 rounded-2xl font-black text-xs border border-slate-200 hover:bg-slate-50 transition-all shadow-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> SINCRONIZAR ODOO
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving || loading}
            className="flex items-center gap-2 px-8 py-3 text-white rounded-2xl font-black text-xs shadow-2xl hover:brightness-110 transition-all active:scale-95 disabled:opacity-50"
            style={{backgroundColor: brandColor}}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            GUARDAR CONFIGURACIÓN
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-[2rem] w-full max-w-md mx-auto">
        <button 
          onClick={() => setActiveTab('individual')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.5rem] font-black text-xs transition-all ${activeTab === 'individual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
        >
          <Package className="w-4 h-4"/> PRODUCTOS
        </button>
        <button 
          onClick={() => setActiveTab('categories')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.5rem] font-black text-xs transition-all ${activeTab === 'categories' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
        >
          <Layers className="w-4 h-4"/> CATEGORÍAS
        </button>
      </div>

      {activeTab === 'individual' ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-left-4">
          <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input 
                type="text" 
                placeholder="Buscar por nombre..." 
                className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 transition-all text-sm font-bold"
                style={{'--tw-ring-color': brandColor} as any}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              className="w-full md:w-56 p-4 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="Todas">TODAS LAS CATEGORÍAS</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                <tr>
                  <th className="px-8 py-6">Producto</th>
                  <th className="px-8 py-6">Categoría</th>
                  <th className="px-8 py-6">Estado en Tienda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  [1,2,3,4,5].map(i => <tr key={i} className="animate-pulse"><td className="px-8 py-6"><div className="h-10 bg-slate-100 rounded-xl w-64"></div></td><td colSpan={2}></td></tr>)
                ) : filteredProducts.map(p => {
                  const isIndividuallyHidden = hiddenIds.includes(p.id);
                  const isCategoryHidden = hiddenCats.includes(p.categoria || '');
                  const isActuallyVisible = !isIndividuallyHidden && !isCategoryHidden;
                  
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50/80 transition-all ${!isActuallyVisible ? 'bg-slate-50/40' : ''}`}>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100 ${!isActuallyVisible ? 'grayscale opacity-30' : ''}`}>
                            {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-200"/>}
                          </div>
                          <div>
                            <p className={`font-bold text-sm ${!isActuallyVisible ? 'text-slate-400' : 'text-slate-900'}`}>{p.nombre}</p>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {p.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${isCategoryHidden ? 'bg-red-50 text-red-400' : 'bg-slate-100 text-slate-500'}`}>
                          {isCategoryHidden && <EyeOff className="w-3 h-3"/>}
                          {p.categoria}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <button 
                          onClick={() => toggleProductVisibility(p.id)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                            isActuallyVisible 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                            : isCategoryHidden 
                              ? 'bg-amber-50 text-amber-500 cursor-not-allowed opacity-60'
                              : 'bg-red-50 text-red-500 border border-red-100'
                          }`}
                          title={isCategoryHidden ? "Oculto por categoría" : ""}
                        >
                          {isActuallyVisible ? <><Eye className="w-4 h-4"/> PUBLICADO</> : isCategoryHidden ? <><EyeOff className="w-4 h-4"/> CAT. OCULTA</> : <><EyeOff className="w-4 h-4"/> OCULTO MANUAL</>}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-right-4">
          {categories.map(cat => {
            const isHidden = hiddenCats.includes(cat);
            const productCount = productos.filter(p => p.categoria === cat).length;
            return (
              <div 
                key={cat} 
                onClick={() => toggleCategoryVisibility(cat)}
                className={`p-8 rounded-[2.5rem] border-2 cursor-pointer transition-all duration-300 flex flex-col justify-between h-48 ${isHidden ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-white shadow-xl hover:scale-105 hover:border-brand-100'}`}
              >
                <div className="flex justify-between items-start">
                   <div className={`p-3 rounded-2xl ${isHidden ? 'bg-slate-200 text-slate-400' : 'bg-brand-50 text-brand-600'}`}>
                      {isHidden ? <EyeOff className="w-6 h-6"/> : <Eye className="w-6 h-6"/>}
                   </div>
                   <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${isHidden ? 'bg-slate-200 text-slate-400' : 'bg-emerald-100 text-emerald-600'}`}>
                      {isHidden ? 'OCULTA' : 'VISIBLE'}
                   </span>
                </div>
                <div>
                   <h3 className={`text-lg font-black uppercase tracking-tight line-clamp-1 ${isHidden ? 'text-slate-400' : 'text-slate-900'}`}>{cat}</h3>
                   <p className="text-xs font-bold text-slate-400 mt-1">{productCount} Productos vinculados</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showSuccess && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-10 py-5 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-12 duration-500 z-50">
          <CheckCircle2 className="w-6 h-6 text-brand-400" />
          <p className="font-black text-sm uppercase tracking-widest">Tienda Sincronizada con Éxito</p>
        </div>
      )}
    </div>
  );
};

export default ProductManager;
