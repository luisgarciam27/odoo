
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, Save, RefreshCw, Loader2, Edit, X, Pill, Beaker, ClipboardCheck, Heart, Footprints, AlertCircle, Filter, CheckCircle2 } from 'lucide-react';
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
    const context = { allowed_company_ids: [session.companyId], company_id: session.companyId };

    try {
      // DOMINIO ESTRICTO: Solo productos de esta compañía o sin compañía (globales)
      const domain: any[] = [
        ['sale_ok', '=', true],
        ['company_id', 'in', [session.companyId, false]]
      ];

      const fields = ['display_name', 'list_price', 'qty_available', 'categ_id', 'image_128', 'description_sale', 'x_registro_sanitario', 'x_laboratorio', 'x_principio_activo', 'x_uso_sugerido', 'x_especie', 'x_duracion_sesion'];
      
      let data: any[] = [];
      try {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, fields, { limit: 1000, order: 'display_name asc', context });
      } catch (err: any) {
        console.warn("Fallo campos extendidos, reintentando con campos base...");
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', domain, ['display_name', 'list_price', 'qty_available', 'categ_id', 'image_128'], { limit: 1000, order: 'display_name asc', context });
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
      console.error("Error sincronización:", e);
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

  const bizLabels = {
    pharmacy: { reg: 'Reg. Sanitario', lab: 'Laboratorio' },
    veterinary: { reg: 'Reg. SENASA', lab: 'Marca / Laboratorio' },
    podiatry: { reg: 'Especialidad', lab: 'Punto de Venta' }
  }[config.businessType || 'pharmacy'];

  const brandColor = config.colorPrimario || '#84cc16';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-32">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-6">
           <div className="p-4 bg-brand-50 rounded-[1.5rem]"><Package className="w-8 h-8 text-brand-600" /></div>
           <div>
              <h2 className="text-3xl font-black text-slate-900 uppercase leading-none tracking-tighter">Gestor de Productos Pro</h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500"/> Sincronizado: <span className="text-slate-900">{session.companyName}</span>
              </p>
           </div>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchProducts} disabled={loading} className="px-6 py-4 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
            <RefreshCw className={loading ? 'animate-spin' : ''} /> Refrescar Odoo
          </button>
          <button onClick={handleSaveConfig} disabled={saving || loading} className="px-10 py-4 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95" style={{backgroundColor: brandColor}}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Publicar Cambios
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex flex-col md:flex-row gap-8 items-center bg-slate-50/30">
          <div className="relative flex-1 group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
            <input type="text" placeholder="Buscar por nombre del producto..." className="w-full pl-14 pr-6 py-5 bg-white border border-slate-100 rounded-[2rem] outline-none font-bold text-sm shadow-inner focus:ring-4 focus:ring-slate-100 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex items-center gap-4 bg-white px-8 py-2 rounded-[2rem] border border-slate-100 shadow-inner">
             <Filter className="w-4 h-4 text-slate-400" />
             <select 
                className="bg-transparent border-none outline-none text-[10px] font-black uppercase py-4 cursor-pointer tracking-widest"
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
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
              <tr><th className="px-12 py-7">Producto / Identidad</th><th className="px-10 py-7">Categoría</th><th className="px-10 py-7 text-right">Precio Online</th><th className="px-12 py-7 text-right">Visibilidad</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts.map(p => {
                const isHidden = hiddenIds.includes(p.id);
                return (
                  <tr key={p.id} className={`hover:bg-slate-50/50 transition-colors ${isHidden ? 'opacity-40 grayscale' : ''}`}>
                    <td className="px-12 py-6 flex items-center gap-6">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border border-slate-50">
                         {p.imagen ? <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover"/> : <Package className="w-6 h-6 text-slate-200"/>}
                      </div>
                      <div>
                        <p className="font-black text-sm uppercase leading-tight text-slate-900 group-hover:text-brand-600 transition-colors">{p.nombre}</p>
                        <p className="text-[9px] text-slate-400 font-black tracking-widest uppercase mt-1">{p.laboratorio || 'S/M'}</p>
                      </div>
                    </td>
                    <td className="px-10 py-6"><span className="text-[9px] font-black bg-slate-100 px-4 py-1.5 rounded-full uppercase text-slate-500 border border-slate-200">{p.categoria}</span></td>
                    <td className="px-10 py-6 text-right font-black text-slate-900">S/ {p.precio.toFixed(2)}</td>
                    <td className="px-12 py-6 text-right flex justify-end gap-3">
                      <button onClick={() => setEditingProduct(p)} className="p-3.5 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"><Edit className="w-4 h-4"/></button>
                      <button onClick={() => setHiddenIds(prev => isHidden ? prev.filter(id => id !== p.id) : [...prev, p.id])} className={`px-6 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all ${isHidden ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-brand-50 text-brand-700 border border-brand-100'}`}>{isHidden ? 'Ocultar' : 'Público'}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="py-32 text-center flex flex-col items-center">
               <Package className="w-20 h-20 text-slate-100 mb-6" />
               <p className="text-slate-400 font-black uppercase text-xs tracking-[0.3em]">Sin resultados en esta categoría</p>
            </div>
          )}
        </div>
      </div>

      {/* EDITOR DE PRODUCTO - TEMPLATE INTERACTIVO */}
      {editingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl animate-in fade-in" onClick={() => setEditingProduct(null)}></div>
          <div className="relative bg-white w-full max-w-4xl rounded-[4rem] shadow-2xl p-12 animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-5">
                 <div className="p-4 bg-brand-50 rounded-[1.5rem]"><Edit className="w-6 h-6 text-brand-600" /></div>
                 <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter">Editor de Ficha Maestra</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{editingProduct.nombre}</p>
                 </div>
              </div>
              <button onClick={() => setEditingProduct(null)} className="p-4 bg-slate-50 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"><X className="w-5 h-5"/></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Descripción Comercial (Web)</label>
                  <textarea className="w-full p-5 bg-slate-50 border-none rounded-[2rem] text-xs font-bold uppercase h-40 outline-none focus:ring-4 focus:ring-brand-100 transition-all shadow-inner" value={editingProduct.descripcion_venta} onChange={e => setEditingProduct({...editingProduct, descripcion_venta: e.target.value})} placeholder="Describe los beneficios para el cliente..." />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Modo de Uso / Recomendaciones</label>
                  <textarea className="w-full p-5 bg-slate-50 border-none rounded-[2rem] text-xs font-bold uppercase h-40 outline-none focus:ring-4 focus:ring-brand-100 transition-all shadow-inner" value={editingProduct.uso_sugerido} onChange={e => setEditingProduct({...editingProduct, uso_sugerido: e.target.value})} placeholder="Ej: Tomar 1 cápsula antes de dormir..." />
                </div>
              </div>
              <div className="space-y-6">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Información Técnica del Giro</label>
                <div className="space-y-4 p-8 bg-slate-50 rounded-[3rem] border border-slate-100 shadow-inner">
                    <div className="relative">
                      <ClipboardCheck className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input type="text" className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-2xl text-[11px] font-black uppercase tracking-tighter" placeholder={bizLabels.reg} value={editingProduct.registro_sanitario} onChange={e => setEditingProduct({...editingProduct, registro_sanitario: e.target.value})} />
                    </div>
                    <div className="relative">
                      <Beaker className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input type="text" className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-2xl text-[11px] font-black uppercase tracking-tighter" placeholder="Principio Activo" value={editingProduct.principio_activo} onChange={e => setEditingProduct({...editingProduct, principio_activo: e.target.value})} />
                    </div>
                    <div className="relative">
                      <Pill className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input type="text" className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-2xl text-[11px] font-black uppercase tracking-tighter" placeholder={bizLabels.lab} value={editingProduct.laboratorio} onChange={e => setEditingProduct({...editingProduct, laboratorio: e.target.value})} />
                    </div>
                    {config.businessType === 'veterinary' && (
                    <div className="relative group">
                        <Heart className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-300" />
                        <input type="text" className="w-full pl-14 pr-6 py-4 bg-white border-2 border-brand-100 rounded-2xl text-[11px] font-black uppercase tracking-tighter focus:border-brand-500 transition-all outline-none" placeholder="Especie Destino (Caninos, Felinos...)" value={editingProduct.especie} onChange={e => setEditingProduct({...editingProduct, especie: e.target.value})} />
                    </div>
                    )}
                    {config.businessType === 'podiatry' && (
                    <div className="relative group">
                        <Footprints className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-300" />
                        <input type="text" className="w-full pl-14 pr-6 py-4 bg-white border-2 border-brand-100 rounded-2xl text-[11px] font-black uppercase tracking-tighter focus:border-brand-500 transition-all outline-none" placeholder="Duración Estimada (min)" value={editingProduct.duracion_sesion} onChange={e => setEditingProduct({...editingProduct, duracion_sesion: e.target.value})} />
                    </div>
                    )}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setEditingProduct(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Cancelar Cambios</button>
              <button onClick={() => { 
                setProductos(prev => prev.map(p => p.id === editingProduct.id ? editingProduct : p));
                setEditingProduct(null);
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 2000);
              }} className="flex-[2] py-5 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl transition-all hover:scale-[1.02] active:scale-95" style={{backgroundColor: brandColor}}>Actualizar Información Local</button>
            </div>
            <p className="mt-8 text-[9px] text-slate-400 font-black text-center uppercase tracking-widest flex items-center justify-center gap-3">
               <AlertCircle className="w-4 h-4 text-brand-400"/> Los cambios realizados se verán inmediatamente en tu tienda virtual Lemon BI.
            </p>
          </div>
        </div>
      )}

      {/* NOTIFICACIÓN DE ÉXITO */}
      {showSuccess && (
         <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-10 py-5 rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-10 flex items-center gap-4">
            <CheckCircle2 className="text-brand-400 w-6 h-6"/>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Sincronización Exitosa</span>
         </div>
      )}
    </div>
  );
};

export default ProductManager;
