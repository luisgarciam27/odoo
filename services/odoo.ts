
// Utility to escape XML special characters
const xmlEscape = (str: string) => 
  str.replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;')
     .replace(/'/g, '&apos;');

// Serializer for XML-RPC parameters
const serialize = (value: any): string => {
  if (value === null || value === undefined) return '<value><nil/></value>';
  let content = '';
  if (typeof value === 'number') {
    content = Number.isInteger(value) ? `<int>${value}</int>` : `<double>${value}</double>`;
  } else if (typeof value === 'string') {
    content = `<string>${xmlEscape(value)}</string>`;
  } else if (typeof value === 'boolean') {
    content = `<boolean>${value ? '1' : '0'}</boolean>`;
  } else if (Array.isArray(value)) {
    content = `<array><data>${value.map(v => serialize(v)).join('')}</data></array>`;
  } else if (typeof value === 'object') {
    if (value instanceof Date) {
      content = `<dateTime.iso8601>${value.toISOString().replace(/\.\d+Z$/, 'Z')}</dateTime.iso8601>`;
    } else {
      content = `<struct>${Object.entries(value).map(([k, v]) => 
        `<member><name>${xmlEscape(k)}</name>${serialize(v)}</member>`
      ).join('')}</struct>`;
    }
  } else {
    content = `<string>${xmlEscape(String(value))}</string>`;
  }
  return `<value>${content}</value>`;
};

const parseValue = (node: Element): any => {
  const child = node.firstElementChild;
  if (!child) return node.textContent?.trim(); 

  const tag = child.tagName.toLowerCase();
  switch (tag) {
    case 'string': return child.textContent;
    case 'int': 
    case 'i4': return parseInt(child.textContent || '0', 10);
    case 'double': return parseFloat(child.textContent || '0');
    case 'boolean': return child.textContent === '1' || child.textContent === 'true';
    case 'datetime.iso8601': return new Date(child.textContent || '');
    case 'array': 
      const dataNode = child.querySelector('data');
      if (!dataNode) return [];
      return Array.from(dataNode.children).map(parseValue);
    case 'struct':
      const obj: any = {};
      Array.from(child.children).forEach(member => {
        const nameNode = member.querySelector('name');
        const valNode = member.querySelector('value');
        if (nameNode && valNode) {
          obj[nameNode.textContent || ''] = parseValue(valNode);
        }
      });
      return obj;
    case 'nil': return null;
    default: return child.textContent;
  }
};

// Lista de proxies para rotación y redundancia
const PROXY_LIST = [
  { name: 'Directo', fn: (url: string) => url },
  { name: 'CORS-Proxy-IO', fn: (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}` },
  { name: 'AllOrigins', fn: (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` },
  { name: 'Codetabs', fn: (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` },
  { name: 'Cloudflare-Worker', fn: (url: string) => `https://cors-proxy.lemon-bi.workers.dev/?url=${encodeURIComponent(url)}` }
];

export class OdooClient {
  private url: string;
  private db: string;
  private useProxy: boolean;
  private static currentProxyIndex: number = 0;
  
  constructor(url: string, db: string, useProxy: boolean = true) {
    this.url = url.trim().replace(/\/+$/, ''); 
    this.db = db;
    this.useProxy = useProxy;
  }

  private async rpcCall(endpoint: string, method: string, params: any[]): Promise<any> {
    if (this.url.startsWith('http://') && window.location.protocol === 'https:') {
        throw new Error("BLOQUEO_SEGURIDAD: No se puede conectar a un servidor HTTP desde una app HTTPS. Usa https://.");
    }

    const xmlString = `<?xml version="1.0" encoding="UTF-8"?><methodCall><methodName>${method}</methodName><params>${params.map(p => `<param>${serialize(p)}</param>`).join('')}</params></methodCall>`;
    const targetUrl = `${this.url}/xmlrpc/2/${endpoint}`;

    const executeRequest = async (proxyIdx: number) => {
        const proxy = PROXY_LIST[proxyIdx];
        const isDirect = proxy.name === 'Directo' && !this.useProxy;
        const fetchUrl = (this.useProxy || !isDirect) ? proxy.fn(targetUrl) : targetUrl;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            const response = await fetch(fetchUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml',
                },
                body: xmlString,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 403 || response.status === 401) throw new Error("BLOQUEO_SERVIDOR_ODOO");
                throw new Error(`HTTP_${response.status}`);
            }

            const text = await response.text();
            if (!text || text.trim().length === 0) throw new Error(`RESPUESTA_VACIA`);

            // Evitar procesar HTML de error de los proxies
            if (text.trim().startsWith('<!DOCTYPE html') || text.trim().startsWith('<html')) {
                throw new Error("RESPUESTA_INVALIDA_PROXY");
            }

            const doc = new DOMParser().parseFromString(text, 'text/xml');
            if (doc.getElementsByTagName('parsererror').length > 0) throw new Error(`XML_INVÁLIDO_SERVIDOR`);

            const fault = doc.querySelector('fault');
            if (fault) {
                const faultStruct = parseValue(fault.querySelector('value')!);
                throw new Error(`Odoo: ${faultStruct.faultString}`);
            }

            const paramNode = doc.querySelector('params param value');
            if (!paramNode) throw new Error('XML_SIN_RESULTADO');
            
            return parseValue(paramNode);
        } catch (e: any) {
            if (e.name === 'AbortError') throw new Error(`TIMEOUT`);
            if (e.message.includes('Failed to fetch')) throw new Error(`ERROR_RED_BLOQUEADA`);
            throw e;
        }
    };

    let lastError: any;
    const maxAttempts = PROXY_LIST.length;
    
    for (let i = 0; i < maxAttempts; i++) {
        const attemptIdx = (OdooClient.currentProxyIndex + i) % PROXY_LIST.length;
        const proxy = PROXY_LIST[attemptIdx];
        
        try {
            const result = await executeRequest(attemptIdx);
            OdooClient.currentProxyIndex = attemptIdx; 
            return result;
        } catch (error: any) {
            lastError = error;
            console.warn(`[Odoo] Intento fallido con ${proxy.name}:`, error.message);
            // Si el error es una falla de credenciales de Odoo, detenemos la rotación
            if (error.message.startsWith('Odoo:')) throw error;
        }
    }
    
    throw new Error(`Fallo de conexión: ${lastError.message}. Intenta instalando la extensión 'CORS Unblock' en tu navegador para saltar el proxy.`);
  }

  async authenticate(username: string, apiKey: string): Promise<number> {
    const uid = await this.rpcCall('common', 'authenticate', [this.db, username, apiKey, {}]);
    if (typeof uid !== 'number' || uid === 0) throw new Error("Odoo: Credenciales inválidas.");
    return uid;
  }

  async searchRead(uid: number, apiKey: string, model: string, domain: any[], fields: string[], options: any = {}) {
    return await this.rpcCall('object', 'execute_kw', [
        this.db, uid, apiKey, model, 'search_read', [domain], { fields, ...options }
    ]);
  }

  async createSaleOrder(uid: number, apiKey: string, partnerData: any, lines: any[], companyId: number) {
    const orderLines = lines.map(line => [0, 0, {
      product_id: line.productId,
      product_uom_qty: line.qty,
      price_unit: line.price
    }]);

    return await this.rpcCall('object', 'execute_kw', [
        this.db, uid, apiKey, 'sale.order', 'create', 
        [{
          partner_id: 1, 
          company_id: companyId,
          order_line: orderLines
        }]
    ]);
  }
}
