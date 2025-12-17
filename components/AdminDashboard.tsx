import React, { useState, useEffect } from 'react';
import { getClients, saveClient, deleteClient, changeAdminPassword } from '../services/clientManager';
import { ClientConfig } from '../types';
import { Trash2, Edit, Plus, X, LogOut, Key, Shield, Activity, RefreshCw, Smartphone, Copy, Workflow } from 'lucide-react';
import { OdooClient } from '../services/odoo';
import { DAILY_WORKFLOW_JSON, MONTHLY_WORKFLOW_JSON } from '../services/n8nTemplate';

interface AdminDashboardProps {
    onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
    const [clients, setClients] = useState<ClientConfig[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    
    // Test Connection State
    const [testingClient, setTestingClient] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<any | null>(null);

    // Simulation State
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationResult, setSimulationResult] = useState<string | null>(null);

    // Form States
    const [currentClient, setCurrentClient] = useState<ClientConfig>({
        code: '', url: '', db: '', username: '', apiKey: '', companyFilter: '', whatsappNumbers: ''
    });
    const [originalCode, setOriginalCode] = useState<string | null>(null);

    // Password Change State
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwdMessage, setPwdMessage] = useState('');
    
    const DASHBOARD_URL = "https://odoo-lemon.vercel.app/";

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
        setCurrentClient(client);
        setOriginalCode(client.code);
        setIsEditing(true);
    };

    const resetForm = () => {
        setCurrentClient({ code: '', url: '', db: '', username: '', apiKey: '', companyFilter: '', whatsappNumbers: '' });
        setOriginalCode(null);
    };

    const handleChangePassword = (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) { setPwdMessage("No coinciden."); return; }
        changeAdminPassword(newPassword);
        setPwdMessage("¡Actualizada!");
        setTimeout(() => { setIsPasswordModalOpen(false); setPwdMessage(''); }, 1000);
    };

    const handleTestConnection = async (client: ClientConfig) => {
        setTestingClient(client.code);
        setTestResult(null);
        setSimulationResult(null);
        try {
            const odoo = new OdooClient(client.url, client.db, true);
            const uid = await odoo.authenticate(client.username, client.apiKey);
            const companies = await odoo.searchRead(uid, client.apiKey, 'res.company', [], ['name']);
            let found = client.companyFilter === 'ALL' ? companies[0] : companies.find((c: any) => c.name.toUpperCase().includes(client.companyFilter.toUpperCase()));
            setTestResult({
                status: 'success',
                uid,
                companyId: found ? found.id : 'NO ENCONTRADO',
                companyName: found ? found.name : 'NO ENCONTRADO',
                allCompanies: companies,
                whatsappNumbers: client.whatsappNumbers || 'No config.',
                clientConfig: client 
            });
        } catch (error: any) {
            setTestResult({ status: 'error', message: error.message });
        } finally {
            setTestingClient(null);
        }
    };

    const handleSimulateReport = async () => {
        if (!testResult) return;
        setIsSimulating(true);
        const client = testResult.clientConfig;
        try {
            const odoo = new OdooClient(client.url, client.db, true);
            const date = new Date(); date.setDate(date.getDate() - 1);
            const yesterdayStr = date.toLocaleDateString('en-CA');
            const domain: any[] = [['stop_at', '>=', `${yesterdayStr} 00:00:00`], ['stop_at', '<=', `${yesterdayStr} 23:59:59`], ['state', '=', 'closed']];
            if (testResult.companyId !== 'NO ENCONTRADO') domain.push(['company_id', '=', testResult.companyId]);
            const sessions = await odoo.searchRead(testResult.uid, client.apiKey, 'pos.session', domain, ['config_id', 'total_payments_amount', 'cash_register_difference']);
            
            let totalVenta = 0;
            let msg = `📊 *SIMULACRO REPORTE*\n🏢 ${client.code}\n📅 ${yesterdayStr}\n\n`;
            
            if (!sessions || sessions.length === 0) {
                msg += "ℹ️ Sin cierres registrados.";
            } else {
                const sessionIds = sessions.map((s: any) => s.id);
                const payments = await odoo.searchRead(testResult.uid, client.apiKey, 'pos.payment', [['session_id', 'in', sessionIds]], ['session_id', 'amount', 'payment_method_id']);
                sessions.forEach((s: any) => {
                    const tienda = Array.isArray(s.config_id) ? s.config_id[1] : 'Tienda';
                    const venta = s.total_payments_amount || 0;
                    totalVenta += venta;
                    msg += `🏪 *${tienda}*\n💰 Venta: S/ ${venta.toFixed(2)}\n`;
                    const sPayments = payments.filter((p: any) => (Array.isArray(p.session_id) ? p.session_id[0] : p.session_id) === s.id);
                    const methods: any = {};
                    sPayments.forEach((p: any) => {
                        const name = Array.isArray(p.payment_method_id) ? p.payment_method_id[1] : 'Pago';
                        if (!methods[name]) methods[name] = { total: 0, count: 0 };
                        methods[name].total += p.amount; methods[name].count++;
                    });
                    Object.entries(methods).forEach(([name, data]: any) => { msg += `   ${name} (${data.count})\tS/ ${data.total.toFixed(2)}\n`; });
                    if(Math.abs(s.cash_register_difference) > 0.01) msg += `🔴 Dif: S/ ${s.cash_register_difference.toFixed(2)}\n`;
                    msg += `----------------\n`;
                });
                msg += `\n🏆 *TOTAL: S/ ${totalVenta.toFixed(2)}*\n\n🔎 *Ver:* ${DASHBOARD_URL}`;
            }
            setSimulationResult(msg);
        } catch (e: any) { setSimulationResult("Error: " + e.message); }
        finally { setIsSimulating(false); }
    };

    const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); alert("Copiado"); };

    const copyWorkflow = (type: 'daily' | 'monthly') => {
        const json = type === 'daily' ? DAILY_WORKFLOW_JSON : MONTHLY_WORKFLOW_JSON;
        copyToClipboard(JSON.stringify(json, null, 2));
    };

    return (
        <div className="min-h-screen bg-slate-100 font-sans text-slate-800 pb-10">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-lg sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-brand-400" />
                    <h1 className="font-bold text-lg">LEMON BI ADMIN</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsPasswordModalOpen(true)} className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs font-bold uppercase"><Key className="w-4 h-4 inline mr-1"/> Clave</button>
                    <button onClick={onLogout} className="px-3 py-1.5 bg-red-600 rounded-lg text-xs font-bold uppercase"><LogOut className="w-4 h-4 inline mr-1"/> Salir</button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h2 className="text-2xl font-bold">Clientes Configurados</h2>
                        <p className="text-slate-500 text-sm">Gestiona el acceso de las sucursales a Odoo y n8n.</p>
                    </div>
                    <button onClick={() => { resetForm(); setIsEditing(true); }} className="bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow flex items-center gap-2"><Plus className="w-5 h-5" /> Nuevo</button>
                </div>

                <div className="bg-white rounded-2xl shadow overflow-hidden relative min-h-[100px]">
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                            <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
                        </div>
                    )}
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b">
                            <tr>
                                <th className="px-6 py-4">Código</th>
                                <th className="px-6 py-4">Filtro Compañía</th>
                                <th className="px-6 py-4">WhatsApp</th>
                                <th className="px-6 py-4">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {clients.map(c => (
                                <tr key={c.code} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-bold">{c.code}</td>
                                    <td className="px-6 py-4 text-brand-700">{c.companyFilter}</td>
                                    <td className="px-6 py-4 text-xs font-mono">{c.whatsappNumbers || '---'}</td>
                                    <td className="px-6 py-4 flex gap-2">
                                        <button 
                                            onClick={() => handleTestConnection(c)} 
                                            disabled={testingClient === c.code}
                                            className="p-2 bg-emerald-50 text-emerald-600 rounded-lg disabled:opacity-50"
                                            title="Probar Conexión"
                                        >
                                            {testingClient === c.code ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => handleEdit(c)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(c.code)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                            {clients.length === 0 && !isLoading && (
                                <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-400 italic">No hay clientes registrados.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {testResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 bg-slate-50 border-b flex justify-between items-center">
                            <h3 className="font-bold">Datos Técnicos para n8n</h3>
                            <button onClick={() => setTestResult(null)}><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4">
                            {testResult.status === 'success' ? (
                                <>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-slate-50 p-3 rounded-lg"><p className="text-[10px] font-bold text-slate-400">UID ODOO</p><p className="font-mono text-lg">{testResult.uid}</p></div>
                                        <div className="bg-slate-50 p-3 rounded-lg"><p className="text-[10px] font-bold text-slate-400">COMPANY ID</p><p className="font-mono text-lg text-brand-600">{testResult.companyId}</p></div>
                                    </div>
                                    <button onClick={handleSimulateReport} className="w-full bg-slate-800 text-white p-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                                        {isSimulating ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Smartphone className="w-4 h-4" />} Simular Reporte Diario
                                    </button>
                                    {simulationResult && (
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 relative">
                                            <div className="bg-white rounded p-3 text-xs font-mono whitespace-pre-wrap">{simulationResult}</div>
                                            <button onClick={() => copyToClipboard(simulationResult)} className="absolute top-6 right-6 p-1 bg-white shadow-sm border rounded hover:text-brand-600"><Copy className="w-3 h-3"/></button>
                                        </div>
                                    )}
                                    <div className="border-t pt-4">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Integración con n8n</p>
                                        <button onClick={() => copyWorkflow('daily')} className="w-full bg-emerald-600 text-white px-3 py-2.5 rounded-lg font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"><Workflow className="w-3 h-3"/> Copiar JSON Flujo Diario</button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center p-4">
                                    <p className="text-red-500 font-bold mb-2">Error de Conexión</p>
                                    <p className="text-xs text-slate-500">{testResult.message}</p>
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-50 p-4 flex justify-end"><button onClick={() => setTestResult(null)} className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold">Cerrar</button></div>
                    </div>
                </div>
            )}

            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-2xl animate-in zoom-in">
                        <div className="flex justify-between mb-4"><h3 className="font-bold text-lg">{originalCode ? 'Editar' : 'Nuevo'} Cliente</h3><button onClick={() => setIsEditing(false)}><X/></button></div>
                        <form onSubmit={handleSaveClient} className="grid grid-cols-2 gap-4">
                            <div className="col-span-2"><label className="text-xs font-bold text-slate-400">Código Acceso</label><input type="text" className="w-full p-2 bg-slate-50 border rounded uppercase font-bold" value={currentClient.code} onChange={e => setCurrentClient({...currentClient, code: e.target.value.toUpperCase()})} required disabled={!!originalCode}/></div>
                            <div><label className="text-xs font-bold text-slate-400">Filtro Compañía Odoo</label><input type="text" className="w-full p-2 bg-slate-50 border rounded" value={currentClient.companyFilter} onChange={e => setCurrentClient({...currentClient, companyFilter: e.target.value})} required/></div>
                            <div><label className="text-xs font-bold text-slate-400">WhatsApp (Números)</label><input type="text" className="w-full p-2 bg-slate-50 border rounded" value={currentClient.whatsappNumbers} onChange={e => setCurrentClient({...currentClient, whatsappNumbers: e.target.value})}/></div>
                            <div className="col-span-2 border-t pt-2 mt-2"><label className="text-[10px] font-bold text-slate-400">Credenciales Odoo</label></div>
                            <div className="col-span-2"><input type="url" placeholder="URL Odoo" className="w-full p-2 bg-slate-50 border rounded" value={currentClient.url} onChange={e => setCurrentClient({...currentClient, url: e.target.value})} required/></div>
                            <input type="text" placeholder="DB" className="w-full p-2 bg-slate-50 border rounded" value={currentClient.db} onChange={e => setCurrentClient({...currentClient, db: e.target.value})} required/>
                            <input type="text" placeholder="Usuario Técnico" className="w-full p-2 bg-slate-50 border rounded" value={currentClient.username} onChange={e => setCurrentClient({...currentClient, username: e.target.value})} required/>
                            <input type="text" placeholder="API Key" className="w-full col-span-2 p-2 bg-slate-50 border rounded font-mono" value={currentClient.apiKey} onChange={e => setCurrentClient({...currentClient, apiKey: e.target.value})} required/>
                            <div className="col-span-2 flex gap-2 pt-4"><button type="button" onClick={() => setIsEditing(false)} className="flex-1 p-3 bg-slate-100 rounded-xl font-bold">Cancelar</button><button type="submit" disabled={isLoading} className="flex-1 p-3 bg-brand-600 text-white rounded-xl font-bold disabled:opacity-50">{isLoading ? 'Guardando...' : 'Guardar'}</button></div>
                        </form>
                    </div>
                </div>
            )}

            {isPasswordModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in">
                        <div className="flex justify-between mb-4"><h3 className="font-bold text-lg">Cambiar Contraseña Admin</h3><button onClick={() => setIsPasswordModalOpen(false)}><X/></button></div>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div><label className="text-xs font-bold text-slate-400">Nueva Contraseña</label><input type="password" name="new-password" className="w-full p-2 bg-slate-50 border rounded" value={newPassword} onChange={e => setNewPassword(e.target.value)} required/></div>
                            <div><label className="text-xs font-bold text-slate-400">Confirmar Contraseña</label><input type="password" name="confirm-password" className="w-full p-2 bg-slate-50 border rounded" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required/></div>
                            {pwdMessage && <p className={`text-xs font-bold ${pwdMessage.includes('!') ? 'text-emerald-600' : 'text-red-600'}`}>{pwdMessage}</p>}
                            <div className="flex gap-2 pt-4"><button type="button" onClick={() => setIsPasswordModalOpen(false)} className="flex-1 p-3 bg-slate-100 rounded-xl font-bold">Cancelar</button><button type="submit" className="flex-1 p-3 bg-slate-900 text-white rounded-xl font-bold">Actualizar</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
