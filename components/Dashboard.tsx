
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Area, AreaChart,
  LineChart, Line
} from 'recharts';
import { 
  TrendingUp, RefreshCw, AlertCircle, Store, 
  FileSpreadsheet, Target, Zap, ChevronDown, Search, List,
  ArrowUpRight, Package, Calculator, LayoutGrid
} from 'lucide-react';
import { Venta, Filtros, AgrupadoPorDia, OdooSession } from '../types';
import { OdooClient } from '../services/odoo';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const generarDatosVentas = (startStr: string, endStr: string): Venta[] => {
  const estructura = [
      { compania: 'BOTICAS MULTIFARMA S.C.C.', sedes: ['MULTIFARMAS (MARTINEZ ...', 'CRISTO REY (FERNANDEZ ...', 'LOMAS (ALEGRE MARTINEZ...', 'TIENDA 4 EXCLUSIVA'] },
      { compania: 'CONSULTORIO MEDICO REQUESALUD', sedes: ['CAJA REQUESALUD PRINCIPAL'] }
  ];
  const productos = [
    { id: 1, nombre: 'Paracetamol 500mg Genérico', costo: 0.50, precio: 2.00, cat: 'Farmacia' },
    { id: 2, nombre: 'Amoxicilina 500mg Blister', costo: 1.20, precio: 3.50, cat: 'Farmacia' },
    { id: 4, nombre: 'Ensure Advance Vainilla', costo: 85.00, precio: 105.00, cat: 'Nutrición' },
    { id: 5, nombre: 'Pañales Huggies XG', costo: 45.00, precio: 58.00, cat: 'Cuidado Personal' },
    { id: 6, nombre: 'Consulta Médica General', costo: 0.00, precio: 50.00, cat: 'Servicios' }
  ];
  const ventas: Venta[] = [];
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T23:59:59`);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    estructura.forEach(emp => {
      emp.sedes.forEach(sede => {
        const vDia = Math.floor(Math.random() * 8) + 3;
        for (let i = 0; i < vDia; i++) {
          const prod = productos[Math.floor(Math.random() * productos.length)];
          const qty = Math.floor(Math.random() * 3) + 1;
          ventas.push({
            fecha: new Date(d),
            sede: sede,
            compania: emp.compania,
            vendedor: 'Vendedor Demo',
            sesion: 'POS/DEMO',
            producto: prod.nombre,
            categoria: prod.cat,
            metodoPago: Math.random() > 0.3 ? 'Efectivo' : 'Yape',
            cantidad: qty,
            total: prod.precio * qty,
            costo: prod.costo * qty,
            margen: (prod.precio - prod.costo) * qty,
            margenPorcentaje: "30"
          });
        }
      });
    });
  }
  return ventas;
};

interface DashboardProps {
    session: OdooSession | null;
    view?: string;
    onDataLoaded?: (data: Venta[]) => void;
    onLoadingStateChange?: (loading: boolean) => void;
}

type FilterMode = 'hoy' | 'mes' | 'anio' | 'custom';

const Dashboard: React.FC<DashboardProps> = ({ 
  session, 
  onDataLoaded,
  onLoadingStateChange
}) => {
  const [ventasData, setVentasData] = useState<Venta[]>([]); 
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('hoy');
  const [dateRange, setDateRange] = useState({
      start: new Date().toLocaleDateString('en-CA'),
      end: new Date().toLocaleDateString('en-CA')
  });

  const [filtros, setFiltros] = useState<Filtros>({
    sedeSeleccionada: 'Todas',
    companiaSeleccionada: session?.companyName || 'Todas',
    periodoSeleccionado: 'hoy',
    fechaInicio: '', 
    fechaFin: ''
  });

  useEffect(() => {
    if (onDataLoaded) onDataLoaded(ventasData);
  }, [ventasData, onDataLoaded]);

  useEffect(() => {
    if (onLoadingStateChange) onLoadingStateChange(loading);
  }, [loading, onLoadingStateChange]);

  useEffect(() => {
      let start = '';
      let end = '';
      const now = new Date();
      if (filterMode === 'hoy') {
          const today = now.toLocaleDateString('en-CA');
          start = today; end = today;
      } else if (filterMode === 'mes') {
          start = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA'); 
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-CA');
      } else if (filterMode === 'anio') {
          start = `${now.getFullYear()}-01-01`;
          end = `${now.getFullYear()}-12-31`;
      }
      if (filterMode !== 'custom') setDateRange({ start, end });
  }, [filterMode]);

  const fetchData = useCallback(async () => {
      if (loading) return;
      setLoading(true);
      setError(null);
      setProgress(0);
      
      if (!session) {
          setLoadStep('Simulando datos...');
          await delay(1000);
          setVentasData(generarDatosVentas(dateRange.start, dateRange.end));
          setLoading(false);
          return;
      }

      const client = new OdooClient(session.url, session.db, session.useProxy);
      try {
          const context = session.companyId ? { allowed_company_ids: [session.companyId] } : {};
          setLoadStep('Sincronizando...');
          const linesRaw: any[] = await client.searchRead(session.uid, session.apiKey, 'pos.order.line', 
            [
                ['order_id.date_order', '>=', `${dateRange.start} 00:00:00`],
                ['order_id.date_order', '<=', `${dateRange.end} 23:59:59`],
                ['order_id.state', 'not in', ['cancel', 'draft']]
            ], 
            ['product_id', 'qty', 'price_subtotal_incl', 'order_id'], 
            { limit: 1000, context }
          );

          if (!linesRaw || linesRaw.length === 0) {
             setVentasData([]);
             setLoading(false);
             return;
          }
          setProgress(40);
          const orderIds = Array.from(new Set(linesRaw.map(l => l.order_id[0])));
          const productIds = Array.from(new Set(linesRaw.map(l => l.product_id[0])));

          const [ordersData, productsData] = await Promise.all([
             client.searchRead(session.uid, session.apiKey, 'pos.order', [['id', 'in', orderIds]], ['date_order', 'config_id', 'company_id', 'user_id', 'payment_ids', 'session_id'], { context }),
             client.searchRead(session.uid, session.apiKey, 'product.product', [['id', 'in', productIds]], ['standard_price', 'categ_id'], { context })
          ]);
          setProgress(80);

          const productMap = new Map<number, { cost: number; cat: string }>(productsData.map((p: any) => [p.id, { cost: p.standard_price || 0, cat: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General' }]));
          const orderMap = new Map<number, any>(ordersData.map((o: any) => [o.id, o]));

          const mapped: Venta[] = linesRaw.map(line => {
              const order = orderMap.get(line.order_id[0]);
              const prodInfo = productMap.get(line.product_id[0]) || { cost: 0, cat: 'General' };
              const total = line.price_subtotal_incl || 0;
              const costo = prodInfo.cost * (line.qty || 1);
              return {
                  fecha: order ? new Date((order.date_order || "").replace(" ", "T") + "Z") : new Date(),
                  sede: (order && Array.isArray(order.config_id)) ? order.config_id[1] : 'Caja',
                  compania: (order && Array.isArray(order.company_id)) ? order.company_id[1] : 'Empresa',
                  vendedor: (order && Array.isArray(order.user_id)) ? order.user_id[1] : 'Usuario',
                  sesion: (order && Array.isArray(order.session_id)) ? order.session_id[1] : 'Sesión',
                  metodoPago: 'Varios',
                  producto: Array.isArray(line.product_id) ? line.product_id[1] : 'Producto',
                  categoria: prodInfo.cat,
                  cantidad: line.qty || 1,
                  total, costo, margen: total - costo,
                  margenPorcentaje: total > 0 ? (((total - costo) / total) * 100).toFixed(1) : '0.0'
              };
          });
          setVentasData(mapped);
          setProgress(100);
      } catch (err: any) { setError(err.message); } finally { setLoading(false); setLoadStep(''); }
  }, [session, dateRange, loading]);

  useEffect(() => { fetchData(); }, [dateRange.start, dateRange.end]);

  const filteredData = useMemo(() => {
    let datos = ventasData;
    if (filtros.sedeSeleccionada !== 'Todas') datos = datos.filter(v => v.sede === filtros.sedeSeleccionada);
    if (searchTerm) datos = datos.filter(v => v.producto.toLowerCase().includes(searchTerm.toLowerCase()));
    return datos;
  }, [ventasData, filtros.sedeSeleccionada, searchTerm]);

  const stats = useMemo(() => {
    const total = filteredData.reduce((acc, v) => acc + v.total, 0);
    const profit = filteredData.reduce((acc, v) => acc + v.margen, 0);
    return {
      total: total.toLocaleString('es-PE', { minimumFractionDigits: 2 }),
      profit: profit.toLocaleString('es-PE', { minimumFractionDigits: 2 }),
      items: filteredData.length.toLocaleString(),
      margin: total > 0 ? ((profit / total) * 100).toFixed(1) : '0.0'
    };
  }, [filteredData]);

  const chartData = useMemo(() => {
    const agg: Record<string, AgrupadoPorDia> = {};
    filteredData.forEach(v => {
      const f = v.fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
      if (!agg[f]) agg[f] = { fecha: f, ventas: 0, margen: 0 };
      agg[f].ventas += v.total;
    });
    return Object.values(agg);
  }, [filteredData]);

  const sedesAnalysis = useMemo(() => {
    const agg: Record<string, { total: number, margen: number }> = {};
    ventasData.forEach(v => {
      if (!agg[v.sede]) agg[v.sede] = { total: 0, margen: 0 };
      agg[v.sede].total += v.total;
      agg[v.sede].margen += v.margen;
    });
    return Object.entries(agg).map(([name, val]) => ({
      name,
      venta: val.total,
      margen: val.margen,
      rentabilidad: val.total > 0 ? (val.margen / val.total * 100) : 0
    })).sort((a, b) => b.venta - a.venta);
  }, [ventasData]);

  return (
    <div className="p-4 md:p-10 font-sans w-full relative min-h-screen text-slate-700 pb-32">
      {loading && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex flex-col items-center justify-center">
              <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl flex flex-col items-center gap-6 border border-slate-100 max-w-md w-full animate-in zoom-in">
                <div className="relative">
                   <div className="w-24 h-24 border-4 border-slate-100 rounded-full"></div>
                   <div className="w-24 h-24 border-4 border-brand-500 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                   <RefreshCw className="w-10 h-10 text-brand-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="font-black text-slate-800 uppercase tracking-tighter text-xl">{loadStep}</p>
              </div>
          </div>
      )}

      <div className="max-w-7xl mx-auto space-y-10">
        {/* TOP HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
           <div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">Smart <span className="text-brand-600">Analytics</span></h1>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mt-4 flex items-center gap-3">
                 <span className="w-2 h-2 bg-brand-500 rounded-full"></span>
                 {session?.companyName || 'Lemon BI Demo'}
              </p>
           </div>
           
           <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="flex bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm w-fit">
                  {(['hoy', 'mes', 'anio', 'custom'] as FilterMode[]).map(mode => (
                      <button key={mode} onClick={() => setFilterMode(mode)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filterMode === mode ? 'bg-brand-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>{mode}</button>
                  ))}
              </div>
              <button onClick={fetchData} className="flex items-center gap-3 bg-white text-slate-800 px-8 py-4 rounded-2xl border border-slate-100 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 shadow-sm transition-all"><RefreshCw className="w-4 h-4" /> Sincronizar</button>
           </div>
        </div>

        {error && ( 
           <div className="bg-red-50 border border-red-200 text-red-700 p-8 rounded-[3rem] flex gap-6 items-center shadow-xl mx-4">
              <AlertCircle className="w-10 h-10 text-red-500 shrink-0" />
              <div className="flex-1">
                 <p className="text-[10px] font-black uppercase tracking-widest mb-1">Error de Sincronización</p>
                 <p className="text-xs font-bold leading-relaxed uppercase">{error}</p>
              </div>
           </div> 
        )}

        {/* SEDE CARDS - INTERACTIVE GRID */}
        <div className="px-4">
           <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-brand-50 rounded-2xl text-brand-600">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Rendimiento por Sede</h2>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {sedesAnalysis.map((sede, idx) => (
                <div 
                  key={idx} 
                  className={`bg-white rounded-[3rem] p-8 shadow-xl border-2 transition-all group relative overflow-hidden ${filtros.sedeSeleccionada === sede.name ? 'border-brand-500 ring-4 ring-brand-500/10' : 'border-slate-50 hover:border-brand-200'}`}
                >
                   {/* Background element */}
                   <div className="absolute -right-4 -top-4 w-32 h-32 bg-brand-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                   
                   <div className="flex justify-between items-start mb-8 relative z-10">
                      <div className="p-4 bg-brand-50 rounded-2xl text-brand-600">
                         <Store className="w-6 h-6" />
                      </div>
                      <button 
                        onClick={() => setFiltros({...filtros, sedeSeleccionada: filtros.sedeSeleccionada === sede.name ? 'Todas' : sede.name})}
                        className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${filtros.sedeSeleccionada === sede.name ? 'bg-brand-500 text-white' : 'bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white'}`}
                      >
                         {filtros.sedeSeleccionada === sede.name ? 'SELECCIONADO' : 'VER DETALLE'}
                         <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                   </div>

                   <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-8 leading-tight line-clamp-1">{sede.name}</h3>
                   
                   <div className="space-y-4 mb-8">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                         <span className="text-slate-400">Venta</span>
                         <span className="text-slate-900">S/ {sede.venta.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                         <span className="text-slate-400">Margen</span>
                         <span className="text-brand-600">S/ {sede.margen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                      </div>
                   </div>

                   <div className="pt-6 border-t border-slate-50">
                      <div className="flex justify-between items-end mb-3">
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rentabilidad</span>
                         <span className="text-xs font-black text-slate-900">{sede.rentabilidad.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                         <div 
                           className="h-full bg-brand-500 rounded-full transition-all duration-1000" 
                           style={{ width: `${Math.min(sede.rentabilidad * 2, 100)}%` }}
                         ></div>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* KPI CARDS - ENFOQUE SELECCIÓN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl flex flex-col justify-between min-h-[160px]">
               <TrendingUp className="w-10 h-10 text-brand-400 opacity-50" />
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Total Venta {filtros.sedeSeleccionada !== 'Todas' ? '(Filtrado)' : ''}</p>
                  <h3 className="text-3xl font-black tracking-tighter mt-2 truncate">S/ {stats.total}</h3>
               </div>
            </div>
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 flex flex-col justify-between min-h-[160px]">
               <Target className="w-10 h-10 text-brand-600 mb-6" />
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Utilidad Bruta</p>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter mt-2 truncate">S/ {stats.profit}</h3>
               </div>
            </div>
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 flex flex-col justify-between min-h-[160px]">
               <Package className="w-10 h-10 text-blue-500 mb-6" />
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Items Vendidos</p>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter mt-2">{stats.items}</h3>
               </div>
            </div>
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 flex flex-col justify-between min-h-[160px]">
               <Calculator className="w-10 h-10 text-amber-500 mb-6" />
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Margen Real %</p>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter mt-2">{stats.margin}%</h3>
               </div>
            </div>
        </div>

        {/* MAIN CHART */}
        <div className="bg-white p-12 rounded-[4rem] shadow-xl border border-slate-100 mx-4">
           <div className="flex justify-between items-center mb-12">
              <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Tendencia de Ingresos</h4>
              <div className="flex items-center gap-3">
                 <div className="w-3 h-3 bg-brand-500 rounded-full"></div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ventas Diarias</span>
              </div>
           </div>
           <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData}>
                    <defs><linearGradient id="colorV" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#84cc16" stopOpacity={0.3}/><stop offset="95%" stopColor="#84cc16" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#94a3b8'}} />
                    <Tooltip contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)'}} />
                    <Area type="monotone" dataKey="ventas" stroke="#84cc16" strokeWidth={6} fillOpacity={1} fill="url(#colorV)" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* TABLE DRAWER */}
        <div className="bg-white rounded-[4rem] shadow-xl border border-slate-100 overflow-hidden mx-4">
           <button 
             onClick={() => setShowTable(!showTable)}
             className="w-full p-12 flex items-center justify-between group hover:bg-slate-50/50 transition-all"
           >
              <div className="flex items-center gap-8">
                 <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                    <List className="w-8 h-8" />
                 </div>
                 <div className="text-left">
                    <h4 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Transacciones Detalladas</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Historial completo del periodo seleccionado</p>
                 </div>
              </div>
              <ChevronDown className={`w-8 h-8 text-slate-300 transition-all duration-500 ${showTable ? 'rotate-180 text-brand-500' : ''}`} />
           </button>

           {showTable && (
              <div className="px-12 pb-16 animate-in slide-in-from-top-4 duration-500">
                 <div className="mb-10 flex flex-col md:flex-row gap-6 items-center justify-between">
                    <div className="relative flex-1 max-w-xl w-full">
                       <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                       <input 
                         type="text" 
                         placeholder="Buscar por producto..." 
                         className="w-full pl-16 pr-8 py-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-xs font-bold uppercase outline-none focus:ring-4 focus:ring-brand-500/10 transition-all shadow-inner"
                         value={searchTerm}
                         onChange={(e) => setSearchTerm(e.target.value)}
                       />
                    </div>
                    <button className="px-10 py-5 bg-brand-500 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-xl hover:shadow-brand-500/30 active:scale-95 transition-all">
                       <FileSpreadsheet className="w-5 h-5" /> Exportar Reporte
                    </button>
                 </div>

                 <div className="overflow-x-auto rounded-[3rem] border border-slate-100 shadow-sm">
                    <table className="w-full text-left">
                       <thead className="bg-slate-900 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-800">
                          <tr>
                             <th className="px-10 py-8">Fecha</th>
                             <th className="px-10 py-8">Producto</th>
                             <th className="px-10 py-8">Sede</th>
                             <th className="px-10 py-8 text-right">Monto</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {filteredData.slice(0, 50).map((v, i) => (
                             <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-10 py-6 text-[11px] font-black text-slate-900 uppercase">{v.fecha.toLocaleDateString('es-PE')}</td>
                                <td className="px-10 py-6">
                                   <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight line-clamp-1">{v.producto}</p>
                                   <p className="text-[9px] font-black text-brand-600 uppercase tracking-widest">{v.categoria}</p>
                                </td>
                                <td className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase">{v.sede}</td>
                                <td className="px-10 py-6 text-right font-black text-slate-900">S/ {v.total.toFixed(2)}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
