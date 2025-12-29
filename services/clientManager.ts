
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
    yapeQR: row.yape_qr || '',
    plinNumber: row.plin_numero || '',
    plinName: row.plin_nombre || '',
    plinQR: row.plin_qr || '',
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
        const { data, error } = await supabase
            .from('empresas')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching clients:', error);
            return [];
        }

        return (data || []).map(mapRowToConfig);
    } catch (err) {
        console.error('Critical error in getClients:', err);
        return [];
    }
};

export const getClientByCode = async (code: string): Promise<ClientConfig | null> => {
    try {
        const { data, error } = await supabase
            .from('empresas')
            .select('*')
            .eq('codigo_acceso', code)
            .maybeSingle();
        
        if (error || !data) return null;
        return mapRowToConfig(data);
    } catch (err) {
        console.error('Error in getClientByCode:', err);
        return null;
    }
};

export const saveClient = async (client: ClientConfig, isNew: boolean): Promise<{ success: boolean; message?: string }> => {
    /** 
     * ATENCIÓN: SCRIPT DE MIGRACIÓN REQUERIDO
     * Ejecute esto en el SQL Editor de Supabase para corregir errores de columna:
     * 
     * ALTER TABLE empresas ADD COLUMN IF NOT EXISTS business_type text DEFAULT 'pharmacy';
     * ALTER TABLE empresas ADD COLUMN IF NOT EXISTS facebook_url text;
     * ALTER TABLE empresas ADD COLUMN IF NOT EXISTS instagram_url text;
     * ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tiktok_url text;
     * ALTER TABLE empresas ADD COLUMN IF NOT EXISTS footer_description text;
     * ALTER TABLE empresas ADD COLUMN IF NOT EXISTS slide_images jsonb DEFAULT '[]'::jsonb;
     * ALTER TABLE empresas ADD COLUMN IF NOT EXISTS quality_text text;
     * ALTER TABLE empresas ADD COLUMN IF NOT EXISTS support_text text;
     * ALTER TABLE empresas ADD COLUMN IF NOT EXISTS categorias_ocultas jsonb DEFAULT '[]'::jsonb;
     * NOTIFY pgrst, 'reload schema';
     */
    
    const fullPayload: any = {
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
        tienda_categoria_nombre: client.tiendaCategoriaNombre || 'Catalogo',
        productos_ocultos: client.hiddenProducts || [],
        categorias_ocultas: client.hiddenCategories || [],
        yape_numero: client.yapeNumber,
        yape_nombre: client.yapeName,
        yape_qr: client.yapeQR,
        plin_numero: client.plinNumber,
        plin_nombre: client.plinName,
        plin_qr: client.plinQR,
        sedes_recojo: client.sedes_recojo || [],
        campos_medicos_visibles: client.campos_medicos_visibles || ["registro", "laboratorio", "principio"],
        footer_description: client.footer_description,
        facebook_url: client.facebook_url,
        instagram_url: client.instagram_url,
        tiktok_url: client.tiktok_url,
        slide_images: client.slide_images || [],
        quality_text: client.quality_text,
        support_text: client.support_text,
        business_type: client.businessType
    };

    try {
        let response;
        if (isNew) {
            response = await supabase.from('empresas').insert([fullPayload]);
        } else {
            response = await supabase.from('empresas').update(fullPayload).eq('codigo_acceso', client.code);
        }
        
        if (response.error) {
            if (response.error.message.includes('column') || response.error.code === '42703' || response.error.message.includes('business_type')) {
                const col = response.error.message.match(/'(.*?)'/)?.[1] || 'business_type';
                return { 
                    success: false, 
                    message: `⚠️ ERROR DE BASE DE DATOS: Falta la columna '${col}'. Por favor, vaya a Supabase y ejecute el script SQL de actualización que aparece en los comentarios del código.` 
                };
            }
            throw response.error;
        }
        return { success: true };
    } catch (err: any) {
        console.error('Error saving client:', err);
        return { success: false, message: err.message || "Error desconocido al guardar." };
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
  const { data, error } = await supabase
    .from('productos_extra')
    .select('*')
    .eq('empresa_code', empresaCode);
    
  if (error) return {};
  
  const map: Record<number, ProductoExtra> = {};
  data.forEach((row: any) => {
    map[row.odoo_id] = row;
  });
  return map;
};

export const deleteClient = async (code: string): Promise<boolean> => {
    const { error } = await supabase.from('empresas').delete().eq('codigo_acceso', code);
    if (error) return false;
    return true;
};
