
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import { 
  Briefcase, Globe, Store, TrendingUp, Users, Package, 
  ArrowUpRight, Loader2, Target, Award, Layers, Banknote,
  Search, Filter, Download, Zap
} from 'lucide-react';
import { OdooSession, ExecutiveVenta } from '../types';
import { OdooClient } from '../services/odoo';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface ExecutiveDashboardProps {
  session: OdooSession | null;
}

const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ session }) => {
  const [data, setData] = useState<ExecutiveVenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChannel, setActiveChannel] = useState<'All' | 'Tienda Online' | 'Venta Directa' | 'Punto de Venta'>('All');

  const fetchData = async () => {
    if (!session) {
      // Demo data if no session
      setLoading(false);
      return;
    }
    setLoading(true);
    const client = new OdooClient(session.url, session.db, session.useProxy);
    
    try {
      // 1. Fetch Sale Orders (Ventas Directas + Ecommerce)
      // Odoo 17 usa website_id para identificar ventas web
      const sales = await client.searchRead(session.uid, session.apiKey, 'sale.order', 
        [['state', 'in', ['sale', 'done']]], 
        ['name', 'date_order', 'amount_total', 'partner_id', 'website_id'], 
        { limit: 300, order: 'date_order desc' }
      );

      // 2. Fetch POS Orders (Retail / Tienda Física)
      const pos = await client.searchRead(session.uid, session.apiKey, 'pos.order', 
        [['state', 'in', ['paid', 'done', 'invoiced']]], 
        ['name', 'date_order', 'amount_total', 'partner_id'], 
        { limit: 300, order: 'date_order desc' }
      );

      const mappedSales: ExecutiveVenta[] = (sales || []).map((s: any) => ({
        id: s.id,
        fecha: new Date(s.date_order),
        cliente: Array.isArray(s.partner_id) ? s.partner_id[1] : 'Cliente Varios',
        canal: s.website_id ? 'Tienda Online' : 'Venta Directa',
        monto: s.amount_total,
        estado: 'Vendido',
        referencia: s.name
      }));

      const mappedPos: ExecutiveVenta[] = (pos || []).map((p: any) => ({
        id: p.id,
        fecha: new Date(p.date_order),
        cliente: Array.isArray(p.partner_id) ? p.partner_id[1] : 'Cliente Retail',
        canal: 'Punto de Venta',
        monto: p.amount_total,
        estado: 'Cobrado',
        referencia: p.name
      }));

      setData([...mappedSales, ...mappedPos].sort((a, b) => b.fecha.getTime() - a.fecha.getTime()));
    } catch (e) {
      console.error("Error fetching data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [session]);

  const filteredData = useMemo(() => {
    if (activeChannel === 'All') return data;
    return data.filter(d => d.canal === activeChannel);
  }, [data, activeChannel]);

  const stats = useMemo(() => {
    const total = filteredData.reduce((acc, curr) => acc + curr.monto, 0);
    const count = filteredData.length;
    
    const byChannel = data.reduce((acc: any, curr) => {
      acc[curr.canal] = (acc[curr.canal] || 0) + curr.monto;
      return acc;
    }, {});

    return { total, count, byChannel };
  }, [filteredData, data]);

  const topClients = useMemo(() => {
    const clients: Record<string, number> = {};
    filteredData.forEach(d => {
      clients[d.cliente] = (clients[d.cliente] || 0) + d.monto;
    });
    return Object.entries(clients)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredData]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[80vh] gap-6">
      <div className="relative">
         <div className="w-20 h-20 border-4 border-indigo-100 rounded-full"></div>
         <div className="w-20 h-20 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
         <Zap className="w-8 h-8 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
      </div>
      <p className="font-black text-indigo-900 uppercase tracking-[0.4em] text-[10px]">Vision BI Executive - Procesando Canales</p>
    </div>
  );

  return (
    <div className="p-4 md:p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      
      {/* EXCLUSIVE HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div>
           <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">
             Vision <span className="text-indigo-600">Executive</span>
           </h2>
           <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[9px] mt-3 flex items-center gap-2">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
             Odoo v17 Enterprise Analytics
           </p>
        </div>

        <div className="flex p-1.5 bg-white rounded-3xl shadow-sm border border-slate-100">
           {(['All', 'Tienda Online', 'Venta Directa', 'Punto de Venta'] as const).map(c => (
             <button 
                key={c}
                onClick={() => setActiveChannel(c)}
                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeChannel === c ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-indigo-600'}`}
             >
               {c === 'All' ? 'Consolidado' : c}
             </button>
           ))}
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
         <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>
            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-6">Ingresos Brutos</p>
            <h3 className="text-3xl font-black text-white tracking-tighter">S/ {stats.total.toLocaleString()}</h3>
            <div className="mt-6 flex items-center gap-2 text-[9px] font-black text-emerald-400 uppercase tracking-widest">
               <TrendingUp className="w-4 h-4" /> +14.2% Eficiencia
            </div>
         </div>

         <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Canal Web</p>
               <Globe className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
               <h3 className="text-2xl font-black text-slate-900 tracking-tighter">S/ {(stats.byChannel['Tienda Online'] || 0).toLocaleString()}</h3>
               <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                  <div className="bg-indigo-500 h-full" style={{width: `${((stats.byChannel['Tienda Online'] || 0)/stats.total * 100) || 0}%`}}></div>
               </div>
            </div>
         </div>

         <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Venta Directa</p>
               <Briefcase className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
               <h3 className="text-2xl font-black text-slate-900 tracking-tighter">S/ {(stats.byChannel['Venta Directa'] || 0).toLocaleString()}</h3>
               <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                  <div className="bg-indigo-500 h-full" style={{width: `${((stats.byChannel['Venta Directa'] || 0)/stats.total * 100) || 0}%`}}></div>
               </div>
            </div>
         </div>

         <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retail POS</p>
               <Store className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
               <h3 className="text-2xl font-black text-slate-900 tracking-tighter">S/ {(stats.byChannel['Punto de Venta'] || 0).toLocaleString()}</h3>
               <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                  <div className="bg-indigo-500 h-full" style={{width: `${((stats.byChannel['Punto de Venta'] || 0)/stats.total * 100) || 0}%`}}></div>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* CHART PRINCIPAL */}
         <div className="lg:col-span-2 bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-100">
            <div className="flex justify-between items-center mb-10">
               <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-indigo-600" /> Rendimiento Histórico
               </h4>
               <button className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all"><Download className="w-5 h-5"/></button>
            </div>
            <div className="h-[400px]">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.slice(0, 30).reverse()}>
                     <defs>
                        <linearGradient id="colorMonto" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                           <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="referencia" hide />
                     <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#94a3b8'}} />
                     <Tooltip 
                        contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '20px'}}
                        labelStyle={{fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px'}}
                     />
                     <Area type="monotone" dataKey="monto" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorMonto)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* TOP CLIENTES ELITE */}
         <div className="bg-slate-900 p-10 rounded-[3.5rem] shadow-2xl text-white">
            <div className="flex items-center gap-3 mb-10">
               <Award className="w-8 h-8 text-amber-400" />
               <h4 className="text-xl font-black uppercase tracking-tighter">Top Clientes</h4>
            </div>
            <div className="space-y-8">
               {topClients.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between group cursor-pointer">
                     <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center font-black text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                           {idx + 1}
                        </div>
                        <div>
                           <p className="text-xs font-black uppercase tracking-tight">{c.name}</p>
                           <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Socio Estratégico</p>
                        </div>
                     </div>
                     <span className="text-sm font-black text-indigo-400">S/ {c.total.toLocaleString()}</span>
                  </div>
               ))}
            </div>
            
            <div className="mt-12 p-6 bg-white/5 rounded-3xl border border-white/5">
               <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2 text-center">Analítica de Fidelidad</p>
               <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 w-[78%]"></div>
               </div>
            </div>
         </div>
      </div>

      {/* TABLA DE MOVIMIENTOS RECIENTES */}
      <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-100 overflow-hidden">
         <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-10">Auditoría de Ventas Recientes</h4>
         <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
               <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
                  <tr>
                     <th className="px-6 py-5">Referencia</th>
                     <th className="px-6 py-5">Cliente / Partner</th>
                     <th className="px-6 py-5">Canal de Origen</th>
                     <th className="px-6 py-5 text-right">Importe Total</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 font-bold text-slate-700 uppercase">
                  {filteredData.slice(0, 10).map(d => (
                     <tr key={d.id} className="hover:bg-indigo-50/50 transition-colors">
                        <td className="px-6 py-5 text-indigo-600">#{d.referencia}</td>
                        <td className="px-6 py-5 truncate max-w-[200px]">{d.cliente}</td>
                        <td className="px-6 py-5">
                           <span className={`px-3 py-1.5 rounded-full text-[8px] font-black tracking-widest ${d.canal === 'Tienda Online' ? 'bg-indigo-100 text-indigo-600' : d.canal === 'Venta Directa' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                              {d.canal}
                           </span>
                        </td>
                        <td className="px-6 py-5 text-right font-black text-slate-900">S/ {d.monto.toLocaleString()}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
