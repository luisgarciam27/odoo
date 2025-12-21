
// CONFIGURACIÓN PARA EXPORTAR A N8N - VERSIÓN V4 (CON PERSISTENCIA EN SUPABASE)
export const DAILY_WORKFLOW_JSON = {
  "name": "LemonBI - Reporte Diario con Guardado en DB",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [{ "field": "cronExpression", "expression": "30 12 * * *" }]
        }
      },
      "name": "Cron - 12:30 PM",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [400, 300]
    },
    {
      "parameters": {
        "url": "https://ogopzhmsjnotuntfimpx.supabase.co/rest/v1/empresas?select=*&estado=eq.true",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "apikey", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb3B6aG1zam5vdHVudGZpbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjcwNjksImV4cCI6MjA4MTUwMzA2OX0.z9rcjc9ToplMYhLKQQl0iuKYc87hm1JAN2O1yfv3lmE" },
            { "name": "Authorization", "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb3B6aG1zam5vdHVudGZpbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjcwNjksImV4cCI6MjA4MTUwMzA2OX0.z9rcjc9ToplMYhLKQQl0iuKYc87hm1JAN2O1yfv3lmE" }
          ]
        }
      },
      "name": "GET Empresas",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [600, 300]
    },
    {
      "parameters": { "batchSize": 1, "options": {} },
      "name": "Iterar Empresas",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [800, 300]
    },
    {
      "parameters": {
        "jsCode": "const data = $json;\nconst date = new Date();\ndate.setDate(date.getDate() - 1);\nconst yesterdayStr = date.toISOString().split('T')[0];\nconst cleanUrl = (data.odoo_url || '').trim().replace(/\\/+$/, '');\n\nreturn {\n  json: {\n    config: {\n      id: data.id, // Mantenemos el UUID de Supabase\n      url: cleanUrl,\n      db: (data.odoo_db || '').trim(),\n      apiKey: (data.odoo_api_key || '').trim(),\n      username: (data.odoo_username || '').trim(),\n      empresa: data.codigo_acceso,\n      phones: (data.whatsapp_numeros || '').split(',').map(n => n.trim().replace(/\\D/g, '')),\n      fecha: yesterdayStr\n    }\n  }\n};"
      },
      "name": "Preparar Config",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1000, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{$json.config.url}}/xmlrpc/2/common",
        "sendBody": true,
        "contentType": "raw",
        "rawContentType": "text/xml",
        "body": "<?xml version=\"1.0\"?>\n<methodCall>\n  <methodName>authenticate</methodName>\n  <params>\n    <param><value><string>{{$json.config.db}}</string></param>\n    <param><value><string>{{$json.config.username}}</string></param>\n    <param><value><string>{{$json.config.apiKey}}</string></param>\n    <param><value><struct></struct></param>\n  </params>\n</methodCall>"
      },
      "name": "Odoo Auth",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1200, 300]
    },
    {
      "parameters": {
        "jsCode": "const authResponse = $json;\nconst configNode = $(\"Preparar Config\").first();\nconst config = configNode.json.config;\nconst uid = authResponse.params?.param?.value?.int || \n            authResponse.methodResponse?.params?.param?.value?.int || 0;\nreturn { json: { uid, config } };"
      },
      "name": "Merge Auth",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1400, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{$json.config.url}}/xmlrpc/2/object",
        "sendBody": true,
        "contentType": "raw",
        "rawContentType": "text/xml",
        "body": "<?xml version=\"1.0\"?>\n<methodCall>\n  <methodName>execute_kw</methodName>\n  <params>\n    <param><value><string>{{$json.config.db}}</string></param>\n    <param><value><int>{{$json.uid}}</int></param>\n    <param><value><string>{{$json.config.apiKey}}</string></param>\n    <param><value><string>pos.session</string></param>\n    <param><value><string>search_read</string></param>\n    <param><value><array><data>\n      <value><array><data>\n        <value><array><data><value><string>stop_at</string></value><value><string>&gt;=</string></value><value><string>{{$json.config.fecha}} 00:00:00</string></value></data></array></value>\n        <value><array><data><value><string>stop_at</string></value><value><string>&lt;=</string></value><value><string>{{$json.config.fecha}} 23:59:59</string></value></data></array></value>\n        <value><array><data><value><string>state</string></value><value><string>=</string></value><value><string>closed</string></value></data></array></value>\n      </data></array></value>\n    </data></array></param>\n    <param><value><struct><member><name>fields</name><value><array><data><value><string>name</string></value><value><string>cash_register_balance_end_real</string></value><value><string>cash_register_balance_start</string></value></data></array></value></member></struct></param>\n  </params>\n</methodCall>"
      },
      "name": "Get Sessions",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1600, 300]
    },
    {
      "parameters": {
        "jsCode": "const input = $json;\nconst mergeNode = $(\"Merge Auth\").first();\nconst config = mergeNode.json.config;\n\nconst getSessionsData = (obj) => {\n  if (obj.params?.param?.value?.array?.data?.value) return obj.params.param.value.array.data.value;\n  if (obj.methodResponse?.params?.param?.value?.array?.data?.value) return obj.methodResponse.params.param.value.array.data.value;\n  return null;\n};\n\nconst sessionsRaw = getSessionsData(input);\nlet totalVenta = 0;\nlet detalleJson = [];\nlet msg = `📊 *REPORTE DE CAJA - LEMONBI*\\n🏢 *${config.empresa}*\\n📅 ${config.fecha}\\n\\n`;\n\nif (sessionsRaw) {\n  const sessionsList = Array.isArray(sessionsRaw) ? sessionsRaw : [sessionsRaw];\n  sessionsList.forEach(s => {\n    const members = Array.isArray(s.struct?.member) ? s.struct.member : [s.struct?.member];\n    const name = members.find(x => x.name === 'name')?.value?.string || 'Caja';\n    const start = parseFloat(members.find(x => x.name === 'cash_register_balance_start')?.value?.double || 0);\n    const end = parseFloat(members.find(x => x.name === 'cash_register_balance_end_real')?.value?.double || 0);\n    const neta = end - start;\n    totalVenta += neta;\n    detalleJson.push({ caja: name, apertura: start, cierre: end, neta });\n    msg += `📍 *${name}*\\n   • Venta: S/ ${neta.toFixed(2)}\\n\\n`;\n  });\n  msg += `💰 *TOTAL VENTA NETA: S/ ${totalVenta.toFixed(2)}*`;\n} else {\n  msg += \"⚠️ No se encontraron cierres de caja.\";\n}\n\nreturn { json: { message: msg, phones: config.phones, totalVenta, detalleJson, empresa_id: config.id, fecha: config.fecha } };"
      },
      "name": "Format Message",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1800, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://ogopzhmsjnotuntfimpx.supabase.co/rest/v1/reportes_cierre",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "apikey", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb3B6aG1zam5vdHVudGZpbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjcwNjksImV4cCI6MjA4MTUwMzA2OX0.z9rcjc9ToplMYhLKQQl0iuKYc87hm1JAN2O1yfv3lmE" },
            { "name": "Authorization", "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb3B6aG1zam5vdHVudGZpbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjcwNjksImV4cCI6MjA4MTUwMzA2OX0.z9rcjc9ToplMYhLKQQl0iuKYc87hm1JAN2O1yfv3lmE" }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            { "name": "empresa_id", "value": "={{$json.empresa_id}}" },
            { "name": "fecha_reporte", "value": "={{$json.fecha}}" },
            { "name": "total_ventas", "value": "={{$json.totalVenta}}" },
            { "name": "detalle_json", "value": "={{JSON.stringify($json.detalleJson)}}" },
            { "name": "enviado_whatsapp", "value": "true" }
          ]
        }
      },
      "name": "Guardar en Supabase",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [2000, 300]
    },
    {
      "parameters": { "fieldToSplitOut": "phones" },
      "name": "Split Phones",
      "type": "n8n-nodes-base.splitOut",
      "typeVersion": 1,
      "position": [2200, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.red51.site/message/sendText/chatbot",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            { "name": "number", "value": "={{$json.phones}}" },
            { "name": "text", "value": "={{$node[\"Format Message\"].json.message}}" }
          ]
        }
      },
      "name": "Send WhatsApp",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [2400, 300]
    }
  ],
  "connections": {
    "Cron - 12:30 PM": { "main": [[{ "node": "GET Empresas", "type": "main", "index": 0 }]] },
    "GET Empresas": { "main": [[{ "node": "Iterar Empresas", "type": "main", "index": 0 }]] },
    "Iterar Empresas": { "main": [[{ "node": "Preparar Config", "type": "main", "index": 0 }]] },
    "Preparar Config": { "main": [[{ "node": "Odoo Auth", "type": "main", "index": 0 }]] },
    "Odoo Auth": { "main": [[{ "node": "Merge Auth", "type": "main", "index": 0 }]] },
    "Merge Auth": { "main": [[{ "node": "Get Sessions", "type": "main", "index": 0 }]] },
    "Get Sessions": { "main": [[{ "node": "Format Message", "type": "main", "index": 0 }]] },
    "Format Message": { "main": [[{ "node": "Guardar en Supabase", "type": "main", "index": 0 }]] },
    "Guardar en Supabase": { "main": [[{ "node": "Split Phones", "type": "main", "index": 0 }]] },
    "Split Phones": { "main": [[{ "node": "Send WhatsApp", "type": "main", "index": 0 }]] },
    "Send WhatsApp": { "main": [[{ "node": "Iterar Empresas", "type": "main", "index": 0 }]] }
  }
};

export const MONTHLY_WORKFLOW_JSON = {
  "name": "LemonBI - Reporte Mensual Automatizado",
  "nodes": [
    {
      "parameters": { "rule": { "interval": [{ "field": "cronExpression", "expression": "0 8 1 * *" }] } },
      "name": "Cada día 1 - 8:00 AM",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [400, 300]
    }
  ],
  "connections": {}
};
