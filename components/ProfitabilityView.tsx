
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell
} from 'recharts';
import { 
  Target, TrendingUp, DollarSign, Package, Percent, 
  ChevronDown, ChevronUp, Search, List, Download,
  Store,
  FileSpreadsheet
} from 'lucide-react';
import { Venta, OdooSession } from '../types';
import * as XLSX from 'xlsx';

interface ProfitabilityViewProps {
  session: OdooSession | null;
  ventasData: Venta[];
  loading: boolean;
  onRefresh: () => void;
}

const ProfitabilityView: React.FC<ProfitabilityViewProps> = ({ session, ventasData, loading, onRefresh }) => {
  const [showFullReport, setShowFullReport] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const stats = useMemo(() => {
    const totalVentas = ventasData.reduce((acc, v) => acc + v.total, 0);
    const totalCosto = ventasData.reduce((acc, v) => acc + v.costo, 0);
    const totalUtilidad = totalVentas - totalCosto;
    const margenPromedio = totalVentas > 0 ? (totalUtilidad / totalVentas) * 100 : 0;
    
    return {
      totalVentas,
      totalCosto,
      totalUtilidad,
      margenPromedio: margenPromedio.toFixed(1)
    };
  }, [ventasData]);

  const productPerformance = useMemo(() => {
    const agg: Record<string, { nombre: string, ventas: number, utilidad: number, costo: number, margen: number, cantidad: number }> = {};
    ventasData.forEach(v => {
      if (!agg[v.producto]) {
        agg[v.producto] = { nombre: v.producto, ventas: 0, utilidad: 0, costo: 0, margen: 0, cantidad: 0 };
      }
      agg[v.producto].ventas += v.total;
      agg[v.producto].utilidad += v.margen;
      agg[v.producto].costo += v.costo;
      agg[v.producto].cantidad += v.cantidad;
    });

    return Object.values(agg).map(p => ({
      ...p,
      margen: p.ventas > 0 ? (p.utilidad / p.ventas) * 100 : 0
    })).sort((a, b) => b.utilidad - a.utilidad);
  }, [ventasData]);

  const categoryProfit = useMemo(() => {
    const agg: Record<string, number> = {};
    ventasData.forEach(v => {
      agg[v.categoria] = (agg[v.categoria] || 0) + v.margen;
    });
    return Object.entries(agg).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [ventasData]);

  const handleExportMultiSheet = () => {
    const wb = XLSX.utils.book_new();

    // Detectar rango de fechas de la data
    let dateRange = "Rango no definido";
    if (ventasData.length > 0) {
      const dates = ventasData.map(v => v.fecha.getTime());
      const minDate = new Date(Math.min(...dates)).toLocaleDateString('es-PE');
      const maxDate = new Date(Math.max(...dates)).toLocaleDateString('es-PE');
      dateRange = `${minDate} al ${maxDate}`;
    }

    // Función auxiliar para crear hojas con formato profesional
    const createSheetWithHeader = (title: string, dataRows: any[], totals: any) => {
      const header = [
        [title.toUpperCase()],
        [`PERIODO: ${dateRange}`],
        [`EMPRESA: ${session?.companyName || 'LEMON BI SYSTEM'}`],
        [], // Espacio
        ["PRODUCTO", "VENTA BRUTA (S/)", "COSTO (S/)", "UTILIDAD NETA (S/)", "MARGEN (%)", "CANTIDAD VENDIDA"]
      ];

      const body = dataRows.map(p => [
        p.nombre || p.Producto,
        p.ventas || p['Venta Bruta'] || 0,
        p.costo || p.Costo || 0,
        p.utilidad || p.Utilidad || 0,
        (p.margen || parseFloat(p['Margen %']) || 0).toFixed(2) + '%',
        p.cantidad || p.Cant || 0
      ]);

      const footer = [
        [], // Espacio antes del total
        [
          "TOTALES GENERALES",
          totals.ventas,
          totals.costo,
          totals.utilidad,
          ((totals.utilidad / totals.ventas) * 100 || 0).toFixed(2) + '%',
          totals.cantidad
        ]
      ];

      return XLSX.utils.aoa_to_sheet([...header, ...body, ...footer]);
    };

    // 1. Hoja Consolidada
    const totalTotals = {
      ventas: productPerformance.reduce((acc, p) => acc + p.ventas, 0),
      costo: productPerformance.reduce((acc, p) => acc + p.costo, 0),
      utilidad: productPerformance.reduce((acc, p) => acc + p.utilidad, 0),
      cantidad: productPerformance.reduce((acc, p) => acc + p.cantidad, 0)
    };
    const totalWs = createSheetWithHeader("Reporte de Rentabilidad Consolidado", productPerformance, totalTotals);
    XLSX.utils.book_append_sheet(wb, totalWs, "CONSOLIDADO");

    // 2. Hojas por Sede
    const sedes = Array.from(new Set(ventasData.map(v => v.sede)));
    sedes.forEach(sedeName => {
      const sedeVentas = ventasData.filter(v => v.sede === sedeName);
      const aggSede: Record<string, any> = {};
      
      let sVentas = 0, sCosto = 0, sUtilidad = 0, sCant = 0;

      sedeVentas.forEach(v => {
        if (!aggSede[v.producto]) {
          aggSede[v.producto] = { nombre: v.producto, ventas: 0, costo: 0, utilidad: 0, cantidad: 0 };
        }
        aggSede[v.producto].ventas += v.total;
        aggSede[v.producto].costo += v.costo;
        aggSede[v.producto].utilidad += v.margen;
        aggSede[v.producto].cantidad += v.cantidad;

        sVentas += v.total;
        sCosto += v.costo;
        sUtilidad += v.margen;
        sCant += v.cantidad;
      });

      const dataSede = Object.values(aggSede).sort((a, b) => b.utilidad - a.utilidad);
      const totalsSede = { ventas: sVentas, costo: sCosto, utilidad: sUtilidad, cantidad: sCant };
      
      // Fix: cast sedeName to string to resolve 'substring' on type 'unknown' error
      const safeSheetName = (sedeName as string).substring(0, 31).toUpperCase().replace(/[\\\/\?\*\[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, createSheetWithHeader(`Rentabilidad Sede: ${sedeName}`, dataSede, totalsSede), safeSheetName);
    });

    const fileName = `RENTABILIDAD_DETALLADA_${session?.companyName?.replace(/\s+/g, '_') || 'LEMON'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="p-4 md:p-10 space-y-10 pb-32">
      {/* RENTABILIDAD TOP KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-100 flex flex-col justify-between relative overflow-hidden group">
           <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-500/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
           <Target className="w-10 h-10 text-brand-600 mb-6" />
           <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Utilidad Total Bruta</p>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter mt-2">S/ {stats.totalUtilidad.toLocaleString()}</h3>
           </div>
        </div>
        <div className="bg-slate-900 p-10 rounded-[3.5rem] shadow-2xl text-white flex flex-col justify-between">
           <Percent className="w-10 h-10 text-brand-400 mb-6" />
           <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Margen Comercial Neto</p>
              <h3 className="text-3xl font-black tracking-tighter mt-2">{stats.margenPromedio}%</h3>
              <div className="mt-4 flex items-center gap-2 text-[9px] font-black uppercase text-brand-400">
                 <TrendingUp className="w-4 h-4" /> Rendimiento Óptimo
              </div>
           </div>
        </div>
        <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-100 flex flex-col justify-between">
           <DollarSign className="w-10 h-10 text-blue-500 mb-6" />
           <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Costo de Ventas (COGS)</p>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter mt-2">S/ {stats.totalCosto.toLocaleString()}</h3>
           </div>
        </div>
        <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-100 flex flex-col justify-between">
           <Store className="w-10 h-10 text-amber-500 mb-6" />
           <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sedes Operativas</p>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter mt-2">{Array.from(new Set(ventasData.map(v => v.sede))).length}</h3>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         {/* CHART RENTABILIDAD POR CATEGORIA */}
         <div className="lg:col-span-8 bg-white p-12 rounded-[4rem] shadow-xl border border-slate-100">
            <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-12">Utilidad por Categoría</h4>
            <div className="h-[400px]">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryProfit} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#64748b'}} />
                     <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#64748b'}} />
                     <Tooltip contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)'}} />
                     <Bar dataKey="value" fill="#84cc16" radius={[15, 15, 0, 0]} barSize={50}>
                        {categoryProfit.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={index === 0 ? '#84cc16' : '#64748b'} fillOpacity={0.8} />
                        ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* TOP PRODUCTOS RENTABLES */}
         <div className="lg:col-span-4 bg-white p-12 rounded-[4rem] shadow-xl border border-slate-100">
            <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-12">Productos Estrella</h4>
            <div className="space-y-8">
               {productPerformance.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex items-center justify-between group">
                     <div className="min-w-0 flex-1 pr-4">
                        <p className="text-[11px] font-black text-slate-800 uppercase truncate">{p.nombre}</p>
                        <p className="text-[9px] font-black text-brand-600 uppercase tracking-widest">{p.margen.toFixed(1)}% Ganancia</p>
                     </div>
                     <span className="text-sm font-black text-slate-900 shrink-0">S/ {p.utilidad.toLocaleString()}</span>
                  </div>
               ))}
            </div>
            <button onClick={() => setShowFullReport(true)} className="w-full mt-12 py-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:bg-white hover:shadow-lg transition-all">Ver reporte completo</button>
         </div>
      </div>

      {/* REPORTE DETALLADO Y EXPANDIBLE */}
      <div className="bg-white rounded-[4rem] shadow-xl border border-slate-100 overflow-hidden">
         <div className="p-12 flex flex-col md:flex-row justify-between items-center gap-8 border-b border-slate-50">
            <div className="flex items-center gap-6">
               <div className="w-16 h-16 bg-brand-500 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl">
                  <FileSpreadsheet className="w-8 h-8" />
               </div>
               <div>
                  <h4 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Reporte Maestro Multi-Sede</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Análisis profundo de márgenes por local</p>
               </div>
            </div>
            <div className="flex gap-4">
               <button 
                onClick={handleExportMultiSheet} 
                className="px-10 py-6 bg-emerald-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest flex items-center gap-4 hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 active:scale-95 transition-all"
               >
                  <Download className="w-6 h-6" /> Descargar Excel Ejecutivo
               </button>
            </div>
         </div>

         <div className="p-12 space-y-8">
            <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="relative flex-1">
                   <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                   <input 
                     type="text" 
                     placeholder="Buscar producto para analizar rentabilidad..." 
                     className="w-full pl-16 pr-8 py-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-xs font-bold uppercase outline-none focus:ring-4 focus:ring-brand-500/10 transition-all"
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                   />
                </div>
            </div>

            <div className={`overflow-x-auto rounded-[2.5rem] border border-slate-100 transition-all duration-700 ${showFullReport ? 'max-h-[1200px]' : 'max-h-[500px]'}`}>
               <table className="w-full text-left">
                  <thead className="bg-slate-900 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] sticky top-0 z-10">
                     <tr>
                        <th className="px-10 py-6">Producto</th>
                        <th className="px-8 py-6 text-right">Venta Bruta</th>
                        <th className="px-8 py-6 text-right">Costo</th>
                        <th className="px-8 py-6 text-right">Utilidad</th>
                        <th className="px-10 py-6 text-right">Margen %</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {productPerformance
                       .filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
                       .slice(0, showFullReport ? 1000 : 8)
                       .map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                           <td className="px-10 py-6">
                              <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{p.nombre}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{p.cantidad} unidades vendidas</p>
                           </td>
                           <td className="px-8 py-6 text-right font-black text-slate-400">S/ {p.ventas.toLocaleString()}</td>
                           <td className="px-8 py-6 text-right font-black text-slate-400">S/ {p.costo.toLocaleString()}</td>
                           <td className="px-8 py-6 text-right font-black text-slate-900">S/ {p.utilidad.toLocaleString()}</td>
                           <td className="px-10 py-6 text-right">
                              <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${p.margen > 30 ? 'bg-emerald-100 text-emerald-600' : p.margen > 15 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                                 {p.margen.toFixed(1)}%
                              </span>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            <div className="flex justify-center pt-8">
               <button 
                 onClick={() => setShowFullReport(!showFullReport)}
                 className="flex items-center gap-4 px-12 py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-[0.3em] shadow-2xl active:scale-95 transition-all"
               >
                  {showFullReport ? (
                    <>Colapsar reporte <ChevronUp className="w-5 h-5"/></>
                  ) : (
                    <>Ver lista completa de productos <ChevronDown className="w-5 h-5"/></>
                  )}
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ProfitabilityView;
