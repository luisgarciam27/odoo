
export interface Producto {
  id: number;
  nombre: string;
  costo: number;
  precio: number;
}

export interface Venta {
  fecha: Date;
  sede: string;
  compania: string;
  producto: string;
  categoria: string; // Nuevo: Para análisis por familia
  vendedor: string;  // Nuevo: Para análisis de desempeño
  cantidad: number;
  total: number;
  costo: number;
  margen: number;
  margenPorcentaje: string;
}

export interface Filtros {
  sedeSeleccionada: string;
  companiaSeleccionada: string;
  periodoSeleccionado: string;
  fechaInicio: string;
  fechaFin: string;
}

export interface KPI {
  totalVentas: string;
  variacionVentas: number; // Nuevo: % vs periodo anterior
  totalMargen: string;
  variacionMargen: number; // Nuevo: % vs periodo anterior
  margenPromedio: string;
  unidadesVendidas: number;
  variacionUnidades: number; // Nuevo: % vs periodo anterior
  ticketPromedio: string;
}

export interface AgrupadoPorDia {
  fecha: string;
  ventas: number;
  margen: number;
  [key: string]: any;
}

export interface AgrupadoPorSede {
  sede: string;
  ventas: number;
  margen: number;
  [key: string]: any;
}

export interface AgrupadoProducto {
  producto: string;
  cantidad: number;
  ventas: number;
  margen: number;
  [key: string]: any;
}

export interface OdooSession {
  url: string;
  db: string;
  username: string;
  apiKey: string;
  uid: number;
  useProxy: boolean;
  companyId?: number;
  companyName?: string;
}