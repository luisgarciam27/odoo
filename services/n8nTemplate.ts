
// CONFIGURACIÓN PARA EXPORTAR A N8N - VERSIÓN V6 (ULTRA ROBUSTA)
export const DAILY_WORKFLOW_JSON = {
  "name": "LemonBI - Reporte Diario v6 (Persistence First)",
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
      "position": [200, 300]
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
      "position": [400, 300]
    },
    {
      "parameters": { "batchSize": 1, "options": {} },
      "name": "Iterar Empresas",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [600, 300]
    },
    {
      "parameters": {
        "jsCode": "const data = $json;\nconst date = new Date();\ndate.setDate(date.getDate() - 1);\nconst yesterdayStr = date.toISOString().split('T')[0];\n\n// Limpieza extrema de URL\nlet rawUrl = (data.odoo_url || '').trim();\nlet url = rawUrl.replace(/\\/+$/, '');\nif (url && !url.startsWith('http')) {\n  url = 'https://' + url;\n}\n\nreturn {\n  json: {\n    config: {\n      id: data.id,\n      url: url,\n      db: (data.odoo_db || '').trim(),\n      apiKey: (data.odoo_api_key || '').trim(),\n      username: (data.odoo_username || '').trim(),\n      empresa: data.codigo_acceso,\n      phones: (data.whatsapp_numeros || '').split(',').map(n => n.trim().replace(/\\D/g, '')).filter(n => n.length >= 9),\n      fecha: yesterdayStr,\n      hasCreds: !!(url && data.odoo_db && data.odoo_api_key)\n    }\n  }\n};"
      },
      "name": "Preparar Config",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [800, 300]
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [{ "value1": "={{$json.config.hasCreds}}", "value2": true }]
        }
      },
      "name": "Validar Credenciales",
      "type": "n8n-nodes-base.if",
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
        "body": "<?xml version=\"1.0\"?>\n<methodCall>\n  <methodName>authenticate</methodName>\n  <params>\n    <param><value><string>{{$json.config.db}}</string></param>\n    <param><value><string>{{$json.config.username}}</string></param>\n    <param><value><string>{{$json.config.apiKey}}</string></param>\n    <param><value><struct></struct></param>\n  </params>\n</methodCall>",
        "options": { "response": { "response": { "outputFieldName": "authResponse" } } }
      },
      "name": "Odoo Auth",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1200, 200]
    },
    {
      "parameters": {
        "jsCode": "const input = $json;\nconst xml = input.authResponse || '';\nconst match = xml.match(/<(?:int|i4)>(\\d+)<\\/(?:int|i4)>/);\nconst uid = match ? parseInt(match[1]) : 0;\nreturn { json: { ...input, uid } };"
      },
      "name": "Parse UID",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1400, 200]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{$json.config.url}}/xmlrpc/2/object",
        "sendBody": true,
        "contentType": "raw",
        "rawContentType": "text/xml",
        "body": "<?xml version=\"1.0\"?>\n<methodCall>\n  <methodName>execute_kw</methodName>\n  <params>\n    <param><value><string>{{$json.config.db}}</string></param>\n    <param><value><int>{{$json.uid}}</int></param>\n    <param><value><string>{{$json.config.apiKey}}</string></param>\n    <param><value><string>pos.session</string></param>\n    <param><value><string>search_read</string></param>\n    <param><value><array><data>\n      <value><array><data>\n        <value><array><data><value><string>stop_at</string></value><value><string>&gt;=</string></value><value><string>{{$json.config.fecha}} 00:00:00</string></value></data></array></value>\n        <value><array><data><value><string>stop_at</string></value><value><string>&lt;=</string></value><value><string>{{$json.config.fecha}} 23:59:59</string></value></data></array></value>\n        <value><array><data><value><string>state</string></value><value><string>=</string></value><value><string>closed</string></value></data></array></value>\n      </data></array></value>\n    </data></array></param>\n    <param><value><struct><member><name>fields</name><value><array><data><value><string>name</string></value><value><string>cash_register_balance_end_real</string></value><value><string>cash_register_balance_start</string></value></data></array></value></member></struct></param>\n  </params>\n</methodCall>",
        "options": { "response": { "response": { "outputFieldName": "sessionsResponse" } } }
      },
      "name": "Get Sessions",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1600, 200]
    },
    {
      "parameters": {
        "jsCode": "const input = $json;\nconst config = input.config;\nconst xml = input.sessionsResponse || '';\n\nconst extract = (tag) => {\n  const regex = new RegExp(`<member><name>${tag}<\\/name><value><(?:string|double|int|i4)>(.*?)<\\/`, 'g');\n  const res = []; let m;\n  while ((m = regex.exec(xml)) !== null) res.push(m[1]);\n  return res;\n};\n\nconst names = extract('name');\nconst starts = extract('cash_register_balance_start');\nconst ends = extract('cash_register_balance_end_real');\n\nlet totalVenta = 0;\nlet detalle = [];\nlet msg = `📊 *REPORTE DE CAJA - LEMONBI*\\n🏢 *${config.empresa}*\\n📅 ${config.fecha}\\n\\n`;\n\nif (names.length > 0) {\n  names.forEach((name, i) => {\n    const s = parseFloat(starts[i] || 0);\n    const e = parseFloat(ends[i] || 0);\n    const neta = e - s;\n    totalVenta += neta;\n    detalle.push({ caja: name, apertura: s, arqueo: e, neta });\n    msg += `📍 *${name}*\\n   • Venta: S/ ${neta.toFixed(2)}\\n   • Arqueo: S/ ${e.toFixed(2)}\\n\\n`;\n  });\n  msg += `💰 *TOTAL VENTA NETA: S/ ${totalVenta.toFixed(2)}*`;\n} else {\n  msg += \"⚠️ No se encontraron sesiones cerradas para ayer.\";\n}\n\nreturn { json: { \n  empresa_id: config.id, \n  fecha: config.fecha, \n  total: totalVenta, \n  detalle: detalle, \n  message: msg, \n  phones: config.phones \n} };"
      },
      "name": "Format Data",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1800, 200]
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
            { "name": "total_ventas", "value": "={{$json.total}}" },
            { "name": "detalle_json", "value": "={{JSON.stringify($json.detalle)}}" },
            { "name": "enviado_whatsapp", "value": "true" }
          ]
        }
      },
      "name": "Guardar en Supabase",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [2000, 200]
    },
    {
      "parameters": { "fieldToSplitOut": "phones" },
      "name": "Split Phones",
      "type": "n8n-nodes-base.splitOut",
      "typeVersion": 1,
      "position": [2200, 200]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.red51.site/message/sendText/chatbot",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            { "name": "number", "value": "={{$json.phones}}" },
            { "name": "text", "value": "={{$node[\"Format Data\"].json.message}}" }
          ]
        }
      },
      "name": "Send WhatsApp (Evolution)",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [2400, 200]
    }
  ],
  "connections": {
    "Cron - 12:30 PM": { "main": [[{ "node": "GET Empresas", "type": "main", "index": 0 }]] },
    "GET Empresas": { "main": [[{ "node": "Iterar Empresas", "type": "main", "index": 0 }]] },
    "Iterar Empresas": { "main": [[{ "node": "Preparar Config", "type": "main", "index": 0 }]] },
    "Preparar Config": { "main": [[{ "node": "Validar Credenciales", "type": "main", "index": 0 }]] },
    "Validar Credenciales": { "main": [[{ "node": "Odoo Auth", "type": "main", "index": 0 }]] },
    "Odoo Auth": { "main": [[{ "node": "Parse UID", "type": "main", "index": 0 }]] },
    "Parse UID": { "main": [[{ "node": "Get Sessions", "type": "main", "index": 0 }]] },
    "Get Sessions": { "main": [[{ "node": "Format Data", "type": "main", "index": 0 }]] },
    "Format Data": { "main": [[{ "node": "Guardar en Supabase", "type": "main", "index": 0 }]] },
    "Guardar en Supabase": { "main": [[{ "node": "Split Phones", "type": "main", "index": 0 }]] },
    "Split Phones": { "main": [[{ "node": "Send WhatsApp (Evolution)", "type": "main", "index": 0 }]] },
    "Send WhatsApp (Evolution)": { "main": [[{ "node": "Iterar Empresas", "type": "main", "index": 0 }]] }
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
