import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, DollarSign, Package, MapPin, Calendar, ArrowUpRight, RefreshCw, AlertCircle } from 'lucide-react';
import { Venta, Filtros, AgrupadoPorDia, AgrupadoPorSede, AgrupadoProducto, OdooSession } from '../types';
import OdooConfigModal from './OdooConfigModal';
import { OdooClient } from '../services/odoo';

// Datos de ejemplo simulando Odoo (Fallback)
const generarDatosVentas = (): Venta[] => {
  const sedes = ['Sede Central', 'Sede Norte', 'Sede Sur', 'Sede Este'];
  const productos = [
    { id: 1, nombre: 'Laptop HP 15', costo: 450, precio: 699 },
    { id: 2, nombre: 'Mouse Logitech', costo: 15, precio: 29 },
    { id: 3, nombre: 'Teclado Mecánico', costo: 45, precio: 89 },
    { id: 4, nombre: 'Monitor 24"', costo: 120, precio: 199 },
    { id: 5, nombre: 'Webcam HD', costo: 30, precio: 59 },
    { id: 6, nombre: 'Audífonos Bluetooth', costo: 25, precio: 49 },
    { id: 7, nombre: 'SSD 1TB', costo: 60, precio: 119 },
    { id: 8, nombre: 'RAM 16GB', costo: 40, precio: 79 }
  ];

  const ventas: Venta[] = [];
  const fechaInicio = new Date('2024-10-01');
  const fechaFin = new Date('2024-12-14');

  for (let d = new Date(fechaInicio); d <= fechaFin; d.setDate(d.getDate() + 1)) {
    const ventasPorDia = Math.floor(Math.random() * 15) + 5;
    
    for (let i = 0; i < ventasPorDia; i++) {
      const producto = productos[Math.floor(Math.random() * productos.length)];
      const sede = sedes[Math.floor(Math.random() * sedes.length)];
      const cantidad = Math.floor(Math.random() * 3) + 1;
      const total = producto.precio * cantidad;
      const costo = producto.costo * cantidad;
      const margen = total - costo;
      
      ventas.push({
        fecha: new Date(d),
        sede,
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
  
  const [filtros, setFiltros] = useState<Filtros>({
    sedeSeleccionada: 'Todas',
    periodoSeleccionado: 'mes', // Default to month for better data view
    fechaInicio: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    fechaFin: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
      if (!session) {
          setVentasData(generarDatosVentas());
          return;
      }

      setLoading(true);
      setError(null);
      try {
          const client = new OdooClient(session.url, session.db, session.useProxy);
          // Fetch Sale Order Lines to get product details and costs
          // Note: In real Odoo, 'purchase_price' needs 'sale_margin' module. 
          // If not available, we might fallback to standard price from product.
          // We will request 'purchase_price' assuming the user wants margin.
          
          const fields = [
              'create_date', 
              'order_partner_id', 
              'product_id', 
              'product_uom_qty', 
              'price_unit', 
              'price_subtotal', 
              'purchase_price', // Field from sale_margin module
              'state'
          ];
          
          const domain = [
              ['state', 'in', ['sale', 'done']],
              ['create_date', '>=', filtros.fechaInicio],
              ['create_date', '<=', `${filtros.fechaFin} 23:59:59`]
          ];

          const lines: any[] = await client.searchRead(
              session.uid, 
              session.apiKey, 
              'sale.order.line', 
              domain, 
              fields, 
              200 // Limit for demo performance
          );

          const mappedVentas: Venta[] = lines.map((line: any) => {
              const cantidad = line.product_uom_qty || 0;
              const total = line.price_subtotal || 0;
              // If purchase_price (cost) is available, use it. Otherwise assume 70% of price (demo fallback if module missing)
              const costoUnitario = line.purchase_price || (line.price_unit * 0.7); 
              const costo = costoUnitario * cantidad;
              const margen = total - costo;
              
              // Extract partner/sede (Using partner name as 'Sede' proxy for visualization if no warehouse field)
              // In a real sophisticated setup, we'd fetch warehouse_id from order_id
              const sede = line.order_partner_id ? line.order_partner_id[1] : 'General'; 

              return {
                  fecha: new Date(line.create_date),
                  sede: sede, // Using Client as Sede for this visualization
                  producto: line.product_id ? line.product_id[1] : 'Unknown',
                  cantidad,
                  total,
                  costo,
                  margen,
                  margenPorcentaje: total > 0 ? ((margen / total) * 100).toFixed(1) : '0.0'
              };
          });

          setVentasData(mappedVentas);
      } catch (err: any) {
          console.error(err);
          setError("Error recuperando datos de Odoo. Verifica permisos o módulos instalados (sale_margin).");
          setVentasData(generarDatosVentas()); // Fallback to mock so UI doesn't break
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchData();
  }, [session, filtros.periodoSeleccionado, filtros.fechaInicio, filtros.fechaFin]); // Refetch when filters change if connected

  const sedes = useMemo(() => ['Todas', ...Array.from(new Set(ventasData.map(v => v.sede)))], [ventasData]);

  // Filtrar datos según selección local (Client side filtering for speed after fetch)
  const datosFiltrados = useMemo(() => {
    let datos = ventasData;
    
    if (filtros.sedeSeleccionada !== 'Todas') {
      datos = datos.filter(v => v.sede === filtros.sedeSeleccionada);
    }
    
    // Date filter is handled in fetch for Odoo, but double check locally
    const inicio = new Date(filtros.fechaInicio);
    inicio.setHours(0,0,0,0);
    const fin = new Date(filtros.fechaFin);
    fin.setHours(23,59,59,999);
    
    datos = datos.filter(v => {
      const fechaVenta = new Date(v.fecha);
      return fechaVenta >= inicio && fechaVenta <= fin;
    });
    
    return datos;
  }, [ventasData, filtros.sedeSeleccionada, filtros.fechaInicio, filtros.fechaFin]);

  // KPIs principales
  const kpis = useMemo(() => {
    const totalVentas = datosFiltrados.reduce((sum, v) => sum + v.total, 0);
    const totalCostos = datosFiltrados.reduce((sum, v) => sum + v.costo, 0);
    const totalMargen = totalVentas - totalCostos;
    const margenPromedio = totalVentas > 0 ? ((totalMargen / totalVentas) * 100) : 0;
    const unidadesVendidas = datosFiltrados.reduce((sum, v) => sum + v.cantidad, 0);
    
    return {
      totalVentas: totalVentas.toFixed(2),
      totalMargen: totalMargen.toFixed(2),
      margenPromedio: margenPromedio.toFixed(1),
      unidadesVendidas
    };
  }, [datosFiltrados]);

  // Ventas por día
  const ventasPorDia = useMemo(() => {
    const agrupado: Record<string, AgrupadoPorDia> = {};
    datosFiltrados.forEach(v => {
      const fecha = v.fecha.toISOString().split('T')[0];
      if (!agrupado[fecha]) {
        agrupado[fecha] = { fecha, ventas: 0, margen: 0 };
      }
      agrupado[fecha].ventas += v.total;
      agrupado[fecha].margen += v.margen;
    });
    
    return Object.values(agrupado).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [datosFiltrados]);

  // Ventas por sede
  const ventasPorSede = useMemo(() => {
    const agrupado: Record<string, AgrupadoPorSede> = {};
    datosFiltrados.forEach(v => {
      if (!agrupado[v.sede]) {
        agrupado[v.sede] = { sede: v.sede, ventas: 0, margen: 0 };
      }
      agrupado[v.sede].ventas += v.total;
      agrupado[v.sede].margen += v.margen;
    });
    
    return Object.values(agrupado).sort((a, b) => b.ventas - a.ventas).slice(0, 6); // Limit pie chart segments
  }, [datosFiltrados]);

  // Top productos
  const topProductos = useMemo(() => {
    const agrupado: Record<string, AgrupadoProducto> = {};
    datosFiltrados.forEach(v => {
      if (!agrupado[v.producto]) {
        agrupado[v.producto] = { 
          producto: v.producto, 
          cantidad: 0, 
          ventas: 0,
          margen: 0
        };
      }
      agrupado[v.producto].cantidad += v.cantidad;
      agrupado[v.producto].ventas += v.total;
      agrupado[v.producto].margen += v.margen;
    });
    
    return Object.values(agrupado)
      .sort((a, b) => b.ventas - a.ventas)
      .slice(0, 8);
  }, [datosFiltrados]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  const aplicarPeriodo = (periodo: string) => {
    const hoy = new Date();
    let inicio = new Date(hoy);
    
    switch(periodo) {
      case 'hoy':
        inicio = new Date(hoy);
        break;
      case 'semana':
        inicio.setDate(hoy.getDate() - 7);
        break;
      case 'mes':
        inicio.setMonth(hoy.getMonth() - 1);
        break;
      case 'trimestre':
        inicio.setMonth(hoy.getMonth() - 3);
        break;
    }
    
    setFiltros({
      ...filtros,
      periodoSeleccionado: periodo,
      fechaInicio: inicio.toISOString().split('T')[0],
      fechaFin: hoy.toISOString().split('T')[0]
    });
    // Triggers useEffect fetch
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 font-sans w-full relative">
      <OdooConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
      
      {/* Loading Overlay */}
      {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3 border border-slate-100">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                  <span className="font-medium text-slate-700">Sincronizando con Odoo...</span>
              </div>
          </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-2">
           <div>
              <h1 className="text-2xl font-bold text-slate-800">Visión General</h1>
              <p className="text-slate-500 text-sm">
                  {session ? `Conectado a: ${session.db}` : 'Modo Simulación (Demo)'}
              </p>
           </div>
           
           <div className="mt-4 md:mt-0 flex gap-3">
              <button 
                onClick={fetchData}
                className="flex items-center gap-2 bg-white text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 font-medium text-sm hover:bg-slate-50 transition-colors shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
              
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium text-sm ${session ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${session ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${session ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </span>
                {session ? 'Odoo: Online' : 'Modo Demo'}
              </div>
           </div>
        </div>
        
        {error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex gap-3 items-center">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm">{error}</p>
            </div>
        )}

        {/* Filters Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-full md:w-auto">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                <MapPin className="inline w-3 h-3 mr-1" />
                Cliente / Sede
              </label>
              <select 
                value={filtros.sedeSeleccionada}
                onChange={(e) => setFiltros({...filtros, sedeSeleccionada: e.target.value})}
                className="w-full md:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                {sedes.map(sede => (
                  <option key={sede} value={sede}>{sede}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[300px]">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                <Calendar className="inline w-3 h-3 mr-1" />
                Rango de Tiempo
              </label>
              <div className="flex bg-slate-50 p-1 rounded-lg w-full md:w-fit border border-slate-200">
                {['hoy', 'semana', 'mes', 'trimestre'].map(periodo => (
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

        {/* KPIs - REORDERED: Margin First */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* KPI 1: Profit Margin (Primary Focus) */}
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl shadow-lg shadow-emerald-900/10 p-6 flex flex-col justify-between transform transition-transform hover:scale-[1.01]">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-white/20 text-white rounded-full">
                <ArrowUpRight className="w-3 h-3" /> {kpis.margenPromedio}% avg
              </span>
            </div>
            <div>
              <p className="text-emerald-50 text-sm font-medium tracking-wide opacity-90">Ganancia Neta (Margen)</p>
              <h3 className="text-3xl font-bold text-white mt-1 tracking-tight">${kpis.totalMargen}</h3>
            </div>
            <div className="mt-4 h-1 w-full bg-black/10 rounded-full overflow-hidden">
               <div className="h-full bg-white/40" style={{width: `${Math.min(parseFloat(kpis.margenPromedio), 100)}%`}}></div>
            </div>
            <p className="text-xs text-emerald-100 mt-2 font-medium">Rentabilidad sobre ventas</p>
          </div>

          {/* KPI 2: Total Sales */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:border-blue-300 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-50 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Ventas Totales</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">${kpis.totalVentas}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-auto pt-4">Facturación bruta</p>
          </div>

          {/* KPI 3: Units */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:border-purple-300 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Unidades Vendidas</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{kpis.unidadesVendidas}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-auto pt-4">Volumen de movimiento</p>
          </div>

          {/* KPI 4: Sedes */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:border-orange-300 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-50 rounded-lg">
                <MapPin className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Clientes/Sedes</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{ventasPorSede.length}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-auto pt-4">Cartera activa</p>
          </div>
        </div>

        {/* Gráficos principales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ventas por día */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800">Análisis de Rentabilidad</h3>
              <div className="flex items-center gap-4 text-xs font-medium">
                 <div className="flex items-center gap-1">
                   <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Ganancia
                 </div>
                 <div className="flex items-center gap-1">
                   <div className="w-2 h-2 rounded-full bg-blue-500"></div> Ingresos
                 </div>
              </div>
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
                    formatter={(value: number, name: string) => {
                       const label = name === 'margen' ? 'Ganancia Neta' : 'Ingresos';
                       return [`$${Number(value).toFixed(2)}`, label];
                    }}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ventas" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    dot={false}
                    name="ventas"
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    strokeOpacity={0.5}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="margen" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={false}
                    name="margen"
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ventas por sede */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800">Participación por Cliente/Sede</h3>
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
            <h3 className="text-lg font-bold text-slate-800">Top Productos: Margen vs Ventas</h3>
            <div className="flex gap-4 text-xs font-medium">
               <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-blue-500"></span> Total Ventas</div>
               <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-emerald-500"></span> Ganancia Real</div>
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
                    const label = name === 'ventas' ? 'Ventas' : 'Margen Neto';
                    return [`$${Number(value).toFixed(2)}`, label];
                  }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="ventas" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} name="ventas" />
                <Bar dataKey="margen" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} name="margen" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabla de productos */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">Detalle de Rendimiento por Producto</h3>
            <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
              Descargar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-6 py-3 font-semibold rounded-l-lg">Producto</th>
                  <th className="px-6 py-3 font-semibold text-right">Unidades</th>
                  <th className="px-6 py-3 font-semibold text-right">Ventas Totales</th>
                  <th className="px-6 py-3 font-semibold text-right text-emerald-700">Margen Neto</th>
                  <th className="px-6 py-3 font-semibold text-right rounded-r-lg">% Rentabilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProductos.map((prod, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-800 group-hover:text-blue-600 transition-colors">{prod.producto}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{prod.cantidad}</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">${prod.ventas.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">${prod.margen.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        (prod.margen / prod.ventas) > 0.3 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {((prod.margen / prod.ventas) * 100).toFixed(1)}%
                      </span>
                    </td>
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