
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
    // ... rest of daily nodes (omitted for brevity)
  ],
  "connections": {}
};

// NUEVO WORKFLOW: NOTIFICACIÓN DE PEDIDOS (STORES)
export const ORDER_NOTIFICATION_WORKFLOW_JSON = {
  "name": "LemonBI - Notificación de Pedidos v1",
  "nodes": [
    {
      "parameters": {
        "event": "inserted",
        "schema": "public",
        "table": "pedidos_tienda"
      },
      "name": "Supabase Trigger",
      "type": "n8n-nodes-base.supabaseTrigger",
      "typeVersion": 1,
      "position": [0, 300]
    },
    {
      "parameters": {
        "jsCode": "const data = $json;\nconst meta = data.metadata || {};\nconst items = Array.isArray(meta.carrito) ? meta.carrito.join('\\n') : 'Detalle no disponible';\n\nreturn {\n  json: {\n    cliente_phone: meta.telefono ? meta.telefono.replace(/\\D/g, '') : '',\n    dueno_phone: '51975615244', // REEMPLAZAR CON NUMERO DEL DUEÑO\n    monto: data.monto,\n    nombre: data.cliente_nombre,\n    ref: data.order_name,\n    voucher: data.voucher_url,\n    items: items,\n    entrega: meta.entrega === 'delivery' ? `🚚 Delivery a: ${meta.direccion}` : `📍 Recojo en: ${meta.sede}`\n  }\n};"
      },
      "name": "Formatear Datos",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [220, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.red51.site/message/sendText/farmacia",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            { "name": "number", "value": "={{$json.cliente_phone}}" },
            { "name": "text", "value": "=¡Hola {{$json.nombre}}! 🌟 Gracias por tu pedido en nuestra tienda web.\n\nHemos recibido tu comprobante de pago por S/ {{$json.monto.toFixed(2)}} (Ref: {{$json.ref}}).\n\n⏳ *Estado:* Validación de pago en curso.\nNuestro equipo confirmará tu pedido en unos minutos. ¡Gracias por tu confianza!" }
          ]
        }
      },
      "name": "WhatsApp a Cliente",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [440, 200]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.red51.site/message/sendMedia/farmacia",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            { "name": "number", "value": "={{$json.dueno_phone}}" },
            { "name": "media", "value": "={{$json.voucher}}" },
            { "name": "mediatype", "value": "image" },
            { "name": "caption", "value": "=🔔 *NUEVO PEDIDO RECIBIDO*\n\n👤 *Cliente:* {{$json.nombre}}\n💰 *Monto:* S/ {{$json.monto.toFixed(2)}}\n🆔 *Ref:* {{$json.ref}}\n\n📦 *Pedido:* \n{{$json.items}}\n\n{{$json.entrega}}\n\n_Valida el voucher arriba y confirma en Odoo._" }
          ]
        }
      },
      "name": "WhatsApp a Dueño",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [440, 400]
    }
  ],
  "connections": {
    "Supabase Trigger": { "main": [[{ "node": "Formatear Datos", "type": "main", "index": 0 }]] },
    "Formatear Datos": { "main": [[{ "node": "WhatsApp a Cliente", "type": "main", "index": 0 }, { "node": "WhatsApp a Dueño", "type": "main", "index": 0 }]] }
  }
};
