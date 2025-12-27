
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend, Area, AreaChart 
} from 'recharts';
import { TrendingUp, DollarSign, Package, ArrowUpRight, RefreshCw, AlertCircle, Store, Download, FileSpreadsheet, ArrowUp, ArrowDown, Receipt, Target, PieChart as PieChartIcon, MapPin, CreditCard, Wallet, CalendarRange, Zap, X } from 'lucide-react';
import { Venta, Filtros, AgrupadoPorDia, OdooSession } from '../types';
import OdooConfigModal from './OdooConfigModal';
import { OdooClient } from '../services/odoo';
import * as XLSX from 'xlsx';

const generarDatosVentas = (startStr: string, endStr: string): Venta[] => {
  const estructura = [
      { compania: 'BOTICAS MULTIFARMA S.A.C.', sedes: ['Multifarmas', 'Cristo Rey', 'Lomas', 'Tienda 4'] },
      { compania: 'CONSULTORIO MEDICO REQUESALUD', sedes: ['Caja Requesalud'] }
  ];

  const vendedores = ['Juan Pérez', 'María Gómez', 'Carlos Ruiz', 'Ana Torres', 'Caja Principal'];
  const metodosPago = ['Efectivo', 'Yape', 'Plin', 'Visa', 'Mastercard', 'Transferencia'];

  const productos = [
    { id: 1, nombre: 'Paracetamol 500mg Genérico', costo: 0.50, precio: 2.00, cat: 'Farmacia' },
    { id: 2, nombre: 'Amoxicilina 500mg Blister', costo: 1.20, precio: 3.50, cat: 'Farmacia' },
    { id: 3, nombre: 'Ibuprofeno 400mg Caja', costo: 8.00, precio: 15.00, cat: 'Farmacia' },
    { id: 4, nombre: 'Ensure Advance Vainilla', costo: 85.00, precio: 105.00, cat: 'Nutrición' },
    { id: 5, nombre: 'Pañales Huggies XG', costo: 45.00, precio: 58.00, cat: 'Cuidado Personal' },
    { id: 6, nombre: 'Consulta Médica General', costo: 0.00, precio: 50.00, cat: 'Servicios' },
    { id: 7, nombre: 'Inyectable - Servicio', costo: 1.00, precio: 10.00, cat: 'Servicios' },
    { id: 8, nombre: '[LAB] HEMOGRAMA COMPLETO', costo: 15.00, precio: 35.00, cat: 'Laboratorio' },
    { id: 9, nombre: '[ECO] ABDOMINAL COMPLETA', costo: 40.00, precio: 120.00, cat: 'Imágenes' },
    { id: 10, nombre: 'Shampoo H&S', costo: 18.00, precio: 25.00, cat: 'Cuidado Personal' },
    { id: 11, nombre: 'Vitamina C 1000mg', costo: 25.00, precio: 40.00, cat: 'Nutrición' }
  ];

  const ventas: Venta[] = [];
  const fechaInicioReq = new Date(`${startStr}T00:00:00`);
  const fechaFinReq = new Date(`${endStr}T23:59:59`);
  
  const fechaGeneracionInicio = new Date(fechaInicioReq);
  fechaGeneracionInicio.setDate(fechaGeneracionInicio.getDate() - 65);

  for (let d = new Date(fechaGeneracionInicio); d <= fechaFinReq; d.setDate(d.getDate() + 1)) {
    estructura.forEach(emp => {
        const ventasPorDia = Math.floor(Math.random() * 8) + 2; 
        
        for (let i = 0; i < ventasPorDia; i++) {
            const sede = emp.sedes[Math.floor(Math.random() * emp.sedes.length)];
            const vendedor = vendedores[Math.floor(Math.random() * vendedores.length)];
            const metodo = metodosPago[Math.floor(Math.random() * metodosPago.length)];
            const fakeSession = `POS/${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2, '0')}/${Math.floor(Math.random()*100) + 1000}`;
            
            if (sede === 'Tienda 4') {
                const fechaCierreTienda4 = new Date('2024-08-31');
                if (d > fechaCierreTienda4) continue; 
            }

            const producto = productos[Math.floor(Math.random() * productos.length)];
            let prodFinal = producto;
            
            if (emp.compania.includes('CONSULTORIO')) {
                 if (Math.random() > 0.6) prodFinal = productos.find(p => p.cat === 'Servicios' || p.cat === 'Laboratorio' || p.cat === 'Imágenes') || producto;
            }

            const variacion = 0.9 + (Math.random() * 0.2); 
            const precioVenta = prodFinal.precio * variacion;
            const costoReal = prodFinal.costo * (0.95 + Math.random() * 0.1);

            const total = precioVenta; 
            const margen = total - costoReal;

            ventas.push({
                fecha: new Date(d),
                sede, 
                compania: emp.compania,
                sesion: fakeSession,
                producto: prodFinal.nombre,
                categoria: prodFinal.cat,
                vendedor,
                metodoPago: metodo,
                cantidad: 1,
                total, 
                costo: costoReal,
                margen,
                margenPorcentaje: total > 0 ? ((margen / total) * 100).toFixed(1) : '0.0'
            });
        }
    });
  }
  return ventas;
};

interface DashboardProps {
    session: OdooSession | null;
    view?: string;
}

type FilterMode = 'hoy' | 'mes' | 'anio' | 'custom';

const Dashboard: React.FC<DashboardProps> = ({ session, view = 'general' }) => {
  const [ventasData, setVentasData] = useState<Venta[]>([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [drillDownSede, setDrillDownSede] = useState<string | null>(null);

  const itemsPerPage = 10;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); 

  const [filterMode, setFilterMode] = useState<FilterMode>('hoy');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  
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
    setDrillDownSede(null);
  }, [view, dateRange]);

  useEffect(() => {
      let start = '';
      let end = '';
      if (filterMode === 'hoy') {
          const today = new Date().toLocaleDateString('en-CA');
          start = today;
          end = today;
      }
      else if (filterMode === 'mes') {
          const firstDay = new Date(selectedYear, selectedMonth, 1);
          const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
          start = firstDay.toLocaleDateString('en-CA'); 
          end = lastDay.toLocaleDateString('en-CA');
      } 
      else if (filterMode === 'anio') {
          start = `${selectedYear}-01-01`;
          end = `${selectedYear}-12-31`;
      }
      if (filterMode !== 'custom') {
          setDateRange({ start, end });
      }
  }, [filterMode, selectedYear, selectedMonth]);


  const fetchData = useCallback(async () => {
      setLoading(true);
      setError(null);
      setDrillDownSede(null); 
      
      const bufferStart = new Date(dateRange.start);
      bufferStart.setDate(bufferStart.getDate() - 1); 
      const bufferEnd = new Date(dateRange.end);
      bufferEnd.setDate(bufferEnd.getDate() + 1);
      
      const queryStart = bufferStart.toISOString().split('T')[0];
      const queryEnd = bufferEnd.toISOString().split('T')[0];

      if (!session) {
          setTimeout(() => {
            const demoData = generarDatosVentas(dateRange.start, dateRange.end);
            setVentasData(demoData);
            setLoading(false);
          }, 800);
          return;
      }

      const client = new OdooClient(session.url, session.db, session.useProxy);
      const domain: any[] = [
        ['state', '!=', 'cancel'], 
        ['date_order', '>=', `${queryStart} 00:00:00`],
        ['date_order', '<=', `${queryEnd} 23:59:59`]
      ];

      if (session.companyId) domain.push(['company_id', '=', session.companyId]);

      try {
          const context = session.companyId ? { allowed_company_ids: [session.companyId] } : {};
          const ordersRaw: any[] = await client.searchRead(session.uid, session.apiKey, 'pos.order', domain, ['date_order', 'config_id', 'lines', 'company_id', 'user_id', 'pos_reference', 'name', 'payment_ids', 'session_id'], { limit: 10000, order: 'date_order desc', context });

          if (!ordersRaw || ordersRaw.length === 0) {
             setVentasData([]);
             setLoading(false);
             return;
          }

          const allLineIds = ordersRaw.flatMap((o: any) => o.lines || []);
          const allPaymentIds = ordersRaw.flatMap((o: any) => o.payment_ids || []);

          if (allLineIds.length === 0) {
              setVentasData([]);
              setLoading(false);
              return;
          }
          
          const chunkArray = (array: any[], size: number) => {
              const result = [];
              for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
              return result;
          };

          const lineChunks = chunkArray(allLineIds, 1000);
          let allLinesData: any[] = [];
          for (const chunk of lineChunks) {
              const linesData = await client.searchRead(session.uid, session.apiKey, 'pos.order.line', [['id', 'in', chunk]], ['product_id', 'qty', 'price_subtotal_incl'], { context });
              if (linesData) allLinesData = allLinesData.concat(linesData);
          }

          const productIds = new Set(allLinesData.map((l: any) => Array.isArray(l.product_id) ? l.product_id[0] : null).filter(id => id));
          let productMap = new Map<number, {cost: number, cat: string}>();
          if (productIds.size > 0) {
              const productChunks = chunkArray(Array.from(productIds), 1000);
              for (const pChunk of productChunks) {
                  const productsData = await client.searchRead(session.uid, session.apiKey, 'product.product', [['id', 'in', pChunk]], ['standard_price', 'categ_id'], { context });
                  if (productsData) productsData.forEach((p: any) => productMap.set(p.id, { cost: p.standard_price || 0, cat: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General' }));
              }
          }

          let paymentMap = new Map<number, string>();
          if (allPaymentIds.length > 0) {
              const paymentChunks = chunkArray(allPaymentIds, 1000);
              for (const payChunk of paymentChunks) {
                  const paymentsData = await client.searchRead(session.uid, session.apiKey, 'pos.payment', [['id', 'in', payChunk]], ['payment_method_id', 'pos_order_id'], { context });
                  if (paymentsData) paymentsData.forEach((p: any) => { if (p.pos_order_id && p.payment_method_id) paymentMap.set(p.pos_order_id[0], p.payment_method_id[1]); });
              }
          }

          const linesMap = new Map(allLinesData.map((l: any) => [l.id, l]));
          const mappedVentas: Venta[] = [];

          ordersRaw.forEach((order: any) => {
              const orderDate = new Date((order.date_order || "").replace(" ", "T") + "Z");
              const sede = Array.isArray(order.config_id) ? order.config_id[1] : 'Caja General';
              const compania = Array.isArray(order.company_id) ? order.company_id[1] : 'Empresa Principal';
              const vendedor = Array.isArray(order.user_id) ? order.user_id[1] : 'Usuario Sistema';
              const sesion = Array.isArray(order.session_id) ? order.session_id[1] : 'Sesión Desconocida';
              const metodoPago = paymentMap.get(order.id) || 'Desconocido';

              if (order.lines && Array.isArray(order.lines)) {
                  order.lines.forEach((lineId: number) => {
                      const line = linesMap.get(lineId);
                      if (line) {
                          const productId = Array.isArray(line.product_id) ? line.product_id[0] : 0;
                          const productName = Array.isArray(line.product_id) ? line.product_id[1] : 'Producto Desconocido';
                          const ventaBruta = line.price_subtotal_incl || 0; 
                          const prodInfo = productMap.get(productId) || { cost: 0, cat: 'Varios' };
                          const costoTotal = prodInfo.cost * (line.qty || 1);
                          const margen = ventaBruta - costoTotal; 

                          mappedVentas.push({
                              fecha: orderDate, sede, compania, vendedor, sesion, producto: productName, categoria: prodInfo.cat, metodoPago, cantidad: line.qty || 1, total: ventaBruta, costo: costoTotal, margen,
                              margenPorcentaje: ventaBruta > 0 ? ((margen / ventaBruta) * 100).toFixed(1) : '0.0',
                          });
                      }
                  });
              }
          });
          setVentasData(mappedVentas);
      } catch (err: any) {
          setError(`Error de Conexión: ${err.message || "Fallo en consulta XML-RPC"}`);
          setVentasData([]); 
      } finally {
          setLoading(false);
      }
  }, [session, dateRange]); 

  useEffect(() => { fetchData(); }, [fetchData]); 

  const filteredData = useMemo(() => {
    const startStr = dateRange.start;
    const endStr = dateRange.end;
    let datos = ventasData.filter(v => {
        const vDate = v.fecha.toLocaleDateString('en-CA'); 
        return vDate >= startStr && vDate <= endStr;
    });
    if (filtros.sedeSeleccionada !== 'Todas') datos = datos.filter(v => v.sede === filtros.sedeSeleccionada);
    if (!session && filtros.companiaSeleccionada !== 'Todas') datos = datos.filter(v => v.compania.includes(filtros.companiaSeleccionada));
    if (drillDownSede) datos = datos.filter(v => v.sede === drillDownSede);
    return datos;
  }, [ventasData, filtros, dateRange, session, drillDownSede]);

  const previousPeriodData = useMemo(() => {
      const currentStart = new Date(dateRange.start);
      const currentEnd = new Date(dateRange.end);
      const diffTime = Math.abs(currentEnd.getTime() - currentStart.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      const prevEnd = new Date(currentStart); prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - diffDays);
      const pStartStr = prevStart.toLocaleDateString('en-CA');
      const pEndStr = prevEnd.toLocaleDateString('en-CA');

      let datos = ventasData.filter(v => { const vDate = v.fecha.toLocaleDateString('en-CA'); return vDate >= pStartStr && vDate <= pEndStr; });
      if (filtros.sedeSeleccionada !== 'Todas') datos = datos.filter(v => v.sede === filtros.sedeSeleccionada);
      if (!session && filtros.companiaSeleccionada !== 'Todas') datos = datos.filter(v => v.compania.includes(filtros.companiaSeleccionada));
      if (drillDownSede) datos = datos.filter(v => v.sede === drillDownSede);
      return datos;
  }, [ventasData, dateRange, filtros, session, drillDownSede]);

  const sedes = useMemo(() => {
      let base = ventasData;
      if (!session && filtros.companiaSeleccionada !== 'Todas') base = ventasData.filter(v => v.compania.includes(filtros.companiaSeleccionada));
      return ['Todas', ...Array.from(new Set(base.map(v => v.sede)))];
  }, [ventasData, filtros.companiaSeleccionada, session]);

  const kpis = useMemo(() => {
    const totalVentas = filteredData.reduce((sum, v) => sum + v.total, 0);
    const totalMargen = filteredData.reduce((sum, v) => sum + v.margen, 0);
    const unidades = filteredData.length;
    const prevVentas = previousPeriodData.reduce((sum, v) => sum + v.total, 0);
    const prevMargen = previousPeriodData.reduce((sum, v) => sum + v.margen, 0);
    const prevUnidades = previousPeriodData.length;
    const calcVar = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : 0;

    return {
      totalVentas: totalVentas.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      variacionVentas: calcVar(totalVentas, prevVentas),
      totalMargen: totalMargen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      variacionMargen: calcVar(totalMargen, prevMargen),
      margenPromedio: totalVentas > 0 ? ((totalMargen / totalVentas) * 100).toFixed(1) : '0.0',
      unidadesVendidas: unidades.toLocaleString(),
      variacionUnidades: calcVar(unidades, prevUnidades),
      ticketPromedio: unidades > 0 ? (totalVentas / (unidades * 0.6)).toLocaleString('es-PE', { minimumFractionDigits: 2 }) : '0.00'
    };
  }, [filteredData, previousPeriodData]);

  const kpisPorSede = useMemo(() => {
    const agrupado: Record<string, { name: string; ventas: number; costo: number; margen: number; transacciones: number; margenPct: number }> = {};
    filteredData.forEach(v => {
        // Fix: Typo corrigido 'agruado' -> 'agrupado'
        if (!agrupado[v.sede]) agrupado[v.sede] = { name: v.sede, ventas: 0, costo: 0, margen: 0, transacciones: 0, margenPct: 0 };
        agrupado[v.sede].ventas += v.total; agrupado[v.sede].costo += v.costo; agrupado[v.sede].margen += v.margen; agrupado[v.sede].transacciones += 1;
    });
    return Object.values(agrupado).map(item => ({ ...item, margenPct: item.ventas > 0 ? (item.margen / item.ventas) * 100 : 0 })).sort((a, b) => b.ventas - a.ventas);
  }, [filteredData]);

  const ventasPorDia = useMemo(() => {
    const agrupado: Record<string, AgrupadoPorDia> = {};
    filteredData.forEach(v => {
      const fecha = v.fecha.toLocaleDateString('en-CA');
      if (!agrupado[fecha]) agrupado[fecha] = { fecha, ventas: 0, margen: 0 };
      agrupado[fecha].ventas += v.total; agrupado[fecha].margen += v.margen;
    });
    return Object.values(agrupado).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [filteredData]);

  const comparativaSedes = useMemo(() => {
      const agg: Record<string, { name: string; ventas: number; margen: number }> = {};
      filteredData.forEach(v => {
          const sede = v.sede || 'Sin Sede';
          if (!agg[sede]) agg[sede] = { name: sede, ventas: 0, margen: 0 };
          agg[sede].ventas += v.total; agg[sede].margen += v.margen;
      });
      return Object.values(agg).sort((a, b) => b.ventas - a.ventas);
  }, [filteredData]);

  const ventasPorCategoria = useMemo(() => {
      const agg: Record<string, number> = {};
      filteredData.forEach(v => { const cat = v.categoria || 'Sin Categoría'; agg[cat] = (agg[cat] || 0) + v.total; });
      return Object.entries(agg).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const ventasPorMetodoPago = useMemo(() => {
      const agg: Record<string, number> = {};
      filteredData.forEach(v => { const metodo = v.metodoPago || 'No definido'; agg[metodo] = (agg[metodo] || 0) + v.total; });
      return Object.entries(agg).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const handleDownloadExcel = () => {
    try {
        const wb = XLSX.utils.book_new();
        const headers = [["PRODUCTO", "SEDE", "MÉTODO DE PAGO", "UNIDADES", "VENTA NETA (S/)", "MARGEN %"]];
        const body = filteredData.map(p => [p.producto, p.sede, p.metodoPago, p.cantidad, p.total, p.margenPorcentaje]);
        const ws = XLSX.utils.aoa_to_sheet([...headers, ...body]);
        XLSX.utils.book_append_sheet(wb, ws, "Ventas");
        XLSX.writeFile(wb, `Reporte_LemonBI_${dateRange.start}.xlsx`);
    } catch (e) { alert("Error al generar el reporte."); }
  };

  const isRentabilidad = view === 'rentabilidad';
  const chartDataKey = isRentabilidad ? 'margen' : 'ventas'; 
  const chartColor = isRentabilidad ? '#84cc16' : '#0ea5e9'; 
  const chartLabel = isRentabilidad ? 'Ganancia' : 'Venta Neta';

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const ANIOS = [2023, 2024, 2025];
  const COLORS = ['#84cc16', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#f43f5e', '#6366f1'];

  const paginatedData = useMemo(() => filteredData.slice(0, itemsPerPage), [filteredData]);

  const VariacionBadge = ({ val }: { val: number }) => {
      if (isNaN(val)) return null;
      const isPositive = val >= 0;
      return (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-2 flex items-center gap-0.5 ${isPositive ? 'bg-brand-100 text-brand-700' : 'bg-red-50 text-red-600'}`}>
              {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {Math.abs(val).toFixed(1)}%
          </span>
      );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 font-sans w-full relative pb-20 text-slate-700">
      <OdooConfigModal 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)} 
        initialConfig={session ? { url: session.url, db: session.db, username: session.username, apiKey: session.apiKey } : { url: '', db: '', username: '', apiKey: '' }} 
        onSave={() => setIsConfigOpen(false)} 
      />
      
      {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center h-screen fixed">
              <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4 border border-slate-100 relative z-10">
                <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
                <span className="font-medium text-slate-600">Sincronizando con Odoo...</span>
              </div>
          </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-2">
           <div>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                {view === 'comparativa' ? 'Rendimiento de Sedes y Cajas' : view === 'pagos' ? 'Ingresos y Tesorería' : 'Dashboard de Operaciones'}
                {filterMode === 'hoy' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-brand-100 text-brand-700 border border-brand-200 animate-pulse uppercase"><Zap className="w-3 h-3 mr-1" /> Tiempo Real</span>}
           </h1>
              <p className="text-slate-500 text-sm font-light mt-1">Sincronizado con: <span className="text-brand-600 font-bold">{session?.companyName || 'Modo Demo'}</span> | {dateRange.start}</p>
           </div>
           <div className="mt-4 md:mt-0 flex gap-3">
              <button onClick={() => fetchData()} className="flex items-center gap-2 bg-white text-slate-600 px-4 py-2 rounded-xl border border-slate-200 font-medium text-sm hover:bg-slate-50 shadow-sm transition-all"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar</button>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs uppercase shadow-sm ${session ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{session ? 'Online' : 'Demo'}</div>
           </div>
        </div>

        {error && ( <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex gap-3 items-center shadow-sm"><AlertCircle className="w-5 h-5 text-red-500" /><p className="text-sm">{error}</p></div> )}

        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-500"></div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-4 items-end border-b border-slate-100 pb-4">
                <div className="w-full md:w-auto">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Punto de Venta</label>
                    <select 
                        value={filtros.sedeSeleccionada} 
                        onChange={(e) => setFiltros({...filtros, sedeSeleccionada: e.target.value})} 
                        className="w-full md:w-56 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    >
                        {sedes.map(sede => <option key={sede} value={sede}>{sede}</option>)}
                    </select>
                </div>
            </div>
            <div className="flex flex-wrap gap-6 items-center">
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Periodo de Visualización</label>
                   <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                       <button onClick={() => setFilterMode('hoy')} className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${filterMode === 'hoy' ? 'bg-white text-brand-600 shadow-sm border border-slate-200' : 'text-slate-400'}`}>Hoy</button>
                       <button onClick={() => setFilterMode('mes')} className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${filterMode === 'mes' ? 'bg-white text-brand-600 shadow-sm border border-slate-200' : 'text-slate-400'}`}>Mes</button>
                       <button onClick={() => setFilterMode('anio')} className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${filterMode === 'anio' ? 'bg-white text-brand-600 shadow-sm border border-slate-200' : 'text-slate-400'}`}>Año</button>
                       <button onClick={() => setFilterMode('custom')} className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${filterMode === 'custom' ? 'bg-white text-brand-600 shadow-sm border border-slate-200' : 'text-slate-400'}`}>Personalizado</button>
                   </div>
                </div>
                {filterMode === 'mes' && (
                    <div className="flex gap-4">
                        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm">{ANIOS.map(y => <option key={y} value={y}>{y}</option>)}</select>
                        <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm">{MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
                    </div>
                )}
                {filterMode === 'custom' && (
                    <div className="flex gap-2 items-center">
                        <input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm" />
                        <span className="text-slate-300">→</span>
                        <input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm" />
                    </div>
                )}
            </div>
          </div>
        </div>

        {view === 'pagos' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-800 text-white rounded-2xl shadow-xl p-6 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-4"><div className="p-3 bg-white/10 rounded-xl"><Wallet className="w-6 h-6 text-emerald-400" /></div><span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Recaudado</span></div>
                        <h3 className="text-3xl font-bold">S/ {kpis.totalVentas}</h3><p className="text-slate-400 text-xs mt-1">Venta bruta (IGV incluido)</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-4"><div className="p-3 bg-brand-50 rounded-xl text-brand-600"><Target className="w-6 h-6" /></div><span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Método Top</span></div>
                        <h3 className="text-2xl font-bold text-slate-800">{ventasPorMetodoPago[0]?.name || 'N/A'}</h3><p className="text-slate-500 text-xs mt-1">S/ {ventasPorMetodoPago[0]?.value.toLocaleString()}</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-4"><div className="p-3 bg-blue-50 rounded-xl text-blue-600"><CalendarRange className="w-6 h-6" /></div><span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Transacciones</span></div>
                        <h3 className="text-2xl font-bold text-slate-800">{kpis.unidadesVendidas}</h3><p className="text-slate-500 text-xs mt-1">Operaciones realizadas</p>
                    </div>
                </div>
            </div>
        ) : drillDownSede ? (
            <div className="bg-brand-50 border border-brand-200 text-brand-800 px-5 py-4 rounded-xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4"><div className="bg-brand-100 p-2 rounded-lg"><Store className="w-5 h-5 text-brand-600" /></div><div><p className="text-[10px] uppercase font-bold text-brand-500">Punto de Venta</p><p className="font-bold text-xl text-slate-800">{drillDownSede}</p></div></div>
                <button onClick={() => setDrillDownSede(null)} className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 transition-all hover:bg-slate-50"><X className="w-4 h-4" /> Salir del Detalle</button>
            </div>
        ) : view === 'comparativa' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {kpisPorSede.map((sede, idx) => (
                <div key={idx} className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 hover:shadow-xl hover:border-brand-200 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-brand-50 rounded-bl-full opacity-50 group-hover:bg-brand-100"></div>
                    <div className="flex justify-between items-start mb-4 relative z-10"><div className="p-2 bg-brand-50 rounded-lg text-brand-600"><Store className="w-5 h-5" /></div><button onClick={() => setDrillDownSede(sede.name)} className="text-[9px] font-bold text-brand-600 bg-brand-100 px-2 py-1 rounded uppercase flex items-center gap-1">Ver Detalle <ArrowUpRight className="w-3 h-3"/></button></div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4 truncate">{sede.name}</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-bold text-slate-400 uppercase">Venta</span><span className="text-sm font-bold text-slate-700">S/ {sede.ventas.toLocaleString()}</span></div>
                        <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-bold text-slate-400 uppercase">Margen</span><span className="text-sm font-bold text-brand-600">S/ {sede.margen.toLocaleString()}</span></div>
                        <div className="pt-2"><div className="flex justify-between text-[10px] font-bold mb-1"><span className="text-slate-400">Rentabilidad</span><span className="text-brand-600">{sede.margenPct.toFixed(1)}%</span></div><div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"><div className="bg-brand-500 h-full" style={{ width: `${Math.min(sede.margenPct, 100)}%` }}></div></div></div>
                    </div>
                </div>
              ))}
          </div>
        ) : (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className={`bg-gradient-to-br ${isRentabilidad ? 'from-slate-700 to-slate-800' : 'from-brand-500 to-brand-600'} rounded-2xl shadow-lg p-6 flex flex-col justify-between hover:scale-[1.02] transition-transform relative overflow-hidden group`}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                                {isRentabilidad ? <DollarSign className="w-6 h-6 text-white" /> : <TrendingUp className="w-6 h-6 text-white" />}
                            </div>
                            <VariacionBadge val={kpis.variacionVentas} />
                        </div>
                        <div className="relative z-10">
                            <p className="text-white/80 text-sm font-medium tracking-wide">Venta Total (con IGV)</p>
                            <h3 className="text-3xl font-bold text-white mt-1 tracking-tight">S/ {kpis.totalVentas}</h3>
                        </div>
                    </div>
                    <div className={`rounded-2xl shadow-md border p-6 flex flex-col justify-between hover:scale-[1.02] transition-all bg-white ${isRentabilidad ? 'border-brand-200' : 'border-slate-100'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-2.5 rounded-xl ${isRentabilidad ? 'bg-brand-100 text-brand-600' : 'bg-blue-50 text-blue-600'}`}>
                                {isRentabilidad ? <TrendingUp className="w-6 h-6" /> : <Receipt className="w-6 h-6" />}
                            </div>
                            {isRentabilidad && <VariacionBadge val={kpis.variacionMargen} />}
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm font-medium">{isRentabilidad ? 'Ganancia Neta' : 'Ticket Promedio Est.'}</p>
                            <h3 className={`text-3xl font-bold mt-1 tracking-tight ${isRentabilidad ? 'text-brand-600' : 'text-slate-800'}`}>S/ {isRentabilidad ? kpis.totalMargen : kpis.ticketPromedio}</h3>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 flex flex-col justify-between hover:scale-[1.02] transition-all duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2.5 bg-violet-50 rounded-xl text-violet-600"><Package className="w-6 h-6" /></div>
                            <VariacionBadge val={kpis.variacionUnidades} />
                        </div>
                        <div><p className="text-slate-500 text-sm font-medium">Items Procesados</p><h3 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{kpis.unidadesVendidas}</h3></div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 flex flex-col justify-between hover:scale-[1.02] transition-all duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2.5 bg-orange-50 rounded-xl text-orange-600"><Store className="w-6 h-6" /></div>
                        </div>
                        <div><p className="text-slate-500 text-sm font-medium">Margen Promedio %</p><h3 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{kpis.margenPromedio}%</h3></div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><ArrowUpRight className="w-5 h-5 text-brand-500"/> Tendencia de Ventas (Diario)</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={ventasPorDia} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <defs><linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/><stop offset="95%" stopColor={chartColor} stopOpacity={0}/></linearGradient></defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="fecha" tickFormatter={(v) => new Date(v + 'T00:00:00').toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })} stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} dy={10} />
                                    <YAxis stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} dx={-10} tickFormatter={(v) => `S/${v}`} />
                                    <Tooltip formatter={(val: number) => [`S/ ${Number(val).toFixed(2)}`, chartLabel]} contentStyle={{borderRadius: '12px', border: 'none'}} />
                                    <Area type="monotone" dataKey={chartDataKey} stroke={chartColor} fillOpacity={1} fill="url(#colorVentas)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            {view === 'ventas' ? <CreditCard className="w-5 h-5 text-emerald-500"/> : <PieChartIcon className="w-5 h-5 text-violet-500"/>}
                            {view === 'ventas' ? 'Distribución por Método de Pago' : 'Participación por Categoría'}
                        </h3>
                        <div className="h-[300px] w-full flex">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={view === 'ventas' ? ventasPorMetodoPago : ventasPorCategoria} cx="50%" cy="50%" innerRadius={70} outerRadius={90} fill="#8884d8" paddingAngle={3} dataKey="value" stroke="#fff" strokeWidth={3}>
                                        {(view === 'ventas' ? ventasPorMetodoPago : ventasPorCategoria).map((_, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}
                                    </Pie>
                                    <Tooltip formatter={(val: number) => `S/ ${val.toFixed(2)}`} contentStyle={{borderRadius: '12px', border: 'none'}} />
                                    <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px'}} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><MapPin className="w-5 h-5 text-brand-500"/> Comparativa por Punto de Venta</h3>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={comparativaSedes} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} dy={10} />
                                <YAxis stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} dx={-10} tickFormatter={(val) => `S/${val}`} />
                                <Tooltip formatter={(val: number) => [`S/ ${Number(val).toFixed(2)}`, '']} contentStyle={{borderRadius: '12px', border: 'none'}} />
                                <Legend wrapperStyle={{paddingTop: '20px'}} />
                                <Bar dataKey="ventas" name="Venta Total" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="margen" name="Ganancia" fill="#84cc16" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </>
        )}

        {((view !== 'pagos' && view !== 'comparativa') || drillDownSede) && (
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-brand-600" /> Detalle de Ventas</h3>
                    <button onClick={handleDownloadExcel} className="px-4 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all flex items-center gap-2"><Download className="w-4 h-4" /> Exportar</button>
                </div>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 font-bold tracking-wider">
                        <tr><th className="px-4 py-4">Producto</th><th className="px-4 py-4">Sede</th><th className="px-4 py-4">Pago</th><th className="px-4 py-4 text-right">Unds.</th><th className="px-4 py-4 text-right">Venta (IGV Inc.)</th><th className="px-4 py-4 text-right">Margen %</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {paginatedData.map((v: any, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3.5 font-medium text-slate-700 truncate max-w-[200px]">{v.producto}</td>
                                <td className="px-4 py-3.5 text-slate-500 text-xs">{v.sede}</td>
                                <td className="px-4 py-3.5"><span className="px-2 py-0.5 rounded bg-brand-50 text-brand-700 text-[10px] font-bold">{v.metodoPago}</span></td>
                                <td className="px-4 py-3.5 text-right font-mono">{v.cantidad}</td>
                                <td className="px-4 py-3.5 text-right font-bold text-slate-800">S/ {v.total?.toFixed(2)}</td>
                                <td className="px-4 py-3.5 text-right"><span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-100 text-brand-700">{v.margenPorcentaje}%</span></td>
                            </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
