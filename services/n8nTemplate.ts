
// CONFIGURACIÓN PARA EXPORTAR A N8N - REPORTE DIARIO
export const DAILY_WORKFLOW_JSON = {
  "name": "LemonBI - Reporte Diario v12",
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
      "position": [0, 300]
    }
  ],
  "connections": {}
};

// WORKFLOW PROFESIONAL: WEBHOOK + EVOLUTION API DINÁMICO
export const ORDER_WEBHOOK_WORKFLOW_JSON = {
  "name": "LemonBI - Checkout Pro SaaS (Webhook)",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "lemon-order-webhook",
        "options": {}
      },
      "name": "Webhook Order",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [0, 300]
    },
    {
      "parameters": {
        "jsCode": "const body = $json.body;\nconst meta = body.metadata || {};\nconst items = Array.isArray(meta.carrito) ? meta.carrito.join('\\n') : 'Detalle no disponible';\n\n// Formatear teléfono cliente\nlet phone = meta.telefono ? meta.telefono.replace(/\\D/g, '') : '';\nif (phone.length === 9) phone = '51' + phone;\n\n// Formatear teléfono dueño\nlet ownerPhone = body.dueno_wa ? body.dueno_wa.replace(/\\D/g, '') : '51975615244';\nif (ownerPhone.length === 9) ownerPhone = '51' + ownerPhone;\n\nreturn {\n  json: {\n    instancia: body.evolution_instance || 'lemonbi',\n    evolution_apikey: body.evolution_apikey || 'TOKEN_GENERAL',\n    cliente_phone: phone,\n    dueno_phone: ownerPhone,\n    monto: body.monto,\n    nombre: body.cliente_nombre,\n    ref: body.order_name,\n    voucher: body.voucher_url,\n    items: items,\n    entrega: meta.entrega === 'delivery' ? `🚚 *Delivery:* ${meta.direccion}` : `📍 *Recojo:* ${meta.sede}`,\n    metodo: meta.metodo_pago ? meta.metodo_pago.toUpperCase() : 'YAPE/PLIN'\n  }\n};"
      },
      "name": "Format Data",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [220, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "=https://api.red51.site/message/sendText/{{$json.instancia}}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [{ "name": "apikey", "value": "={{$json.evolution_apikey}}" }]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"number\": \"{{$json.cliente_phone}}\",\n  \"textMessage\": {\n    \"text\": \"✅ *¡PEDIDO RECIBIDO CON ÉXITO!*\\n\\nHola *{{$json.nombre}}*, gracias por comprar en nuestra tienda oficial.\\n\\nHemos recibido tu comprobante por *S/ {{$json.monto.toFixed(2)}}* (Referencia: {{$json.ref}}).\\n\\n🛡️ *Próximos pasos:*\\n1. Nuestro equipo validará la transferencia.\\n2. Recibirás un mensaje de confirmación final.\\n3. Procederemos con tu {{$json.entrega.includes('📍') ? 'recojo' : 'envío'}}.\\n\\nCualquier duda, estamos aquí para ayudarte. ✨\"\n  }\n}"
      },
      "name": "Evolution API - Cliente",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [440, 200]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "=https://api.red51.site/message/sendMedia/{{$json.instancia}}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [{ "name": "apikey", "value": "={{$json.evolution_apikey}}" }]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"number\": \"{{$json.dueno_phone}}\",\n  \"mediatype\": \"image\",\n  \"media\": \"{{$json.voucher}}\",\n  \"caption\": \"🚀 *¡NUEVA VENTA WEB!*\\n\\n👤 *Cliente:* {{$json.nombre}}\\n💰 *Total:* S/ {{$json.monto.toFixed(2)}} ({{$json.metodo}})\\n🆔 *Ref:* {{$json.ref}}\\n\\n🛒 *Pedido:*\\n{{$json.items}}\\n\\n{{$json.entrega}}\\n\\n_Valida el voucher arriba para confirmar el pedido._\"\n}"
      },
      "name": "Evolution API - Dueño",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [440, 400]
    }
  ],
  "connections": {
    "Webhook Order": { "main": [[{ "node": "Format Data", "type": "main", "index": 0 }]] },
    "Format Data": { "main": [[{ "node": "Evolution API - Cliente", "type": "main", "index": 0 }, { "node": "Evolution API - Dueño", "type": "main", "index": 0 }]] }
  }
};
