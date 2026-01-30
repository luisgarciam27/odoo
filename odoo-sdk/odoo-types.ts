/**
 * Tipos de datos base para replicar la conexión en cualquier proyecto.
 */

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

export interface OdooConnectionConfig {
  url: string;
  db: string;
  username: string;
  apiKey: string;
}
