import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { TrendingUp, DollarSign, Package, ArrowUpRight, RefreshCw, AlertCircle, Building2, Store, Download, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown, ListFilter, LayoutGrid, Receipt, X, Target } from 'lucide-react';
import { Venta, Filtros, AgrupadoPorDia, OdooSession } from '../types';
import OdooConfigModal from './OdooConfigModal';
import { OdooClient } from '../services/odoo';
// @ts-ignore
import * as XLSX from 'xlsx';

// Generador de datos dinámico basado en el rango solicitado
const generarDatosVentas = (startStr: string, endStr: string): Venta[] => {
  const estructura = [
      { compania: 'BOTICAS MULTIFARMA S.A.C.', sedes: ['Multifarmas', 'Cristo Rey', 'Lomas', 'Tienda 4'] },
      { compania: 'CONSULTORIO MEDICO REQUESALUD', sedes: ['Caja Requesalud'] }
  ];

  const productos = [
    { id: 1, nombre: 'Paracetamol 500mg Genérico', costo: 0.50, precio: 2.00 },
    { id: 2, nombre: 'Amoxicilina 500mg Blister', costo: 1.20, precio: 3.50 },
    { id: 3, nombre: 'Ibuprofeno 400mg Caja', costo: 8.00, precio: 15.00 },
    { id: 4, nombre: 'Ensure Advance Vainilla', costo: 85.00, precio: 105.00 },
    { id: 5, nombre: 'Panales Huggies XG', costo: 45.00, precio: 58.00 },
    { id: 6, nombre: 'Consulta Médica General', costo: 0.00, precio: 50.00 },
    { id: 7, nombre: 'Inyectable - Servicio', costo: 1.00, precio: 10.00 },
    { id: 8, nombre: '[LAB] HEMOGRAMA COMPLETO', costo: 15.00, precio: 35.00 },
    { id: 9, nombre: '[ECO] ABDOMINAL COMPLETA', costo: 40.00, precio: 120.00 }
  ];

  const ventas: Venta[] = [];
  const fechaInicio = new Date(`${startStr}T00:00:00`);
  const fechaFin = new Date(`${endStr}T23:59:59`);

  for (let d = new Date(fechaInicio); d <= fechaFin; d.setDate(d.getDate() + 1)) {
    estructura.forEach(emp => {
        const ventasPorDia = Math.floor(Math.random() * 6) + 1; 
        
        for (let i = 0; i < ventasPorDia; i++) {
            const sede = emp.sedes[Math.floor(Math.random() * emp.sedes.length)];
            
            if (sede === 'Tienda 4') {
                const fechaCierreTienda4 = new Date('2024-08-31');
                if (d > fechaCierreTienda4) continue; 
            }

            const producto = productos[Math.floor(Math.random() * productos.length)];
            let prodFinal = producto;
            if (emp.compania.includes('CONSULTORIO')) {
                 if (Math.random() > 0.6) prodFinal = productos.find(p => p.nombre.includes('Consulta') || p.nombre.includes('[LAB]') || p.nombre.includes('[ECO]')) || producto;
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
                producto: prodFinal.nombre,
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

type SortKey = 'producto' | 'cantidad' | 'transacciones' | 'costo' | 'ventaNeta' | 'ventaBruta' | 'ganancia' | 'margenPorcentaje';
interface SortConfig {
  key: SortKey;
  direction: 'asc' | 'desc';
}
type FilterMode = 'mes' | 'anio' | 'custom';

const Dashboard: React.FC<DashboardProps> = ({ session, view = 'general' }) => {
  const [ventasData, setVentasData] = useState<Venta[]>([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'ventaNeta', direction: 'desc' });
  
  // Nuevo Estado: Drill-Down por Sede
  const [drillDownSede, setDrillDownSede] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); 

  const [filterMode, setFilterMode] = useState<FilterMode>('mes');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  
  const [dateRange, setDateRange] = useState({
      start: new Date(currentYear, currentMonth, 1).toLocaleDateString('en-CA'),
      end: new Date(currentYear, currentMonth + 1, 0).toLocaleDateString('en-CA')
  });

  const [filtros, setFiltros] = useState<Filtros>({
    sedeSeleccionada: 'Todas',
    companiaSeleccionada: session?.companyName || 'Todas',
    periodoSeleccionado: 'mes',
    fechaInicio: '', 
    fechaFin: ''
  });

  // Limpiar selección de sede cuando cambia la vista o los filtros globales
  useEffect(() => {
    setDrillDownSede(null);
  }, [view, dateRange]);

  useEffect(() => {
      let start = '';
      let end = '';

      if (filterMode === 'mes') {
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
      setDrillDownSede(null); // Reset drilldown on fetch
      
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
          }, 600);
          return;
      }

      const client = new OdooClient(session.url, session.db, session.useProxy);
      const modelOrder = 'pos.order';
      const fieldsOrder = ['date_order', 'config_id', 'lines', 'company_id', 'partner_id', 'pos_reference', 'name'];

      const domain: any[] = [
        ['state', '!=', 'cancel'], 
        ['state', '!=', 'draft'],
        ['date_order', '>=', `${queryStart} 00:00:00`],
        ['date_order', '<=', `${queryEnd} 23:59:59`]
      ];

      if (session.companyId) {
          domain.push(['company_id', '=', session.companyId]);
      }

      const options: any = { limit: 5000, order: 'date_order desc' }; 

      try {
          if (session.companyId) options.context = { allowed_company_ids: [session.companyId] };
          const ordersRaw: any[] = await client.searchRead(session.uid, session.apiKey, modelOrder, domain, fieldsOrder, options);

          if (!ordersRaw || ordersRaw.length === 0) {
             setVentasData([]);
             setLoading(false);
             return;
          }

          const allLineIds = ordersRaw.flatMap((o: any) => o.lines || []);
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
          const fieldsLine = ['product_id', 'qty', 'price_subtotal', 'price_subtotal_incl']; 

          for (const chunk of lineChunks) {
              const linesData = await client.searchRead(session.uid, session.apiKey, 'pos.order.line', [['id', 'in', chunk]], fieldsLine);
              if (linesData) allLinesData = allLinesData.concat(linesData);
          }

          const productIds = new Set(allLinesData.map((l: any) => Array.isArray(l.product_id) ? l.product_id[0] : null).filter(id => id));
          let productCostMap = new Map<number, number>();

          if (productIds.size > 0) {
              const productChunks = chunkArray(Array.from(productIds), 1000);
              for (const pChunk of productChunks) {
                  const productsData = await client.searchRead(session.uid, session.apiKey, 'product.product', [['id', 'in', pChunk]], ['standard_price']);
                  if (productsData) {
                      productsData.forEach((p: any) => productCostMap.set(p.id, p.standard_price || 0));
                  }
              }
          }

          const linesMap = new Map(allLinesData.map((l: any) => [l.id, l]));
          const mappedVentas: Venta[] = [];

          ordersRaw.forEach((order: any) => {
              const orderDate = new Date((order.date_order || "").replace(" ", "T") + "Z");
              const sede = Array.isArray(order.config_id) ? order.config_id[1] : 'Caja General';
              const compania = Array.isArray(order.company_id) ? order.company_id[1] : 'Empresa Principal';
              
              if (order.lines && Array.isArray(order.lines)) {
                  order.lines.forEach((lineId: number) => {
                      const line = linesMap.get(lineId);
                      if (line) {
                          const productId = Array.isArray(line.product_id) ? line.product_id[0] : 0;
                          const productName = Array.isArray(line.product_id) ? line.product_id[1] : 'Producto Desconocido';
                          const ventaNeta = line.price_subtotal || 0; 
                          const ventaBruta = line.price_subtotal_incl || 0; 
                          let unitCost = productCostMap.get(productId) || 0;
                          
                          if (unitCost === 0) {
                             if (productName.toUpperCase().includes('CONSULTA') || productName.toUpperCase().includes('SERVICIO')) {
                                 unitCost = (ventaNeta / (line.qty || 1)) * 0.10; 
                             } else {
                                 unitCost = (ventaNeta / (line.qty || 1)) * 0.65; 
                             }
                          }

                          const costoTotal = unitCost * (line.qty || 1);
                          const margen = ventaNeta - costoTotal; 

                          mappedVentas.push({
                              fecha: orderDate,
                              sede,
                              compania,
                              producto: productName,
                              cantidad: line.qty || 1,
                              total: ventaNeta, 
                              costo: costoTotal,
                              margen,
                              margenPorcentaje: ventaNeta > 0 ? ((margen / ventaNeta) * 100).toFixed(1) : '0.0',
                              // @ts-ignore
                              ventaBrutaReal: ventaBruta 
                          });
                      }
                  });
              } else {
                  const total = order.amount_total || 0; 
                  const net = total / 1.18; 
                  const costo = net * 0.65;
                  mappedVentas.push({
                      fecha: orderDate,
                      sede,
                      compania,
                      producto: 'Venta General (Sin Detalle)',
                      cantidad: 1,
                      total: net,
                      costo,
                      margen: net - costo,
                      margenPorcentaje: '35.0',
                      // @ts-ignore
                      ventaBrutaReal: total
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

  useEffect(() => {
      fetchData();
  }, [fetchData]); 

  // 1. Datos base filtrados globalmente (Top Bars)
  const datosBase = useMemo(() => {
    let datos = ventasData;
    const startStr = dateRange.start;
    const endStr = dateRange.end;
    
    datos = datos.filter(v => {
        const vDate = v.fecha.toLocaleDateString('en-CA'); 
        return vDate >= startStr && vDate <= endStr;
    });

    if (filtros.sedeSeleccionada !== 'Todas') {
        datos = datos.filter(v => v.sede === filtros.sedeSeleccionada);
    }
    if (!session && filtros.companiaSeleccionada !== 'Todas') {
         datos = datos.filter(v => v.compania.includes(filtros.companiaSeleccionada));
    }
    return datos;
  }, [ventasData, filtros, dateRange, session]);

  const sedes = useMemo(() => {
      let base = ventasData;
      if (!session && filtros.companiaSeleccionada !== 'Todas') {
         base = ventasData.filter(v => v.compania.includes(filtros.companiaSeleccionada));
      }
      return ['Todas', ...Array.from(new Set(base.map(v => v.sede)))];
  }, [ventasData, filtros.companiaSeleccionada, session]);

  // 2. Datos Activos para Gráficos y Tablas (Responden al Click de Sede)
  const activeData = useMemo(() => {
      if (drillDownSede) {
          return datosBase.filter(v => v.sede === drillDownSede);
      }
      return datosBase;
  }, [datosBase, drillDownSede]);

  // KPIs
  const kpis = useMemo(() => {
    // Calculamos KPIs basados en activeData para que cambien al drilldown? 
    // MEJOR: KPIs Generales (Top) siempre muestran el global del filtro superior, 
    // y añadimos un banner de detalle cuando hay drilldown.
    // Pero si es Dashboard General, mostramos métricas de Volumen.
    // Si es Rentabilidad, métricas de Dinero.
    
    const dataToUse = datosBase; // KPIs top level respetan filtro global
    const totalVentas = dataToUse.reduce((sum, v) => sum + v.total, 0);
    const totalCostos = dataToUse.reduce((sum, v) => sum + v.costo, 0);
    const totalMargen = totalVentas - totalCostos;
    const margenPromedio = totalVentas > 0 ? ((totalMargen / totalVentas) * 100) : 0;
    const unidadesVendidas = dataToUse.length; // Aproximación por lineas
    const ticketPromedio = unidadesVendidas > 0 ? (totalVentas / (unidadesVendidas * 0.6)) : 0; // Estimación simple
    
    return {
      totalVentas: totalVentas.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      totalMargen: totalMargen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      margenPromedio: margenPromedio.toFixed(1),
      unidadesVendidas: unidadesVendidas.toLocaleString(),
      ticketPromedio: ticketPromedio.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    };
  }, [datosBase]);

  // Gráficos Evolutivos
  const ventasPorDia = useMemo(() => {
    const agrupado: Record<string, AgrupadoPorDia> = {};
    activeData.forEach(v => {
      const fecha = v.fecha.toLocaleDateString('en-CA');
      if (!agrupado[fecha]) agrupado[fecha] = { fecha, ventas: 0, margen: 0 };
      agrupado[fecha].ventas += v.total;
      agrupado[fecha].margen += v.margen;
    });
    return Object.values(agrupado).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [activeData]);

  // Top Productos (Para Dashboard General)
  const topProductosVolumen = useMemo(() => {
      const agg: Record<string, number> = {};
      activeData.forEach(v => {
          agg[v.producto] = (agg[v.producto] || 0) + v.total;
      });
      return Object.entries(agg)
        .map(([name, val]) => ({ name, val }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 5);
  }, [activeData]);

  // Tarjetas de Sedes (SIEMPRE usan datosBase para no desaparecer al filtrar)
  const infoSedesDetallada = useMemo(() => {
    const agrupado: Record<string, {
        sede: string;
        ventas: number;
        margen: number;
        productos: Record<string, number>; 
    }> = {};

    datosBase.forEach(v => {
        if (!agrupado[v.sede]) {
            agrupado[v.sede] = { sede: v.sede, ventas: 0, margen: 0, productos: {} };
        }
        agrupado[v.sede].ventas += v.total;
        agrupado[v.sede].margen += v.margen;
        
        if (!agrupado[v.sede].productos[v.producto]) {
            agrupado[v.sede].productos[v.producto] = 0;
        }
        agrupado[v.sede].productos[v.producto] += v.total;
    });

    return Object.values(agrupado).map(s => {
        const topProductos = Object.entries(s.productos)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3) 
            .map(([nombre, total]) => ({ nombre, total }));

        return {
            ...s,
            margenPorcentaje: s.ventas > 0 ? ((s.margen / s.ventas) * 100).toFixed(1) : '0.0',
            topProductos
        };
    }).sort((a, b) => b.ventas - a.ventas);
  }, [datosBase]); // <-- Importante: Depende de datosBase, no activeData

  const reporteProductos = useMemo(() => {
    const agrupado: Record<string, any> = {};
    activeData.forEach(v => {
      if (!agrupado[v.producto]) {
          agrupado[v.producto] = { 
              producto: v.producto, 
              cantidad: 0, 
              transacciones: 0,
              costo: 0,
              ventaNeta: 0, 
              ventaBruta: 0,
              ganancia: 0
          };
      }
      agrupado[v.producto].cantidad += v.cantidad;
      agrupado[v.producto].transacciones += 1;
      agrupado[v.producto].costo += v.costo;
      agrupado[v.producto].ventaNeta += v.total; 
      // @ts-ignore
      agrupado[v.producto].ventaBruta += (v.ventaBrutaReal || v.total); 
      agrupado[v.producto].ganancia += v.margen;
    });

    return Object.values(agrupado)
        .map(p => ({
            ...p,
            margenPorcentaje: p.ventaNeta > 0 ? (p.ganancia / p.ventaNeta) * 100 : 0
        }))
        .sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (typeof valA === 'string') {
                return sortConfig.direction === 'asc' 
                    ? valA.localeCompare(valB) 
                    : valB.localeCompare(valA);
            }
            return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        });
  }, [activeData, sortConfig]);

  const handleSort = (key: SortKey) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
      if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1 inline" />;
      return sortConfig.direction === 'asc' 
          ? <ArrowUp className="w-3 h-3 text-emerald-600 ml-1 inline" />
          : <ArrowDown className="w-3 h-3 text-emerald-600 ml-1 inline" />;
  };

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const ANIOS = [2023, 2024, 2025];
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  const handleDownloadExcel = () => {
    // Preparar datos para Excel con nombres de columnas amigables
    const dataToExport = reporteProductos.map(p => ({
        'Producto': p.producto,
        'Unidades': p.cantidad,
        '# Transacciones': p.transacciones,
        'Costo Total': Number(p.costo.toFixed(2)),
        'Venta Neta': Number(p.ventaNeta.toFixed(2)),
        'Venta Bruta': Number(p.ventaBruta.toFixed(2)),
        'Ganancia': Number(p.ganancia.toFixed(2)),
        'Margen %': Number(p.margenPorcentaje.toFixed(2)) / 100 // Para formato porcentaje en Excel
    }));

    // Crear hoja de trabajo
    const ws = XLSX.utils.json_to_sheet(dataToExport);

    // Ajustar ancho de columnas (aproximado)
    const wscols = [
        { wch: 40 }, // Producto
        { wch: 10 }, // Unidades
        { wch: 15 }, // Transacciones
        { wch: 15 }, // Costo
        { wch: 15 }, // Venta Neta
        { wch: 15 }, // Venta Bruta
        { wch: 15 }, // Ganancia
        { wch: 12 }, // Margen %
    ];
    ws['!cols'] = wscols;

    // Crear libro de trabajo
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detalle Productos");

    // Generar nombre de archivo
    const fileName = `Reporte_Ventas_${dateRange.start}_${dateRange.end}.xlsx`;
    
    // Descargar
    XLSX.writeFile(wb, fileName);
  };

  // --- LÓGICA DE VISTAS ---
  const isRentabilidad = view === 'rentabilidad';
  
  // En General: Color azul, datos de Venta. En Rentabilidad: Color esmeralda, datos de Margen.
  const chartDataKey = isRentabilidad ? 'margen' : 'ventas'; 
  const chartColor = isRentabilidad ? '#10b981' : '#3b82f6'; 
  const chartLabel = isRentabilidad ? 'Ganancia' : 'Venta Neta';

  // Control de Secciones
  const showKPIs = true; // Siempre mostrar
  const showSedeGrid = isRentabilidad; // Solo en rentabilidad
  const showGeneralCharts = view === 'general'; // Charts de volumen solo en general
  
  // La tabla se muestra siempre, pero en General se prioriza volumen y en Rentabilidad se prioriza margen
  // (Aunque es la misma tabla, el contexto visual cambia)

  return (
    <div className="p-4 md:p-6 lg:p-8 font-sans w-full relative">
      <OdooConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
      
      {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3 border border-slate-100">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                  <span className="font-medium text-slate-700">Procesando Datos...</span>
              </div>
          </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-2">
           <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {view === 'rentabilidad' ? 'Rentabilidad y Ganancias' : 
                 view === 'ventas' ? 'Gestión de Ventas' :
                 view === 'reportes' ? 'Reportes Gráficos' : 'Dashboard General'}
              </h1>
              <p className="text-slate-500 text-sm font-light">
                  {session ? `Compañía: ${session.companyName || 'Todas'}` : 'Modo Demo'} | {dateRange.start} al {dateRange.end}
              </p>
           </div>
           
           <div className="mt-4 md:mt-0 flex gap-3">
              <button 
                onClick={() => fetchData()}
                className="flex items-center gap-2 bg-white text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 font-medium text-sm hover:bg-slate-50 transition-colors shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Recargar
              </button>
              
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium text-sm ${session ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${session ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${session ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </span>
                {session ? 'En línea' : 'Demo'}
              </div>
           </div>
        </div>
        
        {error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex gap-3 items-center shadow-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div className="flex-1"><p className="text-sm opacity-90">{error}</p></div>
            </div>
        )}

        {/* FILTROS GLOBALES */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-4 items-end border-b border-slate-100 pb-4">
                <div className="w-full md:w-auto">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        <Building2 className="inline w-3 h-3 mr-1" />Compañía
                    </label>
                    {session?.companyName ? (
                        <div className="w-full md:w-48 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 font-medium flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            <span className="truncate">{session.companyName}</span>
                        </div>
                    ) : (
                        <select disabled className="w-full md:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed">
                            <option>Demo / Todas</option>
                        </select>
                    )}
                </div>
                <div className="w-full md:w-auto">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        <Store className="inline w-3 h-3 mr-1" />Punto de Venta
                    </label>
                    <select 
                        value={filtros.sedeSeleccionada}
                        onChange={(e) => setFiltros({...filtros, sedeSeleccionada: e.target.value})}
                        className="w-full md:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                        {sedes.map(sede => <option key={sede} value={sede}>{sede}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex flex-wrap gap-6 items-center">
                <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        <ListFilter className="inline w-3 h-3 mr-1" />Modo de Filtro
                   </label>
                   <div className="flex bg-slate-100 p-1 rounded-lg">
                       <button onClick={() => setFilterMode('mes')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filterMode === 'mes' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Por Mes</button>
                       <button onClick={() => setFilterMode('anio')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filterMode === 'anio' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Por Año</button>
                       <button onClick={() => setFilterMode('custom')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filterMode === 'custom' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Personalizado</button>
                   </div>
                </div>

                <div className="flex-1 flex items-center gap-4">
                    {filterMode === 'mes' && (
                        <>
                            <div className="w-32">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Año</label>
                                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none">{ANIOS.map(y => <option key={y} value={y}>{y}</option>)}</select>
                            </div>
                            <div className="w-40">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Mes</label>
                                <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none">{MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
                            </div>
                        </>
                    )}
                    {filterMode === 'anio' && (
                         <div className="w-32">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Año Fiscal</label>
                            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none">{ANIOS.map(y => <option key={y} value={y}>{y}</option>)}</select>
                        </div>
                    )}
                    {filterMode === 'custom' && (
                        <div className="flex gap-2 items-center">
                            <div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Desde</label><input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none" /></div>
                            <div className="h-px w-4 bg-slate-300 mt-6"></div>
                            <div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Hasta</label><input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none" /></div>
                        </div>
                    )}
                </div>
            </div>
          </div>
        </div>

        {/* INDICADOR DE FILTRO ACTIVO (DRILL DOWN) */}
        {drillDownSede && (
            <div className="bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-md flex items-center justify-between animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-1.5 rounded-md">
                        <Target className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs uppercase font-bold tracking-wider opacity-80">Visualizando Detalles de</p>
                        <p className="font-bold text-lg leading-tight">{drillDownSede}</p>
                    </div>
                </div>
                <button 
                    onClick={() => setDrillDownSede(null)}
                    className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                    <X className="w-4 h-4" />
                    Ver Todo
                </button>
            </div>
        )}

        {/* KPIs SUPERIORES */}
        {showKPIs && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* KPI 1: VENTA (Difiere visualmente según vista) */}
          <div className={`bg-gradient-to-br ${isRentabilidad ? 'from-slate-700 to-slate-800' : 'from-blue-600 to-blue-700'} rounded-xl shadow-lg p-6 flex flex-col justify-between`}>
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                  {isRentabilidad ? <DollarSign className="w-6 h-6 text-white" /> : <TrendingUp className="w-6 h-6 text-white" />}
              </div>
              <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-white/20 text-white rounded-full"><ArrowUpRight className="w-3 h-3" /> Global</span>
            </div>
            <div>
              <p className="text-white/80 text-sm font-medium tracking-wide opacity-90">{isRentabilidad ? 'Venta Total Acumulada' : 'Volumen de Ventas'}</p>
              <h3 className="text-3xl font-bold text-white mt-1 tracking-tight">S/ {kpis.totalVentas}</h3>
            </div>
          </div>

          {/* KPI 2: VARIABLE (Ganancia en Rentabilidad vs Ticket en General) */}
          <div className={`rounded-xl shadow-sm border p-6 flex flex-col justify-between transition-colors ${isRentabilidad ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${isRentabilidad ? 'bg-emerald-100' : 'bg-blue-50'}`}>
                  {isRentabilidad ? <TrendingUp className="w-6 h-6 text-emerald-600" /> : <Receipt className="w-6 h-6 text-blue-600" />}
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">{isRentabilidad ? 'Ganancia Neta' : 'Ticket Promedio Est.'}</p>
              <h3 className={`text-3xl font-bold mt-1 tracking-tight ${isRentabilidad ? 'text-emerald-700' : 'text-slate-800'}`}>
                  S/ {isRentabilidad ? kpis.totalMargen : kpis.ticketPromedio}
              </h3>
            </div>
          </div>

          {/* KPI 3: Items/Transacciones */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:border-purple-300 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-50 rounded-lg"><Package className="w-6 h-6 text-purple-600" /></div>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Items Procesados</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{kpis.unidadesVendidas}</h3>
            </div>
          </div>

          {/* KPI 4: Margen % */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:border-orange-300 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-50 rounded-lg"><Store className="w-6 h-6 text-orange-600" /></div>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Margen Promedio %</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{kpis.margenPromedio}%</h3>
            </div>
          </div>
        </div>
        )}

        {/* DASHBOARD GENERAL CHARTS (Volumen) */}
        {showGeneralCharts && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Tendencia de Ventas (Volumen)</h3>
                    <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={ventasPorDia} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="fecha" tickFormatter={(value) => new Date(value + 'T00:00:00').toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })} stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                        <YAxis stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} dx={-10} tickFormatter={(value) => `S/${value}`} />
                        <Tooltip formatter={(value: number) => [`S/ ${Number(value).toFixed(2)}`, 'Venta']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Top 5 Productos (Por Volumen S/)</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topProductosVolumen} layout="vertical" margin={{ left: 40, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 10}} />
                                <Tooltip formatter={(value: number) => [`S/ ${Number(value).toFixed(2)}`, 'Venta Total']} cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="val" radius={[0, 4, 4, 0]} barSize={20}>
                                    {topProductosVolumen.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        )}

        {/* RENTABILIDAD SECTION */}
        {showSedeGrid && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex items-center gap-2 mb-4">
                <LayoutGrid className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-800">Desempeño por Sede (Click para Filtrar)</h3>
            </div>
            
            {/* GRID DE SEDES (CLICABLE) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {infoSedesDetallada.map((sede, idx) => {
                    const isSelected = drillDownSede === sede.sede;
                    return (
                    <div 
                        key={idx} 
                        onClick={() => setDrillDownSede(isSelected ? null : sede.sede)}
                        className={`bg-white rounded-xl shadow-sm border p-5 transition-all cursor-pointer group relative overflow-hidden ${
                            isSelected 
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md transform scale-[1.02]' 
                            : 'border-slate-200 hover:border-emerald-300 hover:shadow-md'
                        }`}
                    >
                        {isSelected && <div className="absolute top-0 right-0 p-1.5 bg-emerald-500 rounded-bl-xl"><Target className="w-3 h-3 text-white" /></div>}
                        
                        <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-md ${isSelected ? 'bg-emerald-100' : 'bg-slate-100 group-hover:bg-emerald-50'}`}>
                                    <Store className={`w-4 h-4 ${isSelected ? 'text-emerald-700' : 'text-slate-600 group-hover:text-emerald-600'}`} />
                                </div>
                                <div>
                                    <h4 className={`font-bold leading-tight ${isSelected ? 'text-emerald-800' : 'text-slate-700'}`}>{sede.sede}</h4>
                                </div>
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-bold ${Number(sede.margenPorcentaje) > 20 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {sede.margenPorcentaje}% Rent.
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-5">
                            <div>
                                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-0.5">Ventas</p>
                                <p className="text-lg font-bold text-slate-800">S/ {sede.ventas.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-0.5">Ganancia</p>
                                <p className="text-lg font-bold text-emerald-600">S/ {sede.margen.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                            </div>
                        </div>

                        <div className={`rounded-lg p-3 border ${isSelected ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50/80 border-slate-100'}`}>
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">Top 3 Productos</p>
                            <div className="space-y-2">
                                {sede.topProductos.map((prod, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm group/item">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className="text-[10px] font-bold text-slate-300 w-3">{i+1}</span>
                                            <span className="text-slate-600 truncate text-xs font-medium group-hover/item:text-emerald-700 transition-colors" title={prod.nombre}>
                                                {prod.nombre}
                                            </span>
                                        </div>
                                        <span className="font-bold text-slate-700 text-xs shrink-0">S/ {prod.total.toFixed(0)}</span>
                                    </div>
                                ))}
                                {sede.topProductos.length === 0 && (
                                    <p className="text-xs text-slate-400 italic">Sin ventas registradas</p>
                                )}
                            </div>
                        </div>
                    </div>
                )})}
            </div>

            {/* CHART RENTABILIDAD (Drill Down Aware) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800">
                        {drillDownSede ? `Evolución de Ganancia: ${drillDownSede}` : 'Evolución de Ganancia (Global)'}
                    </h3>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ventasPorDia} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="fecha" tickFormatter={(value) => new Date(value + 'T00:00:00').toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })} stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                        <YAxis stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} dx={-10} tickFormatter={(value) => `S/${value}`} />
                        <Tooltip formatter={(value: number) => [`S/ ${Number(value).toFixed(2)}`, chartLabel]} labelFormatter={(label) => new Date(label + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey={chartDataKey} stroke={chartColor} strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} name={chartLabel} />
                    </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
          </div>
        )}

        {/* TABLA DE DETALLE (Siempre Visible, pero filtrada por drillDown) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-hidden animate-in fade-in slide-in-from-bottom-12 duration-1000">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div>
               <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                   <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                   {drillDownSede ? `Productos en ${drillDownSede}` : 'Detalle Global de Productos'}
               </h3>
               <p className="text-xs text-slate-500 font-light">
                   {drillDownSede ? 'Mostrando únicamente items vendidos en la sede seleccionada.' : 'Desglose general por item, costo real y rentabilidad.'}
               </p>
            </div>
            <button onClick={handleDownloadExcel} className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" />Descargar Excel
            </button>
          </div>
          <div className="overflow-x-auto border rounded-lg border-slate-100">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 select-none">
                <tr>
                  <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100 hover:text-emerald-700 transition-colors" onClick={() => handleSort('producto')}>Producto <SortIcon column="producto" /></th>
                  <th className="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-slate-100 hover:text-emerald-700 transition-colors" onClick={() => handleSort('cantidad')}>Unds. <SortIcon column="cantidad" /></th>
                  <th className="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-slate-100 hover:text-emerald-700 transition-colors" onClick={() => handleSort('transacciones')}>#Transac. <SortIcon column="transacciones" /></th>
                  <th className="px-4 py-3 font-semibold text-right text-slate-400 cursor-pointer hover:bg-slate-100 hover:text-emerald-700 transition-colors" onClick={() => handleSort('costo')}>Costo Total <SortIcon column="costo" /></th>
                  <th className="px-4 py-3 font-semibold text-right text-slate-700 cursor-pointer hover:bg-slate-100 hover:text-emerald-700 transition-colors" onClick={() => handleSort('ventaNeta')}>Venta Neta <SortIcon column="ventaNeta" /></th>
                  <th className="px-4 py-3 font-semibold text-right text-slate-400 cursor-pointer hover:bg-slate-100 hover:text-emerald-700 transition-colors" onClick={() => handleSort('ventaBruta')}>Venta Bruta <SortIcon column="ventaBruta" /></th>
                  <th className="px-4 py-3 font-semibold text-right text-emerald-700 bg-emerald-50/30 cursor-pointer hover:bg-emerald-100 transition-colors" onClick={() => handleSort('ganancia')}>Ganancia <SortIcon column="ganancia" /></th>
                  <th className="px-4 py-3 font-semibold text-right text-emerald-700 bg-emerald-50/30 cursor-pointer hover:bg-emerald-100 transition-colors" onClick={() => handleSort('margenPorcentaje')}>Margen % <SortIcon column="margenPorcentaje" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reporteProductos.length > 0 ? (
                    reporteProductos.map((prod, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-4 py-3 font-medium text-slate-800 group-hover:text-blue-600 transition-colors max-w-xs truncate" title={prod.producto}>{prod.producto}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{prod.cantidad}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{prod.transacciones}</td>
                        <td className="px-4 py-3 text-right text-slate-400">S/ {prod.costo.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">S/ {prod.ventaNeta.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-slate-400">S/ {prod.ventaBruta.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-600 bg-emerald-50/10">S/ {prod.ganancia.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-700 bg-emerald-50/10">
                            <span className={`px-2 py-0.5 rounded text-xs ${prod.margenPorcentaje < 20 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                                {prod.margenPorcentaje.toFixed(1)}%
                            </span>
                        </td>
                    </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">
                            No se encontraron productos para los filtros seleccionados.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;