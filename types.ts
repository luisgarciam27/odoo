
export interface Producto {
  id: number;
  nombre: string;
  costo: number;
  precio: number;
  categoria?: string;
  stock?: number;
  imagen?: string; 
  // Campos Médicos/Veterinarios
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
  // Configuración Salud y Logística
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

export interface Filtros {
  sedeSeleccionada: string;
  companiaSeleccionada: string;
  periodoSeleccionado: string;
  fechaInicio: string;
  fechaFin: string;
}

export interface AgrupadoPorDia {
  fecha: string;
  ventas: number;
  margen: number;
}
