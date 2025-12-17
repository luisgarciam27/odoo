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
      "id": "trigger-node",
      "notes": "Ejecuta el reporte diariamente"
    },
    {
      "parameters": {
        "jsCode": "// ============================================\n// CONFIGURACIÓN MAESTRA DE EMPRESAS\n// ============================================\n\n// PEGA AQUÍ EL JSON GENERADO DESDE TU ADMIN DASHBOARD\nreturn [\n  // Ejemplo:\n  // {\n  //   json: {\n  //     empresa: \"MI EMPRESA\",\n  //     url: \"https://miempresa.odoo.com\",\n  //     db: \"mi_db\",\n  //     apiKey: \"tu_api_key\",\n  //     company_id: 1,\n  //     whatsapp: \"51999999999\"\n  //   }\n  // }\n];"
      },
      "name": "Code - Configuración Maestra",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -180,
        -60
      ],
      "id": "config-node",
      "notes": "Lista de empresas a procesar"
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
        "jsCode": "// ============================================\n// GENERAR XML PARA CONSULTA ODOO (CORREGIDO)\n// ============================================\n\nconst data = $input.first().json;\n\n// FIX: Forzar zona horaria Perú/Lima para obtener 'Ayer' correctamente\n// independientemente de la hora del servidor n8n.\nconst date = new Date();\ndate.setDate(date.getDate() - 1);\nconst options = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' };\n// Intl devuelve formato MM/DD/YYYY o DD/MM/YYYY según locale, forzamos en-CA para YYYY-MM-DD\nconst formatter = new Intl.DateTimeFormat('en-CA', options);\nconst yesterdayStr = formatter.format(date);\n\nconsole.log(`Procesando: ${data.empresa} para fecha ${yesterdayStr}`);\n\nconst xml = `<?xml version=\"1.0\"?>\n<methodCall>\n  <methodName>execute_kw</methodName>\n  <params>\n    <param><value><string>${data.db}</string></value></param>\n    <param><value><int>2</int></value></param>\n    <param><value><string>${data.apiKey}</string></value></param>\n    <param><value><string>pos.session</string></value></param>\n    <param><value><string>search_read</string></value></param>\n    <param>\n      <value><array><data>\n        <value><array><data>\n            <value><string>stop_at</string></value>\n            <value><string>&gt;=</string></value>\n            <value><string>${yesterdayStr} 00:00:00</string></value>\n        </data></array></value>\n        <value><array><data>\n            <value><string>stop_at</string></value>\n            <value><string>&lt;=</string></value>\n            <value><string>${yesterdayStr} 23:59:59</string></value>\n        </data></array></value>\n        <value><array><data>\n            <value><string>company_id</string></value>\n            <value><string>=</string></value>\n            <value><int>${data.company_id}</int></value>\n        </data></array></value>\n        <value><array><data>\n            <value><string>state</string></value>\n            <value><string>=</string></value>\n            <value><string>closed</string></value>\n        </data></array></value>\n      </data></array></value>\n    </param>\n    <param>\n      <value><struct>\n        <member>\n          <name>fields</name>\n          <value><array><data>\n            <value><string>id</string></value>\n            <value><string>config_id</string></value>\n            <value><string>name</string></value>\n            <value><string>user_id</string></value>\n            <value><string>start_at</string></value>\n            <value><string>stop_at</string></value>\n            <value><string>total_payments_amount</string></value>\n            <value><string>cash_register_balance_end_real</string></value>\n            <value><string>cash_register_difference</string></value>\n          </data></array></value>\n        </member>\n      </struct></value>\n    </param>\n  </params>\n</methodCall>`;\n\nreturn {\n  json: {\n    xmlBody: xml,\n    url: data.url,\n    empresaName: data.empresa,\n    targetPhone: data.whatsapp,\n    fechaConsulta: yesterdayStr\n  }\n};"
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
        "jsCode": "// ============================================\n// FORMATEAR REPORTE (CORREGIDO)\n// ============================================\n\nfunction cleanOdooValue(val) {\n  if (!val) return null;\n  if (val.string !== undefined) return val.string;\n  if (val.double !== undefined) return parseFloat(val.double);\n  if (val.int !== undefined) return parseInt(val.int);\n  if (val.boolean !== undefined) return val.boolean === '1' || val.boolean === 'true';\n  if (val.array && val.array.data && val.array.data.value) {\n    const inner = val.array.data.value;\n    if (Array.isArray(inner) && inner.length === 2) return cleanOdooValue(inner[1]);\n  }\n  return val;\n}\n\n// Verificar si hubo error en el nodo HTTP anterior\nif ($input.first().error) {\n  const inputData = $('Code - Generar XML').first().json;\n  return [{\n    json: {\n      message: `❌ *Error de Conexión en ${inputData.empresaName}*\\nNo se pudo conectar al servidor Odoo.`,\n      phone: inputData.targetPhone,\n      hasData: true // Enviamos alerta de error\n    }\n  }];\n}\n\nconst responseData = $input.first().json;\nconst inputData = $('Code - Generar XML').first().json;\nconst empresaNombre = inputData.empresaName;\nconst targetPhone = inputData.targetPhone;\nconst fechaConsulta = inputData.fechaConsulta;\n\nconst rawParams = responseData.methodResponse?.params?.param?.value?.array?.data?.value;\n\nif (!rawParams || (Array.isArray(rawParams) && rawParams.length === 0)) {\n  return [{\n    json: {\n      message: `⚠️ *${empresaNombre}*\\n📅 ${fechaConsulta}\\nℹ️ No se registraron cierres de caja ayer.`,\n      phone: targetPhone,\n      hasData: false\n    }\n  }];\n}\n\nconst sessions = Array.isArray(rawParams) ? rawParams : [rawParams];\nlet msg = `📊 *REPORTE CIERRE DE CAJA*\\n🏢 ${empresaNombre}\\n📅 ${fechaConsulta}\\n━━━━━━━━━━━━━━━━━━━━\\n\\n`;\nlet totalEmpresa = 0;\nlet totalSesiones = 0;\nlet totalDiferencias = 0;\n\nsessions.forEach((session) => {\n  try {\n    const struct = session.struct?.member;\n    if (!struct) return;\n    \n    const getField = (fieldName) => {\n      const field = struct.find(m => m.name === fieldName);\n      return field ? cleanOdooValue(field.value) : null;\n    };\n    \n    const tienda = getField('config_id') || 'Caja';\n    const cajero = getField('user_id') || 'N/A';\n    const venta = parseFloat(getField('total_payments_amount') || 0);\n    const diferencia = parseFloat(getField('cash_register_difference') || 0);\n    \n    totalEmpresa += venta;\n    totalSesiones++;\n    totalDiferencias += diferencia;\n    \n    msg += `🏪 *${tienda}* (${cajero})\\n`;\n    msg += `💰 Venta: S/ ${venta.toFixed(2)}\\n`;\n    \n    if (Math.abs(diferencia) > 0.01) {\n      const emoji = diferencia > 0 ? '🟢' : '🔴';\n      msg += `${emoji} Dif: S/ ${diferencia.toFixed(2)}\\n`;\n    } else {\n      msg += `✅ Cuadre perfecto\\n`;\n    }\n    msg += `──────────────\\n`;\n  } catch (e) {}\n});\n\nmsg += `\\n💰 *TOTAL: S/ ${totalEmpresa.toFixed(2)}*\\n`;\nif (Math.abs(totalDiferencias) > 0.01) msg += `⚠️ Dif. Total: S/ ${totalDiferencias.toFixed(2)}`;\n\nreturn [{\n  json: {\n    message: msg,\n    phone: targetPhone,\n    hasData: true\n  }\n}];"
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
              "value1": "={{ $json.hasData }}",
              "value2": true
            }
          ]
        },
        "options": {}
      },
      "name": "IF - Enviar",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [
        900,
        -60
      ],
      "id": "if-node"
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
        -60
      ],
      "id": "wait-node",
      "notes": "Pausa para evitar bloqueo"
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
        -60
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
            "node": "Code - Configuración Maestra",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code - Configuración Maestra": {
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
            "node": "IF - Enviar",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "IF - Enviar": {
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