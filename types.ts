
export interface Producto {
  id: number;
  nombre: string;
  costo: number;
  precio: number;
  categoria?: string;
  stock?: number;
  imagen?: string; // base64 de Odoo
}

export interface Venta {
  fecha: Date;
  sede: string;
  compania: string;
  sesion: string;
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

export interface AgrupadoPorDia {
  fecha: string;
  ventas: number;
  margen: number;
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
  // Campos para la tienda
  showStore?: boolean;
  storeCategories?: string; // IDs manuales (opcional)
  tiendaCategoriaNombre?: string; // Ej: "Catalogo Web"
  yapeNumber?: string;
  yapeName?: string;
  yapeQR?: string; 
  plinNumber?: string;
  plinName?: string;
  plinQR?: string;
  bankAccount?: string;
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
