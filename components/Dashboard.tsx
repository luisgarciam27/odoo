import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, DollarSign, Package, Calendar, ArrowUpRight, RefreshCw, AlertCircle, Building2, Store } from 'lucide-react';
import { Venta, Filtros, AgrupadoPorDia, AgrupadoPorSede, AgrupadoProducto, OdooSession } from '../types';
import OdooConfigModal from './OdooConfigModal';
import { OdooClient } from '../services/odoo';

// Datos simulados para PUNTO DE VENTA (Estructura específica del cliente)
const generarDatosVentas = (): Venta[] => {
  // ESTRUCTURA: 
  // BOTICAS MULTIFARMA -> Multifarmas, Cristo Rey, Lomas, Tienda 4
  // CONSULTORIO -> Caja Requesalud

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
    { id: 7, nombre: 'Inyectable - Servicio', costo: 1.00, precio: 10.00 }
  ];

  const ventas: Venta[] = [];
  const fechaInicio = new Date('2024-01-01');
  const fechaFin = new Date();

  // Generamos datos para ambas empresas en el modo demo
  for (let d = new Date(fechaInicio); d <= fechaFin; d.setDate(d.getDate() + 1)) {
    // Para cada empresa
    estructura.forEach(emp => {
        const ventasPorDia = Math.floor(Math.random() * 6) + 1; // 1 a 7 ventas por empresa por día
        
        for (let i = 0; i < ventasPorDia; i++) {
            const sede = emp.sedes[Math.floor(Math.random() * emp.sedes.length)];
            
            // --- REGLA DE NEGOCIO: Tienda 4 cerró en Agosto ---
            if (sede === 'Tienda 4') {
                const fechaCierreTienda4 = new Date('2024-08-31');
                // Si la fecha actual del bucle es mayor a agosto, Tienda 4 ya no vende.
                if (d > fechaCierreTienda4) {
                    continue; // Saltamos esta venta (no se registra, o se podría asignar a otra sede si quisiéramos mantener volumen)
                }
            }

            const producto = productos[Math.floor(Math.random() * productos.length)];
            
            // Si es consultorio, preferimos servicios
            let prodFinal = producto;
            if (emp.compania.includes('CONSULTORIO')) {
                 if (Math.random() > 0.6) prodFinal = productos.find(p => p.nombre.includes('Consulta')) || producto;
            }

            const total = prodFinal.precio;
            const costo = prodFinal.costo;
            const margen = total - costo;

            ventas.push({
                fecha: new Date(d),
                sede, 
                compania: emp.compania,
                producto: prodFinal.nombre,
                cantidad: 1,
                total,
                costo,
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

const Dashboard: React.FC<DashboardProps> = ({ session, view = 'general' }) => {
  const [ventasData, setVentasData] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  // Default: Año actual
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const [filtros, setFiltros] = useState<Filtros>({
    sedeSeleccionada: 'Todas',
    companiaSeleccionada: session?.companyName || 'Todas',
    periodoSeleccionado: 'año',
    fechaInicio: yearStart,
    fechaFin: today
  });

  const fetchData = async () => {
      // 1. MODO DEMO / SIN SESIÓN
      if (!session) {
          if (ventasData.length === 0) {
              setVentasData(generarDatosVentas());
          }
          return;
      }

      // 2. MODO CONECTADO A ODOO
      setLoading(true);
      setError(null);
      const client = new OdooClient(session.url, session.db, session.useProxy);
      
      const model = 'pos.order';
      const fields = ['date_order', 'config_id', 'amount_total', 'company_id', 'state', 'partner_id', 'pos_reference', 'name'];

      // --- CORRECCIÓN DE ZONA HORARIA ---
      const queryStart = new Date(filtros.fechaInicio);
      queryStart.setDate(queryStart.getDate() - 1); 
      const queryStartStr = queryStart.toISOString().split('T')[0];

      const queryEnd = new Date(filtros.fechaFin);
      queryEnd.setDate(queryEnd.getDate() + 1); 
      const queryEndStr = queryEnd.toISOString().split('T')[0];

      const domain: any[] = [
        ['state', '!=', 'cancel'], 
        ['state', '!=', 'draft'],
        ['date_order', '>=', `${queryStartStr} 00:00:00`],
        ['date_order', '<=', `${queryEndStr} 23:59:59`]
      ];

      // --- FILTRADO OBLIGATORIO POR COMPAÑÍA SELECCIONADA EN LOGIN ---
      if (session.companyId) {
          domain.push(['company_id', '=', session.companyId]);
      }

      const options: any = {
        limit: 5000, 
        order: 'date_order desc'
      };

      try {
          // Si hay compañía seleccionada, la forzamos en el contexto
          if (session.companyId) {
              options.context = { allowed_company_ids: [session.companyId] };
          }

          console.log("Consultando Pedidos PoS...", { domain, company: session.companyName });
          
          const rawData: any[] = await client.searchRead(session.uid, session.apiKey, model, domain, fields, options);

          if (!rawData) throw new Error("Respuesta vacía de Odoo.");

          // Preparar fechas límite locales para el filtrado exacto
          const filterStartDate = new Date(`${filtros.fechaInicio}T00:00:00`);
          const filterEndDate = new Date(`${filtros.fechaFin}T23:59:59`);

          // Mapeo de datos
          const mappedVentas: Venta[] = rawData
          .map((line: any) => {
              const total = line.amount_total || 0;
              // config_id[1] es el nombre del Punto de Venta (ej: "Multifarmas", "Tienda 4")
              const sede = Array.isArray(line.config_id) ? line.config_id[1] : 'Caja General';
              const compania = Array.isArray(line.company_id) ? line.company_id[1] : 'Empresa Principal';
              
              let producto = line.pos_reference || line.name || 'Ticket';
              if (Array.isArray(line.partner_id)) {
                  producto = `${producto} - ${line.partner_id[1]}`;
              } else if (line.partner_id) {
                   producto = `${producto} - Cliente General`;
              }

              const costo = total * 0.7; // Simulado si Odoo no devuelve costo en pos.order
              const margen = total - costo;

              const utcString = (line.date_order || "").replace(" ", "T") + "Z";
              const fechaLocal = new Date(utcString);

              return {
                  fecha: fechaLocal,
                  sede,
                  compania,
                  producto,
                  cantidad: 1,
                  total,
                  costo,
                  margen,
                  margenPorcentaje: total > 0 ? ((margen / total) * 100).toFixed(1) : '0.0'
              };
          })
          .filter((v: Venta) => {
              return v.fecha >= filterStartDate && v.fecha <= filterEndDate;
          });

          setVentasData(mappedVentas);

          if (mappedVentas.length === 0) {
            setError("Conexión exitosa. No se encontraron pedidos en este rango de fechas para la compañía seleccionada.");
          }

      } catch (err: any) {
          console.error("Error crítico:", err);
          let errorMsg = err.message || "Error desconocido";
          if (errorMsg.includes("Access")) errorMsg = "Error de Permisos: Tu usuario no tiene acceso al modelo 'pos.order'.";
          setError(`Error: ${errorMsg}`);
          setVentasData([]); 
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchData();
  }, [session, filtros.fechaInicio, filtros.fechaFin]);

  // --- MEMOS ---
  // Calculamos las sedes basadas en los datos ya filtrados por compañía (si existe sesión) o datos demo
  const sedes = useMemo(() => {
      let datosParaSedes = ventasData;
      // Si estamos en modo DEMO y el usuario no ha filtrado (simulando login con filtros vacíos)
      // En modo real, ventasData ya viene filtrado por la API
      if (!session && filtros.companiaSeleccionada !== 'Todas') {
          // Filtrado manual para demo
          datosParaSedes = ventasData.filter(v => v.compania.includes(filtros.companiaSeleccionada));
      }
      return ['Todas', ...Array.from(new Set(datosParaSedes.map(v => v.sede)))];
  }, [ventasData, session, filtros.companiaSeleccionada]);
  
  const datosFiltrados = useMemo(() => {
    let datos = ventasData;
    
    // Filtro por Punto de Venta (Sede)
    if (filtros.sedeSeleccionada !== 'Todas') datos = datos.filter(v => v.sede === filtros.sedeSeleccionada);
    
    // Filtro adicional por Compañía (Solo relevante en Modo Demo o si hay mezcla de datos)
    // En producción (session existe), ventasData ya es solo de una compañía.
    if (!session && filtros.companiaSeleccionada !== 'Todas') {
         // Lógica simple para Demo: "BOTICAS" muestra Multifarma, "CONSULTORIO" muestra Requesalud
         /* En el componente Login ya definimos el nombre. Aquí solo filtramos si el string coincide. */
    }

    return datos;
  }, [ventasData, filtros.sedeSeleccionada, filtros.companiaSeleccionada, session]);

  const kpis = useMemo(() => {
    const totalVentas = datosFiltrados.reduce((sum, v) => sum + v.total, 0);
    const totalCostos = datosFiltrados.reduce((sum, v) => sum + v.costo, 0);
    const totalMargen = totalVentas - totalCostos;
    const margenPromedio = totalVentas > 0 ? ((totalMargen / totalVentas) * 100) : 0;
    const unidadesVendidas = datosFiltrados.length; // Cantidad de Tickets
    return {
      totalVentas: totalVentas.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      totalMargen: totalMargen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      margenPromedio: margenPromedio.toFixed(1),
      unidadesVendidas
    };
  }, [datosFiltrados]);

  const ventasPorDia = useMemo(() => {
    const agrupado: Record<string, AgrupadoPorDia> = {};
    datosFiltrados.forEach(v => {
      const fecha = v.fecha.toLocaleDateString('en-CA');
      if (!agrupado[fecha]) agrupado[fecha] = { fecha, ventas: 0, margen: 0 };
      agrupado[fecha].ventas += v.total;
      agrupado[fecha].margen += v.margen;
    });
    return Object.values(agrupado).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [datosFiltrados]);

  const ventasPorSede = useMemo(() => {
    const agrupado: Record<string, AgrupadoPorSede> = {};
    datosFiltrados.forEach(v => {
      if (!agrupado[v.sede]) agrupado[v.sede] = { sede: v.sede, ventas: 0, margen: 0 };
      agrupado[v.sede].ventas += v.total;
      agrupado[v.sede].margen += v.margen;
    });
    return Object.values(agrupado).sort((a, b) => b.ventas - a.ventas).slice(0, 6); 
  }, [datosFiltrados]);

  const topProductos = useMemo(() => {
    const agrupado: Record<string, AgrupadoProducto> = {};
    datosFiltrados.forEach(v => {
      if (!agrupado[v.producto]) agrupado[v.producto] = { producto: v.producto, cantidad: 0, ventas: 0, margen: 0 };
      agrupado[v.producto].cantidad += 1;
      agrupado[v.producto].ventas += v.total;
      agrupado[v.producto].margen += v.margen;
    });
    return Object.values(agrupado).sort((a, b) => b.ventas - a.ventas).slice(0, 8);
  }, [datosFiltrados]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  const aplicarPeriodo = (periodo: string) => {
    const hoy = new Date();
    let inicio = new Date(hoy);
    
    switch(periodo) {
      case 'hoy': break; 
      case 'semana': inicio.setDate(hoy.getDate() - 7); break;
      case 'mes': inicio.setMonth(hoy.getMonth() - 1); break;
      case 'trimestre': inicio.setMonth(hoy.getMonth() - 3); break;
      case 'año': inicio = new Date(hoy.getFullYear(), 0, 1); break;
    }
    
    setFiltros({
      ...filtros,
      periodoSeleccionado: periodo,
      fechaInicio: inicio.toISOString().split('T')[0],
      fechaFin: hoy.toISOString().split('T')[0]
    });
  };

  // --- CONFIGURACIÓN DE VISTAS ---
  const isRentabilidad = view === 'rentabilidad';
  const chartDataKey = isRentabilidad ? 'margen' : 'ventas'; 
  const chartColor = isRentabilidad ? '#10b981' : '#3b82f6'; 
  const chartLabel = isRentabilidad ? 'Margen (Ganancia)' : 'Ventas Totales';

  const showKPIs = view === 'general' || view === 'rentabilidad';
  const showCharts = view === 'general' || view === 'reportes' || view === 'rentabilidad';
  const showTable = view === 'general' || view === 'ventas';

  return (
    <div className="p-4 md:p-6 lg:p-8 font-sans w-full relative">
      <OdooConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
      
      {/* Loading Overlay */}
      {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3 border border-slate-100">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                  <span className="font-medium text-slate-700">Cargando Pedidos PoS...</span>
              </div>
          </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-2">
           <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {view === 'rentabilidad' ? 'Análisis de Rentabilidad' : 
                 view === 'ventas' ? 'Gestión de Ventas' :
                 view === 'reportes' ? 'Reportes Gráficos' : 'Dashboard General'}
              </h1>
              <p className="text-slate-500 text-sm">
                  {session ? `Compañía: ${session.companyName || 'Todas'}` : 'Modo Demo'}
              </p>
           </div>
           
           <div className="mt-4 md:mt-0 flex gap-3">
              <button 
                onClick={fetchData}
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
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex gap-3 items-center shadow-sm animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div className="flex-1">
                    <p className="font-semibold text-sm">Aviso de Datos</p>
                    <p className="text-xs opacity-90">{error}</p>
                </div>
            </div>
        )}

        {/* Filters Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-wrap gap-4 items-end">
            
            <div className="w-full md:w-auto">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                <Building2 className="inline w-3 h-3 mr-1" />
                Compañía
              </label>
              {session?.companyName ? (
                   <div className="w-full md:w-48 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 font-medium flex items-center gap-2">
                       <Building2 className="w-4 h-4" />
                       <span className="truncate">{session.companyName}</span>
                   </div>
              ) : (
                <select 
                    disabled={true}
                    className="w-full md:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed"
                >
                    <option>Demo / Todas</option>
                </select>
              )}
            </div>

            <div className="w-full md:w-auto">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                <Store className="inline w-3 h-3 mr-1" />
                Punto de Venta (Caja)
              </label>
              <select 
                value={filtros.sedeSeleccionada}
                onChange={(e) => setFiltros({...filtros, sedeSeleccionada: e.target.value})}
                className="w-full md:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {sedes.map(sede => (
                  <option key={sede} value={sede}>{sede}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[300px]">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                <Calendar className="inline w-3 h-3 mr-1" />
                Rango de Fechas
              </label>
              <div className="flex bg-slate-50 p-1 rounded-lg w-full md:w-fit border border-slate-200">
                {['mes', 'trimestre', 'año'].map(periodo => (
                  <button
                    key={periodo}
                    onClick={() => aplicarPeriodo(periodo)}
                    className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                      filtros.periodoSeleccionado === periodo
                        ? 'bg-white text-emerald-600 shadow-sm border border-slate-100'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                  >
                    {periodo.charAt(0).toUpperCase() + periodo.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <div className="w-1/2 md:w-auto">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Desde</label>
                <input
                  type="date"
                  value={filtros.fechaInicio}
                  onChange={(e) => setFiltros({...filtros, fechaInicio: e.target.value, periodoSeleccionado: 'custom'})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="w-1/2 md:w-auto">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Hasta</label>
                <input
                  type="date"
                  value={filtros.fechaFin}
                  onChange={(e) => setFiltros({...filtros, fechaFin: e.target.value, periodoSeleccionado: 'custom'})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        {showKPIs && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className={`bg-gradient-to-br ${isRentabilidad ? 'from-slate-700 to-slate-800' : 'from-emerald-600 to-emerald-700'} rounded-xl shadow-lg p-6 flex flex-col justify-between`}>
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-white/20 text-white rounded-full">
                <ArrowUpRight className="w-3 h-3" /> PoS
              </span>
            </div>
            <div>
              <p className="text-white/80 text-sm font-medium tracking-wide opacity-90">Ingresos Totales</p>
              <h3 className="text-3xl font-bold text-white mt-1 tracking-tight">S/ {kpis.totalVentas}</h3>
            </div>
            <div className="mt-4 h-1 w-full bg-black/10 rounded-full overflow-hidden">
               <div className="h-full bg-white/40" style={{width: '100%'}}></div>
            </div>
          </div>

          <div className={`rounded-xl shadow-sm border p-6 flex flex-col justify-between transition-colors ${isRentabilidad ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${isRentabilidad ? 'bg-emerald-100' : 'bg-blue-50'}`}>
                <DollarSign className={`w-6 h-6 ${isRentabilidad ? 'text-emerald-600' : 'text-blue-600'}`} />
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Ganancia Est. (30%)</p>
              <h3 className={`text-3xl font-bold mt-1 tracking-tight ${isRentabilidad ? 'text-emerald-700' : 'text-slate-800'}`}>S/ {kpis.totalMargen}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-auto pt-4">Margen operativo estimado</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:border-purple-300 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Transacciones</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{kpis.unidadesVendidas}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-auto pt-4">Pedidos / Tickets</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:border-orange-300 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-50 rounded-lg">
                <Store className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Cajas Activas</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{ventasPorSede.length}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-auto pt-4">Puntos de venta con mov.</p>
          </div>
        </div>
        )}

        {/* Gráficos principales */}
        {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
          {/* Gráfico 1: Tiempo */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800">{isRentabilidad ? 'Evolución del Margen' : 'Flujo de Caja Diario'}</h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ventasPorDia} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="fecha" 
                    tickFormatter={(value) => new Date(value + 'T00:00:00').toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                    stroke="#94a3b8"
                    tick={{fontSize: 12}}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#94a3b8"
                    tick={{fontSize: 12}}
                    axisLine={false}
                    tickLine={false}
                    dx={-10}
                    tickFormatter={(value) => `S/ ${value/1000}k`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`S/ ${Number(value).toFixed(2)}`, chartLabel]}
                    labelFormatter={(label) => new Date(label + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={chartDataKey} 
                    stroke={chartColor} 
                    strokeWidth={2} 
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    name={chartLabel}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico 2: Sede */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800">{isRentabilidad ? 'Rentabilidad por Caja' : 'Ventas por Caja/Sede'}</h3>
              <button className="text-xs text-blue-600 hover:text-blue-700 font-medium bg-blue-50 px-3 py-1 rounded-full">Top 6</button>
            </div>
            <div className="h-[300px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ventasPorSede}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey={chartDataKey}
                    nameKey="sede"
                  >
                    {ventasPorSede.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`S/ ${Number(value).toFixed(2)}`, chartLabel]} 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    wrapperStyle={{ paddingLeft: '20px' }}
                    formatter={(value) => (
                      <span className="text-slate-600 text-sm font-medium ml-2">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        )}

        {/* Top productos */}
        {showCharts && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in slide-in-from-bottom-10 duration-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">{isRentabilidad ? 'Top Productos (Por Margen)' : 'Top Tickets / Clientes'}</h3>
            <div className="flex gap-4 text-xs font-medium">
               <div className="flex items-center gap-1"><span className={`h-3 w-3 rounded-sm ${isRentabilidad ? 'bg-emerald-500' : 'bg-blue-500'}`}></span> {chartLabel}</div>
            </div>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductos} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis 
                  dataKey="producto" 
                  type="category" 
                  width={150} 
                  stroke="#475569" 
                  tick={{fontSize: 12, fontWeight: 500}} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  formatter={(value: number) => [`S/ ${Number(value).toFixed(2)}`, chartLabel]}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey={chartDataKey} fill={chartColor} radius={[0, 4, 4, 0]} barSize={20} name={chartLabel} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        )}

        {/* Tabla de productos */}
        {showTable && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-hidden animate-in fade-in slide-in-from-bottom-12 duration-1000">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">Detalle de Transacciones</h3>
            <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
              Descargar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-6 py-3 font-semibold rounded-l-lg">Ticket / Cliente</th>
                  <th className="px-6 py-3 font-semibold text-right">Items</th>
                  <th className="px-6 py-3 font-semibold text-right">Monto Total</th>
                  <th className="px-6 py-3 font-semibold text-right rounded-r-lg">Origen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProductos.map((prod, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-800 group-hover:text-blue-600 transition-colors">{prod.producto}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{prod.cantidad}</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">S/ {prod.ventas.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right text-xs text-slate-500">Punto de Venta</td>
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