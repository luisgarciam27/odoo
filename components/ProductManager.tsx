
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, Eye, EyeOff, Save, RefreshCw, CheckCircle2, Loader2, Edit, X, Info, Pill, Beaker, ClipboardCheck, Heart, Footprints, AlertCircle, Filter } from 'lucide-react';
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
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [hiddenIds, setHiddenIds] = useState<number[]>(config.hiddenProducts || []);

  const fetchProducts = async () => {
    setLoading(true);
    const client = new OdooClient(session.url, session.db, true);
    const context = session.companyId ? { allowed_company_ids: [session.companyId], company_id: session.companyId } : {};

    try {
      // Dominio estricto: Que pertenezca a la compañía actual o sea compartido
      const domain: any[] = [
        ['sale_ok', '=', true],
        ['company_id', 'in', [session.companyId, false]]
      ];

      const coreFields = ['display_name', 'list_price', 'qty_available', 'categ_id', 'image_128', 'description_sale'];
      const extraFields = ['x_registro_sanitario', 'x_laboratorio', 'x_principio_activo', 'x_uso_sugerido', 'x_especie', 'x_duracion_sesion'];
      
      let data: any[] = [];
      try {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, 
          [...coreFields, ...extraFields], { limit: 1000, order: 'display_name asc', context });
      } catch {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, 
          coreFields, { limit: 1000, order: 'display_name asc', context });
      }

      const mapped = data.map((p: any) => ({
        id: p.id,
        nombre: p.display_name,
        precio: p.list_price || 0,
        costo: 0,
        categoria: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General',
        stock: p.qty_available || 0,
        imagen: p.image_128,
        descripcion_venta: p.description_sale || '',
        registro_sanitario: p.x_registro_sanitario || '',
        laboratorio: p.x_laboratorio || '',
        principio_activo: p.x_principio_activo || '',
        uso_sugerido: p.x_uso_sugerido || '',
        especie: p.x_especie || '',
        duracion_sesion: p.x_duracion_sesion || ''
      }));
      setProductos(mapped);
    } catch (e) {
      console.error("Error sync:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [session]);

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

  const handleSaveConfig = async () => {
    setSaving(true);
    const newConfig = { ...config, hiddenProducts: hiddenIds.map(Number) };
    const result = await saveClient(newConfig, false);
    if (result.success) {
      onUpdate(newConfig);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
    setSaving(false);
  };

  const updateEditingField = (field: keyof Producto, val: string) => {
    if (editingProduct) setEditingProduct({...editingProduct, [field]: val});
  };

  const brandColor = config.colorPrimario || '#84cc16';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-32">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-brand-50 rounded-2xl"><Package className="w-8 h-8 text-brand-600" /></div>
           <div>
              <h2 className="text-3xl font-black text-slate-900 uppercase leading-none">Mi Catálogo Pro</h2>
              <p className="text-slate-500 text-sm font-medium mt-1">Sincronizado con: <span className="text-slate-900 font-bold">{session.companyName}</span></p>
           </div>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchProducts} disabled={loading} className="px-6 py-3.5 bg-white border border-slate-200 rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-slate-50 transition-all">
            <RefreshCw className={loading ? 'animate-spin' : ''} /> ACTUALIZAR DATOS
          </button>
          <button onClick={handleSaveConfig} disabled={saving || loading} className="px-8 py-3.5 text-white rounded-2xl font-black text-xs shadow-xl flex items-center gap-2 transition-all hover:scale-105" style={{backgroundColor: brandColor}}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} PUBLICAR CAMBIOS
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row gap-6 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input type="text" placeholder="Buscar por nombre o descripción..." className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex items-center gap-4 bg-slate-50 px-6 py-1.5 rounded-2xl">
             <Filter className="w-4 h-4 text-slate-400" />
             <select 
                className="bg-transparent border-none outline-none text-xs font-black uppercase py-3 cursor-pointer"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
             >
                <option value="Todas">Todas las Categorías</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
             </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
              <tr><th className="px-10 py-6">Producto</th><th className="px-10 py-6">Categoría</th><th className="px-10 py-6 text-right">Precio</th><th className="px-10 py-6 text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts.map(p => {
                const isHidden = hiddenIds.includes(p.id);
                return (
                  <tr key={p.id} className={`hover:bg-slate-50/50 transition-colors ${isHidden ? 'opacity-40 grayscale' : ''}`}>
                    <td className="px-10 py-5 flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                         {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover"/> : <Package className="w-6 h-6 text-slate-200"/>}
                      </div>
                      <div><p className="font-bold text-sm uppercase leading-none mb-1">{p.nombre}</p><p className="text-[9px] text-slate-400 font-black tracking-widest uppercase">{p.laboratorio || 'SIN MARCA'}</p></div>
                    </td>
                    <td className="px-10 py-5"><span className="text-[10px] font-black bg-slate-100 px-3 py-1.5 rounded-xl uppercase">{p.categoria}</span></td>
                    <td className="px-10 py-5 text-right font-black">S/ {p.precio.toFixed(2)}</td>
                    <td className="px-10 py-5 text-right flex justify-end gap-2">
                      <button onClick={() => setEditingProduct(p)} className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-900 hover:text-white transition-all"><Edit className="w-4 h-4"/></button>
                      <button onClick={() => setHiddenIds(prev => isHidden ? prev.filter(id => id !== p.id) : [...prev, p.id])} className={`px-4 py-2.5 rounded-xl font-black text-[9px] uppercase transition-all ${isHidden ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>{isHidden ? 'Oculto' : 'Visible'}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center">
               <Package className="w-12 h-12 text-slate-100 mb-4" />
               <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No hay productos en esta selección</p>
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal manteniene la misma lógica interactiva pero optimizado */}
      {editingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in" onClick={() => setEditingProduct(null)}></div>
          <div className="relative bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl p-10 animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-brand-50 rounded-2xl"><Edit className="w-5 h-5 text-brand-600" /></div>
                 <h3 className="text-xl font-black uppercase tracking-tight">Personalizar Información Online</h3>
              </div>
              <button onClick={() => setEditingProduct(null)} className="p-2 bg-slate-100 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"><X/></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Contenido para el Cliente</label>
                <textarea className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-medium h-32 outline-none focus:ring-2 focus:ring-brand-500" value={editingProduct.descripcion_venta} onChange={e => updateEditingField('descripcion_venta', e.target.value)} placeholder="Ej: Este producto ayuda a..." />
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Modo de Uso / Recomendación</label>
                <textarea className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-medium h-32 outline-none focus:ring-2 focus:ring-brand-500" value={editingProduct.uso_sugerido} onChange={e => updateEditingField('uso_sugerido', e.target.value)} placeholder="Ej: Tomar bajo supervisión..." />
              </div>
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Datos de Sincronización Local</label>
                <div className="space-y-3">
                    <div className="relative">
                      <ClipboardCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input type="text" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl text-xs font-bold" placeholder="Registro Sanitario / SENASA" value={editingProduct.registro_sanitario} onChange={e => updateEditingField('registro_sanitario', e.target.value)} />
                    </div>
                    <div className="relative">
                      <Beaker className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input type="text" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl text-xs font-bold" placeholder="Principio Activo" value={editingProduct.principio_activo} onChange={e => updateEditingField('principio_activo', e.target.value)} />
                    </div>
                    <div className="relative">
                      <Pill className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input type="text" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl text-xs font-bold" placeholder="Laboratorio / Marca" value={editingProduct.laboratorio} onChange={e => updateEditingField('laboratorio', e.target.value)} />
                    </div>
                    {config.businessType === 'veterinary' && (
                    <div className="relative">
                        <Heart className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input type="text" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl text-xs font-bold border-2 border-brand-100" placeholder="Especie (Perros, Gatos...)" value={editingProduct.especie} onChange={e => updateEditingField('especie', e.target.value)} />
                    </div>
                    )}
                    {config.businessType === 'podiatry' && (
                    <div className="relative">
                        <Footprints className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input type="text" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl text-xs font-bold border-2 border-brand-100" placeholder="Duración Sesión (min)" value={editingProduct.duracion_sesion} onChange={e => updateEditingField('duracion_sesion', e.target.value)} />
                    </div>
                    )}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setEditingProduct(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs">Descartar</button>
              <button onClick={() => { 
                setProductos(prev => prev.map(p => p.id === editingProduct.id ? editingProduct : p));
                setEditingProduct(null);
              }} className="flex-[2] py-4 text-white rounded-2xl font-black uppercase text-xs shadow-xl transition-all hover:brightness-110" style={{backgroundColor: brandColor}}>Actualizar Vista Local</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManager;
