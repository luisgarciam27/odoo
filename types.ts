
export interface Producto {
  id: number;
  nombre: string;
  costo: number;
  precio: number;
  categoria?: string;
  stock?: number;
  imagen?: string; 
  // Campos Médicos
  registro_sanitario?: string;
  laboratorio?: string;
  principio_activo?: string;
  presentacion?: string;
}

export interface SedeStore {
  id: string;
  nombre: string;
  direccion: string;
}

export interface ClientConfig {
  code: string;
  url: string;
  db: string;
  username: string;
  apiKey: string;
  companyFilter: string;
  whatsappNumbers?: string;
  isActive: boolean;
  nombreComercial?: string;
  logoUrl?: string;
  colorPrimario?: string;
  showStore?: boolean;
  storeCategories?: string;
  tiendaCategoriaNombre?: string;
  hiddenProducts?: number[];
  yapeNumber?: string;
  yapeName?: string;
  yapeQR?: string; 
  plinNumber?: string;
  plinName?: string;
  plinQR?: string;
  // Nuevos campos logística y salud
  sedes_recojo?: SedeStore[];
  campos_medicos_visibles?: string[]; // ["registro", "laboratorio", "principio"]
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

export interface CartItem {
  producto: Producto;
  cantidad: number;
}

/**
 * Definition of sale record (Venta)
 */
export interface Venta {
  fecha: Date;
  sede: string;
  compania: string;
  vendedor: string;
  sesion: string;
  producto: string;
  categoria: string;
  metodoPago: string;
  cantidad: number;
  total: number;
  costo: number;
  margen: number;
  margenPorcentaje: string;
}

/**
 * Dashboard filter interface (Filtros)
 */
export interface Filtros {
  sedeSeleccionada: string;
  companiaSeleccionada: string;
  periodoSeleccionado: string;
  fechaInicio: string;
  fechaFin: string;
}

/**
 * Grouped sales data per day for charts (AgrupadoPorDia)
 */
export interface AgrupadoPorDia {
  fecha: string;
  ventas: number;
  margen: number;
}
