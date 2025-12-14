
export interface Producto {
  id: number;
  nombre: string;
  costo: number;
  precio: number;
}

export interface Venta {
  fecha: Date;
  sede: string;
  producto: string;
  cantidad: number;
  total: number;
  costo: number;
  margen: number;
  margenPorcentaje: string;
}

export interface Filtros {
  sedeSeleccionada: string;
  periodoSeleccionado: string;
  fechaInicio: string;
  fechaFin: string;
}

export interface KPI {
  totalVentas: string;
  totalMargen: string;
  margenPromedio: string;
  unidadesVendidas: number;
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
}
