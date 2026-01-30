# SDK de Conexión Odoo (XML-RPC para Navegador)

Este kit contiene todo lo necesario para conectar cualquier aplicación Frontend con **Odoo (v12 a v18)** utilizando el protocolo XML-RPC.

## 🚀 Cómo replicar en otro proyecto

1. **Copiar Archivos**: Copia `odoo-connector.ts` y `odoo-types.ts` a tu nueva carpeta de servicios o utilidades.
2. **Dependencias**: No requiere librerías externas pesadas. Utiliza `fetch` y `DOMParser` (nativos del navegador).
3. **Manejo de CORS**: Odoo no permite peticiones directas desde el navegador por defecto. El conector incluye una lista de `PROXIES` automáticos. Si tienes un proxy propio, cámbialo en la constante `PROXIES` dentro de `odoo-connector.ts`.

## 🛠️ Qué modificar para otra Base de Datos

Para conectar a una base de datos diferente, solo necesitas instanciar la clase con los nuevos parámetros:

```typescript
import { OdooClient } from './odoo-connector';

const client = new OdooClient(
  'https://tu-instancia.odoo.com', // URL de Odoo
  'tu_base_de_datos',             // Nombre de la DB
  true                            // true para usar Proxy (CORS)
);

// 1. Autenticar para obtener el UID
const uid = await client.authenticate('tu_usuario@email.com', 'tu_api_key_o_password');

// 2. Consultar cualquier modelo
const productos = await client.searchRead(
  uid, 
  'tu_api_key', 
  'product.product', 
  [['sale_ok', '=', true]], 
  ['display_name', 'list_price']
);
```

## ⚠️ Notas de Seguridad
- Se recomienda usar **API Keys** generadas desde el perfil de usuario en Odoo en lugar de la contraseña principal.
- Si usas este código en producción, considera montar tu propio proxy CORS para mayor estabilidad.
