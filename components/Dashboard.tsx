import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend, ScatterChart, Scatter, ZAxis 
} from 'recharts';
import { TrendingUp, DollarSign, Package, ArrowUpRight, RefreshCw, AlertCircle, Building2, Store, Download, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown, ListFilter, Receipt, X, Target, ChevronLeft, ChevronRight, Users, PieChart as PieChartIcon, MapPin } from 'lucide-react';
import { Venta, Filtros, AgrupadoPorDia, OdooSession } from '../types';
import OdooConfigModal from './OdooConfigModal';
import { OdooClient } from '../services/odoo';
// @ts-ignore
import * as XLSX from 'xlsx';

// --- GENERADOR DE DATOS (MOCK) ACTUALIZADO ---
const generarDatosVentas = (startStr: string, endStr: string): Venta[] => {
  const estructura = [
      { compania: 'BOTICAS MULTIFARMA S.A.C.', sedes: ['Multifarmas', 'Cristo Rey', 'Lomas', 'Tienda 4'] },
      { compania: 'CONSULTORIO MEDICO REQUESALUD', sedes: ['Caja Requesalud'] }
  ];

  const vendedores = ['Juan Pérez', 'María Gómez', 'Carlos Ruiz', 'Ana Torres', 'Caja Principal'];

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
  // Generamos datos desde 2 meses atrás para permitir comparativos
  const fechaInicioReq = new Date(`${startStr}T00:00:00`);
  const fechaFinReq = new Date(`${endStr}T23:59:59`);
  
  // Generar un buffer de 60 días antes para tener "mes anterior"
  const fechaGeneracionInicio = new Date(fechaInicioReq);
  fechaGeneracionInicio.setDate(fechaGeneracionInicio.getDate() - 65);

  for (let d = new Date(fechaGeneracionInicio); d <= fechaFinReq; d.setDate(d.getDate() + 1)) {
    estructura.forEach(emp => {
        const ventasPorDia = Math.floor(Math.random() * 8) + 2; 
        
        for (let i = 0; i < ventasPorDia; i++) {
            const sede = emp.sedes[Math.floor(Math.random() * emp.sedes.length)];
            const vendedor = vendedores[Math.floor(Math.random() * vendedores.length)];
            
            if (sede === 'Tienda 4') {
                const fechaCierreTienda4 = new Date('2024-08-31');
                if (d > fechaCierreTienda4) continue; 
            }

            const producto = productos[Math.floor(Math.random() * productos.length)];
            let prodFinal = producto;
            
            // Lógica simple para asignar productos a tipos de empresa
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
                producto: prodFinal.nombre,
                categoria: prodFinal.cat,
                vendedor,
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
      
      // Ampliamos el rango de búsqueda para incluir datos históricos si fuera necesario para comparativos
      // En modo real, idealmente haríamos 2 queries, pero para simplificar traemos un buffer
      const bufferStart = new Date(dateRange.start);
      bufferStart.setDate(bufferStart.getDate() - 40); // 40 días antes para asegurar mes previo
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
      // Intentamos traer el user_id (vendedor)
      const fieldsOrder = ['date_order', 'config_id', 'lines', 'company_id', 'user_id', 'pos_reference', 'name'];

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

          // Mapeo de Categorías de productos (Extra fetch)
          const productIds = new Set(allLinesData.map((l: any) => Array.isArray(l.product_id) ? l.product_id[0] : null).filter(id => id));
          let productMap = new Map<number, {cost: number, cat: string}>();

          if (productIds.size > 0) {
              const productChunks = chunkArray(Array.from(productIds), 1000);
              for (const pChunk of productChunks) {
                  // Traemos categ_id para categoría
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

          const linesMap = new Map(allLinesData.map((l: any) => [l.id, l]));
          const mappedVentas: Venta[] = [];

          ordersRaw.forEach((order: any) => {
              const orderDate = new Date((order.date_order || "").replace(" ", "T") + "Z");
              const sede = Array.isArray(order.config_id) ? order.config_id[1] : 'Caja General';
              const compania = Array.isArray(order.company_id) ? order.company_id[1] : 'Empresa Principal';
              const vendedor = Array.isArray(order.user_id) ? order.user_id[1] : 'Usuario Sistema';
              
              if (order.lines && Array.isArray(order.lines)) {
                  order.lines.forEach((lineId: number) => {
                      const line = linesMap.get(lineId);
                      if (line) {
                          const productId = Array.isArray(line.product_id) ? line.product_id[0] : 0;
                          const productName = Array.isArray(line.product_id) ? line.product_id[1] : 'Producto Desconocido';
                          const ventaNeta = line.price_subtotal || 0; 
                          // const ventaBruta = line.price_subtotal_incl || 0; 
                          
                          const prodInfo = productMap.get(productId) || { cost: 0, cat: 'Varios' };
                          let unitCost = prodInfo.cost;
                          
                          if (unitCost === 0) {
                             // Estimación de costo si no hay standard_price
                             unitCost = (ventaNeta / (line.qty || 1)) * 0.65; 
                          }

                          const costoTotal = unitCost * (line.qty || 1);
                          const margen = ventaNeta - costoTotal; 

                          mappedVentas.push({
                              fecha: orderDate,
                              sede,
                              compania,
                              vendedor,
                              producto: productName,
                              categoria: prodInfo.cat,
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


  // --- DATOS FILTRADOS POR RANGO SELECCIONADO ---
  const filteredData = useMemo(() => {
    const startStr = dateRange.start;
    const endStr = dateRange.end;
    
    let datos = ventasData.filter(v => {
        const vDate = v.fecha.toLocaleDateString('en-CA'); 
        return vDate >= startStr && vDate <= endStr;
    });

    if (filtros.sedeSeleccionada !== 'Todas') {
        datos = datos.filter(v => v.sede === filtros.sedeSeleccionada);
    }
    if (!session && filtros.companiaSeleccionada !== 'Todas') {
         datos = datos.filter(v => v.compania.includes(filtros.companiaSeleccionada));
    }
    if (drillDownSede) {
        datos = datos.filter(v => v.sede === drillDownSede);
    }
    return datos;
  }, [ventasData, filtros, dateRange, session, drillDownSede]);

  // --- DATOS PERIODO ANTERIOR (Para Comparativos) ---
  const previousPeriodData = useMemo(() => {
      const currentStart = new Date(dateRange.start);
      const currentEnd = new Date(dateRange.end);
      const diffTime = Math.abs(currentEnd.getTime() - currentStart.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      // Calcular rango anterior (mismo número de días hacia atrás)
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

      // Aplicar mismos filtros de sede/compañia
      if (filtros.sedeSeleccionada !== 'Todas') datos = datos.filter(v => v.sede === filtros.sedeSeleccionada);
      if (!session && filtros.companiaSeleccionada !== 'Todas') datos = datos.filter(v => v.compania.includes(filtros.companiaSeleccionada));
      if (drillDownSede) datos = datos.filter(v => v.sede === drillDownSede);
      
      return datos;
  }, [ventasData, dateRange, filtros, session, drillDownSede]);


  // Lista de Sedes para el Dropdown
  const sedes = useMemo(() => {
      let base = ventasData;
      if (!session && filtros.companiaSeleccionada !== 'Todas') {
         base = ventasData.filter(v => v.compania.includes(filtros.companiaSeleccionada));
      }
      return ['Todas', ...Array.from(new Set(base.map(v => v.sede)))];
  }, [ventasData, filtros.companiaSeleccionada, session]);


  // --- KPIs CALCULADOS ---
  const kpis = useMemo(() => {
    // Actuales
    const totalVentas = filteredData.reduce((sum, v) => sum + v.total, 0);
    const totalMargen = filteredData.reduce((sum, v) => sum + v.margen, 0);
    const unidades = filteredData.length;
    
    // Anteriores
    const prevVentas = previousPeriodData.reduce((sum, v) => sum + v.total, 0);
    const prevMargen = previousPeriodData.reduce((sum, v) => sum + v.margen, 0);
    const prevUnidades = previousPeriodData.length;

    // Variaciones %
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

  // --- KPIs POR SEDE (Para Vista Comparativa) ---
  const kpisPorSede = useMemo(() => {
    const agrupado: Record<string, { name: string; ventas: number; costo: number; margen: number; transacciones: number; margenPct: number }> = {};
    
    // Si estamos en modo comparativa, ignoramos el filtro de sedeSeleccionada si está en 'Todas'
    // Para que se muestren todas las tarjetas. Si el usuario filtra una sede, solo sale una tarjeta.
    // Usamos filteredData que ya respeta el filtro global, pero si se quiere comparar SIEMPRE todas,
    // deberíamos usar 'ventasData' filtrado solo por fecha. 
    // Mantenemos filteredData para respetar la consistencia del filtro global.
    
    filteredData.forEach(v => {
        if (!agrupado[v.sede]) {
            agrupado[v.sede] = { name: v.sede, ventas: 0, costo: 0, margen: 0, transacciones: 0, margenPct: 0 };
        }
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


  // Gráfico Evolutivo
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

  // Comparativa por Sedes (Gráfico General)
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

  // Top Productos (Volumen)
  const topProductosVolumen = useMemo(() => {
      const agg: Record<string, number> = {};
      filteredData.forEach(v => {
          agg[v.producto] = (agg[v.producto] || 0) + v.total;
      });
      return Object.entries(agg)
        .map(([name, val]) => ({ name, val }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 5);
  }, [filteredData]);

  // Productos Menos Vendidos (Bottom 5)
  const bottomProductosVolumen = useMemo(() => {
      const agg: Record<string, number> = {};
      filteredData.forEach(v => {
          agg[v.producto] = (agg[v.producto] || 0) + v.total;
      });
      return Object.entries(agg)
        .map(([name, val]) => ({ name, val }))
        .sort((a, b) => a.val - b.val) // Ascendente
        .slice(0, 5);
  }, [filteredData]);

  // Ventas por Categoría (Pie Chart)
  const ventasPorCategoria = useMemo(() => {
      const agg: Record<string, number> = {};
      filteredData.forEach(v => {
          const cat = v.categoria || 'Sin Categoría';
          agg[cat] = (agg[cat] || 0) + v.total;
      });
      return Object.entries(agg)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  // Ventas por Vendedor (Ranking)
  const rankingVendedores = useMemo(() => {
      const agg: Record<string, number> = {};
      filteredData.forEach(v => {
          const vend = v.vendedor || 'Sistema';
          agg[vend] = (agg[vend] || 0) + v.total;
      });
      return Object.entries(agg)
        .map(([name, ventas]) => ({ name, ventas }))
        .sort((a, b) => b.ventas - a.ventas);
  }, [filteredData]);

  // --- TABLA DETALLE ---
  const reporteProductos = useMemo(() => {
    const agrupado: Record<string, any> = {};
    filteredData.forEach(v => {
      if (!agrupado[v.producto]) {
          agrupado[v.producto] = { 
              producto: v.producto,
              categoria: v.categoria || 'General', 
              cantidad: 0, 
              transacciones: 0,
              costo: 0,
              ventaNeta: 0, 
              ganancia: 0
          };
      }
      agrupado[v.producto].cantidad += v.cantidad;
      agrupado[v.producto].transacciones += 1;
      agrupado[v.producto].costo += v.costo;
      agrupado[v.producto].ventaNeta += v.total; 
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
  }, [filteredData, sortConfig]);

  // Paginación
  useEffect(() => { setCurrentPage(1); }, [reporteProductos.length, sortConfig]);
  const totalPages = Math.ceil(reporteProductos.length / itemsPerPage);
  const paginatedProductos = reporteProductos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
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
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ml-2 flex items-center gap-0.5 ${isPositive ? 'bg-brand-100 text-brand-700' : 'bg-red-100 text-red-700'}`}>
              {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {Math.abs(val).toFixed(1)}%
          </span>
      );
  };

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const ANIOS = [2023, 2024, 2025];
  const COLORS = ['#84cc16', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981'];

  const handleDownloadExcel = () => {
    try {
        // 1. Preparar Datos Generales
        const titulo = [["REPORTE DETALLADO DE VENTAS Y RENTABILIDAD"]];
        const fechaReporte = [["Fecha de Emisión:", new Date().toLocaleDateString()]];
        const empresaInfo = [["Empresa:", session?.companyName || 'DEMO / LOCAL']];
        const sedeInfo = [["Punto de Venta:", drillDownSede || filtros.sedeSeleccionada]];
        const rangoInfo = [["Periodo:", `${dateRange.start} al ${dateRange.end}`]];
        const espacio = [[""]];

        // 2. Encabezados de Tabla
        const headers = [["PRODUCTO", "CATEGORÍA", "UNIDADES", "COSTO TOTAL (S/)", "VENTA NETA (S/)", "GANANCIA (S/)", "MARGEN %"]];

        // 3. Cuerpo de Datos
        const body = reporteProductos.map(p => [
            p.producto,
            p.categoria,
            p.cantidad,
            p.costo,      // Se aplicará formato numérico luego
            p.ventaNeta,  // Se aplicará formato numérico luego
            p.ganancia,   // Se aplicará formato numérico luego
            p.margenPorcentaje / 100 // Para formato porcentaje (0.15 en vez de 15)
        ]);

        // 4. Calcular Totales
        const totalUnidades = reporteProductos.reduce((sum, p) => sum + p.cantidad, 0);
        const totalCosto = reporteProductos.reduce((sum, p) => sum + p.costo, 0);
        const totalVenta = reporteProductos.reduce((sum, p) => sum + p.ventaNeta, 0);
        const totalGanancia = reporteProductos.reduce((sum, p) => sum + p.ganancia, 0);
        const margenTotal = totalVenta > 0 ? (totalGanancia / totalVenta) : 0;

        const totalRow = [["TOTAL GENERAL", "", totalUnidades, totalCosto, totalVenta, totalGanancia, margenTotal]];

        // 5. Unificar todo en una estructura de hoja
        const data = [
            ...titulo,
            ...espacio,
            ...fechaReporte,
            ...empresaInfo,
            ...sedeInfo,
            ...rangoInfo,
            ...espacio,
            ...headers,
            ...body,
            ...totalRow
        ];

        // 6. Crear Hoja de Trabajo
        const ws = XLSX.utils.aoa_to_sheet(data);

        // 7. Estilizar Ancho de Columnas (Widths)
        const wscols = [
            { wch: 45 }, // Producto
            { wch: 20 }, // Categoría
            { wch: 12 }, // Unidades
            { wch: 18 }, // Costo
            { wch: 18 }, // Venta
            { wch: 18 }, // Ganancia
            { wch: 12 }  // Margen
        ];
        ws['!cols'] = wscols;

        // 8. Fusionar Celdas del Título
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } } // Título principal
        ];

        // 9. Aplicar Formatos Numéricos (Currency & Percent)
        // El rango de datos empieza en la fila 9 (índice 8) -> headers en fila 8 (índice 7)
        const range = XLSX.utils.decode_range(ws['!ref'] || "A1:A1");
        
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[cellRef]) continue;

                if (R >= 8) { 
                    if (C === 3 || C === 4 || C === 5) { // Costo, Venta, Ganancia
                        ws[cellRef].z = '"S/" #,##0.00'; 
                    }
                    if (C === 6) { // Margen
                        ws[cellRef].z = '0.00%';
                    }
                }
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte Ventas");
        const fileName = `Reporte_Ventas_${filtros.sedeSeleccionada.replace(/\s+/g, '_')}_${dateRange.start}.xlsx`;
        XLSX.writeFile(wb, fileName);

    } catch (error) {
        console.error("Error exportando Excel:", error);
        alert("Hubo un error al generar el archivo Excel.");
    }
  };

  const handleDownloadComparativa = () => {
    try {
        const wb = XLSX.utils.book_new();

        // --- HOJA 1: RESUMEN EJECUTIVO POR SEDE ---
        const titulo = [["REPORTE COMPARATIVO DE SEDES"]];
        const fechaReporte = [["Fecha de Emisión:", new Date().toLocaleDateString()]];
        const empresaInfo = [["Empresa:", session?.companyName || 'Todas']];
        const rangoInfo = [["Periodo:", `${dateRange.start} al ${dateRange.end}`]];
        const espacio = [[""]];

        const headersResumen = [["SEDE / PUNTO DE VENTA", "TRANSACCIONES", "VENTA NETA (S/)", "COSTO TOTAL (S/)", "GANANCIA NETA (S/)", "MARGEN %"]];

        const bodyResumen = kpisPorSede.map(s => [
            s.name,
            s.transacciones,
            s.ventas,
            s.costo,
            s.margen,
            s.margenPct / 100
        ]);

        const totalVentas = kpisPorSede.reduce((sum, s) => sum + s.ventas, 0);
        const totalCosto = kpisPorSede.reduce((sum, s) => sum + s.costo, 0);
        const totalMargen = kpisPorSede.reduce((sum, s) => sum + s.margen, 0);
        const totalTransacciones = kpisPorSede.reduce((sum, s) => sum + s.transacciones, 0);
        const margenPromedio = totalVentas > 0 ? (totalMargen / totalVentas) : 0;

        const totalRowResumen = [["TOTALES GLOBALES", totalTransacciones, totalVentas, totalCosto, totalMargen, margenPromedio]];

        const dataResumen = [
            ...titulo, ...espacio, ...fechaReporte, ...empresaInfo, ...rangoInfo, ...espacio,
            ...headersResumen, ...bodyResumen, ...totalRowResumen
        ];

        const wsResumen = XLSX.utils.aoa_to_sheet(dataResumen);
        wsResumen['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];
        wsResumen['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

        // Formato Hoja 1
        const rangeResumen = XLSX.utils.decode_range(wsResumen['!ref'] || "A1:A1");
        for (let R = rangeResumen.s.r; R <= rangeResumen.e.r; ++R) {
            for (let C = rangeResumen.s.c; C <= rangeResumen.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                if (!wsResumen[cellRef]) continue;
                if (R >= 7) { 
                    if (C === 2 || C === 3 || C === 4) wsResumen[cellRef].z = '"S/" #,##0.00'; 
                    if (C === 5) wsResumen[cellRef].z = '0.00%';
                }
            }
        }
        XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Sedes");


        // --- HOJA 2: DETALLE PRODUCTOS POR SEDE ---
        // 1. Agrupar datos por Sede y Producto
        const detalleAgrupado: Record<string, any> = {};
        filteredData.forEach(v => {
            const key = `${v.sede}|${v.producto}`;
            if (!detalleAgrupado[key]) {
                detalleAgrupado[key] = {
                    sede: v.sede,
                    producto: v.producto,
                    categoria: v.categoria,
                    cantidad: 0,
                    costo: 0,
                    total: 0,
                    margen: 0
                };
            }
            detalleAgrupado[key].cantidad += v.cantidad;
            detalleAgrupado[key].costo += v.costo;
            detalleAgrupado[key].total += v.total;
            detalleAgrupado[key].margen += v.margen;
        });
        
        // Convertir a array y ordenar por Sede (A-Z) y luego por Venta Total (Desc)
        const listaDetalle = Object.values(detalleAgrupado).sort((a, b) => {
            if (a.sede === b.sede) {
                return b.total - a.total;
            }
            return a.sede.localeCompare(b.sede);
        });

        const tituloDetalle = [["DETALLE DE PRODUCTOS POR SEDE"]];
        const headersDetalle = [["SEDE", "PRODUCTO", "CATEGORÍA", "UNIDADES", "COSTO TOTAL (S/)", "VENTA NETA (S/)", "GANANCIA (S/)", "RENTABILIDAD %"]];
        
        const bodyDetalle = listaDetalle.map(d => [
            d.sede,
            d.producto,
            d.categoria,
            d.cantidad,
            d.costo,
            d.total,
            d.margen,
            d.total > 0 ? (d.margen / d.total) : 0
        ]);

        // Totales Hoja 2
        const sumCant = listaDetalle.reduce((acc, curr) => acc + curr.cantidad, 0);
        const sumCosto = listaDetalle.reduce((acc, curr) => acc + curr.costo, 0);
        const sumTotal = listaDetalle.reduce((acc, curr) => acc + curr.total, 0);
        const sumMargen = listaDetalle.reduce((acc, curr) => acc + curr.margen, 0);
        const sumRentabilidad = sumTotal > 0 ? sumMargen / sumTotal : 0;

        const totalRowDetalle = [["TOTAL GENERAL", "", "", sumCant, sumCosto, sumTotal, sumMargen, sumRentabilidad]];

        const dataDetalle = [
             ...tituloDetalle, ...espacio, ...fechaReporte, ...empresaInfo, ...rangoInfo, ...espacio,
             ...headersDetalle, ...bodyDetalle, ...totalRowDetalle
        ];

        const wsDetalle = XLSX.utils.aoa_to_sheet(dataDetalle);
        wsDetalle['!cols'] = [
            { wch: 25 }, // Sede
            { wch: 40 }, // Producto
            { wch: 20 }, // Categoria
            { wch: 10 }, // Unidades
            { wch: 15 }, // Costo
            { wch: 15 }, // Venta
            { wch: 15 }, // Ganancia
            { wch: 12 }  // Rentabilidad
        ];
        wsDetalle['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

        // Formato Hoja 2
        const rangeDetalle = XLSX.utils.decode_range(wsDetalle['!ref'] || "A1:A1");
        for (let R = rangeDetalle.s.r; R <= rangeDetalle.e.r; ++R) {
            for (let C = rangeDetalle.s.c; C <= rangeDetalle.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                if (!wsDetalle[cellRef]) continue;
                // Headers están en fila index 7 (row 8)
                if (R >= 8) { 
                    if (C === 4 || C === 5 || C === 6) wsDetalle[cellRef].z = '"S/" #,##0.00'; 
                    if (C === 7) wsDetalle[cellRef].z = '0.00%';
                }
            }
        }
        XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle Productos");


        XLSX.writeFile(wb, `Comparativa_Completa_${dateRange.start}.xlsx`);

    } catch (error) {
        console.error("Error exportando Excel Comparativa:", error);
        alert("Error al generar el reporte comparativo.");
    }
  };

  const isRentabilidad = view === 'rentabilidad';
  const chartDataKey = isRentabilidad ? 'margen' : 'ventas'; 
  const chartColor = isRentabilidad ? '#84cc16' : '#3b82f6'; 
  const chartLabel = isRentabilidad ? 'Ganancia' : 'Venta Neta';

  // --- RENDER ---
  return (
    <div className="p-4 md:p-6 lg:p-8 font-sans w-full relative pb-20">
      <OdooConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
      
      {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center h-screen fixed">
              <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3 border border-slate-100">
                  <RefreshCw className="w-5 h-5 animate-spin text-brand-600" />
                  <span className="font-medium text-slate-700">Procesando datos...</span>
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
                 view === 'comparativa' ? 'Comparativa de Sedes' :
                 view === 'reportes' ? 'Reportes Gráficos' : 'Dashboard General'}
              </h1>
              <p className="text-slate-500 text-sm font-light">
                  {session ? `Compañía: ${session.companyName || 'Todas'}` : 'Modo Demo'} | {dateRange.start} al {dateRange.end}
              </p>
           </div>
           
           <div className="mt-4 md:mt-0 flex gap-3">
              {view === 'comparativa' && (
                <button onClick={handleDownloadComparativa} className="flex items-center gap-2 bg-brand-600 text-white px-3 py-1.5 rounded-lg font-medium text-sm hover:bg-brand-700 transition-colors shadow-sm shadow-brand-200">
                  <Download className="w-4 h-4" /> Reporte Completo (Excel)
                </button>
              )}
              <button onClick={() => fetchData()} className="flex items-center gap-2 bg-white text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 font-medium text-sm hover:bg-slate-50 transition-colors shadow-sm">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Recargar
              </button>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium text-sm ${session ? 'bg-brand-50 text-brand-700 border-brand-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${session ? 'bg-brand-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${session ? 'bg-brand-500' : 'bg-amber-500'}`}></span>
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
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5"><Building2 className="inline w-3 h-3 mr-1" />Compañía</label>
                    {session?.companyName ? (
                        <div className="w-full md:w-48 px-3 py-2 bg-brand-50 border border-brand-200 rounded-lg text-sm text-brand-800 font-medium flex items-center gap-2"><Building2 className="w-4 h-4" /><span className="truncate">{session.companyName}</span></div>
                    ) : (
                        <select disabled className="w-full md:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed"><option>Demo / Todas</option></select>
                    )}
                </div>
                <div className="w-full md:w-auto">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5"><Store className="inline w-3 h-3 mr-1" />Punto de Venta</label>
                    <select value={filtros.sedeSeleccionada} onChange={(e) => setFiltros({...filtros, sedeSeleccionada: e.target.value})} className="w-full md:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-brand-500 outline-none">
                        {sedes.map(sede => <option key={sede} value={sede}>{sede}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex flex-wrap gap-6 items-center">
                <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2"><ListFilter className="inline w-3 h-3 mr-1" />Modo de Filtro</label>
                   <div className="flex bg-slate-100 p-1 rounded-lg">
                       <button onClick={() => setFilterMode('mes')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filterMode === 'mes' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Por Mes</button>
                       <button onClick={() => setFilterMode('anio')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filterMode === 'anio' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Por Año</button>
                       <button onClick={() => setFilterMode('custom')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filterMode === 'custom' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Personalizado</button>
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

        {/* DRILL DOWN INDICATOR */}
        {drillDownSede && (
            <div className="bg-brand-600 text-white px-4 py-3 rounded-lg shadow-md flex items-center justify-between animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-1.5 rounded-md"><Target className="w-5 h-5" /></div>
                    <div>
                        <p className="text-xs uppercase font-bold tracking-wider opacity-80">Visualizando Detalles de</p>
                        <p className="font-bold text-lg leading-tight">{drillDownSede}</p>
                    </div>
                </div>
                <button onClick={() => setDrillDownSede(null)} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"><X className="w-4 h-4" /> Ver Todo</button>
            </div>
        )}

        {/* --- VISTA COMPARATIVA DE SEDES (TIPO CAJONES) --- */}
        {view === 'comparativa' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             {/* CAJONES: Tarjetas Interactivas por Sede */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                 {kpisPorSede.map((sede, idx) => (
                    <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-brand-300 transition-all p-5 flex flex-col justify-between group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-slate-100 to-transparent rounded-bl-3xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="p-2 bg-brand-50 text-brand-700 rounded-lg">
                                <Store className="w-6 h-6" />
                            </div>
                            <button onClick={() => setDrillDownSede(sede.name)} className="text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded-md transition-colors flex items-center gap-1">
                                Ver Detalle <ArrowUpRight className="w-3 h-3" />
                            </button>
                        </div>

                        <h3 className="text-lg font-bold text-slate-800 mb-1 truncate" title={sede.name}>{sede.name}</h3>
                        <p className="text-xs text-slate-500 mb-4">{sede.transacciones} transacciones</p>

                        <div className="space-y-3">
                            <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase">Venta Neta</span>
                                <span className="text-base font-bold text-slate-800">S/ {sede.ventas.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                                <span className="text-xs font-semibold text-red-400 uppercase">Costo/Pérdida</span>
                                <span className="text-base font-medium text-red-600">- S/ {sede.costo.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-end pt-1">
                                <span className="text-xs font-bold text-brand-600 uppercase">Ganancia</span>
                                <span className="text-xl font-extrabold text-brand-700">S/ {sede.margen.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Visualizador de Margen (Barra) */}
                        <div className="mt-4">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-500">Rentabilidad</span>
                                <span className={`font-bold ${sede.margenPct < 15 ? 'text-red-500' : 'text-brand-600'}`}>{sede.margenPct.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div 
                                    className={`h-2 rounded-full transition-all duration-1000 ${sede.margenPct < 15 ? 'bg-red-500' : 'bg-brand-500'}`} 
                                    style={{ width: `${Math.min(sede.margenPct, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                 ))}
             </div>

             {/* GRÁFICOS DE ANÁLISIS COMPARATIVO */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. Stacked Bar: Ventas vs Costos (Visualizar el Margen) */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <ArrowUpDown className="w-5 h-5 text-brand-600"/> Composición Venta vs Costo
                    </h3>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={kpisPorSede} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11}} />
                                <Tooltip formatter={(value: number) => `S/ ${value.toLocaleString()}`} cursor={{fill: 'transparent'}} />
                                <Legend />
                                <Bar dataKey="margen" name="Ganancia Neta" stackId="a" fill="#84cc16" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="costo" name="Costo Mercadería" stackId="a" fill="#ef4444" radius={[4, 0, 0, 4]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Scatter Plot: Volumen vs Rentabilidad */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Target className="w-5 h-5 text-brand-600"/> Matriz de Rendimiento (Volumen vs Margen %)
                    </h3>
                    <div className="h-[350px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis type="number" dataKey="ventas" name="Volumen Venta" unit=" S/" tick={{fontSize: 12}} stroke="#94a3b8" />
                                <YAxis type="number" dataKey="margenPct" name="Margen" unit="%" tick={{fontSize: 12}} stroke="#94a3b8" />
                                <ZAxis type="number" dataKey="transacciones" range={[60, 400]} name="Transacciones" />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value: any, name: string) => [name === 'Margen' ? `${Number(value).toFixed(1)}%` : `S/ ${Number(value).toLocaleString()}`, name]} />
                                <Legend />
                                <Scatter name="Sedes" data={kpisPorSede} fill="#3b82f6">
                                    {kpisPorSede.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.margenPct > 20 ? '#84cc16' : entry.margenPct < 10 ? '#ef4444' : '#eab308'} />
                                    ))}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                        <p className="text-xs text-center text-slate-400 mt-2">
                            * Eje X: Volumen Venta | Eje Y: % Margen | Tamaño: Nro. Transacciones
                        </p>
                    </div>
                </div>

             </div>

          </div>
        ) : (
          /* --- VISTAS ANTERIORES (General, Rentabilidad, Ventas, Reportes) --- */
          <>
            {/* KPIs SUPERIORES CON COMPARATIVOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className={`bg-gradient-to-br ${isRentabilidad ? 'from-slate-700 to-slate-800' : 'from-blue-600 to-blue-700'} rounded-xl shadow-lg p-6 flex flex-col justify-between`}>
                <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                    {isRentabilidad ? <DollarSign className="w-6 h-6 text-white" /> : <TrendingUp className="w-6 h-6 text-white" />}
                </div>
                <VariacionBadge val={kpis.variacionVentas} />
                </div>
                <div>
                <p className="text-white/80 text-sm font-medium tracking-wide opacity-90">{isRentabilidad ? 'Venta Total Acumulada' : 'Volumen de Ventas'}</p>
                <h3 className="text-3xl font-bold text-white mt-1 tracking-tight">S/ {kpis.totalVentas}</h3>
                </div>
            </div>

            <div className={`rounded-xl shadow-sm border p-6 flex flex-col justify-between transition-colors ${isRentabilidad ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${isRentabilidad ? 'bg-brand-100' : 'bg-blue-50'}`}>
                    {isRentabilidad ? <TrendingUp className="w-6 h-6 text-brand-600" /> : <Receipt className="w-6 h-6 text-blue-600" />}
                </div>
                {isRentabilidad && <VariacionBadge val={kpis.variacionMargen} />}
                </div>
                <div>
                <p className="text-slate-500 text-sm font-medium">{isRentabilidad ? 'Ganancia Neta' : 'Ticket Promedio Est.'}</p>
                <h3 className={`text-3xl font-bold mt-1 tracking-tight ${isRentabilidad ? 'text-brand-700' : 'text-slate-800'}`}>
                    S/ {isRentabilidad ? kpis.totalMargen : kpis.ticketPromedio}
                </h3>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:border-purple-300 transition-colors">
                <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-50 rounded-lg"><Package className="w-6 h-6 text-purple-600" /></div>
                <VariacionBadge val={kpis.variacionUnidades} />
                </div>
                <div>
                <p className="text-slate-500 text-sm font-medium">Items Procesados</p>
                <h3 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{kpis.unidadesVendidas}</h3>
                </div>
            </div>

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

            {/* GRAFICOS PRINCIPALES Y RANKING */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                {/* TENDENCIA */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><ArrowUpRight className="w-5 h-5 text-brand-600"/> Tendencia de Ventas (Diario)</h3>
                    <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={ventasPorDia} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="fecha" tickFormatter={(value) => new Date(value + 'T00:00:00').toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })} stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                        <YAxis stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} dx={-10} tickFormatter={(value) => `S/${value}`} />
                        <Tooltip formatter={(value: number) => [`S/ ${Number(value).toFixed(2)}`, chartLabel]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey={chartDataKey} stroke={chartColor} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                    </div>
                </div>

                {/* VENTAS POR CATEGORIA (PIE CHART) */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-purple-600"/> Participación por Categoría</h3>
                    <div className="h-[300px] w-full flex">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={ventasPorCategoria}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {ventasPorCategoria.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => `S/ ${value.toFixed(2)}`} />
                                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px', color: '#64748b'}} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* COMPARATIVA POR PUNTO DE VENTA (SEDES) - Visible solo si no es view comparativa (que tiene su propia vista) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-brand-600"/> Comparativa por Punto de Venta (Venta vs Ganancia)
                </h3>
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparativaSedes} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                            <YAxis stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} dx={-10} tickFormatter={(value) => `S/${value/1000}k`} />
                            <Tooltip 
                                formatter={(value: number) => [`S/ ${Number(value).toFixed(2)}`, '']}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                cursor={{fill: '#f8fafc'}} 
                            />
                            <Legend wrapperStyle={{paddingTop: '20px'}} />
                            <Bar dataKey="ventas" name="Venta Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="margen" name="Ganancia" fill="#84cc16" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* RANKING VENDEDORES Y TOP PRODUCTOS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                {/* RANKING VENDEDORES */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Users className="w-5 h-5 text-blue-600"/> Desempeño por Vendedor/Caja</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={rankingVendedores} layout="vertical" margin={{ left: 20, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 10}} />
                                <Tooltip formatter={(value: number) => [`S/ ${Number(value).toFixed(2)}`, 'Ventas']} cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="ventas" radius={[0, 4, 4, 0]} barSize={20} fill="#3b82f6" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* TOP 5 PRODUCTOS */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Package className="w-5 h-5 text-brand-600"/> Top 5 Productos (Más Vendidos)</h3>
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

            {/* BOTTOM PRODUCTOS (ALERTA) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-500"/> Productos con Menor Rotación (Bottom 5)</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {bottomProductosVolumen.map((p, idx) => (
                        <div key={idx} className="bg-red-50 border border-red-100 rounded-lg p-3">
                            <p className="text-xs font-bold text-red-400 uppercase mb-1">Puesto #{idx+1}</p>
                            <p className="text-sm font-medium text-slate-800 truncate" title={p.name}>{p.name}</p>
                            <p className="text-lg font-bold text-red-700 mt-1">S/ {p.val.toFixed(2)}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* TABLA DE DETALLE CON PAGINACIÓN */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-hidden animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-brand-600" />
                    {drillDownSede ? `Productos en ${drillDownSede}` : 'Detalle Global de Productos'}
                </h3>
                <p className="text-xs text-slate-500 font-light">
                    {drillDownSede ? 'Mostrando únicamente items vendidos en la sede seleccionada.' : 'Desglose general por item, costo real y rentabilidad.'}
                </p>
                </div>
                <button onClick={handleDownloadExcel} className="px-4 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                <Download className="w-4 h-4" />Descargar Excel
                </button>
            </div>
            <div className="overflow-x-auto border rounded-lg border-slate-100">
                <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 select-none">
                    <tr>
                    <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100 hover:text-brand-700 transition-colors" onClick={() => handleSort('producto')}>Producto <SortIcon column="producto" /></th>
                    <th className="px-4 py-3 font-semibold cursor-pointer text-slate-500">Categoría</th>
                    <th className="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-slate-100 hover:text-brand-700 transition-colors" onClick={() => handleSort('cantidad')}>Unds. <SortIcon column="cantidad" /></th>
                    <th className="px-4 py-3 font-semibold text-right text-slate-400 cursor-pointer hover:bg-slate-100 hover:text-brand-700 transition-colors" onClick={() => handleSort('costo')}>Costo Total <SortIcon column="costo" /></th>
                    <th className="px-4 py-3 font-semibold text-right text-slate-700 cursor-pointer hover:bg-slate-100 hover:text-brand-700 transition-colors" onClick={() => handleSort('ventaNeta')}>Venta Neta <SortIcon column="ventaNeta" /></th>
                    <th className="px-4 py-3 font-semibold text-right text-brand-700 bg-brand-50/30 cursor-pointer hover:bg-brand-100 transition-colors" onClick={() => handleSort('ganancia')}>Ganancia <SortIcon column="ganancia" /></th>
                    <th className="px-4 py-3 font-semibold text-right text-brand-700 bg-brand-50/30 cursor-pointer hover:bg-brand-100 transition-colors" onClick={() => handleSort('margenPorcentaje')}>Margen % <SortIcon column="margenPorcentaje" /></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {paginatedProductos.length > 0 ? (
                        paginatedProductos.map((prod, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-4 py-3 font-medium text-slate-800 group-hover:text-blue-600 transition-colors max-w-xs truncate" title={prod.producto}>{prod.producto}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs">{prod.categoria}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{prod.cantidad}</td>
                            <td className="px-4 py-3 text-right text-slate-400">S/ {prod.costo.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">S/ {prod.ventaNeta.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-medium text-brand-600 bg-brand-50/10">S/ {prod.ganancia.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-medium text-brand-700 bg-brand-50/10">
                                <span className={`px-2 py-0.5 rounded text-xs ${prod.margenPorcentaje < 20 ? 'bg-red-100 text-red-700' : 'bg-brand-100 text-brand-800'}`}>
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

            {/* Pagination Controls */}
            {reporteProductos.length > 0 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-6 mt-2">
                    <div className="flex flex-1 justify-between sm:hidden">
                        <button 
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Anterior
                        </button>
                        <button 
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Siguiente
                        </button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-slate-700">
                                Mostrando <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, reporteProductos.length)}</span> de <span className="font-bold text-slate-900">{reporteProductos.length}</span> resultados
                            </p>
                        </div>
                        <div>
                            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="sr-only">Anterior</span>
                                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                </button>
                                <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 focus:outline-offset-0">
                                    Página {currentPage} de {totalPages}
                                </span>
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
          </>
        )}

      </div>
    </div>
  );
};

export default Dashboard;