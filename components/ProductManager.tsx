
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, Eye, EyeOff, Save, RefreshCw, CheckCircle2, AlertCircle, Loader2, Tag, Filter } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [showSuccess, setShowSuccess] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<number[]>(config.hiddenProducts || []);

  useEffect(() => {
    fetchProducts();
  }, [session, config.tiendaCategoriaNombre]);

  const fetchProducts = async () => {
    setLoading(true);
    const client = new OdooClient(session.url, session.db, true);
    try {
      const categoryNames = (config.tiendaCategoriaNombre || 'Catalogo')
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0);

      let categoryIds: number[] = [];
      if (categoryNames.length > 0) {
        const categories = await client.searchRead(session.uid, session.apiKey, 'product.category', 
          categoryNames.length === 1 ? [['name', 'ilike', categoryNames[0]]] : [['name', 'in', categoryNames]], 
          ['id']
        );
        categoryIds = categories.map((c: any) => c.id);
      }

      const domain: any[] = [['sale_ok', '=', true]];
      if (categoryIds.length > 0) {
        domain.push(['categ_id', 'child_of', categoryIds]);
      }
      if (session.companyId) domain.push(['company_id', '=', session.companyId]);

      const data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, 
        ['display_name', 'list_price', 'qty_available', 'categ_id', 'image_128'], 
        { limit: 300, order: 'display_name asc' }
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
    return ['Todas', ...Array.from(new Set(productos.map(p => p.categoria || 'General')))];
  }, [productos]);

  const filteredProducts = useMemo(() => {
    return productos.filter(p => {
      const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'Todas' || p.categoria === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [productos, searchTerm, categoryFilter]);

  const toggleVisibility = (id: number) => {
    setHiddenIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(hid => hid !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const newConfig = { ...config, hiddenProducts: hiddenIds };
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

  const stats = {
    total: productos.length,
    publicados: productos.length - hiddenIds.filter(id => productos.some(p => p.id === id)).length,
    ocultos: hiddenIds.filter(id => productos.some(p => p.id === id)).length
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Gestión de Publicación</h2>
          <p className="text-slate-500 text-sm mt-1">Selecciona qué productos quieres que vean tus clientes en la web.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={fetchProducts}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-600 rounded-xl font-bold text-sm border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sincronizar Odoo
          </button>
          <button 
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-brand-200 hover:bg-brand-600 transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Cambios
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-brand-50 rounded-2xl text-brand-600"><Package className="w-6 h-6"/></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">En Odoo</p>
            <h4 className="text-2xl font-bold text-slate-800">{stats.total}</h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600"><Eye className="w-6 h-6"/></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Publicados Web</p>
            <h4 className="text-2xl font-bold text-emerald-600">{stats.publicados}</h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 rounded-2xl text-red-600"><EyeOff className="w-6 h-6"/></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ocultos</p>
            <h4 className="text-2xl font-bold text-red-500">{stats.ocultos}</h4>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/30">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input 
              type="text" 
              placeholder="Buscar por nombre..." 
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-sm font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              className="flex-1 md:w-48 p-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none font-medium"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-8 py-5">Producto</th>
                <th className="px-8 py-5">Categoría</th>
                <th className="px-8 py-5">Precio</th>
                <th className="px-8 py-5">Stock</th>
                <th className="px-8 py-5 text-right">Estado / Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-8 py-5 flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg"></div>
                      <div className="h-4 bg-slate-100 rounded w-48"></div>
                    </td>
                    <td colSpan={4}></td>
                  </tr>
                ))
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold">No se encontraron productos</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const isHidden = hiddenIds.includes(p.id);
                  const stockValue = p.stock ?? 0;
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50 transition-colors group ${isHidden ? 'bg-slate-50/50' : ''}`}>
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100 transition-all ${isHidden ? 'grayscale opacity-50' : ''}`}>
                            {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-200"/>}
                          </div>
                          <span className={`font-bold text-sm ${isHidden ? 'text-slate-400' : 'text-slate-800'}`}>{p.nombre}</span>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-500 uppercase">
                          <Tag className="w-3 h-3"/> {p.categoria}
                        </span>
                      </td>
                      <td className="px-8 py-4 font-mono font-bold text-slate-700">S/ {p.precio.toFixed(2)}</td>
                      <td className="px-8 py-4">
                        <span className={`text-xs font-bold ${stockValue > 0 ? 'text-emerald-600' : 'text-red-400'}`}>
                          {stockValue} <span className="text-[10px] text-slate-400 font-normal ml-0.5">uds</span>
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <button 
                          onClick={() => toggleVisibility(p.id)}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm ${
                            isHidden 
                            ? 'bg-white text-slate-400 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600' 
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-red-50 hover:text-red-500 hover:border-red-100'
                          }`}
                        >
                          {isHidden ? <><EyeOff className="w-3.5 h-3.5"/> Oculto</> : <><Eye className="w-3.5 h-3.5"/> Publicado</>}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSuccess && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-10 duration-500 z-50">
          <CheckCircle2 className="w-6 h-6 text-brand-400" />
          <p className="font-bold">¡Catálogo actualizado correctamente!</p>
        </div>
      )}
    </div>
  );
};

export default ProductManager;
