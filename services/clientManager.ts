import { ClientConfig } from '../types';

// Actualizamos la versión para forzar la recarga de los datos por defecto en el navegador del usuario
const CLIENTS_STORAGE_KEY = 'LEMON_BI_CLIENTS_V2';
const ADMIN_PWD_KEY = 'LEMON_BI_ADMIN_PWD';
const DEFAULT_ADMIN_PWD = 'Luis2021.';

const DEFAULT_CLIENTS: ClientConfig[] = [
    {
        code: 'REQUESALUD',
        url: 'https://igp.facturaclic.pe/',
        db: 'igp_master',
        username: 'soporte@facturaclic.pe',
        apiKey: '6761eabe769db8795b3817000bd649cad0970d0f',
        // Actualizado con el nombre real encontrado en Odoo
        companyFilter: 'SAN MARTIN DE THOURS'
    },
    {
        code: 'MULTIFARMA',
        url: 'https://igp.facturaclic.pe/',
        db: 'igp_master',
        username: 'soporte@facturaclic.pe',
        apiKey: '6761eabe769db8795b3817000bd649cad0970d0f',
        companyFilter: 'MULTIFARMA'
    },
    {
        code: 'FEETCARE',
        url: 'https://vida.facturaclic.pe/',
        db: 'vida_master',
        username: 'soporte@facturaclic.pe',
        apiKey: 'ad5d72efa974bd60712bbb24542717ffbce9e75d',
        companyFilter: 'FEET CARE'
    },
    {
        code: 'MARIPEYA',
        url: 'https://vida.facturaclic.pe/',
        db: 'vida_master',
        username: 'soporte@facturaclic.pe',
        apiKey: 'ad5d72efa974bd60712bbb24542717ffbce9e75d',
        companyFilter: 'MARIPEYA'
    }
];

// --- GESTIÓN DE CLIENTES ---

export const getClients = (): ClientConfig[] => {
    const stored = localStorage.getItem(CLIENTS_STORAGE_KEY);
    if (!stored) {
        // Si no hay datos (o cambió la versión key), guardamos los defaults y los retornamos
        localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(DEFAULT_CLIENTS));
        return DEFAULT_CLIENTS;
    }
    try {
        return JSON.parse(stored);
    } catch (e) {
        return DEFAULT_CLIENTS;
    }
};

export const saveClients = (clients: ClientConfig[]) => {
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
};

export const getClientByCode = (code: string): ClientConfig | undefined => {
    const clients = getClients();
    return clients.find(c => c.code.toUpperCase() === code.toUpperCase());
};

// --- GESTIÓN DE ADMIN ---

export const verifyAdminPassword = (password: string): boolean => {
    const storedPwd = localStorage.getItem(ADMIN_PWD_KEY) || DEFAULT_ADMIN_PWD;
    return storedPwd === password;
};

export const changeAdminPassword = (newPassword: string) => {
    localStorage.setItem(ADMIN_PWD_KEY, newPassword);
};
