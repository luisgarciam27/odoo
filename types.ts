
export interface Producto {
  id: number;
  nombre: string;
  costo: number;
  precio: number;
  categoria?: string;
  stock?: number;
  imagen?: string; 
  descripcion_venta?: string; 
  descripcion_raw?: string;   
  registro_sanitario?: string;
  laboratorio?: string;
  marca?: string;
  principio_activo?: string;
  principio_activo_id?: number;
  presentacion?: string;
  uso_sugerido?: string;
  especie?: string; 
  peso_rango?: string;
  duracion_sesion?: string; 
  categoria_personalizada?: string; 
  uom_id?: number;
}

export interface PedidoTienda {
  id: string;
  order_name: string;
  cliente_nombre: string;
  monto: number;
  voucher_url: string;
  estado: 'pendiente' | 'validado' | 'rechazado';
  empresa_code: string;
  created_at: string;
}

export interface ProductoExtra {
  odoo_id: number;
  empresa_code: string;
  descripcion_lemon?: string;
  instrucciones_lemon?: string;
  categoria_personalizada?: string; 
  ficha_tecnica_json?: any;
}

export type BusinessType = 'pharmacy' | 'veterinary' | 'podiatry' | 'general';

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
  whatsappHelpNumber?: string; 
  isActive: boolean;
  nombreComercial?: string;
  logoUrl?: string;
  footerLogoUrl?: string;
  colorPrimario?: string;
  colorSecundario?: string;
  colorAcento?: string;
  showStore?: boolean;
  storeCategories?: string;
  tiendaCategoriaNombre?: string;
  hiddenProducts?: number[];
  hiddenCategories?: string[];
  customCategories?: string[];
  yapeNumber?: string;
  yapeName?: string;
  yapeQR?: string; 
  plinNumber?: string;
  plinName?: string;
  plinQR?: string;
  sedes_recojo?: SedeStore[];
  campos_medicos_visibles?: string[];
  footer_description?: string;
  facebook_url?: string;
  instagram_url?: string;
  tiktok_url?: string;
  slide_images?: string[]; 
  quality_text?: string;
  support_text?: string;
  businessType?: BusinessType;
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
