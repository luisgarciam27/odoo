
import { supabase } from './supabaseClient';
import { ClientConfig, ProductoExtra } from '../types';

const ADMIN_PWD_KEY = 'LEMON_BI_ADMIN_PWD';
const DEFAULT_ADMIN_PWD = 'Luis2021.';

export const verifyAdminPassword = (password: string): boolean => {
    const storedPwd = localStorage.getItem(ADMIN_PWD_KEY) || DEFAULT_ADMIN_PWD;
    return storedPwd === password;
};

export const changeAdminPassword = (newPassword: string) => {
    localStorage.setItem(ADMIN_PWD_KEY, newPassword);
};

// Columnas que podrían faltar en bases de datos antiguas
const EXTENDED_COLUMNS = [
  'business_type', 'facebook_url', 'instagram_url', 'tiktok_url', 
  'footer_description', 'slide_images', 'quality_text', 'support_text', 
  'categorias_ocultas', 'whatsapp_help_number', 'productos_ocultos',
  'tienda_habilitada', 'tienda_categoria_nombre', 'sedes_recojo', 'campos_medicos_visibles'
];

const mapRowToConfig = (row: any): ClientConfig => ({
    code: row.codigo_acceso,
    url: row.odoo_url || '',
    db: row.odoo_db || '',
    username: row.odoo_username || '',
    apiKey: row.odoo_api_key || '',
    companyFilter: row.filtro_compania || 'ALL',
    whatsappNumbers: row.whatsapp_numeros || '',
    whatsappHelpNumber: row.whatsapp_help_number || '',
    isActive: row.estado ?? true,
    nombreComercial: row.nombre_comercial || row.codigo_acceso,
    logoUrl: row.logo_url || '',
    colorPrimario: row.color_primario || '#84cc16',
    colorSecundario: row.color_secundario || '#1e293b',
    colorAcento: row.color_acento || '#0ea5e9',
    showStore: row.tienda_habilitada ?? true,
    tiendaCategoriaNombre: row.tienda_categoria_nombre || 'Catalogo',
    hiddenProducts: Array.isArray(row.productos_ocultos) ? row.productos_ocultos.map(Number) : [],
    hiddenCategories: Array.isArray(row.categorias_ocultas) ? row.categorias_ocultas : [],
    yapeNumber: row.yape_numero || '',
    yapeName: row.yape_nombre || '',
    plinNumber: row.plin_numero || '',
    plinName: row.plin_nombre || '',
    sedes_recojo: Array.isArray(row.sedes_recojo) ? row.sedes_recojo : [],
    campos_medicos_visibles: Array.isArray(row.campos_medicos_visibles) ? row.campos_medicos_visibles : ["registro", "laboratorio", "principio"],
    footer_description: row.footer_description || '',
    facebook_url: row.facebook_url || '',
    instagram_url: row.instagram_url || '',
    tiktok_url: row.tiktok_url || '',
    slide_images: Array.isArray(row.slide_images) ? row.slide_images : [],
    quality_text: row.quality_text || '',
    support_text: row.support_text || '',
    businessType: row.business_type || 'pharmacy'
});

export const getClients = async (): Promise<ClientConfig[]> => {
    try {
        const { data, error } = await supabase.from('empresas').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return (data || []).map(mapRowToConfig);
    } catch (err) {
        return [];
    }
};

export const getClientByCode = async (code: string): Promise<ClientConfig | null> => {
    try {
        const { data, error } = await supabase.from('empresas').select('*').eq('codigo_acceso', code).maybeSingle();
        if (error || !data) return null;
        return mapRowToConfig(data);
    } catch (err) {
        return null;
    }
};

export const saveClient = async (client: ClientConfig, isNew: boolean): Promise<{ success: boolean; message?: string }> => {
    let payload: any = {
        codigo_acceso: client.code,
        odoo_url: client.url,
        odoo_db: client.db,
        odoo_username: client.username,
        odoo_api_key: client.apiKey,
        filtro_compania: client.companyFilter,
        whatsapp_numeros: client.whatsappNumbers,
        whatsapp_help_number: client.whatsappHelpNumber,
        estado: client.isActive,
        nombre_comercial: client.nombreComercial,
        logo_url: client.logoUrl,
        color_primario: client.colorPrimario, 
        color_secundario: client.colorSecundario,
        color_acento: client.colorAcento, 
        tienda_habilitada: client.showStore,
        tienda_categoria_nombre: client.tiendaCategoriaNombre,
        productos_ocultos: client.hiddenProducts || [],
        categorias_ocultas: client.hiddenCategories || [],
        yape_numero: client.yapeNumber,
        yape_nombre: client.yapeName,
        plin_numero: client.plinNumber,
        plin_nombre: client.plinName,
        sedes_recojo: client.sedes_recojo || [],
        campos_medicos_visibles: client.campos_medicos_visibles || [],
        footer_description: client.footer_description,
        facebook_url: client.facebook_url,
        instagram_url: client.instagram_url,
        tiktok_url: client.tiktok_url,
        slide_images: client.slide_images || [],
        quality_text: client.quality_text,
        support_text: client.support_text,
        business_type: client.businessType
    };

    const runSave = async (data: any) => {
        if (isNew) return await supabase.from('empresas').insert([data]);
        return await supabase.from('empresas').update(data).eq('codigo_acceso', client.code);
    };

    try {
        let response = await runSave(payload);
        
        // Si falla por columna inexistente (42703), limpiamos y reintentamos solo con lo básico
        if (response.error && (response.error.code === '42703' || response.error.message.includes('column'))) {
            console.warn("Detectadas columnas faltantes. Reintentando con payload básico...");
            const safePayload = { ...payload };
            EXTENDED_COLUMNS.forEach(col => delete safePayload[col]);
            
            response = await runSave(safePayload);
            if (!response.error) {
                return { 
                    success: true, 
                    message: "Guardado exitoso (Modo Básico). Para usar funciones de tienda avanzadas, ejecute el script SQL en Supabase." 
                };
            }
        }

        if (response.error) throw response.error;
        return { success: true };
    } catch (err: any) {
        return { success: false, message: err.message };
    }
};

export const saveProductExtra = async (extra: ProductoExtra) => {
  const { error } = await supabase
    .from('productos_extra')
    .upsert([
      { 
        odoo_id: extra.odoo_id, 
        empresa_code: extra.empresa_code, 
        descripcion_lemon: extra.descripcion_lemon,
        instrucciones_lemon: extra.instrucciones_lemon
      }
    ], { onConflict: 'odoo_id,empresa_code' });
  return { success: !error, error };
};

export const getProductExtras = async (empresaCode: string): Promise<Record<number, ProductoExtra>> => {
  const { data, error } = await supabase.from('productos_extra').select('*').eq('empresa_code', empresaCode);
  if (error) return {};
  const map: Record<number, ProductoExtra> = {};
  data.forEach((row: any) => { map[row.odoo_id] = row; });
  return map;
};

export const deleteClient = async (code: string): Promise<boolean> => {
    const { error } = await supabase.from('empresas').delete().eq('codigo_acceso', code);
    return !error;
};
