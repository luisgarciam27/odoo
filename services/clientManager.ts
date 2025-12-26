
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

const mapRowToConfig = (row: any): ClientConfig => ({
    code: row.codigo_acceso,
    url: row.odoo_url,
    db: row.odoo_db,
    username: row.odoo_username,
    apiKey: row.odoo_api_key,
    companyFilter: row.filtro_compania,
    whatsappNumbers: row.whatsapp_numeros,
    isActive: row.estado ?? true,
    // Marca
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
    plinQR: row.plin_qr || ''
});

export const getClients = async (): Promise<ClientConfig[]> => {
    const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching clients from Supabase:', error);
        return [];
    }

    return data.map(mapRowToConfig);
};

export const getClientByCode = async (code: string): Promise<ClientConfig | null> => {
    const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('codigo_acceso', code)
        .single();
    
    if (error || !data) return null;
    return mapRowToConfig(data);
};

export const saveClient = async (client: ClientConfig, isNew: boolean): Promise<{ success: boolean; message?: string }> => {
    const payload = {
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
        tienda_categorias: client.storeCategories,
        tienda_categoria_nombre: client.tiendaCategoriaNombre || 'Catalogo',
        productos_ocultos: client.hiddenProducts || [],
        yape_numero: client.yapeNumber,
        yape_nombre: client.yapeName,
        yape_qr: client.yapeQR,
        plin_numero: client.plinNumber,
        plin_nombre: client.plinName,
        plin_qr: client.plinQR
    };

    try {
        if (isNew) {
            const existing = await getClientByCode(client.code);
            if (existing) return { success: false, message: 'El código de empresa ya existe.' };
            const { error } = await supabase.from('empresas').insert([payload]);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('empresas').update(payload).eq('codigo_acceso', client.code);
            if (error) throw error;
        }
        return { success: true };
    } catch (error: any) {
        console.error('Error saving client:', error);
        return { success: false, message: error.message || 'Error al guardar.' };
    }
};

export const deleteClient = async (code: string): Promise<boolean> => {
    const { error } = await supabase.from('empresas').delete().eq('codigo_acceso', code);
    if (error) return false;
    return true;
};
