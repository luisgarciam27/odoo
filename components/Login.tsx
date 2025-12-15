import React, { useState } from 'react';
import { ArrowRight, Loader2, AlertTriangle, ShieldCheck, Citrus, Building2 } from 'lucide-react';
import { OdooClient } from '../services/odoo';
import { OdooSession } from '../types';

interface LoginProps {
  onLogin: (session: OdooSession | null) => void;
}

// --- DIRECTORIO DE CLIENTES (Invisible para el usuario) ---
// Aquí registras las bases de datos y accesos de tus clientes.
const CLIENT_DIRECTORY: Record<string, {
    url: string;
    db: string;
    username: string;
    apiKey: string;
    companyFilter: string; // Nombre aproximado de la compañía en Odoo para filtrar
}> = {
    // Cliente 1
    'REQUESALUD': {
        url: 'https://igp.facturaclic.pe/',
        db: 'igp_master',
        username: 'soporte@facturaclic.pe',
        apiKey: '6761eabe769db8795b3817000bd649cad0970d0f',
        companyFilter: 'REQUESALUD'
    },
    // Cliente 2
    'MULTIFARMA': {
        url: 'https://igp.facturaclic.pe/',
        db: 'igp_master',
        username: 'soporte@facturaclic.pe',
        apiKey: '6761eabe769db8795b3817000bd649cad0970d0f',
        companyFilter: 'MULTIFARMA'
    },
    // Cliente 3: FEET CARE
    'FEETCARE': {
        url: 'https://vida.facturaclic.pe/',
        db: 'vida_master',
        username: 'soporte@facturaclic.pe',
        apiKey: 'ad5d72efa974bd60712bbb24542717ffbce9e75d',
        companyFilter: 'FEET CARE'
    },
    // Cliente 4: MARIPEYA
    'MARIPEYA': {
        url: 'https://vida.facturaclic.pe/',
        db: 'vida_master',
        username: 'soporte@facturaclic.pe',
        apiKey: 'ad5d72efa974bd60712bbb24542717ffbce9e75d',
        companyFilter: 'MARIPEYA'
    },
    // Cliente Demo
    'DEMO': {
        url: 'https://igp.facturaclic.pe/',
        db: 'igp_master',
        username: 'soporte@facturaclic.pe',
        apiKey: '6761eabe769db8795b3817000bd649cad0970d0f',
        companyFilter: 'ALL'
    }
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const code = accessCode.trim().toUpperCase();
    const clientConfig = CLIENT_DIRECTORY[code];

    // 1. Validar si el código existe en nuestro directorio interno
    if (!clientConfig) {
        setTimeout(() => {
            setError("Código de sucursal no encontrado. Verifica tus credenciales.");
            setIsLoading(false);
        }, 1000);
        return;
    }

    try {
        setStatusMessage(`Conectando con servidor...`);
        
        // 2. Iniciar Cliente Odoo con los datos "ocultos"
        const client = new OdooClient(clientConfig.url, clientConfig.db, true); 
        
        // 3. Autenticar
        const uid = await client.authenticate(clientConfig.username, clientConfig.apiKey);
        
        if (!uid) throw new Error("Credenciales técnicas inválidas.");

        setStatusMessage("Sincronizando datos...");

        // 4. Buscar la compañía específica del cliente
        const userData: any[] = await client.searchRead(
            uid, clientConfig.apiKey, 'res.users',
            [['id', '=', uid]], ['company_ids']
        );

        let targetCompanyId = 0;
        let targetCompanyName = '';

        if (userData && userData.length > 0) {
            const companyIds = userData[0].company_ids || [];
            const companiesData: any[] = await client.searchRead(
                uid, clientConfig.apiKey, 'res.company',
                [['id', 'in', companyIds]], ['name']
            );

            let foundCompany;
            if (clientConfig.companyFilter === 'ALL') {
                 foundCompany = companiesData[0]; 
            } else {
                 foundCompany = companiesData.find((c: any) => 
                    c.name.toUpperCase().includes(clientConfig.companyFilter.toUpperCase())
                );
            }

            if (foundCompany) {
                targetCompanyId = foundCompany.id;
                targetCompanyName = foundCompany.name;
            } else {
                throw new Error(`El sistema no encontró la empresa asignada a '${code}'.`);
            }
        } else {
            throw new Error("El usuario sistema no tiene compañías asignadas.");
        }

        // 5. Éxito
        setStatusMessage("¡Acceso Correcto!");
        setTimeout(() => {
            onLogin({
                url: clientConfig.url,
                db: clientConfig.db,
                username: clientConfig.username,
                apiKey: clientConfig.apiKey,
                uid: uid,
                useProxy: true,
                companyId: targetCompanyId,
                companyName: targetCompanyName
            });
        }, 500);

    } catch (err: any) {
        console.error(err);
        setError(err.message || "Error de comunicación con el servidor.");
        setIsLoading(false);
        setStatusMessage('');
    }
  };

  const handleDemoMode = () => {
      if(confirm("¿Entrar en modo demostración con datos simulados?")) {
          onLogin(null);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      
      {/* SECCIÓN IZQUIERDA: VISUAL & MENSAJE (PORTADA) */}
      <div className="w-full md:w-1/2 lg:w-5/12 bg-white relative overflow-hidden flex flex-col justify-between p-8 md:p-12 border-r border-slate-200">
        <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-gradient-to-br from-brand-50 via-white to-white opacity-80"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-100 rounded-full blur-[120px] opacity-60"></div>

        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-200">
                    <Citrus className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">LEMON_BI<span className="animate-pulse text-brand-500">_</span></h1>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6 text-slate-900">
                Tus datos de Odoo,<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-brand-600">frescos y claros.</span>
            </h2>
            <p className="text-slate-500 text-lg font-light mb-12 max-w-md leading-relaxed">
                Plataforma de analítica inteligente para iluminar tus decisiones de negocio en tiempo real.
            </p>
        </div>

        <div className="relative z-10 space-y-8">
            <h3 className="text-[10px] font-bold text-brand-600 uppercase tracking-[0.2em] mb-4 pb-2 border-b border-brand-100 inline-block">Proceso de Inicio</h3>
            
            <div className="flex gap-4 items-start group">
                <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center font-mono text-sm font-bold group-hover:bg-brand-500 group-hover:text-white transition-all duration-300 shadow-sm">01</div>
                <div>
                    <h4 className="font-bold text-slate-800 mb-1">Conecta</h4>
                    <p className="text-sm text-slate-500 font-light">Ingresa tu código de sucursal para establecer conexión.</p>
                </div>
            </div>

            <div className="flex gap-4 items-start group">
                <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center font-mono text-sm font-bold group-hover:bg-brand-500 group-hover:text-white transition-all duration-300 shadow-sm">02</div>
                <div>
                    <h4 className="font-bold text-slate-800 mb-1">Sincroniza</h4>
                    <p className="text-sm text-slate-500 font-light">Sincronizamos tus ventas e inventario de Odoo al instante.</p>
                </div>
            </div>

             <div className="flex gap-4 items-start group">
                <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center font-mono text-sm font-bold group-hover:bg-brand-500 group-hover:text-white transition-all duration-300 shadow-sm">03</div>
                <div>
                    <h4 className="font-bold text-slate-800 mb-1">Decide</h4>
                    <p className="text-sm text-slate-500 font-light">Visualiza métricas clave con claridad y toma el control.</p>
                </div>
            </div>
        </div>

        <div className="mt-12 text-[10px] text-slate-400 font-mono relative z-10">
            <p>&copy; 2025 LEMON BI Analytics v2.1</p>
            <p className="mt-1">
              Desarrollado por <a href="https://gaorsystem.vercel.app/" target="_blank" rel="noreferrer" className="font-bold hover:text-brand-600 transition-colors">GAORSYSTEM PERU</a>
            </p>
        </div>
      </div>

      {/* SECCIÓN DERECHA: FORMULARIO */}
      <div className="w-full md:w-1/2 lg:w-7/12 flex items-center justify-center p-6 md:p-12 relative bg-slate-50">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <div className="max-w-md w-full relative z-10 bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white">
            
            <div className="text-center mb-8 md:hidden">
                <div className="inline-flex items-center gap-2 mb-2">
                    <Citrus className="w-6 h-6 text-brand-600" />
                    <span className="font-bold text-xl text-slate-900">LEMON BI</span>
                </div>
            </div>

            <div className="mb-8">
                <h3 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Bienvenido</h3>
                <p className="text-slate-500 font-light text-sm">Ingresa tu código de cliente para acceder.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
                <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                        Código de Sucursal / Empresa
                    </label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Building2 className={`h-5 w-5 transition-colors ${error ? 'text-red-400' : 'text-slate-400 group-focus-within:text-brand-500'}`} />
                        </div>
                        <input
                            type="text" 
                            className={`w-full pl-11 pr-4 py-4 bg-slate-50 border rounded-xl outline-none transition-all duration-300 tracking-wider font-bold text-slate-800 placeholder-slate-300 uppercase ${
                                error 
                                ? 'border-red-300 focus:ring-2 focus:ring-red-100 bg-red-50' 
                                : 'border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 hover:border-brand-300'
                            }`}
                            placeholder="EJ: REQUESALUD"
                            value={accessCode}
                            onChange={(e) => {
                                setAccessCode(e.target.value);
                                if(error) setError(null);
                            }}
                            autoFocus
                            disabled={isLoading}
                        />
                    </div>
                    {error && (
                        <div className="mt-3 flex items-start gap-2 animate-in slide-in-from-top-1">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-red-500 text-xs font-medium">{error}</p>
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={accessCode.length < 3 || isLoading}
                    className={`w-full py-4 rounded-xl font-bold text-base shadow-lg flex items-center justify-center gap-2 transition-all duration-300 transform active:scale-[0.98] ${
                        accessCode.length < 3 || isLoading
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200'
                        : 'bg-brand-500 text-white hover:bg-brand-600 hover:shadow-brand-200 shadow-brand-100'
                    }`}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="tracking-wide text-sm">{statusMessage || 'VALIDANDO...'}</span>
                        </>
                    ) : (
                        <>
                            INGRESAR
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>

                <div className="text-center pt-4">
                     <button 
                        type="button" 
                        onClick={handleDemoMode}
                        className="text-xs text-slate-400 hover:text-brand-600 transition-colors font-medium underline decoration-dashed underline-offset-4"
                     >
                        ¿No tienes código? Probar Demo
                     </button>
                </div>

                <div className="flex items-center justify-center gap-2 pt-2 opacity-40 hover:opacity-80 transition-opacity">
                    <ShieldCheck className="w-3 h-3 text-slate-500" />
                    <p className="text-[10px] text-slate-500 font-light uppercase tracking-wider">Conexión Segura Garantizada</p>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default Login;