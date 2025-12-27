
import React, { useState, useEffect } from 'react';
import { getClients, saveClient, deleteClient } from '../services/clientManager';
import { ClientConfig } from '../types';
import { Trash2, Edit, Plus, X, LogOut, Shield, Activity, RefreshCw, Copy, ShoppingBag, Tag, ExternalLink, Palette, Facebook, Instagram, MessageCircle, HeartPulse } from 'lucide-react';
import { OdooClient } from '../services/odoo';

interface AdminDashboardProps {
    onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
    const [clients, setClients] = useState<ClientConfig[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    
    const [testingClient, setTestingClient] = useState<string | null>(null);

    const [currentClient, setCurrentClient] = useState<ClientConfig>({
        code: '', url: '', db: '', username: '', apiKey: '', companyFilter: '', whatsappNumbers: '', isActive: true,
        nombreComercial: '', logoUrl: '', colorPrimario: '#84cc16',
        showStore: true, tiendaCategoriaNombre: 'Catalogo', yapeNumber: '', yapeName: '', plinNumber: '', plinName: '', yapeQR: '', plinQR: '',
        footer_description: '', facebook_url: '', instagram_url: '', tiktok_url: '', quality_text: '', support_text: ''
    });
    const [originalCode, setOriginalCode] = useState<string | null>(null);

    const loadClients = async () => {
        setIsLoading(true);
        try {
            const data = await getClients();
            setClients(data);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadClients();
    }, []);

    const handleSaveClient = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const isNew = !originalCode;
        try {
            const result = await saveClient(currentClient, isNew);
            if (result.success) {
                await loadClients();
                setIsEditing(false);
                resetForm();
            } else {
                alert(result.message || "Error al guardar.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (code: string) => {
        if (confirm(`¿Eliminar cliente ${code}?`)) {
            setIsLoading(true);
            try {
                if (await deleteClient(code)) await loadClients();
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleEdit = (client: ClientConfig) => {
        setCurrentClient({
          ...client,
          tiendaCategoriaNombre: client.tiendaCategoriaNombre || 'Catalogo',
          nombreComercial: client.nombreComercial || client.code,
          colorPrimario: client.colorPrimario || '#84cc16'
        });
        setOriginalCode(client.code);
        setIsEditing(true);
    };

    const resetForm = () => {
        setCurrentClient({ code: '', url: '', db: '', username: '', apiKey: '', companyFilter: '', whatsappNumbers: '', isActive: true, nombreComercial: '', logoUrl: '', colorPrimario: '#84cc16', showStore: true, tiendaCategoriaNombre: 'Catalogo', yapeNumber: '', yapeName: '', plinNumber: '', plinName: '', yapeQR: '', plinQR: '', footer_description: '', facebook_url: '', instagram_url: '', tiktok_url: '', quality_text: '', support_text: '' });
        setOriginalCode(null);
    };

    const copyStoreLink = (code: string) => {
        const baseUrl = window.location.origin + window.location.pathname;
        const fullUrl = `${baseUrl}?shop=${code}`;
        navigator.clipboard.writeText(fullUrl);
        alert(`¡Enlace copiado!\nComparte este link con el cliente: ${fullUrl}`);
    };

    const handleTestConnection = async (client: ClientConfig) => {
        setTestingClient(client.code);
        try {
            const odoo = new OdooClient(client.url, client.db, true);
            const uid = await odoo.authenticate(client.username, client.apiKey);
            const categoryName = client.tiendaCategoriaNombre || 'Catalogo';
            const categories = await odoo.searchRead(uid, client.apiKey, 'product.category', [['name', 'ilike', categoryName]], ['id', 'name']);

            alert(`Conexión Exitosa con Odoo.\nCategoría '${categoryName}': ${categories.length > 0 ? '✓ Encontrada ('+categories[0].id+')' : '⚠ NO ENCONTRADA EN ODOO'}`);
        } catch (error: any) {
            alert("Error de conexión: " + error.message);
        } finally {
            setTestingClient(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 font-sans text-slate-800 pb-10">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-lg sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-brand-400" />
                    <h1 className="font-bold text-lg">LEMON BI ADMIN</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={onLogout} className="px-3 py-1.5 bg-red-600 rounded-lg text-xs font-bold uppercase transition-colors hover:bg-red-700"><LogOut className="w-4 h-4 inline mr-1"/> Salir</button>
                </div>
            </div>
            <div className="max-w-7xl mx-auto p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900">Gestión de Clientes</h2>
                        <p className="text-slate-500 text-sm mt-1">Configura analítica y catálogo online.</p>
                    </div>
                    <button onClick={() => { resetForm(); setIsEditing(true); }} className="bg-brand-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-xl shadow-brand-200 flex items-center gap-2 transition-all hover:bg-brand-700 hover:scale-[1.02] active:scale-95"><Plus className="w-5 h-5" /> Nueva Empresa</button>
                </div>
                
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-bold border-b tracking-widest">
                            <tr>
                                <th className="px-8 py-5">Código / Empresa</th>
                                <th className="px-8 py-5">Estado Catálogo</th>
                                <th className="px-8 py-5">Marca y Diseño</th>
                                <th className="px-8 py-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {clients.map(c => (
                                <tr key={c.code} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="font-bold text-slate-900">{c.code}</div>
                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.url}</div>
                                    </td>
                                    <td className="px-8 py-5">
                                        {c.showStore ? (
                                            <div className="flex flex-col gap-1.5 items-start">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-brand-100 text-brand-700 uppercase">
                                                    <ShoppingBag className="w-3.5 h-3.5"/> Activa
                                                </span>
                                                <button onClick={() => copyStoreLink(c.code)} className="text-[10px] text-brand-600 font-bold flex items-center gap-1 hover:underline">
                                                    <Copy className="w-3 h-3"/> Copiar Link Público
                                                </button>
                                            </div>
                                        ) : <span className="text-slate-300 text-xs">Inactivo</span>}
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full border border-slate-200" style={{backgroundColor: c.colorPrimario}}></div>
                                            <span className="text-xs font-bold text-slate-700 uppercase truncate max-w-[120px]">{c.nombreComercial || c.code}</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-1 uppercase flex items-center gap-1">
                                            <Tag className="w-3 h-3" /> {c.tiendaCategoriaNombre || 'Catalogo'}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 flex justify-end gap-3">
                                        <button onClick={() => window.open(`${window.location.origin}${window.location.pathname}?shop=${c.code}`, '_blank')} title="Ver Catálogo" className="p-2.5 bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-100 transition-all">
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleTestConnection(c)} disabled={testingClient === c.code} title="Probar Odoo" className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all">
                                            {testingClient === c.code ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => handleEdit(c)} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(c.code)} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all"><Trash2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-6xl p-10 shadow-2xl animate-in zoom-in duration-300 relative my-10">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="font-bold text-3xl text-slate-900">{originalCode ? 'Editar Configuración' : 'Nueva Empresa'}</h3>
                                <p className="text-slate-500 text-sm mt-1">Personaliza la experiencia de marca para tus clientes.</p>
                            </div>
                            <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X/></button>
                        </div>
                        
                        <form onSubmit={handleSaveClient} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {/* SECCIÓN 1: ODOO */}
                            <div className="space-y-6">
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                                    <h4 className="font-bold text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2">Acceso Odoo</h4>
                                    <input type="text" className="w-full p-3.5 bg-white border border-slate-200 rounded-xl uppercase font-bold text-slate-800" value={currentClient.code} onChange={e => setCurrentClient({...currentClient, code: e.target.value.toUpperCase()})} required disabled={!!originalCode} placeholder="CÓDIGO EMPRESA (EJ: REQUESALUD)"/>
                                    <input type="url" placeholder="URL Servidor (https://...)" className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none" value={currentClient.url} onChange={e => setCurrentClient({...currentClient, url: e.target.value})} required/>
                                    <input type="text" placeholder="Nombre Base de Datos" className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none" value={currentClient.db} onChange={e => setCurrentClient({...currentClient, db: e.target.value})} required/>
                                    <input type="text" placeholder="Email Usuario" className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none" value={currentClient.username} onChange={e => setCurrentClient({...currentClient, username: e.target.value})} required/>
                                    <input type="password" placeholder="API Key" className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none font-mono" value={currentClient.apiKey} onChange={e => setCurrentClient({...currentClient, apiKey: e.target.value})} required/>
                                    <input type="text" placeholder="Filtro Compañía Odoo" className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none" value={currentClient.companyFilter} onChange={e => setCurrentClient({...currentClient, companyFilter: e.target.value})} required/>
                                </div>
                            </div>

                            {/* SECCIÓN 2: MARCA Y FOOTER */}
                            <div className="space-y-6">
                                <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 space-y-4">
                                    <h4 className="font-bold text-xs text-blue-600 uppercase tracking-widest flex items-center gap-2"><Palette className="w-4 h-4"/> Marca y Footer</h4>
                                    
                                    <input type="text" placeholder="Nombre Comercial" className="w-full p-3.5 bg-white border border-blue-100 rounded-xl outline-none text-sm font-bold" value={currentClient.nombreComercial} onChange={e => setCurrentClient({...currentClient, nombreComercial: e.target.value})}/>
                                    
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Descripción del Footer</label>
                                        <textarea placeholder="Descripción larga para el pie de página..." className="w-full p-3.5 bg-white border border-blue-100 rounded-xl outline-none text-xs h-24" value={currentClient.footer_description} onChange={e => setCurrentClient({...currentClient, footer_description: e.target.value})} />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Redes Sociales (URLs)</label>
                                        <div className="flex gap-2">
                                            <div className="flex-1 relative">
                                                <Facebook className="absolute left-3 top-3 w-4 h-4 text-slate-300"/>
                                                <input type="url" placeholder="Facebook" className="w-full pl-9 pr-3 py-2.5 bg-white border border-blue-100 rounded-xl text-xs outline-none" value={currentClient.facebook_url} onChange={e => setCurrentClient({...currentClient, facebook_url: e.target.value})}/>
                                            </div>
                                            <div className="flex-1 relative">
                                                <Instagram className="absolute left-3 top-3 w-4 h-4 text-slate-300"/>
                                                <input type="url" placeholder="Instagram" className="w-full pl-9 pr-3 py-2.5 bg-white border border-blue-100 rounded-xl text-xs outline-none" value={currentClient.instagram_url} onChange={e => setCurrentClient({...currentClient, instagram_url: e.target.value})}/>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Garantía de Calidad (Texto)</label>
                                        <div className="relative">
                                            <HeartPulse className="absolute left-3 top-3 w-4 h-4 text-emerald-400"/>
                                            <input type="text" placeholder="Ej: Autorizado por DIGEMID" className="w-full pl-9 pr-3 py-2.5 bg-white border border-emerald-100 rounded-xl text-xs outline-none" value={currentClient.quality_text} onChange={e => setCurrentClient({...currentClient, quality_text: e.target.value})}/>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECCIÓN 3: SOPORTE Y TIENDA */}
                            <div className="space-y-6">
                                <div className="bg-brand-50/50 p-6 rounded-3xl border border-brand-100 space-y-4">
                                    <h4 className="font-bold text-xs text-brand-600 uppercase tracking-widest flex items-center gap-2"><MessageCircle className="w-4 h-4"/> Soporte y Pagos</h4>
                                    
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mensaje de Soporte</label>
                                        <input type="text" placeholder="Ej: ¿Tienes dudas? Escríbenos." className="w-full p-3.5 bg-white border border-brand-100 rounded-xl outline-none text-xs" value={currentClient.support_text} onChange={e => setCurrentClient({...currentClient, support_text: e.target.value})}/>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-purple-600 uppercase ml-1">Yape (Celular)</label>
                                            <input type="text" className="w-full p-2.5 bg-white border border-brand-100 rounded-xl text-xs" value={currentClient.yapeNumber} onChange={e => setCurrentClient({...currentClient, yapeNumber: e.target.value})}/>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-cyan-600 uppercase ml-1">Plin (Celular)</label>
                                            <input type="text" className="w-full p-2.5 bg-white border border-brand-100 rounded-xl text-xs" value={currentClient.plinNumber} onChange={e => setCurrentClient({...currentClient, plinNumber: e.target.value})}/>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 block mb-2">Color Corporativo</label>
                                        <div className="flex gap-3">
                                            <input type="color" className="w-12 h-12 rounded-xl border-none cursor-pointer" value={currentClient.colorPrimario} onChange={e => setCurrentClient({...currentClient, colorPrimario: e.target.value})}/>
                                            <input type="text" className="flex-1 p-3.5 bg-white border border-slate-200 rounded-xl text-xs font-mono" value={currentClient.colorPrimario} onChange={e => setCurrentClient({...currentClient, colorPrimario: e.target.value})}/>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={() => setIsEditing(false)} className="flex-1 p-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all uppercase text-xs tracking-widest">Cancelar</button>
                                    <button type="submit" disabled={isLoading} className="flex-[2] p-4 bg-brand-600 text-white rounded-2xl font-bold shadow-xl shadow-brand-100 hover:bg-brand-700 active:scale-95 transition-all uppercase text-xs tracking-widest">
                                        {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
