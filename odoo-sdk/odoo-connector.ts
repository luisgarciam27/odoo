
/**
 * MOTOR DE CONEXIÓN ODOO XML-RPC (Standalone Corregido v2)
 */

const xmlEscape = (str: string) => 
  str.replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;')
     .replace(/'/g, '&apos;');

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
  }
  return `<value>${content}</value>`;
};

const parseValue = (node: Element): any => {
  const child = node.firstElementChild;
  if (!child) return node.textContent?.trim(); 
  const tag = child.tagName.toLowerCase();
  switch (tag) {
    case 'string': return child.textContent;
    case 'int': case 'i4': return parseInt(child.textContent || '0', 10);
    case 'double': return parseFloat(child.textContent || '0');
    case 'boolean': return child.textContent === '1' || child.textContent === 'true';
    case 'datetime.iso8601': return new Date(child.textContent || '');
    case 'array': 
      const dataNode = child.querySelector('data');
      return dataNode ? Array.from(dataNode.children).map(parseValue) : [];
    case 'struct':
      const obj: any = {};
      Array.from(child.children).forEach(member => {
        const nameNode = member.querySelector('name');
        const valNode = member.querySelector('value');
        if (nameNode && valNode) obj[nameNode.textContent || ''] = parseValue(valNode);
      });
      return obj;
    case 'nil': return null;
    default: return child.textContent;
  }
};

const PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
];

export class OdooClient {
  private url: string;
  private db: string;
  private useProxy: boolean;
  
  constructor(url: string, db: string, useProxy: boolean = true) {
    this.url = url.replace(/\/+$/, ''); 
    this.db = db;
    this.useProxy = useProxy;
  }

  private async rpcCall(endpoint: string, method: string, params: any[]): Promise<any> {
    const xmlString = `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${params.map(p => `<param>${serialize(p)}</param>`).join('')}</params></methodCall>`;
    const targetUrl = `${this.url}/xmlrpc/2/${endpoint}`;
    
    // Usar bytes puros para asegurar que el proxy no corrompa el cuerpo del POST
    const bodyData = new TextEncoder().encode(xmlString);
    const fetchUrl = this.useProxy ? PROXIES[0](targetUrl) : targetUrl;
    
    const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: { 
            'Content-Type': 'text/xml',
            'Accept': 'text/xml' 
        },
        body: bodyData
    });

    const text = await response.text();
    if (!text) throw new Error("Servidor devolvió respuesta vacía (posible error de Proxy)");

    const doc = new DOMParser().parseFromString(text, 'text/xml');
    
    const fault = doc.querySelector('fault');
    if (fault) {
        const faultStruct = parseValue(fault.querySelector('value')!);
        throw new Error(`Odoo Error: ${faultStruct.faultString}`);
    }

    const paramNode = doc.querySelector('params param value');
    return paramNode ? parseValue(paramNode) : null;
  }

  async authenticate(username: string, apiKey: string): Promise<number> {
    return await this.rpcCall('common', 'authenticate', [this.db, username, apiKey, {}]);
  }

  async searchRead(uid: number, apiKey: string, model: string, domain: any[], fields: string[], options: any = {}) {
    return await this.rpcCall('object', 'execute_kw', [
        this.db, uid, apiKey, model, 'search_read', [domain], { fields, ...options }
    ]);
  }
}
