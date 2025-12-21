
import React, { useState, useEffect } from 'react';
import { getClients, saveClient, deleteClient, changeAdminPassword } from '../services/clientManager';
import { ClientConfig } from '../types';
import { Trash2, Edit, Plus, X, LogOut, Key, Shield, Activity, RefreshCw, Smartphone, Copy, Workflow, Send, CheckCircle2, PauseCircle, Bell, Settings, Calendar } from 'lucide-react';
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
    
    const [testingClient, setTestingClient] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<any | null>(null);
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationResult, setSimulationResult] = useState<string | null>(null);
    const [isSendingTest, setIsSendingTest] = useState(false);

    const [currentClient, setCurrentClient] = useState<ClientConfig>({
        code: '', url: '', db: '', username: '', apiKey: '', companyFilter: '', whatsappNumbers: '', isActive: true
    });
    const [originalCode, setOriginalCode] = useState<string | null>(null);

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwdMessage, setPwdMessage] = useState('');

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
        setCurrentClient({ code: '', url: '', db: '', username: '', apiKey: '', companyFilter: '', whatsappNumbers: '', isActive: true });
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
                whatsappNumbers: client.whatsappNumbers || '',
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
            const sessions = await odoo.searchRead(testResult.uid, client.apiKey, 'pos.session', domain, ['name', 'cash_register_balance_end_real', 'cash_register_balance_start']);
            
            let totalVenta = 0;
            let msg = `📊 *REPORTE DE CAJA - LEMONBI*\n🏢 *${client.code}*\n📅 ${yesterdayStr}\n\n`;
            
            if (!sessions || sessions.length === 0) {
                msg += "⚠️ No se registraron sesiones de caja cerradas para esta fecha.";
            } else {
                sessions.forEach((s: any) => {
                    const start = s.cash_register_balance_start || 0;
                    const end = s.cash_register_balance_end_real || 0;
                    const neta = end - start;
                    totalVenta += neta;
                    msg += `📍 *${s.name}*\n   • Venta: S/ ${neta.toFixed(2)}\n   • Arqueo: S/ ${end.toFixed(2)}\n\n`;
                });
                msg += `💰 *TOTAL VENTA NETA: S/ ${totalVenta.toFixed(2)}*`;
            }
            setSimulationResult(msg);
        } catch (e: any) { setSimulationResult("Error: " + e.message); }
        finally { setIsSimulating(false); }
    };

    const handleSendTestWhatsApp = async () => {
        if (!simulationResult || !testResult?.whatsappNumbers) {
            alert("Primero simula un reporte y asegura tener números configurados.");
            return;
        }
        setIsSendingTest(true);
        const rawNumbers = testResult.whatsappNumbers.split(',').map((n: string) => n.trim().replace(/\D/g, ''));
        const numbers = rawNumbers.filter((n: string) => n.length >= 9);
        
        if (numbers.length === 0) {
            alert("❌ No hay números válidos configurados.");
            setIsSendingTest(false);
            return;
        }

        try {
            let successCount = 0;
            for (const num of numbers) {
                const targetUrl = 'https://api.red51.site/message/sendText/chatbot';
                // Usamos un proxy de respaldo más agresivo para peticiones POST
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
                
                try {
                    const response = await fetch(proxyUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ number: num, text: simulationResult })
                    });
                    if (response.ok) successCount++;
                } catch (innerE) {
                    // Si falla el proxy, intentamos directo (puede fallar por CORS, pero a veces pasa)
                    await fetch(targetUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ number: num, text: simulationResult })
                    });
                    successCount++;
                }
            }
            alert(`✅ Mensaje enviado a ${successCount} destinatarios.`);
        } catch (e) {
            console.error("Error sending WhatsApp:", e);
            alert("❌ Error crítico al enviar. Verifique la API de Red51.");
        } finally {
            setIsSendingTest(false);
        }
    };

    const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); alert("Copiado al portapapeles"); };
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
                    <button onClick={() => setIsPasswordModalOpen(true)} className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs font-bold uppercase transition-colors hover:bg-slate-700"><Key className="w-4 h-4 inline mr-1"/> Clave</button>
                    <button onClick={onLogout} className="px-3 py-1.5 bg-red-600 rounded-lg text-xs font-bold uppercase transition-colors hover:bg-red-700"><LogOut className="w-4 h-4 inline mr-1"/> Salir</button>
                </div>
            </div>
            <div className="max-w-7xl mx-auto p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900">Gestión de Clientes y Flujos</h2>
                        <p className="text-slate-500 text-sm mt-1">Administra quién recibe los reportes y configura la conexión con Odoo.</p>
                    </div>
                    <button onClick={() => { resetForm(); setIsEditing(true); }} className="bg-brand-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-xl shadow-brand-200 flex items-center gap-2 transition-all hover:bg-brand-700 hover:scale-[1.02] active:scale-95"><Plus className="w-5 h-5" /> Registrar Nueva Empresa</button>
                </div>
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden relative">
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                            <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
                        </div>
                    )}
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-bold border-b tracking-widest">
                            <tr>
                                <th className="px-8 py-5">Reportes</th>
                                <th className="px-8 py-5">Código Empresa</th>
                                <th className="px-8 py-5">Filtro Compañía</th>
                                <th className="px-8 py-5">Destinatarios</th>
                                <th className="px-8 py-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {clients.map(c => (
                                <tr key={c.code} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-8 py-5">
                                        {c.isActive ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">
                                                <CheckCircle2 className="w-3.5 h-3.5"/> Activo
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 uppercase">
                                                <PauseCircle className="w-3.5 h-3.5"/> Pausado
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5 font-bold text-slate-900 text-base">{c.code}</td>
                                    <td className="px-8 py-5 text-slate-500 italic">{c.companyFilter}</td>
                                    <td className="px-8 py-5">
                                        <div className="flex flex-wrap gap-1.5">
                                            {c.whatsappNumbers ? c.whatsappNumbers.split(',').map((n, i) => (
                                                <span key={i} className="px-2 py-1 bg-brand-50 text-brand-700 rounded-lg text-[10px] font-mono border border-brand-100">{n.trim()}</span>
                                            )) : <span className="text-slate-300 text-xs italic">Sin destinatarios</span>}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 flex justify-end gap-3">
                                        <button onClick={() => handleTestConnection(c)} disabled={testingClient === c.code} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-brand-50 hover:text-brand-600 transition-all">
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
            {testResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
                        <div className="px-8 py-6 bg-slate-50 border-b flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-xl text-slate-800">Verificador de Reporte</h3>
                                <p className="text-[10px] text-brand-600 font-bold uppercase tracking-widest mt-0.5">Cliente: {testResult.clientConfig.code}</p>
                            </div>
                            <button onClick={() => setTestResult(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X className="w-6 h-6"/></button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-6">
                            {testResult.status === 'success' ? (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                                            <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1 tracking-wider">Conexión Odoo</p>
                                            <p className="font-bold text-emerald-900">EXITOSA ✅</p>
                                        </div>
                                        <div className="bg-brand-50 p-4 rounded-2xl border border-brand-100">
                                            <p className="text-[10px] font-bold text-brand-600 uppercase mb-1 tracking-wider">ID Compañía</p>
                                            <p className="font-bold text-slate-800">{testResult.companyId}</p>
                                        </div>
                                    </div>
                                    <button onClick={handleSimulateReport} disabled={isSimulating} className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-black transition-all shadow-lg active:scale-95">
                                        {isSimulating ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Smartphone className="w-5 h-5" />} 
                                        Generar Vista Previa del Mensaje
                                    </button>
                                    {simulationResult && (
                                        <div className="animate-in slide-in-from-top-4 duration-500">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Smartphone className="w-3 h-3"/> Simulación de WhatsApp:</p>
                                                <button onClick={() => copyToClipboard(simulationResult)} className="text-[10px] font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"><Copy className="w-3 h-3"/> Copiar</button>
                                            </div>
                                            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 shadow-inner">
                                                <div className="bg-white rounded-xl p-4 text-[13px] font-mono whitespace-pre-wrap shadow-sm text-slate-700 border border-emerald-50/50 leading-relaxed">{simulationResult}</div>
                                                <div className="mt-5 space-y-3">
                                                    <button onClick={handleSendTestWhatsApp} disabled={isSendingTest} className="w-full p-3.5 bg-brand-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-brand-600 shadow-lg shadow-brand-100 transition-all disabled:opacity-50">
                                                        {isSendingTest ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>} ENVIAR PRUEBA REAL AHORA
                                                    </button>
                                                    <p className="text-[9px] text-brand-600 text-center font-bold uppercase tracking-wider">Se enviará a: {testResult.whatsappNumbers || 'Sin números'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="pt-6 border-t border-slate-100">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Workflow className="w-4 h-4 text-emerald-500" />
                                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Integración N8N</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <button onClick={() => copyWorkflow('daily')} className="bg-white border border-slate-200 text-slate-700 px-4 py-3 rounded-xl font-bold text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                                                <Copy className="w-4 h-4 text-slate-400"/> JSON Flujo Diario
                                            </button>
                                            <button onClick={() => copyWorkflow('monthly')} className="bg-white border border-slate-200 text-slate-700 px-4 py-3 rounded-xl font-bold text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                                                <Calendar className="w-4 h-4 text-slate-400"/> JSON Flujo Mensual
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="p-10 text-center bg-red-50 rounded-3xl border border-red-100">
                                    <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner"><X className="w-8 h-8"/></div>
                                    <h4 className="font-bold text-red-800 mb-2">Error de Conexión</h4>
                                    <p className="text-sm text-red-600/80 font-medium leading-relaxed">{testResult.message}</p>
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-50 p-6 flex gap-3 border-t border-slate-100">
                            <button onClick={() => setTestResult(null)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors">Entendido</button>
                        </div>
                    </div>
                </div>
            )}
            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl animate-in zoom-in duration-300">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="font-bold text-3xl text-slate-900">{originalCode ? 'Configuración de Empresa' : 'Nueva Integración'}</h3>
                                <p className="text-slate-500 text-sm mt-1">Administra el envío de reportes y las credenciales de Odoo.</p>
                            </div>
                            <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X/></button>
                        </div>
                        <form onSubmit={handleSaveClient} className="space-y-8">
                            <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <Bell className="w-5 h-5 text-brand-600" />
                                    <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wider">Control de Notificaciones</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Código Identificador</label>
                                        <input type="text" className="w-full p-3.5 bg-white border border-slate-200 rounded-xl uppercase font-bold text-slate-800 focus:ring-4 focus:ring-brand-100 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400" value={currentClient.code} onChange={e => setCurrentClient({...currentClient, code: e.target.value.toUpperCase()})} required disabled={!!originalCode} placeholder="EJ: FEETCARE"/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Estado del Servicio</label>
                                        <div className={`flex items-center gap-3 p-3.5 rounded-xl border transition-colors ${currentClient.isActive ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-300 opacity-70'}`}>
                                            <input type="checkbox" id="isActive" checked={currentClient.isActive} onChange={e => setCurrentClient({...currentClient, isActive: e.target.checked})} className="w-6 h-6 accent-emerald-500 cursor-pointer"/>
                                            <label htmlFor="isActive" className={`text-sm font-bold cursor-pointer ${currentClient.isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                {currentClient.isActive ? 'Reportes Habilitados' : 'Servicio en Pausa'}
                                            </label>
                                        </div>
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Números de WhatsApp</label>
                                        <div className="relative group">
                                            <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-500" />
                                            <input type="text" placeholder="Ej: 51987654321, 51900111222" className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-100 outline-none transition-all font-mono text-sm" value={currentClient.whatsappNumbers} onChange={e => setCurrentClient({...currentClient, whatsappNumbers: e.target.value})}/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <Settings className="w-5 h-5 text-slate-400" />
                                    <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wider">Configuración Técnica</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="col-span-1 md:col-span-2">
                                        <input type="url" placeholder="URL del Servidor" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-brand-100 transition-all text-sm" value={currentClient.url} onChange={e => setCurrentClient({...currentClient, url: e.target.value})} required/>
                                    </div>
                                    <input type="text" placeholder="Base de Datos" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={currentClient.db} onChange={e => setCurrentClient({...currentClient, db: e.target.value})} required/>
                                    <input type="text" placeholder="Filtro de Compañía" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={currentClient.companyFilter} onChange={e => setCurrentClient({...currentClient, companyFilter: e.target.value})} required/>
                                    <input type="text" placeholder="Usuario" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={currentClient.username} onChange={e => setCurrentClient({...currentClient, username: e.target.value})} required/>
                                    <input type="password" placeholder="API Key" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono tracking-widest" value={currentClient.apiKey} onChange={e => setCurrentClient({...currentClient, apiKey: e.target.value})} required/>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-6">
                                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 p-4 bg-slate-100 text-slate-600 rounded-2xl font-bold transition-all hover:bg-slate-200">Cancelar</button>
                                <button type="submit" disabled={isLoading} className="flex-[2] p-4 bg-brand-600 text-white rounded-2xl font-bold shadow-xl shadow-brand-100 transition-all hover:bg-brand-700 hover:scale-[1.01] active:scale-95 disabled:opacity-50">
                                    {isLoading ? 'Guardando cambios...' : 'Guardar y Aplicar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {isPasswordModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2rem] w-full max-sm p-10 shadow-2xl animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="font-bold text-2xl text-slate-800">Clave Maestra</h3>
                            <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-300 hover:text-slate-600 transition-colors"><X/></button>
                        </div>
                        <form onSubmit={handleChangePassword} className="space-y-5">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-widest">Nueva Contraseña</label>
                                <input type="password" name="new-password" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-brand-100 transition-all" value={newPassword} onChange={e => setNewPassword(e.target.value)} required/>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-widest">Confirmar Contraseña</label>
                                <input type="password" name="confirm-password" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-brand-100 transition-all" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required/>
                            </div>
                            {pwdMessage && <p className={`text-xs font-bold text-center p-3 rounded-xl ${pwdMessage.includes('!') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{pwdMessage}</p>}
                            <div className="flex gap-2 pt-6">
                                <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="flex-1 py-3.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                                <button type="submit" className="flex-[2] py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-black shadow-lg transition-all">Actualizar Clave</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
