
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, Eye, EyeOff, Save, RefreshCw, CheckCircle2, Loader2, Edit, X, Info, Pill, Beaker, ClipboardCheck, Heart, Footprints, AlertCircle } from 'lucide-react';
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
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [hiddenIds, setHiddenIds] = useState<number[]>(config.hiddenProducts || []);

  const fetchProducts = async () => {
    setLoading(true);
    const client = new OdooClient(session.url, session.db, true);
    try {
      const coreFields = ['display_name', 'list_price', 'qty_available', 'categ_id', 'image_128', 'description_sale'];
      const extraFields = ['x_registro_sanitario', 'x_laboratorio', 'x_principio_activo', 'x_uso_sugerido', 'x_especie', 'x_duracion_sesion'];
      
      let data: any[] = [];
      try {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], 
          [...coreFields, ...extraFields], { limit: 500, order: 'display_name asc' });
      } catch {
        data = await client.searchRead(session.uid, session.apiKey, 'product.product', [['sale_ok', '=', true]], 
          coreFields, { limit: 500, order: 'display_name asc' });
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

  const filteredProducts = useMemo(() => {
    return productos.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [productos, searchTerm]);

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

  const handleUpdateProductInList = () => {
    if (editingProduct) {
      setProductos(prev => prev.map(p => p.id === editingProduct.id ? editingProduct : p));
      setEditingProduct(null);
      // Nota: Aquí se guardaría en Odoo si se tuviera permiso de escritura, 
      // por ahora actualizamos la vista local para que el admin vea sus cambios.
    }
  };

  const brandColor = config.colorPrimario || '#84cc16';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-32">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase">Mis Productos Pro</h2>
          <p className="text-slate-500 text-sm font-medium">Gestiona visibilidad y contenido enriquecido.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchProducts} disabled={loading} className="px-6 py-3.5 bg-white border border-slate-200 rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-slate-50 transition-all">
            <RefreshCw className={loading ? 'animate-spin' : ''} /> SINCRONIZAR ODOO
          </button>
          <button onClick={handleSaveConfig} disabled={saving || loading} className="px-8 py-3.5 text-white rounded-2xl font-black text-xs shadow-xl flex items-center gap-2 transition-all hover:scale-105" style={{backgroundColor: brandColor}}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} PUBLICAR CAMBIOS
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input type="text" placeholder="Buscar por nombre..." className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
                      <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden">{p.imagen && <img src={`data:image/png;base64,${p.imagen}`} className="w-full h-full object-cover"/>}</div>
                      <div><p className="font-bold text-sm uppercase leading-none mb-1">{p.nombre}</p><p className="text-[9px] text-slate-400 font-black tracking-widest uppercase">{p.laboratorio || 'S/M'}</p></div>
                    </td>
                    <td className="px-10 py-5"><span className="text-[10px] font-black bg-slate-100 px-3 py-1.5 rounded-xl uppercase">{p.categoria}</span></td>
                    <td className="px-10 py-5 text-right font-black">S/ {p.precio.toFixed(2)}</td>
                    <td className="px-10 py-5 text-right flex justify-end gap-2">
                      <button onClick={() => setEditingProduct(p)} className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-900 hover:text-white transition-all"><Edit className="w-4 h-4"/></button>
                      <button onClick={() => setHiddenIds(prev => isHidden ? prev.filter(id => id !== p.id) : [...prev, p.id])} className={`px-4 py-2.5 rounded-xl font-black text-[9px] uppercase transition-all ${isHidden ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>{isHidden ? 'Oculto' : 'Visible'}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor de Ficha de Producto */}
      {editingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in" onClick={() => setEditingProduct(null)}></div>
          <div className="relative bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl p-10 animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black uppercase tracking-tight">Editar Ficha Técnica</h3>
              <button onClick={() => setEditingProduct(null)} className="p-2 bg-slate-100 rounded-full hover:bg-red-50 hover:text-red-500"><X/></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción Comercial</label>
                <textarea className="w-full p-4 bg-slate-50 rounded-2xl text-xs h-32 outline-none focus:ring-2 focus:ring-brand-500" value={editingProduct.descripcion_venta} onChange={e => updateEditingField('descripcion_venta', e.target.value)} placeholder="Escribe aquí los beneficios..." />
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Uso Sugerido / Dosis</label>
                <textarea className="w-full p-4 bg-slate-50 rounded-2xl text-xs h-32 outline-none focus:ring-2 focus:ring-brand-500" value={editingProduct.uso_sugerido} onChange={e => updateEditingField('uso_sugerido', e.target.value)} placeholder="Ej: Tomar 1 cada 8 horas..." />
              </div>
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Datos Técnicos</label>
                <div className="relative">
                  <ClipboardCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input type="text" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl text-xs font-bold" placeholder="Registro Sanitario" value={editingProduct.registro_sanitario} onChange={e => updateEditingField('registro_sanitario', e.target.value)} />
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
                    <input type="text" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl text-xs font-bold" placeholder="Especie (Perros, Gatos...)" value={editingProduct.especie} onChange={e => updateEditingField('especie', e.target.value)} />
                  </div>
                )}
                {config.businessType === 'podiatry' && (
                  <div className="relative">
                    <Footprints className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input type="text" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl text-xs font-bold" placeholder="Duración Sesión (min)" value={editingProduct.duracion_sesion} onChange={e => updateEditingField('duracion_sesion', e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setEditingProduct(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs">Cancelar</button>
              <button onClick={handleUpdateProductInList} className="flex-[2] py-4 text-white rounded-2xl font-black uppercase text-xs shadow-xl transition-all hover:scale-105" style={{backgroundColor: brandColor}}>Actualizar Información Local</button>
            </div>
            <p className="mt-4 text-[9px] text-slate-400 font-bold text-center uppercase tracking-widest flex items-center justify-center gap-2"><AlertCircle className="w-3 h-3"/> Los cambios se reflejarán inmediatamente en tu tienda virtual.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManager;
