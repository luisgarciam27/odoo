import React, { useState, useEffect } from 'react';
import { getClients, saveClients, changeAdminPassword } from '../services/clientManager';
import { ClientConfig } from '../types';
import { Trash2, Edit, Plus, Save, X, LogOut, Key, Shield, Building2, Eye, EyeOff, Activity, CheckCircle, AlertTriangle, Copy, MessageSquare, ExternalLink } from 'lucide-react';
import { OdooClient } from '../services/odoo';

interface AdminDashboardProps {
    onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
    const [clients, setClients] = useState<ClientConfig[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
    
    // Test Connection State
    const [testingClient, setTestingClient] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<any | null>(null);

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

    useEffect(() => {
        setClients(getClients());
    }, []);

    const handleSaveClient = (e: React.FormEvent) => {
        e.preventDefault();
        let updatedClients = [...clients];

        if (originalCode) {
            // Edit existing
            updatedClients = updatedClients.map(c => c.code === originalCode ? currentClient : c);
        } else {
            // Add new (check for duplicate code)
            if (updatedClients.some(c => c.code === currentClient.code)) {
                alert("El código de empresa ya existe.");
                return;
            }
            updatedClients.push(currentClient);
        }

        saveClients(updatedClients);
        setClients(updatedClients);
        setIsEditing(false);
        resetForm();
    };

    const handleDelete = (code: string) => {
        if (confirm(`¿Estás seguro de eliminar al cliente ${code}?`)) {
            const updated = clients.filter(c => c.code !== code);
            saveClients(updated);
            setClients(updated);
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
        if (newPassword !== confirmPassword) {
            setPwdMessage("Las contraseñas no coinciden.");
            return;
        }
        if (newPassword.length < 4) {
            setPwdMessage("La contraseña es muy corta.");
            return;
        }
        changeAdminPassword(newPassword);
        setPwdMessage("¡Contraseña actualizada correctamente!");
        setTimeout(() => {
            setIsPasswordModalOpen(false);
            setPwdMessage('');
            setNewPassword('');
            setConfirmPassword('');
        }, 1000);
    };

    const toggleKeyVisibility = (code: string) => {
        setShowApiKey(prev => ({ ...prev, [code]: !prev[code] }));
    };

    // --- NEW: Test Connection & Get IDs for n8n ---
    const handleTestConnection = async (client: ClientConfig) => {
        setTestingClient(client.code);
        setTestResult(null);

        try {
            const odoo = new OdooClient(client.url, client.db, true); // useProxy = true
            const uid = await odoo.authenticate(client.username, client.apiKey);
            
            // Buscar datos de compañia para obtener el ID numérico
            const companies = await odoo.searchRead(uid, client.apiKey, 'res.company', [], ['name']);
            
            let foundCompany = null;
            if (client.companyFilter === 'ALL') {
                foundCompany = companies[0];
            } else {
                foundCompany = companies.find((c: any) => 
                    c.name.toUpperCase().includes(client.companyFilter.toUpperCase())
                );
            }

            setTestResult({
                status: 'success',
                uid: uid,
                companyId: foundCompany ? foundCompany.id : 'NO ENCONTRADO',
                companyName: foundCompany ? foundCompany.name : 'NO ENCONTRADO',
                allCompanies: companies,
                whatsappNumbers: client.whatsappNumbers || 'No configurado'
            });

        } catch (error: any) {
            console.error(error);
            setTestResult({
                status: 'error',
                message: error.message || "Error desconocido al conectar."
            });
        } finally {
            setTestingClient(null);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert(`Copiado: ${text}`);
    };

    return (
        <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
            {/* Navbar */}
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-lg sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-500 p-2 rounded-lg"><Shield className="w-5 h-5 text-white" /></div>
                    <div>
                        <h1 className="font-bold text-lg tracking-wide">LEMON BI <span className="text-brand-400">ADMIN</span></h1>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">Panel de Superadministrador</p>
                    </div>
                </div>
                <div className="flex gap-3">
                     <button onClick={() => setIsPasswordModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold uppercase transition-colors">
                        <Key className="w-4 h-4" /> Cambiar Contraseña
                    </button>
                    <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-bold uppercase transition-colors shadow-lg shadow-red-900/50">
                        <LogOut className="w-4 h-4" /> Salir
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6 md:p-8">
                
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Directorio de Clientes</h2>
                        <p className="text-slate-500 text-sm mt-1">Administra las credenciales y obtén datos técnicos para n8n.</p>
                    </div>
                    <button 
                        onClick={() => { resetForm(); setIsEditing(true); }}
                        className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" /> Nuevo Cliente
                    </button>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Código (Acceso)</th>
                                    <th className="px-6 py-4">Filtro Compañía</th>
                                    <th className="px-6 py-4">URL Servidor</th>
                                    <th className="px-6 py-4">WhatsApp Envío</th>
                                    <th className="px-6 py-4">Usuario Técnico</th>
                                    <th className="px-6 py-4">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {clients.map((client) => (
                                    <tr key={client.code} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                {client.code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-brand-700">{client.companyFilter}</td>
                                        <td className="px-6 py-4 text-xs font-mono text-slate-500 truncate max-w-[150px]" title={client.url}>{client.url}</td>
                                        <td className="px-6 py-4">
                                            {client.whatsappNumbers ? (
                                                <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded font-medium truncate max-w-[120px]">
                                                    <MessageSquare className="w-3 h-3" /> {client.whatsappNumbers}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-300 italic">No config.</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs">{client.username}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono bg-slate-100 px-1 rounded text-slate-400">
                                                        {showApiKey[client.code] ? client.apiKey : '••••••••••••'}
                                                    </span>
                                                    <button onClick={() => toggleKeyVisibility(client.code)} className="text-slate-400 hover:text-brand-600">
                                                        {showApiKey[client.code] ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => handleTestConnection(client)} 
                                                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors relative" 
                                                    title="Probar Conexión y Ver IDs para n8n"
                                                    disabled={testingClient === client.code}
                                                >
                                                    {testingClient === client.code ? <Activity className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                                                </button>
                                                <button onClick={() => handleEdit(client)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Editar">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(client.code)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Eliminar">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {clients.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No hay clientes registrados.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal de Resultado de Test (IDs para n8n) */}
            {testResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className={`px-6 py-4 flex justify-between items-center ${testResult.status === 'success' ? 'bg-emerald-50 border-b border-emerald-100' : 'bg-red-50 border-b border-red-100'}`}>
                            <h3 className={`font-bold text-lg flex items-center gap-2 ${testResult.status === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>
                                {testResult.status === 'success' ? <CheckCircle className="w-5 h-5"/> : <AlertTriangle className="w-5 h-5"/>}
                                {testResult.status === 'success' ? 'Datos Técnicos para n8n' : 'Error de Conexión'}
                            </h3>
                            <button onClick={() => setTestResult(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        
                        <div className="p-6">
                            {testResult.status === 'success' ? (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-500 mb-4">
                                        Copia estos valores en tus nodos de n8n para configurar las automatizaciones.
                                    </p>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 relative group">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">User ID (UID)</p>
                                            <p className="font-mono text-xl font-bold text-slate-800">{testResult.uid}</p>
                                            <button onClick={() => copyToClipboard(String(testResult.uid))} className="absolute top-2 right-2 p-1 text-slate-300 hover:text-brand-500"><Copy className="w-4 h-4"/></button>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 relative group">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company ID</p>
                                            <p className="font-mono text-xl font-bold text-brand-600">{testResult.companyId}</p>
                                            <button onClick={() => copyToClipboard(String(testResult.companyId))} className="absolute top-2 right-2 p-1 text-slate-300 hover:text-brand-500"><Copy className="w-4 h-4"/></button>
                                        </div>
                                    </div>

                                    {/* Link Dashboard */}
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 relative group">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Link Dashboard (Para Mensaje)</p>
                                        <p className="font-mono text-sm text-brand-600 truncate pr-6">{DASHBOARD_URL}</p>
                                        <button onClick={() => copyToClipboard(DASHBOARD_URL)} className="absolute top-2 right-2 p-1 text-slate-300 hover:text-brand-500"><Copy className="w-4 h-4"/></button>
                                    </div>

                                    {/* WhatsApp */}
                                    <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 relative">
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                                            <MessageSquare className="w-3 h-3"/> WhatsApp de Envío
                                        </p>
                                        <p className="font-mono text-sm font-bold text-emerald-800 mt-1">{testResult.whatsappNumbers}</p>
                                        <button onClick={() => copyToClipboard(testResult.whatsappNumbers)} className="absolute top-2 right-2 p-1 text-emerald-400 hover:text-emerald-700"><Copy className="w-4 h-4"/></button>
                                    </div>

                                    {testResult.companyId === 'NO ENCONTRADO' && (
                                        <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                                            <strong>Advertencia:</strong> No se encontró una compañía que coincida con el filtro. Revisa la lista de disponibles:
                                            <ul className="mt-1 list-disc list-inside">
                                                {testResult.allCompanies.map((c: any) => (
                                                    <li key={c.id}>{c.name} (ID: {c.id})</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-red-600 font-medium mb-2">{testResult.message}</p>
                                    <p className="text-sm text-slate-500">Verifica la URL, Base de Datos, Usuario o API Key.</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="bg-slate-50 px-6 py-4 flex justify-end">
                            <button onClick={() => setTestResult(null)} className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold text-sm hover:bg-slate-900">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Edit/Create */}
            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">{originalCode ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                            <button onClick={() => setIsEditing(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={handleSaveClient} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Código de Acceso (Único)</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2.5 border border-slate-200 rounded-xl uppercase font-bold text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
                                    value={currentClient.code}
                                    onChange={e => setCurrentClient({...currentClient, code: e.target.value.toUpperCase()})}
                                    required
                                    disabled={!!originalCode} // Cannot change code on edit to avoid breaking keys
                                    placeholder="EJ: NUEVAEMPRESA"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Este es el código que el usuario ingresará en el login.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Filtro Compañía</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <input 
                                        type="text" 
                                        className="w-full pl-9 p-2.5 border border-slate-200 rounded-xl text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
                                        value={currentClient.companyFilter}
                                        onChange={e => setCurrentClient({...currentClient, companyFilter: e.target.value})}
                                        required
                                        placeholder="Ej: Inversiones SAC"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-emerald-600 uppercase mb-1">Números WhatsApp (Alertas)</label>
                                <div className="relative">
                                    <MessageSquare className="absolute left-3 top-2.5 w-4 h-4 text-emerald-500" />
                                    <input 
                                        type="text" 
                                        className="w-full pl-9 p-2.5 border border-emerald-200 bg-emerald-50/30 rounded-xl text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none placeholder-emerald-800/30"
                                        value={currentClient.whatsappNumbers || ''}
                                        onChange={e => setCurrentClient({...currentClient, whatsappNumbers: e.target.value})}
                                        placeholder="51999999, 51888888"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Base de Datos (DB)</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
                                    value={currentClient.db}
                                    onChange={e => setCurrentClient({...currentClient, db: e.target.value})}
                                    required
                                    placeholder="nombre_db"
                                />
                            </div>

                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL Odoo</label>
                                <input 
                                    type="url" 
                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
                                    value={currentClient.url}
                                    onChange={e => setCurrentClient({...currentClient, url: e.target.value})}
                                    required
                                    placeholder="https://..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Usuario Técnico</label>
                                <input 
                                    type="email" 
                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
                                    value={currentClient.username}
                                    onChange={e => setCurrentClient({...currentClient, username: e.target.value})}
                                    required
                                    placeholder="admin@..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">API Key</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none font-mono"
                                    value={currentClient.apiKey}
                                    onChange={e => setCurrentClient({...currentClient, apiKey: e.target.value})}
                                    required
                                    placeholder="Hash..."
                                />
                            </div>

                            <div className="col-span-1 md:col-span-2 pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 shadow-md flex items-center justify-center gap-2">
                                    <Save className="w-4 h-4" /> Guardar Cliente
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Password */}
            {isPasswordModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                     <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 p-6">
                        <h3 className="font-bold text-lg text-slate-800 mb-4">Cambiar Contraseña Admin</h3>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <input 
                                type="password" 
                                placeholder="Nueva Contraseña"
                                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                required
                            />
                            <input 
                                type="password" 
                                placeholder="Confirmar Contraseña"
                                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                            />
                            {pwdMessage && <p className={`text-xs font-bold ${pwdMessage.includes('correctamente') ? 'text-green-600' : 'text-red-500'}`}>{pwdMessage}</p>}
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="flex-1 py-2 text-slate-500 font-medium">Cancelar</button>
                                <button type="submit" className="flex-1 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900">Actualizar</button>
                            </div>
                        </form>
                     </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
