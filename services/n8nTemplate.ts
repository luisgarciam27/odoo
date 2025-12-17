
// CONFIGURACIÓN COMÚN
const SUPABASE_URL = "https://ogopzhmsjnotuntfimpx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb3B6aG1zam5vdHVudGZpbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjcwNjksImV4cCI6MjA4MTUwMzA2OX0.z9rcjc9ToplMYhLKQQl0iuKYc87hm1JAN2O1yfv3lmE";

// --- FLUJO 1: REPORTE DIARIO DE CAJA ---
export const DAILY_WORKFLOW_JSON = {
  "name": "LemonBI - Reporte Diario (Cierres & Pagos)",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [{ "field": "cronExpression", "expression": "0 6 * * *" }]
        }
      },
      "name": "Schedule - 6:00 AM",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.1,
      "position": [-380, -60]
    },
    {
      "parameters": {
        "url": `${SUPABASE_URL}/rest/v1/empresas?select=*&estado=eq.true`,
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "apikey", "value": SUPABASE_KEY },
            { "name": "Authorization", "value": `Bearer ${SUPABASE_KEY}` }
          ]
        }
      },
      "name": "GET Empresas Activas",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [-180, -60]
    },
    {
      "parameters": {},
      "name": "Split In Batches",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [20, -60]
    },
    {
      "parameters": {
        "jsCode": `
const data = $input.first().json;
const empresaName = data.codigo_acceso;
const url = data.odoo_url;
const db = data.odoo_db;
const apiKey = data.odoo_api_key;
const targetPhone = data.whatsapp_numeros;
const companyFilter = data.filtro_compania;

// FECHA: AYER
const date = new Date();
date.setDate(date.getDate() - 1);
const options = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' };
const formatter = new Intl.DateTimeFormat('en-CA', options);
const yesterdayStr = formatter.format(date);

// Construir Filtro de Compañía si existe
let companyFilterXml = '';
if (companyFilter && companyFilter !== 'ALL') {
    companyFilterXml = \`<value><array><data>
        <value><string>company_id.name</string></value>
        <value><string>ilike</string></value>
        <value><string>\${companyFilter}</string></value>
    </data></array></value>\`;
}

// XML-RPC para buscar sesiones cerradas ayer
const xml = \`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>\${db}</string></value></param>
    <param><value><int>2</int></value></param>
    <param><value><string>\${apiKey}</string></value></param>
    <param><value><string>pos.session</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param>
      <value><array><data>
        <value><array><data>
            <value><string>stop_at</string></value>
            <value><string>&gt;=</string></value>
            <value><string>\${yesterdayStr} 00:00:00</string></value>
        </data></array></value>
        <value><array><data>
            <value><string>stop_at</string></value>
            <value><string>&lt;=</string></value>
            <value><string>\${yesterdayStr} 23:59:59</string></value>
        </data></array></value>
        <value><array><data>
            <value><string>state</string></value>
            <value><string>=</string></value>
            <value><string>closed</string></value>
        </data></array></value>
        \${companyFilterXml}
      </data></array></value>
    </param>
    <param>
      <value><struct>
        <member>
          <name>fields</name>
          <value><array><data>
            <value><string>config_id</string></value>
            <value><string>user_id</string></value>
            <value><string>total_payments_amount</string></value>
            <value><string>cash_register_difference</string></value>
          </data></array></value>
        </member>
      </struct></value>
    </param>
  </params>
</methodCall>\`;

return {
  json: { xmlBody: xml, url, db, apiKey, empresaName, targetPhone, fechaConsulta: yesterdayStr, empresaIdSupabase: data.id }
};
        `
      },
      "name": "Code - Configura Query Sessions",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [240, -60]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $json.url }}/xmlrpc/2/object",
        "sendHeaders": true,
        "headerParameters": { "parameters": [{ "name": "Content-Type", "value": "text/xml" }] },
        "body": "={{ $json.xmlBody }}",
        "options": { "timeout": 30000 }
      },
      "name": "HTTP - Get Sessions",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [460, -60],
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "jsCode": `
function cleanOdooValue(val) {
  if (!val) return null;
  if (val.string !== undefined) return val.string;
  if (val.double !== undefined) return parseFloat(val.double);
  if (val.int !== undefined) return parseInt(val.int);
  if (Array.isArray(val.array?.data?.value) && val.array.data.value.length === 2) return val.array.data.value; // Retorna [id, name]
  return val;
}

if ($input.first().error) {
    return [{ json: { hasData: false, error: true } }];
}

const responseData = $input.first().json;
const rawParams = responseData.methodResponse?.params?.param?.value?.array?.data?.value;
const meta = $('Code - Configura Query Sessions').first().json;

if (!rawParams || (Array.isArray(rawParams) && rawParams.length === 0)) {
   return [{ json: { hasData: false, meta } }];
}

// Procesar Sesiones
const rawSessions = Array.isArray(rawParams) ? rawParams : [rawParams];
const sessions = [];
const sessionIds = [];

rawSessions.forEach(s => {
    const struct = s.struct?.member || [];
    const getVal = (name) => {
        const field = struct.find(m => m.name === name);
        return field ? cleanOdooValue(field.value) : null;
    };
    const id = getVal('id');
    const tienda = getVal('config_id');
    const venta = getVal('total_payments_amount') || 0;
    const dif = getVal('cash_register_difference') || 0;
    
    if (id) {
        sessions.push({ id, tienda: Array.isArray(tienda) ? tienda[1] : 'Tienda', venta, dif });
        sessionIds.push(id);
    }
});

// Construir XML para consultar Pagos (pos.payment)
// Filtrar por session_id IN [ids]
let idsXml = '';
sessionIds.forEach(id => {
    idsXml += \`<value><int>\${id}</int></value>\`;
});

const xmlPayments = \`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>\${meta.db}</string></value></param>
    <param><value><int>2</int></value></param>
    <param><value><string>\${meta.apiKey}</string></value></param>
    <param><value><string>pos.payment</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param>
      <value><array><data>
        <value><array><data>
            <value><string>session_id</string></value>
            <value><string>in</string></value>
            <value><array><data>\${idsXml}</data></array></value>
        </data></array></value>
      </data></array></value>
    </param>
    <param>
      <value><struct>
        <member>
          <name>fields</name>
          <value><array><data>
            <value><string>session_id</string></value>
            <value><string>amount</string></value>
            <value><string>payment_method_id</string></value>
          </data></array></value>
        </member>
      </struct></value>
    </param>
  </params>
</methodCall>\`;

return [{ json: { hasData: true, meta, sessions, xmlPayments } }];
        `
      },
      "name": "Code - Prep Payments",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [680, -60]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $json.meta.url }}/xmlrpc/2/object",
        "sendHeaders": true,
        "headerParameters": { "parameters": [{ "name": "Content-Type", "value": "text/xml" }] },
        "body": "={{ $json.xmlPayments }}",
        "options": { "timeout": 30000 }
      },
      "name": "HTTP - Get Payments",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [900, -60],
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "jsCode": `
function cleanOdooValue(val) {
  if (!val) return null;
  if (val.string !== undefined) return val.string;
  if (val.double !== undefined) return parseFloat(val.double);
  if (val.int !== undefined) return parseInt(val.int);
  if (Array.isArray(val.array?.data?.value) && val.array.data.value.length === 2) return val.array.data.value; // Retorna [id, name]
  return val;
}

const prepData = $('Code - Prep Payments').first().json;

if (!prepData.hasData) {
     return [{ json: { message: \`⚠️ *\${prepData.meta.empresaName}*\\n📅 \${prepData.meta.fechaConsulta}\\nℹ️ Sin cierres registrados.\`, phone: prepData.meta.targetPhone, hasData: false, saveToSupabase: false } }];
}

const responseData = $input.first().json;
const rawParams = responseData.methodResponse?.params?.param?.value?.array?.data?.value;
const payments = [];

if (rawParams) {
    const rawList = Array.isArray(rawParams) ? rawParams : [rawParams];
    rawList.forEach(p => {
        const struct = p.struct?.member || [];
        const getVal = (name) => {
            const field = struct.find(m => m.name === name);
            return field ? cleanOdooValue(field.value) : null;
        };
        const sessionIdRaw = getVal('session_id');
        const methodRaw = getVal('payment_method_id');
        const amount = getVal('amount') || 0;

        payments.push({
            sessionId: Array.isArray(sessionIdRaw) ? sessionIdRaw[0] : sessionIdRaw,
            method: Array.isArray(methodRaw) ? methodRaw[1] : 'Desconocido',
            amount
        });
    });
}

// Construir Mensaje
const meta = prepData.meta;
const sessions = prepData.sessions;
let totalVenta = 0;
let totalDif = 0;
let msg = \`📊 *REPORTE DIARIO*\\n🏢 \${meta.empresaName}\\n📅 \${meta.fechaConsulta}\\n\\n\`;

sessions.forEach(s => {
    totalVenta += s.venta;
    totalDif += s.dif;
    
    msg += \`🏪 *\${s.tienda}*\\n💰 Venta: S/ \${s.venta.toFixed(2)}\\n\`;
    
    // Agrupar Pagos
    const sessionPayments = payments.filter(p => p.sessionId === s.id);
    const methods = {};
    sessionPayments.forEach(p => {
        if(!methods[p.method]) methods[p.method] = {count: 0, total: 0};
        methods[p.method].count++;
        methods[p.method].total += p.amount;
    });

    Object.entries(methods).forEach(([name, data]) => {
         msg += \`   \${name} (\${data.count})\\tS/ \${data.total.toFixed(2)}\\n\`;
    });

    if(Math.abs(s.dif)>0.01) msg += \`🔴 Dif: S/ \${s.dif.toFixed(2)}\\n\`;
    msg += \`----------------\\n\`;
});

msg += \`\\n🏆 *TOTAL: S/ \${totalVenta.toFixed(2)}*\`;
msg += \`\\n\\n🔎 *Ver Detalle y Rentabilidad:*\\n👉 https://odoo-lemon.vercel.app/\`;

return [{
  json: {
    message: msg,
    phone: meta.targetPhone,
    hasData: true,
    saveToSupabase: true,
    dbPayload: {
        empresa_id: meta.empresaIdSupabase,
        fecha_reporte: meta.fechaConsulta,
        total_ventas: totalVenta,
        total_diferencia: totalDif,
        enviado_whatsapp: true
    }
  }
}];
        `
      },
      "name": "Code - Merge & Format",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1120, -60]
    },
    {
      "parameters": {
        "conditions": { "boolean": [{ "value1": "={{ $json.saveToSupabase }}", "value2": true }] }
      },
      "name": "Guardar?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [1340, -60]
    },
    {
      "parameters": {
        "method": "POST",
        "url": `${SUPABASE_URL}/rest/v1/reportes_cierre`,
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "apikey", "value": SUPABASE_KEY },
            { "name": "Authorization", "value": `Bearer ${SUPABASE_KEY}` },
            { "name": "Content-Type", "value": "application/json" },
            { "name": "Prefer", "value": "return=minimal" }
          ]
        },
        "body": "={{ $json.dbPayload }}"
      },
      "name": "Supabase Save",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [1560, -140]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.red51.site/message/sendText/chatbot",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "evolutionApi",
        "body": "={{ {\"number\": $json.phone, \"text\": $json.message} }}"
      },
      "name": "WhatsApp",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1560, 20],
      "credentials": { "evolutionApi": { "id": "ckynLYdXPqMmVdMh", "name": "Evolution account" } }
    }
  ],
  "connections": {
    "Schedule - 6:00 AM": { "main": [[{ "node": "GET Empresas Activas", "type": "main", "index": 0 }]] },
    "GET Empresas Activas": { "main": [[{ "node": "Split In Batches", "type": "main", "index": 0 }]] },
    "Split In Batches": { "main": [[{ "node": "Code - Configura Query Sessions", "type": "main", "index": 0 }]] },
    "Code - Configura Query Sessions": { "main": [[{ "node": "HTTP - Get Sessions", "type": "main", "index": 0 }]] },
    "HTTP - Get Sessions": { "main": [[{ "node": "Code - Prep Payments", "type": "main", "index": 0 }]] },
    "Code - Prep Payments": { "main": [[{ "node": "HTTP - Get Payments", "type": "main", "index": 0 }]] },
    "HTTP - Get Payments": { "main": [[{ "node": "Code - Merge & Format", "type": "main", "index": 0 }]] },
    "Code - Merge & Format": { "main": [[{ "node": "Guardar?", "type": "main", "index": 0 }]] },
    "Guardar?": {
      "main": [
        [{ "node": "Supabase Save", "type": "main", "index": 0 }, { "node": "WhatsApp", "type": "main", "index": 0 }]
      ]
    },
    "Supabase Save": { "main": [[{ "node": "Split In Batches", "type": "main", "index": 0 }]] },
    "WhatsApp": { "main": [[{ "node": "Split In Batches", "type": "main", "index": 0 }]] }
  }
};

// --- FLUJO 2: REPORTE MENSUAL (RENTABILIDAD) ---
export const MONTHLY_WORKFLOW_JSON = {
  "name": "LemonBI - Reporte Mensual (Rentabilidad)",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [{ "field": "cronExpression", "expression": "0 6 1 * *" }]
        }
      },
      "name": "Schedule - 1ro Mes 6:00 AM",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.1,
      "position": [-380, -60]
    },
    {
      "parameters": {
        "url": `${SUPABASE_URL}/rest/v1/empresas?select=*&estado=eq.true`,
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "apikey", "value": SUPABASE_KEY },
            { "name": "Authorization", "value": `Bearer ${SUPABASE_KEY}` }
          ]
        }
      },
      "name": "GET Empresas",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [-180, -60]
    },
    {
      "parameters": {},
      "name": "Split In Batches",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [20, -60]
    },
    {
      "parameters": {
        "jsCode": `
const data = $input.first().json;
const empresaName = data.codigo_acceso;

// CALCULAR MES ANTERIOR
const date = new Date();
date.setDate(1); // Ir al 1ro del mes actual
date.setHours(-1); // Ir a la ultima hora del mes anterior

const year = date.getFullYear();
const month = date.getMonth() + 1; // Mes 1-12
const lastDay = date.getDate();

const startStr = \`\${year}-\${String(month).padStart(2,'0')}-01\`;
const endStr = \`\${year}-\${String(month).padStart(2,'0')}-\${lastDay}\`;

// Query para obtener TOTAL VENDIDO (pos.order)
const xml = \`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>\${data.odoo_db}</string></value></param>
    <param><value><int>2</int></value></param>
    <param><value><string>\${data.odoo_api_key}</string></value></param>
    <param><value><string>pos.order</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param>
      <value><array><data>
        <value><array><data>
            <value><string>date_order</string></value>
            <value><string>&gt;=</string></value>
            <value><string>\${startStr} 00:00:00</string></value>
        </data></array></value>
        <value><array><data>
            <value><string>date_order</string></value>
            <value><string>&lt;=</string></value>
            <value><string>\${endStr} 23:59:59</string></value>
        </data></array></value>
        <value><array><data>
            <value><string>state</string></value>
            <value><string>!=</string></value>
            <value><string>cancel</string></value>
        </data></array></value>
      </data></array></value>
    </param>
    <param>
      <value><struct>
        <member>
            <name>fields</name>
            <value><array><data>
                <value><string>amount_total</string></value>
            </data></array></value>
        </member>
      </struct></value>
    </param>
  </params>
</methodCall>\`;

return {
  json: { 
    xmlBody: xml, 
    url: data.odoo_url, 
    empresaName, 
    targetPhone: data.whatsapp_numeros, 
    periodo: \`\${month}/\${year}\`
  }
};
        `
      },
      "name": "Code - Fechas y Query",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [240, -60]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $json.url }}/xmlrpc/2/object",
        "sendHeaders": true,
        "headerParameters": { "parameters": [{ "name": "Content-Type", "value": "text/xml" }] },
        "body": "={{ $json.xmlBody }}",
        "options": { "timeout": 60000 }
      },
      "name": "HTTP - Odoo Mensual",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [460, -60],
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "jsCode": `
if ($input.first().error) return [{json: {send: false}}];

const responseData = $input.first().json;
const meta = $('Code - Fechas y Query').first().json;

// Parsear XML-RPC response
const rawParams = responseData.methodResponse?.params?.param?.value?.array?.data?.value;
if (!rawParams) return [{json: {send: false}}];

const orders = Array.isArray(rawParams) ? rawParams : [rawParams];
let totalVendido = 0;

orders.forEach(o => {
    const struct = o.struct?.member || [];
    const val = struct.find(m => m.name === 'amount_total');
    if(val) {
       if(val.value.double) totalVendido += parseFloat(val.value.double);
       else if(val.value.string) totalVendido += parseFloat(val.value.string);
    }
});

const msg = \`📈 *REPORTE MENSUAL LEMON BI*\\n🏢 \${meta.empresaName}\\n📅 Periodo: \${meta.periodo}\\n\\n💰 *Ventas Totales: S/ \${totalVendido.toFixed(2)}*\\n\\n🔎 *Ver Detalle y Rentabilidad:*\\n👉 https://odoo-lemon.vercel.app/\`;

return [{
    json: {
        message: msg,
        phone: meta.targetPhone,
        send: true
    }
}];
        `
      },
      "name": "Code - Mensaje",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [680, -60]
    },
    {
      "parameters": {
        "conditions": { "boolean": [{ "value1": "={{ $json.send }}", "value2": true }] }
      },
      "name": "Enviar?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [900, -60]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.red51.site/message/sendText/chatbot",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "evolutionApi",
        "body": "={{ {\"number\": $json.phone, \"text\": $json.message} }}"
      },
      "name": "WhatsApp Mensual",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1150, -60],
      "credentials": { "evolutionApi": { "id": "ckynLYdXPqMmVdMh", "name": "Evolution account" } }
    },
    {
      "parameters": {},
      "name": "Loop",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [1350, -60]
    }
  ],
  "connections": {
    "Schedule - 1ro Mes 6:00 AM": { "main": [[{ "node": "GET Empresas", "type": "main", "index": 0 }]] },
    "GET Empresas": { "main": [[{ "node": "Split In Batches", "type": "main", "index": 0 }]] },
    "Split In Batches": { "main": [[{ "node": "Code - Fechas y Query", "type": "main", "index": 0 }]] },
    "Code - Fechas y Query": { "main": [[{ "node": "HTTP - Odoo Mensual", "type": "main", "index": 0 }]] },
    "HTTP - Odoo Mensual": { "main": [[{ "node": "Code - Mensaje", "type": "main", "index": 0 }]] },
    "Code - Mensaje": { "main": [[{ "node": "Enviar?", "type": "main", "index": 0 }]] },
    "Enviar?": { "main": [[{ "node": "WhatsApp Mensual", "type": "main", "index": 0 }]] },
    "WhatsApp Mensual": { "main": [[{ "node": "Split In Batches", "type": "main", "index": 0 }]] }
  }
};
