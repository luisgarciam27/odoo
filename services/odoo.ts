
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

// Proxies con diferentes estrategias de reenvío
const PROXIES = [
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, // Modo indirecto
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

export class OdooClient {
  private url: string;
  private db: string;
  private useProxy: boolean;
  private static currentProxyIndex: number = 0;
  
  constructor(url: string, db: string, useProxy: boolean = false) {
    this.url = url.replace(/\/+$/, ''); 
    this.db = db;
    this.useProxy = useProxy;
  }

  private async rpcCall(endpoint: string, method: string, params: any[]): Promise<any> {
    const xmlString = `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${params.map(p => `<param>${serialize(p)}</param>`).join('')}</params></methodCall>`;
    const targetUrl = `${this.url}/xmlrpc/2/${endpoint}`;
    
    // Convertimos a bytes para evitar que el proxy modifique el texto
    const bodyData = new TextEncoder().encode(xmlString);

    const executeRequest = async (proxyIdx: number) => {
        const fetchUrl = this.useProxy ? PROXIES[proxyIdx](targetUrl) : targetUrl;
        
        // Si usamos AllOrigins indirecto, la estructura de la respuesta cambia
        const isAllOrigins = fetchUrl.includes('allorigins.win/get');

        const response = await fetch(fetchUrl, {
            method: isAllOrigins ? 'GET' : 'POST', // AllOrigins POST se hace vía GET con parámetros en su API, pero para Odoo necesitamos POST real
            headers: isAllOrigins ? {} : {
                'Content-Type': 'text/xml',
                'Accept': 'text/xml',
            },
            body: isAllOrigins ? null : bodyData
        });

        if (!response.ok) throw new Error(`HTTP_${response.status}`);

        let text = '';
        if (isAllOrigins) {
            const json = await response.json();
            text = json.contents;
        } else {
            text = await response.text();
        }

        if (!text || text.trim().length === 0) throw new Error("EMPTY_RESPONSE");

        const doc = new DOMParser().parseFromString(text, 'text/xml');
        
        // Verificar si la respuesta es realmente XML o un error del proxy
        if (doc.getElementsByTagName('parsererror').length > 0) {
            throw new Error("INVALID_XML_RESPONSE");
        }

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
    const maxAttempts = this.useProxy ? PROXIES.length : 1;
    
    for (let i = 0; i < maxAttempts; i++) {
        const attemptIdx = (OdooClient.currentProxyIndex + i) % PROXIES.length;
        
        // Saltamos AllOrigins para rpcCall directos porque prefiere GET
        if (attemptIdx === 0 && this.useProxy) {
            OdooClient.currentProxyIndex = (attemptIdx + 1) % PROXIES.length;
            continue; 
        }

        try {
            const result = await executeRequest(attemptIdx);
            OdooClient.currentProxyIndex = attemptIdx;
            return result;
        } catch (error: any) {
            lastError = error;
            console.warn(`Proxy ${attemptIdx} falló: ${error.message}`);
            if (error.message.startsWith('Odoo:')) throw error;
        }
    }
    
    throw new Error(`Error de conexión: ${lastError.message}. Intenta recargar o verifica que la URL de Odoo sea HTTPS.`);
  }

  async authenticate(username: string, apiKey: string): Promise<number> {
    const uid = await this.rpcCall('common', 'authenticate', [this.db, username, apiKey, {}]);
    if (typeof uid !== 'number') throw new Error("Credenciales inválidas.");
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
