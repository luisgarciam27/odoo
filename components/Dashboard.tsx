import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend, ScatterChart, Scatter, ZAxis, Area, AreaChart 
} from 'recharts';
import { TrendingUp, DollarSign, Package, ArrowUpRight, RefreshCw, AlertCircle, Building2, Store, Download, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown, ListFilter, Receipt, X, Target, ChevronLeft, ChevronRight, Users, PieChart as PieChartIcon, MapPin, CreditCard, Wallet, CalendarRange, Clock, LayoutGrid } from 'lucide-react';
import { Venta, Filtros, AgrupadoPorDia, OdooSession } from '../types';
import OdooConfigModal, { ConnectionConfig } from './OdooConfigModal';
import { OdooClient } from '../services/odoo';
// @ts-ignore
import * as XLSX from 'xlsx';

// --- GENERADOR DE DATOS (MOCK) ---
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

type SortKey = 'producto' | 'cantidad' | 'transacciones' | 'costo' | 'ventaNeta' | 'ventaBruta' | 'ganancia' | 'margenPorcentaje' | 'metodoPago' | 'sesion' | 'fecha';
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
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'fecha', direction: 'desc' });
  const [drillDownSede, setDrillDownSede] = useState<string | null>(null);

  // Estados de Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
      setDrillDownSede(null); 
      
      const bufferStart = new Date(dateRange.start);
      bufferStart.setDate(bufferStart.getDate() - 40); 
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
      const modelOrder = 'pos.order';
      // Added 'payment_ids' and 'session_id'
      const fieldsOrder = ['date_order', 'config_id', 'lines', 'company_id', 'user_id', 'pos_reference', 'name', 'payment_ids', 'session_id'];

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

          // --- FETCH ORDER LINES ---
          const lineChunks = chunkArray(allLineIds, 1000);
          let allLinesData: any[] = [];
          const fieldsLine = ['product_id', 'qty', 'price_subtotal', 'price_subtotal_incl']; 

          for (const chunk of lineChunks) {
              const linesData = await client.searchRead(session.uid, session.apiKey, 'pos.order.line', [['id', 'in', chunk]], fieldsLine);
              if (linesData) allLinesData = allLinesData.concat(linesData);
          }

          // --- FETCH PRODUCTS INFO (COST) ---
          const productIds = new Set(allLinesData.map((l: any) => Array.isArray(l.product_id) ? l.product_id[0] : null).filter(id => id));
          let productMap = new Map<number, {cost: number, cat: string}>();

          if (productIds.size > 0) {
              const productChunks = chunkArray(Array.from(productIds), 1000);
              for (const pChunk of productChunks) {
                  const productsData = await client.searchRead(session.uid, session.apiKey, 'product.product', [['id', 'in', pChunk]], ['standard_price', 'categ_id']);
                  if (productsData) {
                      productsData.forEach((p: any) => {
                          productMap.set(p.id, {
                              cost: p.standard_price || 0,
                              cat: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General'
                          });
                      });
                  }
              }
          }

          // --- FETCH PAYMENTS INFO ---
          let paymentMap = new Map<number, string>();
          if (allPaymentIds.length > 0) {
              const paymentChunks = chunkArray(allPaymentIds, 1000);
              for (const payChunk of paymentChunks) {
                  const paymentsData = await client.searchRead(session.uid, session.apiKey, 'pos.payment', [['id', 'in', payChunk]], ['payment_method_id', 'pos_order_id']);
                  if (paymentsData) {
                      paymentsData.forEach((p: any) => {
                          if (p.pos_order_id && p.payment_method_id) {
                              const orderId = p.pos_order_id[0];
                              const methodName = p.payment_method_id[1];
                              if (!paymentMap.has(orderId)) {
                                  paymentMap.set(orderId, methodName);
                              }
                          }
                      });
                  }
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
                          const ventaNeta = line.price_subtotal || 0; 
                          const prodInfo = productMap.get(productId) || { cost: 0, cat: 'Varios' };
                          let unitCost = prodInfo.cost;
                          
                          if (unitCost === 0) {
                             unitCost = (ventaNeta / (line.qty || 1)) * 0.65; 
                          }

                          const costoTotal = unitCost * (line.qty || 1);
                          const margen = ventaNeta - costoTotal; 

                          mappedVentas.push({
                              fecha: orderDate,
                              sede,
                              compania,
                              vendedor,
                              sesion, // Nuevo campo
                              producto: productName,
                              categoria: prodInfo.cat,
                              metodoPago, 
                              cantidad: line.qty || 1,
                              total: ventaNeta, 
                              costo: costoTotal,
                              margen,
                              margenPorcentaje: ventaNeta > 0 ? ((margen / ventaNeta) * 100).toFixed(1) : '0.0',
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

  useEffect(() => {
      fetchData();
  }, [fetchData]); 


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
      
      const prevEnd = new Date(currentStart);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - diffDays);

      const pStartStr = prevStart.toLocaleDateString('en-CA');
      const pEndStr = prevEnd.toLocaleDateString('en-CA');

      let datos = ventasData.filter(v => {
          const vDate = v.fecha.toLocaleDateString('en-CA'); 
          return vDate >= pStartStr && vDate <= pEndStr;
      });

      if (filtros.sedeSeleccionada !== 'Todas') datos = datos.filter(v => v.sede === filtros.sedeSeleccionada);
      if (!session && filtros.companiaSeleccionada !== 'Todas') datos = datos.filter(v => v.compania.includes(filtros.companiaSeleccionada));
      if (drillDownSede) datos = datos.filter(v => v.sede === drillDownSede);
      
      return datos;
  }, [ventasData, dateRange, filtros, session, drillDownSede]);


  const sedes = useMemo(() => {
      let base = ventasData;
      if (!session && filtros.companiaSeleccionada !== 'Todas') {
         base = ventasData.filter(v => v.compania.includes(filtros.companiaSeleccionada));
      }
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
        if (!agrupado[v.sede]) agrupado[v.sede] = { name: v.sede, ventas: 0, costo: 0, margen: 0, transacciones: 0, margenPct: 0 };
        agrupado[v.sede].ventas += v.total;
        agrupado[v.sede].costo += v.costo;
        agrupado[v.sede].margen += v.margen;
        agrupado[v.sede].transacciones += 1;
    });

    return Object.values(agrupado).map(item => ({
        ...item,
        margenPct: item.ventas > 0 ? (item.margen / item.ventas) * 100 : 0
    })).sort((a, b) => b.ventas - a.ventas);
  }, [filteredData]);

  const ventasPorDia = useMemo(() => {
    const agrupado: Record<string, AgrupadoPorDia> = {};
    filteredData.forEach(v => {
      const fecha = v.fecha.toLocaleDateString('en-CA');
      if (!agrupado[fecha]) agrupado[fecha] = { fecha, ventas: 0, margen: 0 };
      agrupado[fecha].ventas += v.total;
      agrupado[fecha].margen += v.margen;
    });
    return Object.values(agrupado).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [filteredData]);

  const comparativaSedes = useMemo(() => {
      const agg: Record<string, { name: string; ventas: number; margen: number }> = {};
      filteredData.forEach(v => {
          const sede = v.sede || 'Sin Sede';
          if (!agg[sede]) agg[sede] = { name: sede, ventas: 0, margen: 0 };
          agg[sede].ventas += v.total;
          agg[sede].margen += v.margen;
      });
      return Object.values(agg).sort((a, b) => b.ventas - a.ventas);
  }, [filteredData]);


  const bottomProductosVolumen = useMemo(() => {
      const agg: Record<string, number> = {};
      filteredData.forEach(v => {
          agg[v.producto] = (agg[v.producto] || 0) + v.total;
      });
      return Object.entries(agg).map(([name, val]) => ({ name, val })).sort((a, b) => a.val - b.val).slice(0, 5);
  }, [filteredData]);

  const ventasPorCategoria = useMemo(() => {
      const agg: Record<string, number> = {};
      filteredData.forEach(v => {
          const cat = v.categoria || 'Sin Categoría';
          agg[cat] = (agg[cat] || 0) + v.total;
      });
      return Object.entries(agg).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const ventasPorMetodoPago = useMemo(() => {
      const agg: Record<string, number> = {};
      filteredData.forEach(v => {
          const metodo = v.metodoPago || 'No definido';
          agg[metodo] = (agg[metodo] || 0) + v.total;
      });
      return Object.entries(agg).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const rankingVendedores = useMemo(() => {
      const agg: Record<string, number> = {};
      filteredData.forEach(v => {
          const vend = v.vendedor || 'Sistema';
          agg[vend] = (agg[vend] || 0) + v.total;
      });
      return Object.entries(agg).map(([name, ventas]) => ({ name, ventas })).sort((a, b) => b.ventas - a.ventas);
  }, [filteredData]);

  // --- LOGICA ESPECIFICA PARA VISTA 'PAGOS' ---
  const pagosData = useMemo(() => {
      if (view !== 'pagos') return [];
      
      // Agrupar por Fecha + Sesión + Método (Para la tabla detalle)
      // Aunque en la tabla queremos filas individuales, para los gráficos necesitamos agrupamientos.
      
      // Para tabla detallada, podemos usar filteredData directamente (mapeando campos) o agrupar ligeramente.
      // Vamos a mostrar detalle por producto/linea que es lo que tenemos, pero con info de sesión.
      
      return filteredData.map(v => ({
          fecha: v.fecha,
          fechaStr: v.fecha.toLocaleDateString('es-PE'),
          sesion: v.sesion,
          sede: v.sede,
          metodo: v.metodoPago,
          producto: v.producto,
          total: v.total
      })).sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  }, [filteredData, view]);

  const pagosPorDiaStack = useMemo(() => {
      if (view !== 'pagos') return [];
      const agg: Record<string, any> = {};
      // Get all methods to ensure keys exist. Explicitly type Set<string> to avoid unknown type.
      const methods = new Set<string>(filteredData.map(v => v.metodoPago));
      
      filteredData.forEach(v => {
          const f = v.fecha.toLocaleDateString('en-CA');
          if(!agg[f]) {
              agg[f] = { fecha: f };
              methods.forEach(m => agg[f][m] = 0);
          }
          // Explicit casting to string to avoid index type errors if inference fails
          const metodo = v.metodoPago as string;
          agg[f][metodo] = (agg[f][metodo] || 0) + v.total;
      });
      return Object.values(agg).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
  }, [filteredData, view]);

  // --- LOGICA PARA VISTA DETALLE DE SEDE (Drilldown) ---
  const sessionsInSede = useMemo(() => {
      if (!drillDownSede) return [];
      const agg: Record<string, { sesion: string; responsable: string; total: number; transacciones: number; inicio: Date; fin: Date }> = {};
      
      filteredData.forEach(v => {
          // Filtrar solo los datos de la sede seleccionada (aunque filteredData ya debería tenerlo por el efecto de drillDownSede, aseguramos)
          if(v.sede !== drillDownSede) return;

          if (!agg[v.sesion]) {
              agg[v.sesion] = { 
                  sesion: v.sesion, 
                  responsable: v.vendedor, 
                  total: 0, 
                  transacciones: 0,
                  inicio: v.fecha,
                  fin: v.fecha
              };
          }
          agg[v.sesion].total += v.total;
          agg[v.sesion].transacciones += 1; // Contamos líneas de producto como transacciones aproximadas o items
          if (v.fecha < agg[v.sesion].inicio) agg[v.sesion].inicio = v.fecha;
          if (v.fecha > agg[v.sesion].fin) agg[v.sesion].fin = v.fecha;
      });
      
      return Object.values(agg).sort((a, b) => b.inicio.getTime() - a.inicio.getTime());
  }, [filteredData, drillDownSede]);


  // --- REPORTES Y TABLAS ---

  const reporteProductos = useMemo(() => {
    // Si estamos en vista pagos, usamos pagosData para la tabla, pero la lógica de paginación es compartida.
    // Separaremos la lógica de tabla según la vista.
    if (view === 'pagos') {
        return pagosData; // Usamos esto como fuente para la tabla de pagos
    }

    const agrupado: Record<string, any> = {};
    filteredData.forEach(v => {
      const key = `${v.producto}-${v.metodoPago}`;
      
      if (!agrupado[key]) {
          agrupado[key] = { 
              producto: v.producto,
              categoria: v.categoria || 'General', 
              metodoPago: v.metodoPago,
              cantidad: 0, 
              transacciones: 0,
              costo: 0,
              ventaNeta: 0, 
              ganancia: 0
          };
      }
      agrupado[key].cantidad += v.cantidad;
      agrupado[key].transacciones += 1;
      agrupado[key].costo += v.costo;
      agrupado[key].ventaNeta += v.total; 
      agrupado[key].ganancia += v.margen;
    });

    return Object.values(agrupado)
        .map(p => ({
            ...p,
            margenPorcentaje: p.ventaNeta > 0 ? (p.ganancia / p.ventaNeta) * 100 : 0
        }))
        .sort((a: any, b: any) => {
            const key = sortConfig.key as string;
            const valA = a[key];
            const valB = b[key];
            if (valA === undefined || valB === undefined) return 0;
            if (typeof valA === 'string') {
                return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return sortConfig.direction === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
        });
  }, [filteredData, sortConfig, view, pagosData]);

  // Use a generic source for pagination based on view
  const tableSource = view === 'pagos' ? pagosData : reporteProductos;

  useEffect(() => { setCurrentPage(1); }, [tableSource.length, sortConfig, view]);
  const totalPages = Math.ceil(tableSource.length / itemsPerPage);
  const paginatedData = tableSource.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  
  const handlePageChange = (newPage: number) => { if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage); };

  const handleSort = (key: SortKey) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
      if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1 inline" />;
      return sortConfig.direction === 'asc' 
          ? <ArrowUp className="w-3 h-3 text-brand-600 ml-1 inline" />
          : <ArrowDown className="w-3 h-3 text-brand-600 ml-1 inline" />;
  };

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

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const ANIOS = [2023, 2024, 2025];
  // Vivid Lemon/Spring Palette
  const COLORS = ['#84cc16', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#f43f5e', '#6366f1'];

  const handleDownloadPagos = () => {
    try {
        const wb = XLSX.utils.book_new();
        const titulo = [["REPORTE DE INGRESOS POR MÉTODO DE PAGO Y SESIÓN"]];
        const fechaReporte = [["Fecha de Emisión:", new Date().toLocaleDateString()]];
        const empresaInfo = [["Empresa:", session?.companyName || 'Todas']];
        const rangoInfo = [["Periodo:", `${dateRange.start} al ${dateRange.end}`]];
        const espacio = [[""]];

        const headers = [["FECHA", "SEDE", "SESIÓN CAJA", "MÉTODO DE PAGO", "PRODUCTO / CONCEPTO", "MONTO (S/)"]];
        
        const body = pagosData.map((row: any) => [
            row.fechaStr,
            row.sede,
            row.sesion,
            row.metodo,
            row.producto,
            row.total
        ]);

        const totalSum = pagosData.reduce((acc: number, r: any) => acc + r.total, 0);
        const totalRow = [["TOTAL GENERAL", "", "", "", "", totalSum]];

        // Resumen por Metodo
        const resumenMetodo = ventasPorMetodoPago.map(m => [m.name, m.value]);
        const headerResumen = [["RESUMEN POR MÉTODO", "TOTAL"]];

        const dataMain = [...titulo, ...espacio, ...fechaReporte, ...empresaInfo, ...rangoInfo, ...espacio, ...headers, ...body, ...totalRow, ...espacio, ...espacio, ...headerResumen, ...resumenMetodo];
        
        const ws = XLSX.utils.aoa_to_sheet(dataMain);
        ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 40 }, { wch: 12 }];

        XLSX.utils.book_append_sheet(wb, ws, "Pagos Detalle");
        XLSX.writeFile(wb, `Reporte_Pagos_${dateRange.start}.xlsx`);

    } catch (e) {
        console.error(e);
        alert("Error generando Excel de pagos.");
    }
  };

  const handleDownloadComparativa = () => {
    try {
        const wb = XLSX.utils.book_new();

        const titulo = [["REPORTE COMPARATIVO DE SEDES"]];
        const fechaReporte = [["Fecha de Emisión:", new Date().toLocaleDateString()]];
        const empresaInfo = [["Empresa:", session?.companyName || 'Todas']];
        const rangoInfo = [["Periodo:", `${dateRange.start} al ${dateRange.end}`]];
        const espacio = [[""]];

        const headersResumen = [["SEDE / PUNTO DE VENTA", "TRANSACCIONES", "VENTA NETA (S/)", "COSTO TOTAL (S/)", "GANANCIA NETA (S/)", "MARGEN %"]];
        const bodyResumen = kpisPorSede.map(s => [s.name, s.transacciones, s.ventas, s.costo, s.margen, s.margenPct / 100]);
        
        const totalVentas = kpisPorSede.reduce((sum, s) => sum + s.ventas, 0);
        const totalCosto = kpisPorSede.reduce((sum, s) => sum + s.costo, 0);
        const totalMargen = kpisPorSede.reduce((sum, s) => sum + s.margen, 0);
        const totalTransacciones = kpisPorSede.reduce((sum, s) => sum + s.transacciones, 0);
        const margenPromedio = totalVentas > 0 ? (totalMargen / totalVentas) : 0;
        const totalRowResumen = [["TOTALES GLOBALES", totalTransacciones, totalVentas, totalCosto, totalMargen, margenPromedio]];

        const dataResumen = [...titulo, ...espacio, ...fechaReporte, ...empresaInfo, ...rangoInfo, ...espacio, ...headersResumen, ...bodyResumen, ...totalRowResumen];
        const wsResumen = XLSX.utils.aoa_to_sheet(dataResumen);
        wsResumen['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];
        wsResumen['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
        
        XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Sedes");

        const detalleAgrupado: Record<string, any> = {};
        filteredData.forEach(v => {
            const key = `${v.sede}|${v.producto}|${v.metodoPago}`;
            if (!detalleAgrupado[key]) {
                detalleAgrupado[key] = { sede: v.sede, producto: v.producto, categoria: v.categoria, metodoPago: v.metodoPago, cantidad: 0, costo: 0, total: 0, margen: 0 };
            }
            detalleAgrupado[key].cantidad += v.cantidad;
            detalleAgrupado[key].costo += v.costo;
            detalleAgrupado[key].total += v.total;
            detalleAgrupado[key].margen += v.margen;
        });
        
        const listaDetalle = Object.values(detalleAgrupado).sort((a, b) => a.sede === b.sede ? b.total - a.total : a.sede.localeCompare(b.sede));
        const tituloDetalle = [["DETALLE DE PRODUCTOS POR SEDE"]];
        const headersDetalle = [["SEDE", "PRODUCTO", "CATEGORÍA", "MÉTODO DE PAGO", "UNIDADES", "COSTO TOTAL (S/)", "VENTA NETA (S/)", "GANANCIA (S/)", "RENTABILIDAD %"]];
        const bodyDetalle = listaDetalle.map(d => [d.sede, d.producto, d.categoria, d.metodoPago, d.cantidad, d.costo, d.total, d.margen, d.total > 0 ? (d.margen / d.total) : 0]);
        const sumCant = listaDetalle.reduce((acc, curr) => acc + curr.cantidad, 0);
        const sumCosto = listaDetalle.reduce((acc, curr) => acc + curr.costo, 0);
        const sumTotal = listaDetalle.reduce((acc, curr) => acc + curr.total, 0);
        const sumMargen = listaDetalle.reduce((acc, curr) => acc + curr.margen, 0);
        const sumRentabilidad = sumTotal > 0 ? sumMargen / sumTotal : 0;
        const totalRowDetalle = [["TOTAL GENERAL", "", "", "", sumCant, sumCosto, sumTotal, sumMargen, sumRentabilidad]];

        const dataDetalle = [...tituloDetalle, ...espacio, ...fechaReporte, ...empresaInfo, ...rangoInfo, ...espacio, ...headersDetalle, ...bodyDetalle, ...totalRowDetalle];
        const wsDetalle = XLSX.utils.aoa_to_sheet(dataDetalle);
        wsDetalle['!cols'] = [{ wch: 25 }, { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
        wsDetalle['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];

        XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle Productos");
        XLSX.writeFile(wb, `Comparativa_Completa_${dateRange.start}.xlsx`);

    } catch (error) {
        console.error("Error exportando Excel:", error);
        alert("Error al generar el reporte comparativo.");
    }
  };

  const handleDownloadExcel = () => {
    try {
        const wb = XLSX.utils.book_new();
        
        const titulo = [[drillDownSede ? `REPORTE DE PRODUCTOS - SEDE: ${drillDownSede}` : "REPORTE DETALLADO DE PRODUCTOS"]];
        const fechaReporte = [["Fecha de Emisión:", new Date().toLocaleDateString()]];
        const empresaInfo = [["Empresa:", session?.companyName || 'Todas']];
        const rangoInfo = [["Periodo:", `${dateRange.start} al ${dateRange.end}`]];
        const espacio = [[""]];

        const headers = [["PRODUCTO", "CATEGORÍA", "MÉTODO DE PAGO", "UNIDADES", "COSTO TOTAL (S/)", "VENTA NETA (S/)", "GANANCIA (S/)", "MARGEN %"]];
        
        // Extract array from union type for map operation
        const productsList = reporteProductos as any[];

        const body = productsList.map(p => [
            p.producto,
            p.categoria,
            p.metodoPago,
            p.cantidad,
            p.costo,
            p.ventaNeta,
            p.ganancia,
            p.margenPorcentaje / 100
        ]);

        const sumCant = productsList.reduce((acc, curr) => acc + curr.cantidad, 0);
        const sumCosto = productsList.reduce((acc, curr) => acc + curr.costo, 0);
        const sumTotal = productsList.reduce((acc, curr) => acc + curr.ventaNeta, 0);
        const sumMargen = productsList.reduce((acc, curr) => acc + curr.ganancia, 0);
        const sumRentabilidad = sumTotal > 0 ? sumMargen / sumTotal : 0;

        const totalRow = [["TOTALES", "", "", sumCant, sumCosto, sumTotal, sumMargen, sumRentabilidad]];

        const data = [...titulo, ...espacio, ...fechaReporte, ...empresaInfo, ...rangoInfo, ...espacio, ...headers, ...body, ...totalRow];
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        ws['!cols'] = [{ wch: 45 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

        XLSX.utils.book_append_sheet(wb, ws, "Productos");
        XLSX.writeFile(wb, `Reporte_Productos_${dateRange.start}.xlsx`);

    } catch (error) {
        console.error("Error exportando Excel:", error);
        alert("Error al generar el reporte de productos.");
    }
  };

  const isRentabilidad = view === 'rentabilidad';
  const chartDataKey = isRentabilidad ? 'margen' : 'ventas'; 
  const chartColor = isRentabilidad ? '#84cc16' : '#0ea5e9'; 
  const chartLabel = isRentabilidad ? 'Ganancia' : 'Venta Neta';

  // Helper for rendering table rows to avoid complex nesting in JSX
  const renderTableRows = () => {
      if (paginatedData.length === 0) {
          return (
            <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">
                    No se encontraron productos para los filtros seleccionados.
                </td>
            </tr>
          );
      }

      return paginatedData.map((item: any, idx: number) => {
          const prod = item as any;
          return (
            <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                <td className="px-4 py-3.5 font-medium text-slate-700 group-hover:text-brand-700 transition-colors max-w-xs truncate" title={prod.producto}>{prod.producto}</td>
                <td className="px-4 py-3.5 text-slate-500 text-xs">{prod.categoria}</td>
                <td className="px-4 py-3.5 text-slate-500 text-xs">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-medium">
                        {prod.metodoPago || 'Varios'}
                    </span>
                </td>
                <td className="px-4 py-3.5 text-right text-slate-600">{prod.cantidad}</td>
                <td className="px-4 py-3.5 text-right text-slate-400">S/ {prod.costo.toFixed(2)}</td>
                <td className="px-4 py-3.5 text-right font-bold text-slate-800">S/ {prod.ventaNeta.toFixed(2)}</td>
                <td className="px-4 py-3.5 text-right font-medium text-brand-600">S/ {prod.ganancia.toFixed(2)}</td>
                <td className="px-4 py-3.5 text-right font-medium text-brand-600">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${prod.margenPorcentaje < 20 ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-700'}`}>
                        {prod.margenPorcentaje.toFixed(1)}%
                    </span>
                </td>
            </tr>
          );
      });
  };

  // Helper for rendering General View to clean up main JSX
  const renderGeneralView = () => (
      <>
        {/* KPIs SUPERIORES CON COMPARATIVOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        <div className={`bg-gradient-to-br ${isRentabilidad ? 'from-slate-700 to-slate-800' : 'from-brand-500 to-brand-600'} rounded-2xl shadow-lg shadow-brand-500/20 p-6 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-300 relative overflow-hidden group`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl transform translate-x-10 -translate-y-10 group-hover:bg-white/30 transition-colors"></div>
            <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                {isRentabilidad ? <DollarSign className="w-6 h-6 text-white" /> : <TrendingUp className="w-6 h-6 text-white" />}
            </div>
            <VariacionBadge val={kpis.variacionVentas} />
            </div>
            <div className="relative z-10">
            <p className="text-white/80 text-sm font-medium tracking-wide">{isRentabilidad ? 'Venta Total Acumulada' : 'Volumen de Ventas'}</p>
            <h3 className="text-3xl font-bold text-white mt-1 tracking-tight drop-shadow-sm">S/ {kpis.totalVentas}</h3>
            </div>
        </div>

        <div className={`rounded-2xl shadow-md border p-6 flex flex-col justify-between hover:scale-[1.02] transition-all duration-300 bg-white ${isRentabilidad ? 'border-brand-200' : 'border-slate-100'}`}>
            <div className="flex items-center justify-between mb-4">
            <div className={`p-2.5 rounded-xl ${isRentabilidad ? 'bg-brand-100 text-brand-600' : 'bg-blue-50 text-blue-600'}`}>
                {isRentabilidad ? <TrendingUp className="w-6 h-6" /> : <Receipt className="w-6 h-6" />}
            </div>
            {isRentabilidad && <VariacionBadge val={kpis.variacionMargen} />}
            </div>
            <div>
            <p className="text-slate-500 text-sm font-medium">{isRentabilidad ? 'Ganancia Neta' : 'Ticket Promedio Est.'}</p>
            <h3 className={`text-3xl font-bold mt-1 tracking-tight ${isRentabilidad ? 'text-brand-600' : 'text-slate-800'}`}>
                S/ {isRentabilidad ? kpis.totalMargen : kpis.ticketPromedio}
            </h3>
            </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 flex flex-col justify-between hover:border-violet-200 transition-all hover:scale-[1.02] duration-300">
            <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-violet-50 rounded-xl text-violet-600"><Package className="w-6 h-6" /></div>
            <VariacionBadge val={kpis.variacionUnidades} />
            </div>
            <div>
            <p className="text-slate-500 text-sm font-medium">Items Procesados</p>
            <h3 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{kpis.unidadesVendidas}</h3>
            </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 flex flex-col justify-between hover:border-orange-200 transition-all hover:scale-[1.02] duration-300">
            <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-orange-50 rounded-xl text-orange-600"><Store className="w-6 h-6" /></div>
            </div>
            <div>
            <p className="text-slate-500 text-sm font-medium">Margen Promedio %</p>
            <h3 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{kpis.margenPromedio}%</h3>
            </div>
        </div>
        </div>

        {/* GRAFICOS PRINCIPALES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* TENDENCIA */}
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><ArrowUpRight className="w-5 h-5 text-brand-500"/> Tendencia de Ventas (Diario)</h3>
                <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ventasPorDia} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <defs>
                            <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="fecha" tickFormatter={(value) => new Date(value + 'T00:00:00').toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })} stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                        <YAxis stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} dx={-10} tickFormatter={(value) => `S/${value}`} />
                        <Tooltip 
                            formatter={(value: number) => [`S/ ${Number(value).toFixed(2)}`, chartLabel]} 
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                        />
                        <Area type="monotone" dataKey={chartDataKey} stroke={chartColor} fillOpacity={1} fill="url(#colorVentas)" strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
                </div>
            </div>

            {/* VENTAS POR CATEGORIA (O METODO DE PAGO SI ESTAMOS EN VENTAS) */}
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        {view === 'ventas' ? <CreditCard className="w-5 h-5 text-emerald-500"/> : <PieChartIcon className="w-5 h-5 text-violet-500"/>}
                        {view === 'ventas' ? 'Distribución por Método de Pago' : 'Participación por Categoría'}
                </h3>
                <div className="h-[300px] w-full flex">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={view === 'ventas' ? ventasPorMetodoPago : ventasPorCategoria}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={90}
                                fill="#8884d8"
                                paddingAngle={3}
                                dataKey="value"
                                stroke="#fff"
                                strokeWidth={3}
                            >
                                {(view === 'ventas' ? ventasPorMetodoPago : ventasPorCategoria).map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `S/ ${value.toFixed(2)}`} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                            <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px', color: '#64748b'}} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* COMPARATIVA POR PUNTO DE VENTA (SEDES) */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 animate-in fade-in slide-in-from-bottom-8 duration-700 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand-500"/> Comparativa por Punto de Venta
            </h3>
            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparativaSedes} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                        <YAxis stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} dx={-10} tickFormatter={(value) => `S/${value/1000}k`} />
                        <Tooltip 
                            formatter={(value: number) => [`S/ ${Number(value).toFixed(2)}`, '']}
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                            cursor={{fill: '#f8fafc'}} 
                        />
                        <Legend wrapperStyle={{paddingTop: '20px'}} />
                        <Bar dataKey="ventas" name="Venta Total" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="margen" name="Ganancia" fill="#84cc16" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* RANKING Y ALERTA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Users className="w-5 h-5 text-blue-500"/> Ranking Vendedores</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rankingVendedores} layout="vertical" margin={{ left: 20, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 10, fill: '#64748b'}} />
                            <Tooltip formatter={(value: number) => [`S/ ${Number(value).toFixed(2)}`, 'Ventas']} cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                            <Bar dataKey="ventas" radius={[0, 4, 4, 0]} barSize={20} fill="#0ea5e9" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-500"/> Menor Rotación (Bottom 5)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bottomProductosVolumen.map((p, idx) => (
                        <div key={idx} className="bg-red-50 border border-red-100 rounded-xl p-3 flex flex-col hover:bg-red-100 transition-colors">
                            <p className="text-[10px] font-bold text-red-400 uppercase mb-1">Puesto #{idx+1}</p>
                            <p className="text-sm font-medium text-slate-800 truncate flex-1" title={p.name}>{p.name}</p>
                            <p className="text-lg font-bold text-red-500 mt-1">S/ {p.val.toFixed(2)}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </>
  );

  // --- RENDER ---
  return (
    <div className="p-4 md:p-6 lg:p-8 font-sans w-full relative pb-20 text-slate-700">
      <OdooConfigModal 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)} 
        initialConfig={{
            url: session?.url || '',
            db: session?.db || '',
            username: session?.username || '',
            apiKey: session?.apiKey || ''
        }}
        onSave={(config: ConnectionConfig) => {
            console.log("Config updated", config);
            setIsConfigOpen(false);
        }}
      />
      
      {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center h-screen fixed transition-all duration-300">
              <div className="relative">
                <div className="absolute inset-0 bg-brand-200 blur-xl opacity-50 animate-pulse"></div>
                <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4 border border-slate-100 relative z-10">
                    <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
                    <span className="font-medium text-slate-600 tracking-wide">Procesando datos...</span>
                </div>
              </div>
          </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-2">
           <div>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight drop-shadow-sm flex items-center gap-2">
                {view === 'rentabilidad' ? 'Rentabilidad y Ganancias' : 
                 view === 'ventas' ? 'Gestión de Ventas' :
                 view === 'comparativa' ? 'Gestión de Sedes y Cajas' :
                 view === 'pagos' ? 'Tesorería y Métodos de Pago' :
                 view === 'reportes' ? 'Reportes Gráficos' : 'Dashboard General'}
                 {view === 'general' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-100 text-brand-700 border border-brand-200">LIVE</span>}
              </h1>
              <p className="text-slate-500 text-sm font-light mt-1">
                  {session ? `Compañía: ${session.companyName || 'Todas'}` : 'Modo Demo'} | <span className="text-brand-600 font-medium">{dateRange.start}</span> al <span className="text-brand-600 font-medium">{dateRange.end}</span>
              </p>
           </div>
           
           <div className="mt-4 md:mt-0 flex gap-3">
              {view === 'comparativa' && (
                <button onClick={handleDownloadComparativa} className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-brand-700 transition-all shadow-md shadow-brand-200 hover:shadow-lg hover:shadow-brand-200/50">
                  <Download className="w-4 h-4" /> Reporte Completo
                </button>
              )}
              {view === 'pagos' && (
                <button onClick={handleDownloadPagos} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-slate-900 transition-all shadow-md shadow-slate-800/20">
                  <FileSpreadsheet className="w-4 h-4" /> Exportar Informe
                </button>
              )}
              <button onClick={() => fetchData()} className="flex items-center gap-2 bg-white text-slate-600 px-4 py-2 rounded-xl border border-slate-200 font-medium text-sm hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Recargar
              </button>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-medium text-sm shadow-sm ${session ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${session ? 'bg-brand-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${session ? 'bg-brand-500' : 'bg-amber-500'}`}></span>
                </span>
                {session ? 'En línea' : 'Demo'}
              </div>
           </div>
        </div>
        
        {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex gap-3 items-center shadow-sm animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
                <div className="flex-1"><p className="text-sm">{error}</p></div>
            </div>
        )}

        {/* FILTROS GLOBALES */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-5 relative overflow-hidden">
          {/* Decorative side accent */}
          <div className="absolute top-0 left-0 w-1 h-full bg-brand-500"></div>
          
          <div className="flex flex-col gap-4 relative z-10">
            <div className="flex flex-wrap gap-4 items-end border-b border-slate-100 pb-4">
                <div className="w-full md:w-auto">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2"><Building2 className="inline w-3 h-3 mr-1" />Compañía</label>
                    {session?.companyName ? (
                        <div className="w-full md:w-56 px-4 py-2.5 bg-brand-50 border border-brand-200 rounded-xl text-sm text-brand-700 font-medium flex items-center gap-2"><Building2 className="w-4 h-4" /><span className="truncate">{session.companyName}</span></div>
                    ) : (
                        <select disabled className="w-full md:w-56 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-400 cursor-not-allowed"><option>Demo / Todas</option></select>
                    )}
                </div>
                <div className="w-full md:w-auto">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2"><Store className="inline w-3 h-3 mr-1" />Punto de Venta</label>
                    <select value={filtros.sedeSeleccionada} onChange={(e) => setFiltros({...filtros, sedeSeleccionada: e.target.value})} className="w-full md:w-56 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all shadow-sm">
                        {sedes.map(sede => <option key={sede} value={sede}>{sede}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex flex-wrap gap-6 items-center">
                <div>
                   <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2"><ListFilter className="inline w-3 h-3 mr-1" />Modo de Filtro</label>
                   <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                       <button onClick={() => setFilterMode('mes')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${filterMode === 'mes' ? 'bg-white text-brand-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Por Mes</button>
                       <button onClick={() => setFilterMode('anio')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${filterMode === 'anio' ? 'bg-white text-brand-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Por Año</button>
                       <button onClick={() => setFilterMode('custom')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${filterMode === 'custom' ? 'bg-white text-brand-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Personalizado</button>
                   </div>
                </div>
                <div className="flex-1 flex items-center gap-4">
                    {filterMode === 'mes' && (
                        <>
                            <div className="w-32">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Año</label>
                                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all">{ANIOS.map(y => <option key={y} value={y}>{y}</option>)}</select>
                            </div>
                            <div className="w-40">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mes</label>
                                <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all">{MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
                            </div>
                        </>
                    )}
                    {filterMode === 'custom' && (
                        <div className="flex gap-2 items-center">
                            <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Desde</label><input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" /></div>
                            <div className="h-px w-4 bg-slate-200 mt-6"></div>
                            <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Hasta</label><input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" /></div>
                        </div>
                    )}
                </div>
            </div>
          </div>
        </div>

        {/* --- VISTA: PAGOS (TESORERÍA) --- */}
        {view === 'pagos' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                {/* KPIs de Pagos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-800 text-white rounded-2xl shadow-xl shadow-slate-200 p-6 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-white/10 rounded-xl"><Wallet className="w-6 h-6 text-emerald-400" /></div>
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Recaudado</span>
                        </div>
                        <h3 className="text-3xl font-bold tracking-tight">S/ {kpis.totalVentas}</h3>
                        <p className="text-slate-400 text-sm mt-1">{kpis.unidadesVendidas} transacciones procesadas</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-brand-50 rounded-xl text-brand-600"><Target className="w-6 h-6" /></div>
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Método Principal</span>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {ventasPorMetodoPago[0]?.name || 'N/A'}
                        </h3>
                        <p className="text-slate-500 text-sm mt-1">
                            S/ {ventasPorMetodoPago[0]?.value.toLocaleString()} ({ventasPorMetodoPago[0] ? ((ventasPorMetodoPago[0].value / Number(kpis.totalVentas.replace(',',''))) * 100).toFixed(0) : 0}%)
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><CalendarRange className="w-6 h-6" /></div>
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Promedio Diario</span>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800">
                             S/ {(Number(kpis.totalVentas.replace(/,/g,'')) / (pagosPorDiaStack.length || 1)).toLocaleString('es-PE', {maximumFractionDigits: 0})}
                        </h3>
                        <p className="text-slate-500 text-sm mt-1">Ingreso promedio por día operativo</p>
                    </div>
                </div>

                {/* Gráficos de Pagos */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Gráfico 1: Evolución por Método (Stacked Bar) */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-md border border-slate-100 p-6">
                         <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                             <TrendingUp className="w-5 h-5 text-brand-600"/> Evolución de Ingresos por Día
                         </h3>
                         <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={pagosPorDiaStack} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="fecha" stroke="#94a3b8" tick={{fontSize: 12}} tickFormatter={(val) => val.split('-')[2]} />
                                    <YAxis stroke="#94a3b8" tick={{fontSize: 12}} />
                                    <Tooltip 
                                        cursor={{fill: '#f8fafc'}}
                                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                        formatter={(val: number) => `S/ ${val.toLocaleString()}`}
                                    />
                                    <Legend wrapperStyle={{paddingTop: '20px'}}/>
                                    {ventasPorMetodoPago.map((m, idx) => (
                                        <Bar key={m.name} dataKey={m.name} stackId="a" fill={COLORS[idx % COLORS.length]} />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                         </div>
                    </div>

                    {/* Gráfico 2: Distribución Total */}
                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <PieChartIcon className="w-5 h-5 text-brand-600"/> Distribución
                        </h3>
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={ventasPorMetodoPago}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {ventasPorMetodoPago.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `S/ ${value.toLocaleString()}`} />
                                    <Legend layout="vertical" verticalAlign="middle" align="right" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Tabla Detallada de Pagos */}
                <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-slate-600" />
                                Detalle de Operaciones de Caja
                            </h3>
                            <p className="text-xs text-slate-500 font-light mt-1">
                                Listado completo de transacciones por sesión y método de pago.
                            </p>
                        </div>
                        {/* Buscador Simple */}
                        {/* <input type="text" placeholder="Buscar sesión..." className="border rounded px-3 py-1 text-sm"/> */}
                    </div>

                    <div className="overflow-x-auto border border-slate-100 rounded-xl">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100 select-none">
                                <tr>
                                    <th className="px-4 py-4 font-bold cursor-pointer hover:text-brand-600" onClick={() => handleSort('fecha')}>Fecha <SortIcon column="fecha"/></th>
                                    <th className="px-4 py-4 font-bold cursor-pointer hover:text-brand-600" onClick={() => handleSort('sesion')}>Sesión Caja <SortIcon column="sesion"/></th>
                                    <th className="px-4 py-4 font-bold cursor-pointer hover:text-brand-600" onClick={() => handleSort('metodoPago')}>Método <SortIcon column="metodoPago"/></th>
                                    <th className="px-4 py-4 font-bold">Concepto / Producto</th>
                                    <th className="px-4 py-4 font-bold text-right cursor-pointer hover:text-brand-600" onClick={() => handleSort('ventaNeta')}>Monto <SortIcon column="ventaNeta"/></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {(paginatedData as any[]).map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.fechaStr}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-brand-700 font-medium bg-brand-50/50 rounded">{row.sesion}</td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                                {row.metodo}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 truncate max-w-xs">{row.producto}</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-700">S/ {row.total.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {paginatedData.length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No hay registros de pagos para este periodo.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination for Payment Table */}
                    {tableSource.length > 0 && (
                        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-6 mt-4">
                            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-slate-500">
                                        Mostrando <span className="font-bold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-bold text-slate-800">{Math.min(currentPage * itemsPerPage, tableSource.length)}</span> de <span className="font-bold text-slate-800">{tableSource.length}</span> registros
                                    </p>
                                </div>
                                <div>
                                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 disabled:opacity-50"><ChevronLeft className="h-5 w-5" /></button>
                                        <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">Página {currentPage}</span>
                                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 disabled:opacity-50"><ChevronRight className="h-5 w-5" /></button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        ) : drillDownSede && (
            <div className="bg-brand-50 border border-brand-200 text-brand-800 px-5 py-4 rounded-xl shadow-sm flex items-center justify-between animate-in slide-in-from-top-2">
                <div className="flex items-center gap-4">
                    <div className="bg-brand-100 p-2 rounded-lg"><Target className="w-5 h-5 text-brand-600" /></div>
                    <div>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-brand-500">Visualizando Detalles de</p>
                        <p className="font-bold text-xl leading-tight text-slate-800">{drillDownSede}</p>
                    </div>
                </div>
                <button onClick={() => setDrillDownSede(null)} className="flex items-center gap-2 bg-white hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-200 shadow-sm text-slate-600"><X className="w-4 h-4" /> Cerrar Detalle</button>
            </div>
        )}

        {/* --- VISTA COMPARATIVA (TIPO CAJONES) --- */}
        {view === 'comparativa' && !drillDownSede ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
             
             {/* CAJONES: Tarjetas Interactivas por Sede */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                 {kpisPorSede.map((sede, idx) => (
                    <div key={idx} className="bg-white rounded-2xl shadow-md border border-slate-100 hover:border-brand-300 hover:shadow-lg transition-all duration-300 p-6 flex flex-col justify-between group relative overflow-hidden hover:-translate-y-1">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-brand-50 rounded-bl-[100px] transition-all group-hover:bg-brand-100"></div>
                        
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="p-2.5 bg-brand-50 rounded-xl border border-brand-100 group-hover:bg-brand-100 transition-colors">
                                <Store className="w-6 h-6 text-brand-600" />
                            </div>
                            <button onClick={() => setDrillDownSede(sede.name)} className="text-[10px] font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 uppercase tracking-wider shadow-sm hover:shadow">
                                Ver Cajas <ArrowUpRight className="w-3 h-3" />
                            </button>
                        </div>

                        <h3 className="text-lg font-bold text-slate-800 mb-1 truncate" title={sede.name}>{sede.name}</h3>
                        <p className="text-xs text-slate-400 mb-5 font-mono">{sede.transacciones} transacciones</p>

                        <div className="space-y-4">
                            <div className="flex justify-between items-end border-b border-slate-50 pb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Venta Neta</span>
                                <span className="text-base font-bold text-slate-700">S/ {sede.ventas.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-end border-b border-slate-50 pb-2">
                                <span className="text-[10px] font-bold text-red-300 uppercase tracking-widest">Costo/Pérdida</span>
                                <span className="text-base font-medium text-red-500">- S/ {sede.costo.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-end pt-1">
                                <span className="text-[10px] font-bold text-brand-500 uppercase tracking-widest">Ganancia</span>
                                <span className="text-2xl font-bold text-brand-600">S/ {sede.margen.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Visualizador de Margen (Barra) */}
                        <div className="mt-6">
                            <div className="flex justify-between text-xs mb-1.5">
                                <span className="text-slate-500 font-medium">Rentabilidad</span>
                                <span className={`font-bold ${sede.margenPct < 15 ? 'text-red-500' : 'text-brand-600'}`}>{sede.margenPct.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ${sede.margenPct < 15 ? 'bg-red-500' : 'bg-brand-500'}`} 
                                    style={{ width: `${Math.min(sede.margenPct, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                 ))}
             </div>

             {/* GRÁFICOS DE ANÁLISIS COMPARATIVO */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. Stacked Bar */}
                <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 hover:shadow-lg transition-shadow">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <ArrowUpDown className="w-5 h-5 text-brand-500"/> Composición Venta vs Costo
                    </h3>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={kpisPorSede} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fill: '#64748b'}} />
                                <Tooltip 
                                    formatter={(value: number) => `S/ ${value.toLocaleString()}`} 
                                    cursor={{fill: '#f8fafc'}}
                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                />
                                <Legend />
                                <Bar dataKey="margen" name="Ganancia Neta" stackId="a" fill="#84cc16" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="costo" name="Costo Mercadería" stackId="a" fill="#f43f5e" radius={[4, 0, 0, 4]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Scatter Plot */}
                <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 hover:shadow-lg transition-shadow">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Target className="w-5 h-5 text-brand-500"/> Matriz de Rendimiento
                    </h3>
                    <div className="h-[350px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis type="number" dataKey="ventas" name="Volumen Venta" unit=" S/" tick={{fontSize: 12, fill: '#94a3b8'}} stroke="#cbd5e1" />
                                <YAxis type="number" dataKey="margenPct" name="Margen" unit="%" tick={{fontSize: 12, fill: '#94a3b8'}} stroke="#cbd5e1" />
                                <ZAxis type="number" dataKey="transacciones" range={[60, 400]} name="Transacciones" />
                                <Tooltip 
                                    cursor={{ strokeDasharray: '3 3' }} 
                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                    formatter={(value: any, name: string) => [name === 'Margen' ? `${Number(value).toFixed(1)}%` : `S/ ${Number(value).toLocaleString()}`, name]} 
                                />
                                <Legend />
                                <Scatter name="Sedes" data={kpisPorSede} fill="#3b82f6">
                                    {kpisPorSede.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.margenPct > 20 ? '#84cc16' : entry.margenPct < 10 ? '#f43f5e' : '#f59e0b'} strokeWidth={1} stroke="#fff" />
                                    ))}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                        <p className="text-xs text-center text-slate-400 mt-2 font-mono">
                            * Eje X: Volumen Venta | Eje Y: % Margen | Tamaño: Nro. Transacciones
                        </p>
                    </div>
                </div>

             </div>

          </div>
        ) : view !== 'pagos' ? (
          /* --- VISTAS ANTERIORES (General, Rentabilidad, Ventas, Reportes) --- */
          renderGeneralView()
        ) : null}

        {/* TABLA DE DETALLE - Visible en General y en Comparativa (solo si hay DrillDown) */}
        {(view !== 'pagos' && view !== 'comparativa') || (view === 'comparativa' && drillDownSede) ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            
            {/* NUEVA SECCIÓN: DESGLOSE DE CAJAS POR SEDE (Solo si DrillDown está activo) */}
            {view === 'comparativa' && drillDownSede && (
                <div className="bg-amber-50 rounded-2xl shadow-md border border-amber-100 p-6 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-100 rounded-bl-[100px] opacity-50"></div>
                    
                    <h3 className="text-lg font-bold text-amber-800 flex items-center gap-2 mb-4 relative z-10">
                        <Receipt className="w-5 h-5 text-amber-600" />
                        Resumen de Cajas (Sesiones) en {drillDownSede}
                    </h3>
                    
                    {sessionsInSede.length > 0 ? (
                        <div className="overflow-x-auto border border-amber-100 rounded-xl bg-white relative z-10">
                            <table className="w-full text-sm text-left text-slate-600">
                                <thead className="text-xs text-amber-800 uppercase bg-amber-50 border-b border-amber-100 select-none">
                                    <tr>
                                        <th className="px-4 py-3 font-bold">Sesión ID</th>
                                        <th className="px-4 py-3 font-bold">Responsable / Caja</th>
                                        <th className="px-4 py-3 font-bold text-center">Apertura</th>
                                        <th className="px-4 py-3 font-bold text-center">Transacciones</th>
                                        <th className="px-4 py-3 font-bold text-right">Total Recaudado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-amber-50/50">
                                    {sessionsInSede.map((s, i) => (
                                        <tr key={i} className="hover:bg-amber-50/30 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-amber-700">{s.sesion}</td>
                                            <td className="px-4 py-3 text-slate-700 font-medium">{s.responsable || 'Cajero General'}</td>
                                            <td className="px-4 py-3 text-center text-xs text-slate-500 flex items-center justify-center gap-1">
                                                <Clock className="w-3 h-3"/> {s.inicio.toLocaleDateString()} {s.inicio.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">{s.transacciones}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-800">S/ {s.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="bg-white p-4 rounded-xl text-center text-amber-700/60 text-sm">
                            No se encontró información detallada de sesiones para esta sede en el periodo seleccionado.
                        </div>
                    )}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-brand-600" />
                        {drillDownSede ? `Productos Vendidos en ${drillDownSede}` : 'Detalle Global de Productos'}
                    </h3>
                    <p className="text-xs text-slate-500 font-light mt-1">
                        {drillDownSede ? 'Mostrando únicamente items vendidos en la sede seleccionada.' : 'Desglose general por item, costo real y rentabilidad.'}
                    </p>
                    </div>
                    <button onClick={handleDownloadExcel} className="px-4 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                    <Download className="w-4 h-4" />Descargar Excel
                    </button>
                </div>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-sm text-left text-slate-600">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100 select-none">
                        <tr>
                        <th className="px-4 py-4 font-bold cursor-pointer hover:text-brand-600 transition-colors" onClick={() => handleSort('producto')}>Producto <SortIcon column="producto" /></th>
                        <th className="px-4 py-4 font-bold cursor-pointer">Categoría</th>
                        <th className="px-4 py-4 font-bold cursor-pointer hover:text-brand-600 transition-colors" onClick={() => handleSort('metodoPago')}>Pago <SortIcon column="metodoPago" /></th>
                        <th className="px-4 py-4 font-bold text-right cursor-pointer hover:text-brand-600 transition-colors" onClick={() => handleSort('cantidad')}>Unds. <SortIcon column="cantidad" /></th>
                        <th className="px-4 py-4 font-bold text-right text-slate-400 cursor-pointer hover:text-brand-600 transition-colors" onClick={() => handleSort('costo')}>Costo Total <SortIcon column="costo" /></th>
                        <th className="px-4 py-4 font-bold text-right cursor-pointer hover:text-brand-600 transition-colors" onClick={() => handleSort('ventaNeta')}>Venta Neta <SortIcon column="ventaNeta" /></th>
                        <th className="px-4 py-4 font-bold text-right text-brand-600 cursor-pointer hover:text-brand-800 transition-colors" onClick={() => handleSort('ganancia')}>Ganancia <SortIcon column="ganancia" /></th>
                        <th className="px-4 py-4 font-bold text-right text-brand-600 cursor-pointer hover:text-brand-800 transition-colors" onClick={() => handleSort('margenPorcentaje')}>Margen % <SortIcon column="margenPorcentaje" /></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {renderTableRows()}
                    </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {tableSource.length > 0 && (
                    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-6 mt-4">
                        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-slate-500">
                                    Mostrando <span className="font-bold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-bold text-slate-800">{Math.min(currentPage * itemsPerPage, tableSource.length)}</span> de <span className="font-bold text-slate-800">{tableSource.length}</span> resultados
                                </p>
                            </div>
                            <div>
                                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <span className="sr-only">Anterior</span>
                                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 focus:outline-offset-0">
                                        Página {currentPage} de {totalPages}
                                    </span>
                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <span className="sr-only">Siguiente</span>
                                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            </div>
        ) : null}

      </div>
    </div>
  );
};

export default Dashboard;