export const N8N_WORKFLOW_TEMPLATE = {
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "0 8 * * *"
            }
          ]
        }
      },
      "name": "Schedule Trigger - 8:00 AM",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.1,
      "position": [
        -380,
        -60
      ],
      "id": "trigger-node"
    },
    {
      "parameters": {
        "url": "https://ogopzhmsjnotuntfimpx.supabase.co/rest/v1/empresas?select=*&estado=eq.true",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb3B6aG1zam5vdHVudGZpbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjcwNjksImV4cCI6MjA4MTUwMzA2OX0.z9rcjc9ToplMYhLKQQl0iuKYc87hm1JAN2O1yfv3lmE"
            },
            {
              "name": "Authorization",
              "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb3B6aG1zam5vdHVudGZpbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjcwNjksImV4cCI6MjA4MTUwMzA2OX0.z9rcjc9ToplMYhLKQQl0iuKYc87hm1JAN2O1yfv3lmE"
            }
          ]
        },
        "options": {}
      },
      "name": "GET Empresas - Supabase",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        -180,
        -60
      ],
      "id": "supabase-get-node",
      "notes": "Obtiene empresas activas"
    },
    {
      "parameters": {
        "options": {}
      },
      "name": "Split In Batches",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [
        20,
        -60
      ],
      "id": "split-node",
      "notes": "Procesa 1 empresa a la vez"
    },
    {
      "parameters": {
        "jsCode": "// ============================================\n// GENERAR XML PARA CONSULTA ODOO (CORREGIDO)\n// ============================================\n\nconst data = $input.first().json;\n\n// Mapeo desde Supabase (snake_case) a variables\nconst empresaName = data.codigo_acceso;\nconst url = data.odoo_url;\nconst db = data.odoo_db;\nconst apiKey = data.odoo_api_key;\n// Buscamos ID de compañía. Si es 'ALL' o texto, este flujo asume que ya tenemos el ID numérico\n// Si no, deberías agregar lógica para buscar el ID primero. \n// Para simplificar, asumiremos que odoo_company_id ya está en la DB o se busca por nombre.\n// En este ejemplo, usaremos filtro_compania como string para buscar ID si fuera necesario,\n// PERO lo ideal es guardar el ID numérico en supabase. \n// Asumiremos que el admin ya configuró un ID si lo tiene, o usaremos 1 por defecto.\n// NOTA: Para producción, agrega una columna 'odoo_company_id_int' en Supabase.\nconst companyId = 1; \n\nconst targetPhone = data.whatsapp_numeros;\n\n// FIX: Forzar zona horaria Perú/Lima para obtener 'Ayer' correctamente\nconst date = new Date();\ndate.setDate(date.getDate() - 1);\nconst options = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' };\nconst formatter = new Intl.DateTimeFormat('en-CA', options);\nconst yesterdayStr = formatter.format(date);\n\nconsole.log(`Procesando: ${empresaName} para fecha ${yesterdayStr}`);\n\nconst xml = `<?xml version=\"1.0\"?>\n<methodCall>\n  <methodName>execute_kw</methodName>\n  <params>\n    <param><value><string>${db}</string></value></param>\n    <param><value><int>2</int></value></param>\n    <param><value><string>${apiKey}</string></value></param>\n    <param><value><string>pos.session</string></value></param>\n    <param><value><string>search_read</string></value></param>\n    <param>\n      <value><array><data>\n        <value><array><data>\n            <value><string>stop_at</string></value>\n            <value><string>&gt;=</string></value>\n            <value><string>${yesterdayStr} 00:00:00</string></value>\n        </data></array></value>\n        <value><array><data>\n            <value><string>stop_at</string></value>\n            <value><string>&lt;=</string></value>\n            <value><string>${yesterdayStr} 23:59:59</string></value>\n        </data></array></value>\n        <value><array><data>\n            <value><string>state</string></value>\n            <value><string>=</string></value>\n            <value><string>closed</string></value>\n        </data></array></value>\n      </data></array></value>\n    </param>\n    <param>\n      <value><struct>\n        <member>\n          <name>fields</name>\n          <value><array><data>\n            <value><string>id</string></value>\n            <value><string>config_id</string></value>\n            <value><string>name</string></value>\n            <value><string>user_id</string></value>\n            <value><string>start_at</string></value>\n            <value><string>stop_at</string></value>\n            <value><string>total_payments_amount</string></value>\n            <value><string>cash_register_balance_end_real</string></value>\n            <value><string>cash_register_difference</string></value>\n          </data></array></value>\n        </member>\n      </struct></value>\n    </param>\n  </params>\n</methodCall>`;\n\nreturn {\n  json: {\n    xmlBody: xml,\n    url: url,\n    empresaName: empresaName,\n    targetPhone: targetPhone,\n    fechaConsulta: yesterdayStr,\n    empresaIdSupabase: data.id\n  }\n};"
      },
      "name": "Code - Generar XML",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        240,
        -60
      ],
      "id": "xml-gen-node"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $json.url }}/xmlrpc/2/object",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "text/xml"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "string",
        "body": "={{ $json.xmlBody }}",
        "options": {
          "response": {
            "response": {
              "responseFormat": "json"
            }
          },
          "timeout": 30000
        }
      },
      "name": "HTTP Request - Odoo",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        460,
        -60
      ],
      "id": "http-odoo-node",
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "jsCode": "// ============================================\n// FORMATEAR REPORTE (CORREGIDO)\n// ============================================\n\nfunction cleanOdooValue(val) {\n  if (!val) return null;\n  if (val.string !== undefined) return val.string;\n  if (val.double !== undefined) return parseFloat(val.double);\n  if (val.int !== undefined) return parseInt(val.int);\n  if (val.boolean !== undefined) return val.boolean === '1' || val.boolean === 'true';\n  if (val.array && val.array.data && val.array.data.value) {\n    const inner = val.array.data.value;\n    if (Array.isArray(inner) && inner.length === 2) return cleanOdooValue(inner[1]);\n  }\n  return val;\n}\n\n// Verificar si hubo error en el nodo HTTP anterior\nif ($input.first().error) {\n  const inputData = $('Code - Generar XML').first().json;\n  return [{\n    json: {\n      message: `❌ *Error de Conexión en ${inputData.empresaName}*\\nNo se pudo conectar al servidor Odoo.`,\n      phone: inputData.targetPhone,\n      hasData: true,\n      saveToSupabase: false\n    }\n  }];\n}\n\nconst responseData = $input.first().json;\nconst inputData = $('Code - Generar XML').first().json;\nconst empresaNombre = inputData.empresaName;\nconst targetPhone = inputData.targetPhone;\nconst fechaConsulta = inputData.fechaConsulta;\nconst empresaIdSupabase = inputData.empresaIdSupabase;\n\nconst rawParams = responseData.methodResponse?.params?.param?.value?.array?.data?.value;\n\nif (!rawParams || (Array.isArray(rawParams) && rawParams.length === 0)) {\n  return [{\n    json: {\n      message: `⚠️ *${empresaNombre}*\\n📅 ${fechaConsulta}\\nℹ️ No se registraron cierres de caja ayer.`,\n      phone: targetPhone,\n      hasData: false,\n      saveToSupabase: false\n    }\n  }];\n}\n\nconst sessions = Array.isArray(rawParams) ? rawParams : [rawParams];\nlet msg = `📊 *REPORTE CIERRE DE CAJA*\\n🏢 ${empresaNombre}\\n📅 ${fechaConsulta}\\n━━━━━━━━━━━━━━━━━━━━\\n\\n`;\nlet totalEmpresa = 0;\nlet totalSesiones = 0;\nlet totalDiferencias = 0;\n\nsessions.forEach((session) => {\n  try {\n    const struct = session.struct?.member;\n    if (!struct) return;\n    \n    const getField = (fieldName) => {\n      const field = struct.find(m => m.name === fieldName);\n      return field ? cleanOdooValue(field.value) : null;\n    };\n    \n    const tienda = getField('config_id') || 'Caja';\n    const cajero = getField('user_id') || 'N/A';\n    const venta = parseFloat(getField('total_payments_amount') || 0);\n    const diferencia = parseFloat(getField('cash_register_difference') || 0);\n    \n    totalEmpresa += venta;\n    totalSesiones++;\n    totalDiferencias += diferencia;\n    \n    msg += `🏪 *${tienda}* (${cajero})\\n`;\n    msg += `💰 Venta: S/ ${venta.toFixed(2)}\\n`;\n    \n    if (Math.abs(diferencia) > 0.01) {\n      const emoji = diferencia > 0 ? '🟢' : '🔴';\n      msg += `${emoji} Dif: S/ ${diferencia.toFixed(2)}\\n`;\n    } else {\n      msg += `✅ Cuadre perfecto\\n`;\n    }\n    msg += `──────────────\\n`;\n  } catch (e) {}\n});\n\nmsg += `\\n💰 *TOTAL: S/ ${totalEmpresa.toFixed(2)}*\\n`;\nif (Math.abs(totalDiferencias) > 0.01) msg += `⚠️ Dif. Total: S/ ${totalDiferencias.toFixed(2)}`;\n\nreturn [{\n  json: {\n    message: msg,\n    phone: targetPhone,\n    hasData: true,\n    saveToSupabase: true,\n    dbPayload: {\n        empresa_id: empresaIdSupabase,\n        fecha_reporte: fechaConsulta,\n        total_ventas: totalEmpresa,\n        total_diferencia: totalDiferencias,\n        detalle_json: sessions,\n        enviado_whatsapp: true\n    }\n  }\n}];"
      },
      "name": "Code - Formatear",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        680,
        -60
      ],
      "id": "format-node"
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.saveToSupabase }}",
              "value2": true
            }
          ]
        },
        "options": {}
      },
      "name": "IF - Guardar DB",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [
        900,
        -160
      ],
      "id": "if-db-node"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://ogopzhmsjnotuntfimpx.supabase.co/rest/v1/reportes_cierre",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb3B6aG1zam5vdHVudGZpbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjcwNjksImV4cCI6MjA4MTUwMzA2OX0.z9rcjc9ToplMYhLKQQl0iuKYc87hm1JAN2O1yfv3lmE"
            },
            {
              "name": "Authorization",
              "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb3B6aG1zam5vdHVudGZpbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjcwNjksImV4cCI6MjA4MTUwMzA2OX0.z9rcjc9ToplMYhLKQQl0iuKYc87hm1JAN2O1yfv3lmE"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            },
            {
              "name": "Prefer",
              "value": "return=minimal"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ $json.dbPayload }}",
        "options": {}
      },
      "name": "POST Reporte - Supabase",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        1100,
        -160
      ],
      "id": "supabase-post-node"
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.hasData }}",
              "value2": true
            }
          ]
        },
        "options": {}
      },
      "name": "IF - Enviar WA",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [
        900,
        60
      ],
      "id": "if-wa-node"
    },
    {
      "parameters": {
        "amount": 5
      },
      "name": "Wait",
      "type": "n8n-nodes-base.wait",
      "typeVersion": 1.1,
      "position": [
        1100,
        60
      ],
      "id": "wait-node"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.red51.site/message/sendText/chatbot",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "evolutionApi",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ {\n    \"number\": $json.phone,\n    \"text\": $json.message\n  } }}",
        "options": {}
      },
      "name": "HTTP - WhatsApp",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        1300,
        60
      ],
      "id": "whatsapp-node",
      "credentials": {
        "evolutionApi": {
          "id": "ckynLYdXPqMmVdMh",
          "name": "Evolution account"
        }
      }
    }
  ],
  "connections": {
    "Schedule Trigger - 8:00 AM": {
      "main": [
        [
          {
            "node": "GET Empresas - Supabase",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "GET Empresas - Supabase": {
      "main": [
        [
          {
            "node": "Split In Batches",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Split In Batches": {
      "main": [
        [
          {
            "node": "Code - Generar XML",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code - Generar XML": {
      "main": [
        [
          {
            "node": "HTTP Request - Odoo",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request - Odoo": {
      "main": [
        [
          {
            "node": "Code - Formatear",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code - Formatear": {
      "main": [
        [
          {
            "node": "IF - Guardar DB",
            "type": "main",
            "index": 0
          },
          {
            "node": "IF - Enviar WA",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "IF - Guardar DB": {
      "main": [
        [
          {
            "node": "POST Reporte - Supabase",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "POST Reporte - Supabase": {
      "main": [
        []
      ]
    },
    "IF - Enviar WA": {
      "main": [
        [
          {
            "node": "Wait",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Wait": {
      "main": [
        [
          {
            "node": "HTTP - WhatsApp",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP - WhatsApp": {
      "main": [
        [
          {
            "node": "Split In Batches",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
};