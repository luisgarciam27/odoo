
// CONFIGURACIÓN PARA EXPORTAR A N8N
// Estos objetos se usan para generar el JSON que el usuario copia desde el Admin Dashboard.

export const DAILY_WORKFLOW_JSON = {
  "name": "LemonBI - Reporte Diario (Full Pro)",
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
      "name": "Schedule - 6:00 AM",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [-1800, 750]
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
      "name": "GET Empresas Activas",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [-1580, 750]
    },
    {
      "parameters": {
        "batchSize": 1,
        "options": {}
      },
      "name": "Split In Batches",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [-1360, 750]
    },
    {
      "parameters": {
        "jsCode": "const data = $input.first().json;\nconst date = new Date();\ndate.setDate(date.getDate() - 1);\nconst options = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' };\nconst formatter = new Intl.DateTimeFormat('en-CA', options);\nconst yesterdayStr = formatter.format(date);\nconst displayFormatter = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'long', year: 'numeric' });\n\nconst rawUrl = data.odoo_url || '';\nconst cleanUrl = rawUrl.trim().replace(/^=+/, '').replace(/\\/+$/, '');\n\nreturn {\n  json: {\n    empresa_id: data.id,\n    url: cleanUrl,\n    db: data.odoo_db,\n    apiKey: data.odoo_api_key,\n    empresaName: data.codigo_acceso,\n    targetPhone: data.whatsapp_numeros,\n    fecha: yesterdayStr,\n    fechaDisplay: displayFormatter.format(date),\n    timestamp: new Date().toISOString()\n  }\n};"
      },
      "name": "Config y Validación",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-1140, 750]
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
        "sendBody": true,
        "contentType": "raw",
        "body": "={{ '<?xml version=\"1.0\"?><methodCall><methodName>execute_kw</methodName><params><param><value><string>' + $json.db + '</string></value></param><param><value><int>2</int></value></param><param><value><string>' + $json.apiKey + '</string></value></param><param><value><string>pos.session</string></value></param><param><value><string>search_read</string></value></param><param><value><array><data><value><array><data><value><string>stop_at</string></value><value><string>&gt;=</string></value><value><string>' + $json.fecha + ' 00:00:00</string></value></data></array></value><value><array><data><value><array><data><value><string>stop_at</string></value><value><string>&lt;=</string></value><value><string>' + $json.fecha + ' 23:59:59</string></value></data></array></value><value><array><data><value><string>state</string></value><value><string>=</string></value><value><string>closed</string></value></data></array></value></data></array></value></param><param><value><struct><member><name>fields</name><value><array><data><value><string>name</string></value><value><string>cash_register_balance_end_real</string></value><value><string>cash_register_total_entry_encoding</string></value></data></array></value></member></struct></value></param></params></methodCall>' }}",
        "options": {}
      },
      "name": "HTTP - Get Sessions Odoo",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [-920, 750]
    },
    {
      "parameters": {
        "jsCode": "const configData = $node[\"Config y Validación\"].json;\nconst odooResponse = $input.first().json.body || '';\nlet sessions = [];\nlet totalVentas = 0;\nconst structMatches = odooResponse.matchAll(/<struct>([\\s\\S]*?)<\\/struct>/g);\nfor (const match of structMatches) {\n  const content = match[1];\n  const name = (content.match(/<name>name<\\/name>[\\s\\S]*?<string>([^<]+)/) || [])[1];\n  const val = (content.match(/<name>cash_register_balance_end_real<\\/name>[\\s\\S]*?<double>([\\d.]+)/) || [])[1];\n  if (name) {\n    const amount = parseFloat(val || '0');\n    sessions.push({ name, amount });\n    totalVentas += amount;\n  }\n}\nreturn { json: { ...configData, sessions, totalVentas: totalVentas.toFixed(2), hasData: sessions.length > 0 } };"
      },
      "name": "Parse Respuesta Odoo",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-700, 750]
    },
    {
      "parameters": {
        "jsCode": "const data = $input.first().json;\nlet msg = `📊 *REPORTE DIARIO - LEMONBI*\\n🏢 *${data.empresaName}*\\n📅 ${data.fechaDisplay}\\n\\n`;\nif (data.hasData) {\n  msg += `💰 *Total Ventas:* S/ ${data.totalVentas}\\n`;\n  msg += `🔢 *Sesiones:* ${data.sessions.length}\\n\\n`;\n  data.sessions.forEach(s => msg += `• ${s.name}: S/ ${s.amount.toFixed(2)}\\n`);\n} else {\n  msg += `⚠️ No se registraron ventas cerradas para esta fecha.`;\n}\nreturn { json: { ...data, mensajeWhatsApp: msg } };"
      },
      "name": "Formatear Mensaje",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-480, 750]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.red51.site/message/sendText/chatbot",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ {\"number\": $json.targetPhone, \"text\": $json.mensajeWhatsApp} }}",
        "options": {}
      },
      "name": "Enviar WhatsApp",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [-260, 750]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://ogopzhmsjnotuntfimpx.supabase.co/rest/v1/reportes_cierre",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "apikey", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb3B6aG1zam5vdHVudGZpbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjcwNjksImV4cCI6MjA4MTUwMzA2OX0.z9rcjc9ToplMYhLKQQl0iuKYc87hm1JAN2O1yfv3lmE" },
            { "name": "Authorization", "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb3B6aG1zam5vdHVudGZpbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjcwNjksImV4cCI6MjA4MTUwMzA2OX0.z9rcjc9ToplMYhLKQQl0iuKYc87hm1JAN2O1yfv3lmE" },
            { "name": "Prefer", "value": "return=minimal" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ {\n  \"empresa_id\": $node[\"Parse Respuesta Odoo\"].json.empresa_id,\n  \"fecha_reporte\": $node[\"Parse Respuesta Odoo\"].json.fecha,\n  \"total_ventas\": parseFloat($node[\"Parse Respuesta Odoo\"].json.totalVentas)\n} }}",
        "options": {}
      },
      "name": "Log en Supabase",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [-40, 750]
    }
  ],
  "connections": {
    "Schedule - 6:00 AM": { "main": [[{ "node": "GET Empresas Activas", "type": "main", "index": 0 }]] },
    "GET Empresas Activas": { "main": [[{ "node": "Split In Batches", "type": "main", "index": 0 }]] },
    "Split In Batches": { "main": [[{ "node": "Config y Validación", "type": "main", "index": 0 }]] },
    "Config y Validación": { "main": [[{ "node": "HTTP - Get Sessions Odoo", "type": "main", "index": 0 }]] },
    "HTTP - Get Sessions Odoo": { "main": [[{ "node": "Parse Respuesta Odoo", "type": "main", "index": 0 }]] },
    "Parse Respuesta Odoo": { "main": [[{ "node": "Formatear Mensaje", "type": "main", "index": 0 }]] },
    "Formatear Mensaje": { "main": [[{ "node": "Enviar WhatsApp", "type": "main", "index": 0 }]] },
    "Enviar WhatsApp": { "main": [[{ "node": "Log en Supabase", "type": "main", "index": 0 }]] },
    "Log en Supabase": { "main": [[{ "node": "Split In Batches", "type": "main", "index": 0 }]] }
  }
};

export const MONTHLY_WORKFLOW_JSON = {
  "name": "LemonBI - Reporte Mensual",
  "nodes": [],
  "connections": {}
};
