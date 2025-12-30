
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

// Parser for XML-RPC responses
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

// Proxies reordenados por fiabilidad en peticiones POST con cuerpo
const PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

export class OdooClient {
  private url: string;
  private db: string;
  private useProxy: boolean;
  private currentProxyIndex: number = 0;
  
  constructor(url: string, db: string, useProxy: boolean = false) {
    this.url = url.replace(/\/+$/, ''); 
    this.db = db;
    this.useProxy = useProxy;
  }

  private async rpcCall(endpoint: string, method: string, params: any[]): Promise<any> {
    // Re-incluimos la cabecera XML mínima para motores antiguos de Odoo
    const xmlString = `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${params.map(p => `<param>${serialize(p)}</param>`).join('')}</params></methodCall>`;
    
    // Convertimos a Blob para forzar al navegador y al proxy a tratarlo como flujo de datos real
    const xmlBlob = new Blob([xmlString], { type: 'text/xml' });
    
    const targetUrl = `${this.url}/xmlrpc/2/${endpoint}`;
    
    const executeRequest = async (proxyFn: (u: string) => string) => {
        const fetchUrl = this.useProxy ? proxyFn(targetUrl) : targetUrl;
        
        const response = await fetch(fetchUrl, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Accept': 'text/xml, application/xml',
                // No establecemos Content-Type manualmente al enviar Blob, el navegador lo hace mejor
            },
            body: xmlBlob,
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error(`HTTP_${response.status}`);
        }

        const text = await response.text();
        if (!text || text.trim().length === 0) {
            throw new Error("EMPTY_RESPONSE");
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/xml');
        
        const parseError = doc.querySelector('parsererror');
        if (parseError) throw new Error("INVALID_XML_RESPONSE");

        const fault = doc.querySelector('fault');
        if (fault) {
            const faultValue = fault.querySelector('value');
            const faultStruct = faultValue ? parseValue(faultValue) : { faultString: 'Odoo Remote Error' };
            throw new Error(`Odoo: ${faultStruct.faultString}`);
        }

        const paramNode = doc.querySelector('params param value');
        if (!paramNode) throw new Error('NO_VALUE_IN_RESPONSE');
        
        return parseValue(paramNode);
    };

    let lastError: any;
    const retryAttempts = this.useProxy ? PROXIES.length : 1;

    for (let i = 0; i < retryAttempts; i++) {
        try {
            // Pausa incremental entre reintentos
            if (i > 0) await new Promise(r => setTimeout(r, 1000 * i));
            
            return await executeRequest(PROXIES[this.currentProxyIndex]);
        } catch (error: any) {
            lastError = error;
            
            // Si el error viene de Odoo (lógica interna), no rotamos proxy
            if (error.message.startsWith('Odoo:')) throw error;

            console.warn(`Intento ${i + 1} fallido (${error.message}). Rotando proxy...`);
            this.currentProxyIndex = (this.currentProxyIndex + 1) % PROXIES.length;
        }
    }

    // Traducción de errores para el usuario final
    if (lastError.message.includes('HTTP_403')) {
        throw new Error("Bloqueo 403: El servidor Odoo ha rechazado la conexión del proxy. Intenta de nuevo en unos segundos o usa un rango de fechas más corto.");
    }
    if (lastError.message.includes('Failed to fetch')) {
        throw new Error("Error de Red: No se pudo establecer conexión con el proxy. Verifica tu internet o intenta refrescar la página.");
    }
    
    throw lastError;
  }

  async authenticate(username: string, apiKey: string): Promise<number> {
    const uid = await this.rpcCall('common', 'authenticate', [this.db, username, apiKey, {}]);
    if (typeof uid !== 'number') throw new Error("Credenciales inválidas. Revise su Usuario y API Key.");
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
