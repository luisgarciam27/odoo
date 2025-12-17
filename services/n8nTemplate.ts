
// CONFIGURACIÓN COMÚN
const SUPABASE_URL = "https://ogopzhmsjnotuntfimpx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb3B6aG1zam5vdHVudGZpbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjcwNjksImV4cCI6MjA4MTUwMzA2OX0.z9rcjc9ToplMYhLKQQl0iuKYc87hm1JAN2O1yfv3lmE";

// --- FLUJO 1: REPORTE DIARIO DE CAJA ---
export const DAILY_WORKFLOW_JSON = {
  "name": "LemonBI - Reporte Diario",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "0 6 * * *"
            }
          ]
        }
      },
      "id": "e2e85a5a-8b8a-4b1a-9b1a-8b8a4b1a9b1a",
      "name": "Schedule - 6:00 AM",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.1,
      "position": [
        -380,
        -60
      ]
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
      "id": "f2f85a5a-8b8a-4b1a-9b1a-8b8a4b1a9b1a",
      "name": "GET Empresas Activas",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        -180,
        -60
      ]
    },
    {
      "parameters": {
        "batchSize": 1
      },
      "id": "a1a85a5a-8b8a-4b1a-9b1a-8b8a4b1a9b1a",
      "name": "Split In Batches",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [
        20,
        -60
      ]
    },
    {
      "parameters": {
        "jsCode": "const data = $input.first().json;\nconst empresaName = data.codigo_acceso;\nconst url = data.odoo_url;\nconst db = data.odoo_db;\nconst apiKey = data.odoo_api_key;\nconst targetPhone = data.whatsapp_numeros;\nconst companyFilter = data.filtro_compania;\n\nconst date = new Date();\ndate.setDate(date.getDate() - 1);\nconst options = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' };\nconst formatter = new Intl.DateTimeFormat('en-CA', options);\nconst yesterdayStr = formatter.format(date);\n\nlet companyFilterXml = '';\nif (companyFilter && companyFilter !== 'ALL') {\n    companyFilterXml = `<value><array><data>\n        <value><array><data>\n            <value><string>company_id.name</string></value>\n            <value><string>ilike</string></value>\n            <value><string>${companyFilter}</string></value>\n        </data></array></value>\n    </data></array></value>`;\n}\n\nconst xml = `<?xml version=\"1.0\"?>\n<methodCall>\n  <methodName>execute_kw</methodName>\n  <params>\n    <param><value><string>${db}</string></value></param>\n    <param><value><int>2</int></value></param>\n    <param><value><string>${apiKey}</string></value></param>\n    <param><value><string>pos.session</string></value></param>\n    <param><value><string>search_read</string></value></param>\n    <param>\n      <value><array><data>\n        <value><array><data>\n            <value><string>stop_at</string></value>\n            <value><string>&gt;=</string></value>\n            <value><string>${yesterdayStr} 00:00:00</string></value>\n        </data></array></value>\n        <value><array><data>\n            <value><string>stop_at</string></value>\n            <value><string>&lt;=</string></value>\n            <value><string>${yesterdayStr} 23:59:59</string></value>\n        </data></array></value>\n        <value><array><data>\n            <value><string>state</string></value>\n            <value><string>=</string></value>\n            <value><string>closed</string></value>\n        </data></array></value>\n        ${companyFilterXml}\n      </data></array></value>\n    </param>\n    <param>\n      <value><struct>\n        <member>\n          <name>fields</name>\n          <value><array><data>\n            <value><string>config_id</string></value>\n            <value><string>total_payments_amount</string></value>\n            <value><string>cash_register_difference</string></value>\n          </data></array></value>\n        </member>\n      </struct></value>\n    </param>\n  </params>\n</methodCall>`;\n\nreturn {\n  json: { xmlBody: xml, url, db, apiKey, empresaName, targetPhone, fechaConsulta: yesterdayStr, empresaIdSupabase: data.id }\n};"
      },
      "id": "b2b85a5a-8b8a-4b1a-9b1a-8b8a4b1a9b1a",
      "name": "Config Query Sessions",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        240,
        -60
      ]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $json.url }}/xmlrpc/2/object",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Content-Type", "value": "text/xml" }
          ]
        },
        "body": "={{ $json.xmlBody }}",
        "options": { "timeout": 30000 }
      },
      "id": "c3c85a5a-8b8a-4b1a-9b1a-8b8a4b1a9b1a",
      "name": "HTTP - Get Sessions",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        460,
        -60
      ]
    },
    {
      "parameters": {
        "jsCode": "function cleanOdooValue(val) {\n  if (!val) return null;\n  if (val.string !== undefined) return val.string;\n  if (val.double !== undefined) return parseFloat(val.double);\n  if (val.int !== undefined) return parseInt(val.int);\n  if (Array.isArray(val.array?.data?.value) && val.array.data.value.length === 2) return val.array.data.value;\n  return val;\n}\n\nconst responseData = $input.first().json;\nconst rawParams = responseData.methodResponse?.params?.param?.value?.array?.data?.value;\nconst meta = $(\"Config Query Sessions\").first().json;\n\nlet sessions = [];\nlet sessionIds = [];\n\nif (rawParams && (Array.isArray(rawParams) && rawParams.length > 0)) {\n    const rawSessions = Array.isArray(rawParams) ? rawParams : [rawParams];\n    rawSessions.forEach(s => {\n        const struct = s.struct?.member || [];\n        const getVal = (name) => {\n            const field = struct.find(m => m.name === name);\n            return field ? cleanOdooValue(field.value) : null;\n        };\n        const id = getVal('id');\n        const tienda = getVal('config_id');\n        const venta = getVal('total_payments_amount') || 0;\n        const dif = getVal('cash_register_difference') || 0;\n        if (id) {\n            sessions.push({ id, tienda: Array.isArray(tienda) ? tienda[1] : 'Tienda', venta, dif });\n            sessionIds.push(id);\n        }\n    });\n}\n\nlet idsXml = sessionIds.length > 0 ? sessionIds.map(id => `<value><int>${id}</int></value>`).join('') : '<value><int>0</int></value>';\n\nconst xmlPayments = `<?xml version=\"1.0\"?>\n<methodCall>\n  <methodName>execute_kw</methodName>\n  <params>\n    <param><value><string>${meta.db}</string></value></param>\n    <param><value><int>2</int></value></param>\n    <param><value><string>${meta.apiKey}</string></value></param>\n    <param><value><string>pos.payment</string></value></param>\n    <param><value><string>search_read</string></value></param>\n    <param><value><array><data><value><array><data><value><string>session_id</string></value><value><string>in</string></value><value><array><data>${idsXml}</data></array></value></data></array></value></data></array></value></param>\n    <param><value><struct><member><name>fields</name><value><array><data><value><string>session_id</string></value><value><string>amount</string></value><value><string>payment_method_id</string></value></data></array></value></member></struct></value></param>\n  </params>\n</methodCall>`;\n\nreturn [{ json: { hasData: sessionIds.length > 0, meta, sessions, xmlPayments } }];"
      },
      "id": "d4d85a5a-8b8a-4b1a-9b1a-8b8a4b1a9b1a",
      "name": "Prep Payments",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        680,
        -60
      ]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $json.meta.url }}/xmlrpc/2/object",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Content-Type", "value": "text/xml" }
          ]
        },
        "body": "={{ $json.xmlPayments }}",
        "options": { "timeout": 30000 }
      },
      "id": "e5e85a5a-8b8a-4b1a-9b1a-8b8a4b1a9b1a",
      "name": "HTTP - Get Payments",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        900,
        -60
      ]
    },
    {
      "parameters": {
        "jsCode": "function cleanOdooValue(val) {\n  if (!val) return null;\n  if (val.string !== undefined) return val.string;\n  if (val.double !== undefined) return parseFloat(val.double);\n  if (val.int !== undefined) return parseInt(val.int);\n  if (Array.isArray(val.array?.data?.value) && val.array.data.value.length === 2) return val.array.data.value;\n  return val;\n}\n\nconst prepData = $(\"Prep Payments\").first().json;\nconst responseData = $input.first().json;\n\nif (!prepData.hasData) {\n     return [{ json: { message: `⚠️ *${prepData.meta.empresaName}*\\n📅 ${prepData.meta.fechaConsulta}\\nℹ️ Sin cierres registrados.`, phone: prepData.meta.targetPhone, saveToSupabase: false } }];\n}\n\nconst rawParams = responseData.methodResponse?.params?.param?.value?.array?.data?.value;\nconst payments = [];\nif (rawParams) {\n    const rawList = Array.isArray(rawParams) ? rawParams : [rawParams];\n    rawList.forEach(p => {\n        const struct = p.struct?.member || [];\n        const getVal = (name) => {\n            const field = struct.find(m => m.name === name);\n            return field ? cleanOdooValue(field.value) : null;\n        };\n        const sessionIdRaw = getVal('session_id');\n        const methodRaw = getVal('payment_method_id');\n        payments.push({\n            sessionId: Array.isArray(sessionIdRaw) ? sessionIdRaw[0] : sessionIdRaw,\n            method: Array.isArray(methodRaw) ? methodRaw[1] : 'Desconocido',\n            amount: getVal('amount') || 0\n        });\n    });\n}\n\nconst meta = prepData.meta;\nconst sessions = prepData.sessions;\nlet totalVenta = 0, totalDif = 0;\nlet msg = `📊 *REPORTE DIARIO*\\n🏢 ${meta.empresaName}\\n📅 ${meta.fechaConsulta}\\n\\n`;\n\nsessions.forEach(s => {\n    totalVenta += s.venta; totalDif += s.dif;\n    msg += `🏪 *${s.tienda}*\\n💰 Venta: S/ ${s.venta.toFixed(2)}\\n`;\n    const sessionPayments = payments.filter(p => p.sessionId === s.id);\n    const methods = {};\n    sessionPayments.forEach(p => {\n        if(!methods[p.method]) methods[p.method] = {count: 0, total: 0};\n        methods[p.method].count++; methods[p.method].total += p.amount;\n    });\n    Object.entries(methods).forEach(([name, data]) => { msg += `   ${name} (${data.count})\\tS/ ${data.total.toFixed(2)}\\n`; });\n    if(Math.abs(s.dif)>0.01) msg += `🔴 Dif: S/ ${s.dif.toFixed(2)}\\n`;\n    msg += `----------------\\n`;\n});\nmsg += `\\n🏆 *TOTAL: S/ ${totalVenta.toFixed(2)}*\\n\\n🔎 *Ver Detalle:* https://odoo-lemon.vercel.app/`;\n\nreturn [{ json: { \n    message: msg, \n    phone: meta.targetPhone, \n    saveToSupabase: true, \n    dbPayload: { empresa_id: meta.empresaIdSupabase, fecha_reporte: meta.fechaConsulta, total_ventas: totalVenta, total_diferencia: totalDif, enviado_whatsapp: true } \n} }];"
      },
      "id": "f6f85a5a-8b8a-4b1a-9b1a-8b8a4b1a9b1a",
      "name": "Merge & Format",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1120,
        -60
      ]
    }
  ],
  "connections": {
    "Schedule - 6:00 AM": { "main": [[{ "node": "GET Empresas Activas", "type": "main", "index": 0 }]] },
    "GET Empresas Activas": { "main": [[{ "node": "Split In Batches", "type": "main", "index": 0 }]] },
    "Split In Batches": { "main": [[{ "node": "Config Query Sessions", "type": "main", "index": 0 }]] },
    "Config Query Sessions": { "main": [[{ "node": "HTTP - Get Sessions", "type": "main", "index": 0 }]] },
    "HTTP - Get Sessions": { "main": [[{ "node": "Prep Payments", "type": "main", "index": 0 }]] },
    "Prep Payments": { "main": [[{ "node": "HTTP - Get Payments", "type": "main", "index": 0 }]] },
    "HTTP - Get Payments": { "main": [[{ "node": "Merge & Format", "type": "main", "index": 0 }]] }
  }
};

export const MONTHLY_WORKFLOW_JSON = {
  "name": "LemonBI - Reporte Mensual",
  "nodes": [],
  "connections": {}
};
