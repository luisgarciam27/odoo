

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

// Fix: Added missing AgrupadoPorDia interface to fix import error in Dashboard.tsx
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
  isActive: boolean; // Control de envío n8n
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