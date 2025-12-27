
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
        } catch (err) {
            console.error("Error cargando clientes:", err);
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
            // Acceso directo a la variable definida por Vite
            const apiKey = process.env.API_KEY || '';
            if (!apiKey) throw new Error("API_KEY no configurada.");

            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Analiza visualmente la marca '${currentClient.nombreComercial || currentClient.code}' basándote en su logo (${currentClient.logoUrl}). Sugiere una paleta de 3 colores hexadecimales que armonicen con el logo y una breve descripción de marca para el footer. Responde estrictamente en JSON.`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            primary: { type: Type.STRING },
                            secondary: { type: Type.STRING },
                            accent: { type: Type.STRING },
                            footerDescription: { type: Type.STRING }
                        },
                        required: ["primary", "secondary", "accent", "footerDescription"]
                    }
                }
            });

            const text = response.text;
            if (!text) throw new Error("La IA no devolvió contenido.");
            
            try {
                const data = JSON.parse(text);
                setCurrentClient(prev => ({
                    ...prev,
                    colorPrimario: data.primary || prev.colorPrimario,
                    colorSecundario: data.secondary || prev.colorSecundario,
                    colorAcento: data.accent || prev.colorAcento,
                    footer_description: data.footerDescription || prev.footer_description
                }));
            } catch (jsonErr) {
                console.error("Error parseando respuesta de IA:", text);
                alert("La IA devolvió un formato inesperado. Intenta de nuevo.");
            }
        } catch (error: any) {
            console.error("AI Error:", error);
            alert("Error de IA: " + error.message);
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
        setCurrentClient({ ...client });
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
        const fullUrl = `${window.location.origin}${window.location.pathname}?shop=${code}`;
        navigator.clipboard.writeText(fullUrl);
        alert(`Link copiado: ${fullUrl}`);
    };

    const handleTestConnection = async (client: ClientConfig) => {
        setTestingClient(client.code);
        try {
            const odoo = new OdooClient(client.url, client.db, true);
            const uid = await odoo.authenticate(client.username, client.apiKey);
            alert(`Conexión Exitosa. UID: ${uid}`);
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
                    <h1 className="font-bold text-lg uppercase tracking-tighter">Lemon BI Admin</h1>
                </div>
                <button onClick={onLogout} className="px-3 py-1.5 bg-red-600 rounded-lg text-xs font-bold uppercase hover:bg-red-700 transition-colors">
                  <LogOut className="w-4 h-4 inline mr-1"/> Salir
                </button>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Clientes</h2>
                        <p className="text-slate-500 text-sm mt-1">Gestión de marcas e integraciones.</p>
                    </div>
                    <button onClick={() => { resetForm(); setIsEditing(true); }} className="bg-brand-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-xl flex items-center gap-2 hover:bg-brand-700 transition-all">
                      <Plus className="w-5 h-5" /> Nueva Empresa
                    </button>
                </div>
                
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black border-b tracking-widest">
                            <tr>
                                <th className="px-8 py-5">Empresa</th>
                                <th className="px-8 py-5">Estado Catálogo</th>
                                <th className="px-8 py-5">Branding</th>
                                <th className="px-8 py-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {clients.map(c => (
                                <tr key={c.code} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="font-bold text-slate-900">{c.code}</div>
                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.url}</div>
                                    </td>
                                    <td className="px-8 py-5">
                                        {c.showStore ? (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] font-black bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full inline-block w-fit">ACTIVO</span>
                                                <button onClick={() => copyStoreLink(c.code)} className="text-[9px] text-brand-600 font-bold hover:underline">COPIAR LINK</button>
                                            </div>
                                        ) : <span className="text-slate-300 text-[9px] font-bold">INACTIVO</span>}
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex gap-1">
                                            <div className="w-4 h-4 rounded-full" style={{backgroundColor: c.colorPrimario}}></div>
                                            <div className="w-4 h-4 rounded-full" style={{backgroundColor: c.colorSecundario}}></div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 flex justify-end gap-2">
                                        <button onClick={() => handleTestConnection(c)} className="p-2 bg-slate-100 rounded-lg hover:bg-blue-100 transition-colors"><Activity className="w-4 h-4"/></button>
                                        <button onClick={() => handleEdit(c)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"><Edit className="w-4 h-4"/></button>
                                        <button onClick={() => handleDelete(c.code)} className="p-2 bg-slate-100 rounded-lg hover:bg-red-100 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-4xl p-10 shadow-2xl relative my-8">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="font-black text-2xl uppercase">{originalCode ? 'Editar Marca' : 'Nueva Marca'}</h3>
                            <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-100 rounded-full"><X/></button>
                        </div>
                        
                        <form onSubmit={handleSaveClient} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Datos Odoo</label>
                                <input type="text" placeholder="CÓDIGO EMPRESA" className="w-full p-3 border rounded-xl font-bold uppercase" value={currentClient.code} onChange={e => setCurrentClient({...currentClient, code: e.target.value.toUpperCase()})} required disabled={!!originalCode}/>
                                <input type="url" placeholder="URL ODOO" className="w-full p-3 border rounded-xl" value={currentClient.url} onChange={e => setCurrentClient({...currentClient, url: e.target.value})} required/>
                                <input type="text" placeholder="BASE DE DATOS" className="w-full p-3 border rounded-xl" value={currentClient.db} onChange={e => setCurrentClient({...currentClient, db: e.target.value})} required/>
                                <input type="text" placeholder="USUARIO" className="w-full p-3 border rounded-xl" value={currentClient.username} onChange={e => setCurrentClient({...currentClient, username: e.target.value})} required/>
                                <input type="password" placeholder="API KEY" className="w-full p-3 border rounded-xl font-mono" value={currentClient.apiKey} onChange={e => setCurrentClient({...currentClient, apiKey: e.target.value})} required/>
                            </div>

                            <div className="space-y-4">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identidad Visual</label>
                                <input type="text" placeholder="NOMBRE COMERCIAL" className="w-full p-3 border rounded-xl uppercase font-bold" value={currentClient.nombreComercial} onChange={e => setCurrentClient({...currentClient, nombreComercial: e.target.value})}/>
                                <div className="flex gap-2">
                                  <input type="url" placeholder="URL LOGO" className="flex-1 p-3 border rounded-xl text-xs" value={currentClient.logoUrl} onChange={e => setCurrentClient({...currentClient, logoUrl: e.target.value})}/>
                                  <button type="button" onClick={handleSuggestPalette} disabled={isGeneratingPalette} className="p-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600">
                                    {isGeneratingPalette ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Sparkles className="w-5 h-5"/>}
                                  </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <input type="color" className="w-full h-10 rounded-lg cursor-pointer" value={currentClient.colorPrimario} onChange={e => setCurrentClient({...currentClient, colorPrimario: e.target.value})}/>
                                  <input type="color" className="w-full h-10 rounded-lg cursor-pointer" value={currentClient.colorSecundario} onChange={e => setCurrentClient({...currentClient, colorSecundario: e.target.value})}/>
                                  <input type="color" className="w-full h-10 rounded-lg cursor-pointer" value={currentClient.colorAcento} onChange={e => setCurrentClient({...currentClient, colorAcento: e.target.value})}/>
                                </div>
                                <textarea placeholder="Slogan / Descripción IA" className="w-full p-3 border rounded-xl text-xs h-20" value={currentClient.footer_description} onChange={e => setCurrentClient({...currentClient, footer_description: e.target.value})}></textarea>
                            </div>

                            <div className="md:col-span-2 pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 p-4 bg-slate-100 rounded-xl font-bold uppercase text-xs">Cancelar</button>
                                <button type="submit" disabled={isLoading} className="flex-[2] p-4 bg-brand-600 text-white rounded-xl font-bold uppercase text-xs shadow-lg shadow-brand-200">
                                    {isLoading ? 'Guardando...' : 'Guardar Empresa'}
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
