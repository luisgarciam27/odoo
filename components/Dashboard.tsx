import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, DollarSign, Package, MapPin, Calendar, ArrowUpRight, RefreshCw, AlertCircle, Building2, Store } from 'lucide-react';
import { Venta, Filtros, AgrupadoPorDia, AgrupadoPorSede, AgrupadoProducto, OdooSession } from '../types';
import OdooConfigModal from './OdooConfigModal';
import { OdooClient } from '../services/odoo';

// Datos simulados para PUNTO DE VENTA (Cajas, Tiendas físicas)
const generarDatosVentas = (): Venta[] => {
  const sedes = ['Caja Principal', 'Barra 1', 'Tienda Centro', 'Kiosko Norte'];
  const companias = ['Mi Empresa S.A.C.', 'Sucursal Arequipa IRL'];
  const productos = [
    { id: 1, nombre: 'Coca Cola 500ml', costo: 1.5, precio: 3.5 },
    { id: 2, nombre: 'Menu Ejecutivo', costo: 8, precio: 15 },
    { id: 3, nombre: 'Agua San Mateo', costo: 1, precio: 2.5 },
    { id: 4, nombre: 'Sandwich de Pollo', costo: 3, precio: 8 },
    { id: 5, nombre: 'Cafe Americano', costo: 1.2, precio: 5 },
    { id: 6, nombre: 'Postre del Dia', costo: 2, precio: 6 },
    { id: 7, nombre: 'Inka Cola 1L', costo: 2.5, precio: 5.5 },
    { id: 8, nombre: 'Galletas Varias', costo: 0.8, precio: 2.0 }
  ];

  const ventas: Venta[] = [];
  const fechaInicio = new Date('2024-01-01');
  const fechaFin = new Date();

  for (let d = new Date(fechaInicio); d <= fechaFin; d.setDate(d.getDate() + 1)) {
    const ventasPorDia = Math.floor(Math.random() * 10) + 5;
    
    for (let i = 0; i < ventasPorDia; i++) {
      const producto = productos[Math.floor(Math.random() * productos.length)];
      const sede = sedes[Math.floor(Math.random() * sedes.length)];
      const compania = companias[Math.floor(Math.random() * companias.length)];
      const cantidad = Math.floor(Math.random() * 2) + 1;
      const total = producto.precio * cantidad;
      const costo = producto.costo * cantidad;
      const margen = total - costo;
      
      ventas.push({
        fecha: new Date(d),
        sede, // En PoS esto es la "Caja" o "Punto de Venta"
        compania,
        producto: producto.nombre,
        cantidad,
        total,
        costo,
        margen,
        margenPorcentaje: ((margen / total) * 100).toFixed(1)
      });
    }
  }
  return ventas;
};

interface DashboardProps {
    session: OdooSession | null;
}

const Dashboard: React.FC<DashboardProps> = ({ session }) => {
  const [ventasData, setVentasData] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [realCompanies, setRealCompanies] = useState<string[]>([]);
  
  // Default: Año actual
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const [filtros, setFiltros] = useState<Filtros>({
    sedeSeleccionada: 'Todas',
    companiaSeleccionada: 'Todas',
    periodoSeleccionado: 'año',
    fechaInicio: yearStart,
    fechaFin: today
  });

  const fetchData = async () => {
      if (!session) {
          if (ventasData.length === 0) {
              setVentasData(generarDatosVentas());
              setRealCompanies(['Mi Empresa S.A.C.', 'Sucursal Arequipa IRL']);
          }
          return;
      }

      setLoading(true);
      setError(null);
      const client = new OdooClient(session.url, session.db, session.useProxy);
      
      // CONFIGURACIÓN PARA PUNTO DE VENTA (PoS)
      
      // Intento 1: Usar 'report.pos.order' (Análisis de PoS). 
      // Es el mejor porque trae Productos + Configuración (Caja) en una sola vista.
      const modelReport = 'report.pos.order';
      const fieldsReport = ['date', 'config_id', 'product_id', 'company_id', 'price_total', 'product_qty', 'state'];
      
      // Intento 2 (Fallback): Usar 'pos.order' (Cabeceras de tickets).
      // Si falla el reporte por permisos, usamos esto. Perdemos el detalle de productos, pero vemos totales por caja.
      const modelFallback = 'pos.order';
      const fieldsFallback = ['date_order', 'config_id', 'amount_total', 'company_id', 'state', 'partner_id'];

      // Filtro común
      const domain = [
        ['state', 'in', ['paid', 'done', 'invoiced']], // Estados válidos de PoS
        ['date' /* se ajustará según modelo */, '>=', filtros.fechaInicio],
        ['date' /* se ajustará según modelo */, '<=', `${filtros.fechaFin} 23:59:59`]
      ];

      const options: any = {
        limit: 1000, 
        order: 'date desc' // O date_order desc
      };

      try {
          // 1. Obtener Compañías permitidas
          let allowedCompanyIds: number[] = [];
          try {
             const userData: any[] = await client.searchRead(
                 session.uid, session.apiKey, 'res.users',
                 [['id', '=', session.uid]], ['company_ids']
             );
             if (userData && userData.length > 0) {
                 allowedCompanyIds = userData[0].company_ids || [];
                 // Cargar nombres
                 client.searchRead(session.uid, session.apiKey, 'res.company', [['id', 'in', allowedCompanyIds]], ['name'])
                    .then((comps: any[]) => setRealCompanies(comps.map(c => c.name))).catch(() => {});
             }
          } catch (e) { console.warn("Fallo leve obteniendo users", e); }

          if (allowedCompanyIds.length > 0) {
              options.context = { allowed_company_ids: allowedCompanyIds };
          }

          let rawData: any[] = [];
          let source = 'report';

          try {
             console.log("Intentando leer Análisis de PoS (report.pos.order)...");
             // Ajustar dominio para reporte
             const domainReport = [...domain];
             domainReport[1] = ['date', '>=', filtros.fechaInicio];
             domainReport[2] = ['date', '<=', `${filtros.fechaFin} 23:59:59`];
             options.order = 'date desc';

             rawData = await client.searchRead(session.uid, session.apiKey, modelReport, domainReport, fieldsReport, options);
          } catch (reportErr) {
             console.warn("Fallo leyendo reporte PoS, intentando cabeceras (pos.order)", reportErr);
             source = 'order';
             
             // Ajustar dominio para pos.order (usa date_order en vez de date)
             const domainOrder = [...domain];
             domainOrder[1] = ['date_order', '>=', filtros.fechaInicio];
             domainOrder[2] = ['date_order', '<=', `${filtros.fechaFin} 23:59:59`];
             options.order = 'date_order desc';

             rawData = await client.searchRead(session.uid, session.apiKey, modelFallback, domainOrder, fieldsFallback, options);
          }

          if (!rawData) throw new Error("Respuesta vacía de Odoo.");

          // Mapeo de datos (Unificando estructura)
          const mappedVentas: Venta[] = rawData.map((line: any) => {
              // Campos dinámicos según el origen (Reporte vs Orden directa)
              const dateRaw = source === 'report' ? line.date : line.date_order;
              const total = source === 'report' ? (line.price_total || 0) : (line.amount_total || 0);
              const cantidad = source === 'report' ? (line.product_qty || 1) : 1;
              
              // PoS Config (Caja/Sede)
              const sede = Array.isArray(line.config_id) ? line.config_id[1] : 'Caja Desconocida';
              const compania = Array.isArray(line.company_id) ? line.company_id[1] : 'Empresa Principal';
              
              // Producto
              let producto = 'Venta PoS General';
              if (source === 'report') {
                  producto = Array.isArray(line.product_id) ? line.product_id[1] : 'Sin Nombre';
              } else {
                  // Si estamos en modo fallback (solo cabeceras), usamos el cliente o genérico
                  producto = Array.isArray(line.partner_id) ? `Cliente: ${line.partner_id[1]}` : 'Ticket de Venta';
              }

              // Estimación de costo (70%)
              const costo = total * 0.7;
              const margen = total - costo;

              return {
                  fecha: new Date(dateRaw),
                  sede,
                  compania,
                  producto,
                  cantidad,
                  total,
                  costo,
                  margen,
                  margenPorcentaje: total > 0 ? ((margen / total) * 100).toFixed(1) : '0.0'
              };
          });

          setVentasData(mappedVentas);

          if (mappedVentas.length === 0) {
            setError("Conexión exitosa. No se encontraron tickets de PoS en el rango seleccionado.");
          }

      } catch (err: any) {
          console.error("Error crítico:", err);
          let errorMsg = err.message || "Error desconocido";
          if (errorMsg.includes("Access")) errorMsg = "Error de Permisos: Tu usuario no tiene acceso al módulo Punto de Venta (PoS).";
          setError(`Error: ${errorMsg}`);
          setVentasData([]); 
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchData();
  }, [session, filtros.fechaInicio, filtros.fechaFin]);

  // --- MEMOS (Sin cambios lógicos, solo visuales) ---
  const sedes = useMemo(() => ['Todas', ...Array.from(new Set(ventasData.map(v => v.sede)))], [ventasData]);
  const companias = useMemo(() => {
      if (realCompanies.length > 0) return ['Todas', ...realCompanies];
      return ['Todas', ...Array.from(new Set(ventasData.map(v => v.compania)))];
  }, [ventasData, realCompanies]);

  const datosFiltrados = useMemo(() => {
    let datos = ventasData;
    if (filtros.sedeSeleccionada !== 'Todas') datos = datos.filter(v => v.sede === filtros.sedeSeleccionada);
    if (filtros.companiaSeleccionada !== 'Todas') datos = datos.filter(v => v.compania === filtros.companiaSeleccionada);
    return datos;
  }, [ventasData, filtros.sedeSeleccionada, filtros.companiaSeleccionada]);

  const kpis = useMemo(() => {
    const totalVentas = datosFiltrados.reduce((sum, v) => sum + v.total, 0);
    const totalCostos = datosFiltrados.reduce((sum, v) => sum + v.costo, 0);
    const totalMargen = totalVentas - totalCostos;
    const margenPromedio = totalVentas > 0 ? ((totalMargen / totalVentas) * 100) : 0;
    const unidadesVendidas = datosFiltrados.reduce((sum, v) => sum + v.cantidad, 0); // O Tickets si es fallback
    return {
      totalVentas: totalVentas.toFixed(2),
      totalMargen: totalMargen.toFixed(2),
      margenPromedio: margenPromedio.toFixed(1),
      unidadesVendidas
    };
  }, [datosFiltrados]);

  const ventasPorDia = useMemo(() => {
    const agrupado: Record<string, AgrupadoPorDia> = {};
    datosFiltrados.forEach(v => {
      const fecha = v.fecha.toISOString().split('T')[0];
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
      agrupado[v.producto].cantidad += v.cantidad;
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

  return (
    <div className="p-4 md:p-6 lg:p-8 font-sans w-full relative">
      <OdooConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
      
      {/* Loading Overlay */}
      {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3 border border-slate-100">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                  <span className="font-medium text-slate-700">Cargando datos de PoS...</span>
              </div>
          </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-2">
           <div>
              <h1 className="text-2xl font-bold text-slate-800">Punto de Venta (PoS)</h1>
              <p className="text-slate-500 text-sm">
                  {session ? `Base de datos: ${session.db}` : 'Modo Demo (Simulación)'}
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
              <select 
                value={filtros.companiaSeleccionada}
                onChange={(e) => setFiltros({...filtros, companiaSeleccionada: e.target.value})}
                className="w-full md:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {companias.map(comp => (
                  <option key={comp} value={comp}>{comp}</option>
                ))}
              </select>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl shadow-lg shadow-emerald-900/10 p-6 flex flex-col justify-between transform transition-transform hover:scale-[1.01]">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-white/20 text-white rounded-full">
                <ArrowUpRight className="w-3 h-3" /> PoS
              </span>
            </div>
            <div>
              <p className="text-emerald-50 text-sm font-medium tracking-wide opacity-90">Ingresos Totales (Cajas)</p>
              <h3 className="text-3xl font-bold text-white mt-1 tracking-tight">${kpis.totalVentas}</h3>
            </div>
            <div className="mt-4 h-1 w-full bg-black/10 rounded-full overflow-hidden">
               <div className="h-full bg-white/40" style={{width: '100%'}}></div>
            </div>
            <p className="text-xs text-emerald-100 mt-2 font-medium">Facturado en PoS</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:border-blue-300 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-50 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Ganancia Est. (30%)</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">${kpis.totalMargen}</h3>
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
              <p className="text-slate-500 text-sm font-medium">Items / Tickets</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{kpis.unidadesVendidas}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-auto pt-4">Volumen transaccional</p>
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

        {/* Gráficos principales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ventas por día */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800">Flujo de Caja Diario</h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ventasPorDia} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="fecha" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
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
                    tickFormatter={(value) => `$${value/1000}k`}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [`$${Number(value).toFixed(2)}`, 'Ventas']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ventas" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ventas por sede */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800">Ventas por Caja/Sede</h3>
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
                    dataKey="ventas"
                  >
                    {ventasPorSede.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `$${Number(value).toFixed(2)}`} 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    wrapperStyle={{ paddingLeft: '20px' }}
                    formatter={(_, entry: any) => (
                      <span className="text-slate-600 text-sm font-medium ml-2">{entry.payload.sede}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top productos */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">Top Productos Vendidos (PoS)</h3>
            <div className="flex gap-4 text-xs font-medium">
               <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-blue-500"></span> Total Ventas</div>
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
                  formatter={(value: number, name: string) => {
                    const label = name === 'ventas' ? 'Ventas' : 'Margen';
                    return [`$${Number(value).toFixed(2)}`, label];
                  }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="ventas" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} name="ventas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabla de productos */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">Detalle de Productos</h3>
            <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
              Descargar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-6 py-3 font-semibold rounded-l-lg">Producto</th>
                  <th className="px-6 py-3 font-semibold text-right">Cantidad</th>
                  <th className="px-6 py-3 font-semibold text-right">Ventas Totales</th>
                  <th className="px-6 py-3 font-semibold text-right rounded-r-lg">Origen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProductos.map((prod, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-800 group-hover:text-blue-600 transition-colors">{prod.producto}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{prod.cantidad}</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">${prod.ventas.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right text-xs text-slate-500">Punto de Venta</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;