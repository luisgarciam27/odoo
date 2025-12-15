
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
  sesion: string; // Nuevo campo para la Sesión del POS (Ej: POS/2024/01/55)
  producto: string;
  categoria: string;
  vendedor: string;
  metodoPago: string;
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
  variacionVentas: number;
  totalMargen: string;
  variacionMargen: number;
  margenPromedio: string;
  unidadesVendidas: number;
  variacionUnidades: number;
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

// Nueva interfaz para la configuración de clientes
export interface ClientConfig {
  code: string; // El código de acceso (ej: REQUESALUD)
  url: string;
  db: string;
  username: string;
  apiKey: string;
  companyFilter: string;
}