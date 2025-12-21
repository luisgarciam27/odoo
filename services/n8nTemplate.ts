
// CONFIGURACIÓN PARA EXPORTAR A N8N COMPLETADA
// Este archivo contiene los flujos listos para importar en n8n.io

export const DAILY_WORKFLOW_JSON = {
  "name": "LemonBI - Reporte Diario Automatizado",
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
      "name": "GET Empresas Activas",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [620, 300]
    },
    {
      "parameters": {
        "batchSize": 1,
        "options": {}
      },
      "name": "Split In Batches",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [840, 300]
    },
    {
      "parameters": {
        "jsCode": "const data = $json;\nconst date = new Date();\ndate.setDate(date.getDate() - 1);\nconst options = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' };\nconst formatter = new Intl.DateTimeFormat('en-CA', options);\nconst yesterdayStr = formatter.format(date);\n\nreturn {\n  json: {\n    url: (data.odoo_url || '').trim().replace(/\\/+$/, ''),\n    db: data.odoo_db,\n    apiKey: data.odoo_api_key,\n    username: data.odoo_username,\n    empresaName: data.codigo_acceso,\n    companyFilter: data.filtro_compania || 'ALL',\n    targetPhones: (data.whatsapp_numeros || '').split(',').map(n => n.trim()),\n    fecha: yesterdayStr\n  }\n};"
      },
      "name": "Configuracion",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1060, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{$json.url}}/xmlrpc/2/common",
        "sendBody": true,
        "contentType": "raw",
        "rawContentType": "text/xml",
        "body": "<?xml version=\"1.0\"?>\n<methodCall>\n  <methodName>authenticate</methodName>\n  <params>\n    <param><value><string>{{$json.db}}</string></param>\n    <param><value><string>{{$json.username}}</string></param>\n    <param><value><string>{{$json.apiKey}}</string></param>\n    <param><value><struct></struct></param>\n  </params>\n</methodCall>",
        "options": {}
      },
      "name": "Odoo Auth",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1280, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{$node[\"Configuracion\"].json.url}}/xmlrpc/2/object",
        "sendBody": true,
        "contentType": "raw",
        "rawContentType": "text/xml",
        "body": "<?xml version=\"1.0\"?>\n<methodCall>\n  <methodName>execute_kw</methodName>\n  <params>\n    <param><value><string>{{$node[\"Configuracion\"].json.db}}</string></param>\n    <param><value><int>{{$json.body.params.param.value.int || $json.body.params.param.value.i4}}</int></param>\n    <param><value><string>{{$node[\"Configuracion\"].json.apiKey}}</string></param>\n    <param><value><string>pos.session</string></param>\n    <param><value><string>search_read</string></param>\n    <param><value><array><data>\n      <value><array><data>\n        <value><array><data><value><string>stop_at</string></value><value><string>&gt;=</string></value><value><string>{{$node[\"Configuracion\"].json.fecha}} 00:00:00</string></value></data></array></value>\n        <value><array><data><value><string>stop_at</string></value><value><string>&lt;=</string></value><value><string>{{$node[\"Configuracion\"].json.fecha}} 23:59:59</string></value></data></array></value>\n        <value><array><data><value><string>state</string></value><value><string>=</string></value><value><string>closed</string></value></data></array></value>\n      </data></array></value>\n    </data></array></param>\n    <param><value><struct><member><name>fields</name><value><array><data><value><string>name</string></value><value><string>cash_register_balance_end_real</string></value><value><string>cash_register_balance_start</string></value></data></array></value></member></struct></param>\n  </params>\n</methodCall>",
        "options": {}
      },
      "name": "Get Sessions",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1500, 300]
    },
    {
      "parameters": {
        "jsCode": "const config = $node[\"Configuracion\"].json;\nconst response = $json.body.params.param.value;\nconst sessions = response.array?.data?.value || [];\n\nlet totalVenta = 0;\nlet msg = `📊 *REPORTE DE CAJA - LEMONBI*\\n🏢 *${config.empresaName}*\\n📅 ${config.fecha}\\n\\n`;\n\nif (sessions.length === 0) {\n  msg += \"⚠️ No se registraron cierres de caja para esta fecha.\";\n} else {\n  sessions.forEach(s => {\n    const struct = s.struct.member;\n    const name = struct.find(m => m.name === 'name').value.string;\n    const end = struct.find(m => m.name === 'cash_register_balance_end_real').value.double || 0;\n    const start = struct.find(m => m.name === 'cash_register_balance_start').value.double || 0;\n    const neta = end - start;\n    totalVenta += neta;\n    msg += `📍 *${name}*\\n   • Venta: S/ ${neta.toFixed(2)}\\n   • Arqueo: S/ ${end.toFixed(2)}\\n\\n`;\n  });\n  msg += `💰 *TOTAL VENTA NETA: S/ ${totalVenta.toFixed(2)}*`;\n}\n\nreturn { json: { message: msg, phones: config.targetPhones } };"
      },
      "name": "Format Message",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1720, 300]
    },
    {
      "parameters": {
        "fieldToSplitOut": "phones",
        "options": {}
      },
      "name": "Split Phones",
      "type": "n8n-nodes-base.splitOut",
      "typeVersion": 1,
      "position": [1940, 300]
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
      "position": [2160, 300]
    }
  ],
  "connections": {
    "Schedule - 6:00 AM": { "main": [[{ "node": "GET Empresas Activas", "type": "main", "index": 0 }]] },
    "GET Empresas Activas": { "main": [[{ "node": "Split In Batches", "type": "main", "index": 0 }]] },
    "Split In Batches": { "main": [[{ "node": "Configuracion", "type": "main", "index": 0 }]] },
    "Configuracion": { "main": [[{ "node": "Odoo Auth", "type": "main", "index": 0 }]] },
    "Odoo Auth": { "main": [[{ "node": "Get Sessions", "type": "main", "index": 0 }]] },
    "Get Sessions": { "main": [[{ "node": "Format Message", "type": "main", "index": 0 }]] },
    "Format Message": { "main": [[{ "node": "Split Phones", "type": "main", "index": 0 }]] },
    "Split Phones": { "main": [[{ "node": "Send WhatsApp", "type": "main", "index": 0 }]] },
    "Send WhatsApp": { "main": [[{ "node": "Split In Batches", "type": "main", "index": 0 }]] }
  }
};

export const MONTHLY_WORKFLOW_JSON = {
  "name": "LemonBI - Reporte Mensual Automatizado",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            { "field": "cronExpression", "expression": "0 8 1 * *" }
          ]
        }
      },
      "name": "Cada día 1 - 8:00 AM",
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
      "name": "GET Clientes Activos",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [620, 300]
    },
    {
      "parameters": { "batchSize": 1 },
      "name": "Loop Clientes",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [840, 300]
    },
    {
      "parameters": {
        "jsCode": "const date = new Date();\ndate.setMonth(date.getMonth() - 1);\nconst month = date.toLocaleString('es-ES', { month: 'long' }).toUpperCase();\nconst year = date.getFullYear();\nreturn { json: { month, year } };"
      },
      "name": "Get Prev Month",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1060, 300]
    }
  ],
  "connections": {
    "Cada día 1 - 8:00 AM": { "main": [[{ "node": "GET Clientes Activos", "type": "main", "index": 0 }]] },
    "GET Clientes Activos": { "main": [[{ "node": "Loop Clientes", "type": "main", "index": 0 }]] },
    "Loop Clientes": { "main": [[{ "node": "Get Prev Month", "type": "main", "index": 0 }]] }
  }
};
