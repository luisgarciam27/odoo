
import { supabase } from './supabaseClient';
import { ClientConfig } from '../types';

const ADMIN_PWD_KEY = 'LEMON_BI_ADMIN_PWD';
const DEFAULT_ADMIN_PWD = 'Luis2021.';

export const verifyAdminPassword = (password: string): boolean => {
    const storedPwd = localStorage.getItem(ADMIN_PWD_KEY) || DEFAULT_ADMIN_PWD;
    return storedPwd === password;
};

export const changeAdminPassword = (newPassword: string) => {
    localStorage.setItem(ADMIN_PWD_KEY, newPassword);
};

/**
 * Mapea de forma segura los datos de la fila de Supabase a la configuración del cliente.
 * Usa valores por defecto si las columnas no existen o son nulas.
 */
const mapRowToConfig = (row: any): ClientConfig => ({
    code: row.codigo_acceso,
    url: row.odoo_url,
    db: row.odoo_db,
    username: row.odoo_username,
    apiKey: row.odoo_api_key,
    companyFilter: row.filtro_compania,
    whatsappNumbers: row.whatsapp_numeros,
    isActive: row.estado ?? true,
    // Marca (con fallbacks para evitar errores si las columnas faltan)
    nombreComercial: row.nombre_comercial || row.codigo_acceso,
    logoUrl: row.logo_url || '',
    colorPrimario: row.color_primario || '#84cc16',
    // Tienda
    showStore: row.tienda_habilitada ?? true,
    storeCategories: row.tienda_categorias || '',
    tiendaCategoriaNombre: row.tienda_categoria_nombre || 'Catalogo',
    hiddenProducts: row.productos_ocultos || [],
    yapeNumber: row.yape_numero || '',
    yapeName: row.yape_nombre || '',
    yapeQR: row.yape_qr || '',
    plinNumber: row.plin_numero || '',
    plinName: row.plin_nombre || '',
    plinQR: row.plin_qr || '',
    // Salud y Logística
    sedes_recojo: Array.isArray(row.sedes_recojo) ? row.sedes_recojo : [],
    campos_medicos_visibles: Array.isArray(row.campos_medicos_visibles) ? row.campos_medicos_visibles : ["registro", "laboratorio", "principio"]
});

export const getClients = async (): Promise<ClientConfig[]> => {
    const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching clients:', error);
        return [];
    }

    return data.map(mapRowToConfig);
};

export const getClientByCode = async (code: string): Promise<ClientConfig | null> => {
    const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('codigo_acceso', code)
        .maybeSingle(); // Usar maybeSingle para evitar errores si no existe
    
    if (error || !data) return null;
    return mapRowToConfig(data);
};

/**
 * Guarda el cliente intentando limpiar el payload para evitar errores de columnas inexistentes
 */
export const saveClient = async (client: ClientConfig, isNew: boolean): Promise<{ success: boolean; message?: string }> => {
    // Definimos el payload completo
    const fullPayload: any = {
        codigo_acceso: client.code,
        odoo_url: client.url,
        odoo_db: client.db,
        odoo_username: client.username,
        odoo_api_key: client.apiKey,
        filtro_compania: client.companyFilter,
        whatsapp_numeros: client.whatsappNumbers,
        estado: client.isActive,
        // Marca
        nombre_comercial: client.nombreComercial,
        logo_url: client.logoUrl,
        color_primario: client.colorPrimario,
        // Tienda
        tienda_habilitada: client.showStore,
        tienda_categoria_nombre: client.tiendaCategoriaNombre || 'Catalogo',
        productos_ocultos: client.hiddenProducts || [],
        yape_numero: client.yapeNumber,
        yape_nombre: client.yapeName,
        yape_qr: client.yapeQR,
        plin_numero: client.plinNumber,
        plin_nombre: client.plinName,
        plin_qr: client.plinQR,
        sedes_recojo: client.sedes_recojo || [],
        campos_medicos_visibles: client.campos_medicos_visibles || ["registro", "laboratorio", "principio"]
    };

    try {
        if (isNew) {
            const { error } = await supabase.from('empresas').insert([fullPayload]);
            if (error) throw error;
        } else {
            // Si el error es específicamente de "column not found", intentamos guardar solo lo básico
            const { error } = await supabase.from('empresas').update(fullPayload).eq('codigo_acceso', client.code);
            
            if (error) {
                if (error.message.includes('column') || error.code === '42703') {
                    console.warn('Detectada discrepancia de esquema. Intentando guardado parcial...');
                    // Intentamos guardar solo columnas básicas que sabemos que existen
                    const basicPayload = {
                        odoo_url: client.url,
                        odoo_db: client.db,
                        odoo_username: client.username,
                        odoo_api_key: client.apiKey,
                        filtro_compania: client.companyFilter,
                        whatsapp_numeros: client.whatsappNumbers,
                        estado: client.isActive
                    };
                    const { error: secondError } = await supabase.from('empresas').update(basicPayload).eq('codigo_acceso', client.code);
                    if (secondError) throw secondError;
                    return { 
                        success: true, 
                        message: 'Guardado parcialmente. Algunas funciones de personalización requieren actualizar la base de datos Supabase.' 
                    };
                }
                throw error;
            }
        }
        return { success: true };
    } catch (error: any) {
        console.error('Error saving client:', error);
        return { 
            success: false, 
            message: error.message.includes('column') 
                ? 'Error de base de datos: Faltan columnas en Supabase. Por favor, ejecute el script de migración SQL.' 
                : (error.message || 'Error al guardar.') 
        };
    }
};

export const deleteClient = async (code: string): Promise<boolean> => {
    const { error } = await supabase.from('empresas').delete().eq('codigo_acceso', code);
    if (error) return false;
    return true;
};
