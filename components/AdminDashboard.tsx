
import React, { useState, useEffect } from 'react';
import { getClients, saveClient, deleteClient } from '../services/clientManager';
import { ClientConfig, BusinessType } from '../types';
import { Trash2, Edit, Plus, X, Shield, Activity, RefreshCw, Pill, PawPrint, Footprints, Briefcase } from 'lucide-react';
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
        nombreComercial: '', logoUrl: '', footerLogoUrl: '', colorPrimario: '#84cc16', colorSecundario: '#1e293b', colorAcento: '#0ea5e9',
        showStore: true, tiendaCategoriaNombre: 'Catalogo', yapeNumber: '', yapeName: '', plinNumber: '', plinName: '', yapeQR: '', plinQR: '',
        footer_description: '', facebook_url: '', instagram_url: '', tiktok_url: '', whatsappHelpNumber: '', quality_text: '', support_text: '',
        businessType: 'pharmacy'
    });
    const [originalCode, setOriginalCode] = useState<string | null>(null);

    const loadClients = async () => {
        setIsLoading(true);
        try {
            const data = await getClients();
            setClients(data);
        } catch (err) {
            console.error("Error cargando clientes:", err);
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
        setCurrentClient({ ...client });
        setOriginalCode(client.code);
        setIsEditing(true);
    };

    const resetForm = () => {
        setCurrentClient({ 
            code: '', url: '', db: '', username: '', apiKey: '', companyFilter: '', whatsappNumbers: '', isActive: true, 
            nombreComercial: '', logoUrl: '', footerLogoUrl: '', colorPrimario: '#84cc16', colorSecundario: '#1e293b', colorAcento: '#0ea5e9',
            showStore: true, tiendaCategoriaNombre: 'Catalogo', yapeNumber: '', yapeName: '', plinNumber: '', plinName: '', yapeQR: '', plinQR: '', 
            footer_description: '', facebook_url: '', instagram_url: '', tiktok_url: '', whatsappHelpNumber: '', quality_text: '', support_text: '',
            businessType: 'pharmacy'
        });
        setOriginalCode(null);
    };

    const copyStoreLink = (code: string) => {
        const fullUrl = `${window.location.origin}${window.location.pathname}?shop=${code}`;
        navigator.clipboard.writeText(fullUrl);
        alert(`Link copiado.`);
    };

    const handleTestConnection = async (client: ClientConfig) => {
        setTestingClient(client.code);
        try {
            const odoo = new OdooClient(client.url, client.db, true);
            const uid = await odoo.authenticate(client.username, client.apiKey);
            alert(`✅ Conexión Exitosa con Odoo.`);
        } catch (error: any) {
            alert("❌ Error: " + (error.message || "Odoo no responde."));
        } finally {
            setTestingClient(null);
        }
    };

    const BusinessOption = ({ type, label, icon: Icon }: { type: BusinessType, label: string, icon: any }) => (
        <button 
            type="button"
            onClick={() => setCurrentClient({...currentClient, businessType: type})}
            className={`flex-1 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${currentClient.businessType === type ? 'border-brand-500 bg-brand-50' : 'border-slate-100 bg-slate-50 opacity-60'}`}
        >
            <Icon className={`w-6 h-6 ${currentClient.businessType === type ? 'text-brand-600' : 'text-slate-400'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
        </button>
    );

    return (
        <div className="min-h-screen bg-slate-100 font-sans text-slate-800 pb-10">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-lg sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-brand-400" />
                    <h1 className="font-bold text-lg uppercase tracking-tighter">Lemon BI Admin</h1>
                </div>
                <button onClick={onLogout} className="px-3 py-1.5 bg-red-600 rounded-lg text-xs font-bold uppercase">Salir</button>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 uppercase">Clientes</h2>
                        <p className="text-slate-500 text-sm mt-1">Gestión de marcas e integraciones.</p>
                    </div>
                    <button onClick={() => { resetForm(); setIsEditing(true); }} className="bg-brand-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-xl flex items-center gap-2 hover:bg-brand-700">
                      <Plus className="w-5 h-5" /> Nueva Empresa
                    </button>
                </div>
                
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black border-b tracking-widest">
                            <tr>
                                <th className="px-8 py-5">Empresa / Rubro</th>
                                <th className="px-8 py-5">Tienda</th>
                                <th className="px-8 py-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {clients.map(c => (
                                <tr key={c.code} className="hover:bg-slate-50">
                                    <td className="px-8 py-5">
                                        <div className="font-bold text-slate-900">{c.code}</div>
                                        <div className="text-[10px] text-brand-600 font-black uppercase tracking-widest mt-1 flex items-center gap-1">
                                            {c.businessType === 'pharmacy' ? <Pill className="w-2.5 h-2.5" /> : 
                                             c.businessType === 'veterinary' ? <PawPrint className="w-2.5 h-2.5" /> : 
                                             c.businessType === 'podiatry' ? <Footprints className="w-2.5 h-2.5" /> : 
                                             <Briefcase className="w-2.5 h-2.5" />}
                                            {c.businessType}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        {c.showStore ? (
                                            <button onClick={() => copyStoreLink(c.code)} className="text-[9px] font-black bg-brand-100 text-brand-700 px-3 py-1 rounded-full">COPIAR LINK</button>
                                        ) : <span className="text-slate-300 text-[9px] font-bold">OFF</span>}
                                    </td>
                                    <td className="px-8 py-5 flex justify-end gap-2">
                                        <button onClick={() => handleTestConnection(c)} className="p-2 bg-slate-100 rounded-lg hover:bg-blue-100"><Activity className="w-4 h-4"/></button>
                                        <button onClick={() => handleEdit(c)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"><Edit className="w-4 h-4"/></button>
                                        <button onClick={() => handleDelete(c.code)} className="p-2 bg-slate-100 rounded-lg hover:bg-red-100"><Trash2 className="w-4 h-4"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl relative my-8">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="font-black text-2xl uppercase tracking-tighter">Conexión Odoo Técnico</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Sincronización Lemon BI v2.5</p>
                            </div>
                            <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-100 rounded-full"><X/></button>
                        </div>
                        
                        <form onSubmit={handleSaveClient} className="space-y-8">
                            <div className="grid grid-cols-1 gap-8">
                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Giro de Negocio</label>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                        <BusinessOption type="pharmacy" label="Farmacia" icon={Pill} />
                                        <BusinessOption type="veterinary" label="Veterinaria" icon={PawPrint} />
                                        <BusinessOption type="podiatry" label="Podología" icon={Footprints} />
                                        <BusinessOption type="general" label="Comercio" icon={Briefcase} />
                                    </div>

                                    <div className="pt-4 space-y-4">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Parámetros de Servidor</label>
                                        <input type="text" placeholder="CÓDIGO EMPRESA (ID)" className="w-full p-4 border rounded-2xl font-black uppercase" value={currentClient.code} onChange={e => setCurrentClient({...currentClient, code: e.target.value.toUpperCase()})} required disabled={!!originalCode}/>
                                        <input type="url" placeholder="URL ODOO (Ej: https://mi-odoo.com)" className="w-full p-4 border rounded-2xl text-sm" value={currentClient.url} onChange={e => setCurrentClient({...currentClient, url: e.target.value})} required/>
                                        <input type="text" placeholder="BASE DE DATOS" className="w-full p-4 border rounded-2xl text-sm" value={currentClient.db} onChange={e => setCurrentClient({...currentClient, db: e.target.value})} required/>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Integración Técnica</label>
                                    <input type="text" placeholder="USUARIO / EMAIL" className="w-full p-4 border rounded-2xl text-sm" value={currentClient.username} onChange={e => setCurrentClient({...currentClient, username: e.target.value})} required/>
                                    <input type="password" placeholder="API KEY (CONTRASEÑA TÉCNICA)" className="w-full p-4 border rounded-2xl font-mono text-sm" value={currentClient.apiKey} onChange={e => setCurrentClient({...currentClient, apiKey: e.target.value})} required/>
                                    <input type="text" placeholder="FILTRO COMPAÑÍA (Solo si aplica)" className="w-full p-4 border rounded-2xl text-sm uppercase" value={currentClient.companyFilter} onChange={e => setCurrentClient({...currentClient, companyFilter: e.target.value})}/>
                                </div>
                            </div>

                            <div className="pt-6 border-t flex gap-4">
                                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 p-5 bg-slate-100 rounded-2xl font-black uppercase text-xs tracking-widest">Cancelar</button>
                                <button type="submit" disabled={isLoading} className="flex-[2] p-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-black transition-all">
                                    {isLoading ? 'Guardando...' : 'Establecer Conexión'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
