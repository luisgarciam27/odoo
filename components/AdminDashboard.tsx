
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

    const [currentClient, setCurrentClient] = useState<ClientConfig>({
        code: '', url: '', db: '', username: '', apiKey: '', companyFilter: '', isActive: true,
        businessType: 'pharmacy', colorPrimario: '#84cc16'
    });
    const [originalCode, setOriginalCode] = useState<string | null>(null);

    const loadClients = async () => {
        setIsLoading(true);
        try {
            const data = await getClients();
            setClients(data);
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { loadClients(); }, []);

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
            } else { alert(result.message); }
        } finally { setIsLoading(false); }
    };

    const handleEdit = (client: ClientConfig) => {
        setCurrentClient({ ...client });
        setOriginalCode(client.code);
        setIsEditing(true);
    };

    const resetForm = () => {
        setCurrentClient({ 
            code: '', url: '', db: '', username: '', apiKey: '', companyFilter: '', isActive: true,
            businessType: 'pharmacy', colorPrimario: '#84cc16'
        });
        setOriginalCode(null);
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
                        <h2 className="text-3xl font-black text-slate-900 uppercase">Configuración de Marca</h2>
                        <p className="text-slate-500 text-sm mt-1 font-bold uppercase tracking-widest">Parámetros técnicos Odoo v17</p>
                    </div>
                    <button onClick={() => { resetForm(); setIsEditing(true); }} className="bg-brand-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-brand-700">
                      <Plus className="w-5 h-5" /> Nueva Empresa
                    </button>
                </div>
                
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black border-b tracking-widest">
                            <tr>
                                <th className="px-8 py-5">Identificador</th>
                                <th className="px-8 py-5">Servidor Odoo</th>
                                <th className="px-8 py-5">Giro</th>
                                <th className="px-8 py-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold">
                            {clients.map(c => (
                                <tr key={c.code} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-5 uppercase">{c.code}</td>
                                    <td className="px-8 py-5 text-slate-400">{c.url}</td>
                                    <td className="px-8 py-5">
                                        <span className="text-[9px] font-black uppercase bg-slate-100 px-3 py-1 rounded-full">{c.businessType}</span>
                                    </td>
                                    <td className="px-8 py-5 flex justify-end gap-2">
                                        <button onClick={() => handleEdit(c)} className="p-3 bg-slate-100 rounded-xl hover:bg-brand-500 hover:text-white transition-all"><Edit className="w-4 h-4"/></button>
                                        <button onClick={() => deleteClient(c.code).then(loadClients)} className="p-3 bg-slate-100 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-xl p-10 shadow-2xl relative">
                        <div className="flex justify-between items-start mb-8 border-b pb-6">
                            <div>
                                <h3 className="font-black text-2xl uppercase tracking-tighter">Conexión Odoo</h3>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Sincronización Cloud</p>
                            </div>
                            <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-100 rounded-full"><X/></button>
                        </div>
                        
                        <form onSubmit={handleSaveClient} className="space-y-6">
                            <div className="space-y-4">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Negocio</label>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                    <BusinessOption type="pharmacy" label="Farmacia" icon={Pill} />
                                    <BusinessOption type="veterinary" label="Veterinaria" icon={PawPrint} />
                                    <BusinessOption type="podiatry" label="Podología" icon={Footprints} />
                                    <BusinessOption type="general" label="Comercio" icon={Briefcase} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Código Acceso</label>
                                    <input type="text" placeholder="PHARMASCOOT" className="w-full p-4 border rounded-2xl font-black uppercase text-sm" value={currentClient.code} onChange={e => setCurrentClient({...currentClient, code: e.target.value.toUpperCase()})} required disabled={!!originalCode}/>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">URL Odoo</label>
                                    <input type="url" placeholder="https://mi-odoo.com" className="w-full p-4 border rounded-2xl text-sm font-bold" value={currentClient.url} onChange={e => setCurrentClient({...currentClient, url: e.target.value})} required/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Base de Datos</label>
                                    <input type="text" placeholder="odoo_db" className="w-full p-4 border rounded-2xl text-sm font-bold" value={currentClient.db} onChange={e => setCurrentClient({...currentClient, db: e.target.value})} required/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Usuario</label>
                                    <input type="text" placeholder="admin@email.com" className="w-full p-4 border rounded-2xl text-sm font-bold" value={currentClient.username} onChange={e => setCurrentClient({...currentClient, username: e.target.value})} required/>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">API Key</label>
                                    <input type="password" placeholder="••••••••" className="w-full p-4 border rounded-2xl font-mono text-sm" value={currentClient.apiKey} onChange={e => setCurrentClient({...currentClient, apiKey: e.target.value})} required/>
                                </div>
                            </div>

                            <div className="pt-6 border-t flex gap-4">
                                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 p-5 bg-slate-100 rounded-2xl font-black uppercase text-xs">Cerrar</button>
                                <button type="submit" disabled={isLoading} className="flex-[2] p-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">
                                    {isLoading ? 'Conectando...' : 'Guardar Configuración'}
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
