
import React, { useState, useEffect } from 'react';
import { getClients, saveClient, deleteClient } from '../services/clientManager';
import { ClientConfig } from '../types';
import { Trash2, Edit, Plus, X, LogOut, Shield, Activity, RefreshCw, Copy, ShoppingBag, ExternalLink, Facebook, Instagram, MessageCircle, Sparkles, Wand2 } from 'lucide-react';
import { OdooClient } from '../services/odoo';
import { GoogleGenAI, Type } from "@google/genai";

interface AdminDashboardProps {
    onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
    const [clients, setClients] = useState<ClientConfig[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isGeneratingPalette, setIsGeneratingPalette] = useState(false);
    
    const [testingClient, setTestingClient] = useState<string | null>(null);

    const [currentClient, setCurrentClient] = useState<ClientConfig>({
        code: '', url: '', db: '', username: '', apiKey: '', companyFilter: '', whatsappNumbers: '', isActive: true,
        nombreComercial: '', logoUrl: '', colorPrimario: '#84cc16', colorSecundario: '#1e293b', colorAcento: '#0ea5e9',
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

    const handleSuggestPalette = async () => {
        if (!currentClient.logoUrl) {
            alert("Primero ingresa la URL de un logo para analizar.");
            return;
        }

        setIsGeneratingPalette(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Analiza la identidad de marca '${currentClient.nombreComercial || currentClient.code}' basándote en este logo: ${currentClient.logoUrl}. 
                Genera una paleta de 3 colores hexadecimales (Primario, Secundario, Acento) que armonicen con el logo y una breve descripción de marca de una línea para el footer.`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            primary: { type: Type.STRING, description: "Color principal de la marca" },
                            secondary: { type: Type.STRING, description: "Color secundario para fondos oscuros" },
                            accent: { type: Type.STRING, description: "Color de acento para botones" },
                            footerDescription: { type: Type.STRING, description: "Eslogan o descripción corta" }
                        },
                        required: ["primary", "secondary", "accent", "footerDescription"]
                    }
                }
            });

            const data = JSON.parse(response.text || '{}');
            setCurrentClient(prev => ({
                ...prev,
                colorPrimario: data.primary,
                colorSecundario: data.secondary,
                colorAcento: data.accent,
                footer_description: data.footerDescription
            }));
        } catch (error) {
            console.error("AI Error:", error);
            alert("No se pudo analizar el logo. Verifica que la URL sea pública o introduce los colores manualmente.");
        } finally {
            setIsGeneratingPalette(false);
        }
    };

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
          colorPrimario: client.colorPrimario || '#84cc16',
          colorSecundario: client.colorSecundario || '#1e293b',
          colorAcento: client.colorAcento || '#0ea5e9'
        });
        setOriginalCode(client.code);
        setIsEditing(true);
    };

    const resetForm = () => {
        setCurrentClient({ 
            code: '', url: '', db: '', username: '', apiKey: '', companyFilter: '', whatsappNumbers: '', isActive: true, 
            nombreComercial: '', logoUrl: '', colorPrimario: '#84cc16', colorSecundario: '#1e293b', colorAcento: '#0ea5e9',
            showStore: true, tiendaCategoriaNombre: 'Catalogo', yapeNumber: '', yapeName: '', plinNumber: '', plinName: '', yapeQR: '', plinQR: '', 
            footer_description: '', facebook_url: '', instagram_url: '', tiktok_url: '', quality_text: '', support_text: '' 
        });
        setOriginalCode(null);
    };

    const copyStoreLink = (code: string) => {
        const baseUrl = window.location.origin + window.location.pathname;
        const fullUrl = `${baseUrl}?shop=${code}`;
        navigator.clipboard.writeText(fullUrl);
        alert(`Link copiado: ${fullUrl}`);
    };

    const handleTestConnection = async (client: ClientConfig) => {
        setTestingClient(client.code);
        try {
            const odoo = new OdooClient(client.url, client.db, true);
            const uid = await odoo.authenticate(client.username, client.apiKey);
            const categoryName = client.tiendaCategoriaNombre || 'Catalogo';
            const categories = await odoo.searchRead(uid, client.apiKey, 'product.category', [['name', 'ilike', categoryName]], ['id', 'name']);
            alert(`Conexión OK. Categoría '${categoryName}' ${categories.length > 0 ? '✓' : '⚠'}`);
        } catch (error: any) {
            alert("Error: " + error.message);
        } finally {
            setTestingClient(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 font-sans text-slate-800 pb-10">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-lg sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-brand-400" />
                    <h1 className="font-bold text-lg uppercase tracking-tight">Lemon BI Admin</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={onLogout} className="px-3 py-1.5 bg-red-600 rounded-lg text-xs font-bold uppercase hover:bg-red-700 transition-colors"><LogOut className="w-4 h-4 inline mr-1"/> Salir</button>
                </div>
            </div>
            
            <div className="max-w-7xl mx-auto p-6">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Gestión de Marcas</h2>
                        <p className="text-slate-500 text-sm mt-1 font-medium">Configura identidades visuales inteligentes.</p>
                    </div>
                    <button onClick={() => { resetForm(); setIsEditing(true); }} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-xl flex items-center gap-2 hover:bg-slate-800 transition-all"><Plus className="w-5 h-5" /> Nueva Marca</button>
                </div>
                
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black border-b tracking-widest">
                            <tr>
                                <th className="px-8 py-5">Sucursal / Empresa</th>
                                <th className="px-8 py-5">Estatus Tienda</th>
                                <th className="px-8 py-5">Identidad</th>
                                <th className="px-8 py-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {clients.map(c => (
                                <tr key={c.code} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="font-bold text-slate-900">{c.code}</div>
                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[200px]">{c.url}</div>
                                    </td>
                                    <td className="px-8 py-5">
                                        {c.showStore ? (
                                            <div className="flex flex-col gap-1">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-brand-100 text-brand-700 uppercase">
                                                    <ShoppingBag className="w-3.5 h-3.5"/> Activo
                                                </span>
                                                <button onClick={() => copyStoreLink(c.code)} className="text-[9px] text-brand-600 font-bold hover:underline">Copiar Link</button>
                                            </div>
                                        ) : <span className="text-slate-300 text-[10px] font-black uppercase">Inactivo</span>}
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            <div className="flex -space-x-1">
                                                <div className="w-4 h-4 rounded-full border border-white shadow-sm" style={{backgroundColor: c.colorPrimario}} title="P"></div>
                                                <div className="w-4 h-4 rounded-full border border-white shadow-sm" style={{backgroundColor: c.colorSecundario}} title="S"></div>
                                            </div>
                                            <span className="text-[11px] font-bold text-slate-600 uppercase truncate max-w-[120px]">{c.nombreComercial}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 flex justify-end gap-2">
                                        <button onClick={() => window.open(`?shop=${c.code}`, '_blank')} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:text-brand-600 hover:bg-brand-50 transition-all"><ExternalLink className="w-4 h-4" /></button>
                                        <button onClick={() => handleTestConnection(c)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:text-blue-600 hover:bg-blue-50 transition-all">{testingClient === c.code ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}</button>
                                        <button onClick={() => handleEdit(c)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:text-indigo-600 hover:bg-indigo-50 transition-all"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(c.code)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:text-red-600 hover:bg-red-50 transition-all"><Trash2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-5xl p-8 shadow-2xl animate-in zoom-in duration-200 relative my-10">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="font-black text-2xl text-slate-900 uppercase tracking-tight">{originalCode ? 'Configurar Marca' : 'Nueva Marca'}</h3>
                                <p className="text-slate-500 text-xs font-medium mt-1 uppercase tracking-widest">Identidad Visual e Integración Odoo</p>
                            </div>
                            <button onClick={() => setIsEditing(false)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-all"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <form onSubmit={handleSaveClient} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                                    <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Acceso Servidor Odoo</h4>
                                    <input type="text" className="w-full p-4 bg-white border border-slate-200 rounded-2xl uppercase font-black text-xs" value={currentClient.code} onChange={e => setCurrentClient({...currentClient, code: e.target.value.toUpperCase()})} required disabled={!!originalCode} placeholder="CÓDIGO SUCURSAL (EJ: BOTICAS)"/>
                                    <input type="url" placeholder="URL Servidor" className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs outline-none" value={currentClient.url} onChange={e => setCurrentClient({...currentClient, url: e.target.value})} required/>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input type="text" placeholder="Base de Datos" className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs outline-none" value={currentClient.db} onChange={e => setCurrentClient({...currentClient, db: e.target.value})} required/>
                                        <input type="text" placeholder="Filtro de Empresa" className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs outline-none" value={currentClient.companyFilter} onChange={e => setCurrentClient({...currentClient, companyFilter: e.target.value})} required/>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input type="text" placeholder="Usuario" className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs outline-none" value={currentClient.username} onChange={e => setCurrentClient({...currentClient, username: e.target.value})} required/>
                                        <input type="password" placeholder="API Key" className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs outline-none font-mono" value={currentClient.apiKey} onChange={e => setCurrentClient({...currentClient, apiKey: e.target.value})} required/>
                                    </div>
                                </div>
                                
                                <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 space-y-4">
                                    <h4 className="font-black text-[10px] text-blue-600 uppercase tracking-widest">Canales y Soporte</h4>
                                    <div className="relative">
                                        <MessageCircle className="absolute left-4 top-4 w-4 h-4 text-emerald-500"/>
                                        <input type="text" placeholder="WhatsApp (51987654321)" className="w-full pl-11 pr-4 py-4 bg-white border border-blue-100 rounded-2xl text-xs outline-none font-bold" value={currentClient.whatsappNumbers} onChange={e => setCurrentClient({...currentClient, whatsappNumbers: e.target.value})}/>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="relative">
                                            <Facebook className="absolute left-3 top-3 w-4 h-4 text-blue-600"/>
                                            <input type="url" placeholder="Facebook URL" className="w-full pl-10 pr-3 py-3 bg-white border border-blue-100 rounded-2xl text-[10px] outline-none" value={currentClient.facebook_url} onChange={e => setCurrentClient({...currentClient, facebook_url: e.target.value})}/>
                                        </div>
                                        <div className="relative">
                                            <Instagram className="absolute left-3 top-3 w-4 h-4 text-pink-500"/>
                                            <input type="url" placeholder="Instagram URL" className="w-full pl-10 pr-3 py-3 bg-white border border-blue-100 rounded-2xl text-[10px] outline-none" value={currentClient.instagram_url} onChange={e => setCurrentClient({...currentClient, instagram_url: e.target.value})}/>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-brand-50/30 p-6 rounded-[2rem] border border-brand-100 space-y-5">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-black text-[10px] text-brand-600 uppercase tracking-widest flex items-center gap-2">✨ Identidad IA</h4>
                                        <Sparkles className="w-4 h-4 text-brand-500" />
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <input type="text" placeholder="Nombre Comercial" className="w-full p-4 bg-white border border-brand-100 rounded-2xl outline-none text-xs font-black uppercase" value={currentClient.nombreComercial} onChange={e => setCurrentClient({...currentClient, nombreComercial: e.target.value})}/>
                                        <input type="url" placeholder="URL Logo para Análisis IA" className="w-full p-4 bg-white border border-brand-100 rounded-2xl outline-none text-[10px]" value={currentClient.logoUrl} onChange={e => setCurrentClient({...currentClient, logoUrl: e.target.value})}/>
                                        
                                        <button 
                                            type="button" 
                                            onClick={handleSuggestPalette} 
                                            disabled={isGeneratingPalette || !currentClient.logoUrl}
                                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-slate-800 disabled:opacity-50 transition-all"
                                        >
                                            {isGeneratingPalette ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4"/>}
                                            Generar Identidad con IA
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1 block">Primario</label>
                                            <div className="flex items-center gap-2">
                                                <input type="color" className="w-10 h-10 rounded-lg cursor-pointer border-none" value={currentClient.colorPrimario} onChange={e => setCurrentClient({...currentClient, colorPrimario: e.target.value})}/>
                                                <span className="text-[9px] font-mono text-slate-400">{currentClient.colorPrimario}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1 block">Secundario</label>
                                            <div className="flex items-center gap-2">
                                                <input type="color" className="w-10 h-10 rounded-lg cursor-pointer border-none" value={currentClient.colorSecundario} onChange={e => setCurrentClient({...currentClient, colorSecundario: e.target.value})}/>
                                                <span className="text-[9px] font-mono text-slate-400">{currentClient.colorSecundario}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1 block">Acento</label>
                                            <div className="flex items-center gap-2">
                                                <input type="color" className="w-10 h-10 rounded-lg cursor-pointer border-none" value={currentClient.colorAcento} onChange={e => setCurrentClient({...currentClient, colorAcento: e.target.value})}/>
                                                <span className="text-[9px] font-mono text-slate-400">{currentClient.colorAcento}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Eslogan / Footer</label>
                                        <textarea placeholder="Descripción generada por IA..." className="w-full p-4 bg-white border border-brand-100 rounded-2xl outline-none text-xs h-20 leading-relaxed font-medium" value={currentClient.footer_description} onChange={e => setCurrentClient({...currentClient, footer_description: e.target.value})} />
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-2 flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsEditing(false)} className="px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                                <button type="submit" disabled={isLoading} className="px-12 py-4 bg-brand-600 text-white rounded-2xl font-black shadow-xl shadow-brand-100 hover:bg-brand-700 active:scale-95 transition-all uppercase text-[10px] tracking-widest">
                                    {isLoading ? 'Publicando...' : 'Guardar Cambios'}
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
