import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Lock, ArrowRight, Loader2, AlertTriangle, KeyRound, ShieldCheck } from 'lucide-react';
import { OdooClient } from '../services/odoo';
import { OdooSession } from '../types';

interface LoginProps {
  onLogin: (session: OdooSession | null) => void;
}

interface Company {
  id: number;
  name: string;
}

// --- CONFIGURACIÓN DE CÓDIGOS DE ACCESO ---
// Mapea el código que escribe el usuario (Clave) con una palabra clave del nombre de la compañía (Valor)
const COMPANY_ACCESS_CODES: Record<string, string> = {
    'CONSULTORIO': 'REQUESALUD', // El usuario escribe CONSULTORIO -> Buscamos empresa que diga "REQUESALUD" o "CONSULTORIO"
    'MULTIFARMA': 'MULTIFARMA',  // El usuario escribe MULTIFARMA -> Buscamos empresa "BOTICAS MULTIFARMA"
    'ADMIN': 'ALL'               // Código maestro
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  // CREDENCIALES PREDEFINIDAS Y OCULTAS (Técnico / Master User)
  const config = {
      url: 'https://igp.facturaclic.pe/',
      db: 'igp_master',
      email: 'soporte@facturaclic.pe',
      apiKey: '6761eabe769db8795b3817000bd649cad0970d0f',
      useProxy: true
  };
  
  const [step, setStep] = useState<'connecting' | 'input' | 'processing' | 'error'>('connecting');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [uid, setUid] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState('');

  // 1. Auto-conectar silenciosamente al cargar para obtener la lista real de empresas
  useEffect(() => {
    initConnection();
  }, []);

  const initConnection = async () => {
    setStep('connecting');
    setError(null);
    try {
        const client = new OdooClient(config.url, config.db, config.useProxy);
        const userId = await client.authenticate(config.email, config.apiKey);
        setUid(userId);

        // Obtener compañías permitidas del usuario técnico
        const userData: any[] = await client.searchRead(
            userId, config.apiKey, 'res.users',
            [['id', '=', userId]], ['company_ids']
        );

        if (userData && userData.length > 0) {
            const companyIds = userData[0].company_ids || [];
            
            // Traer nombres reales
            const companiesData: any[] = await client.searchRead(
                userId, config.apiKey, 'res.company',
                [['id', 'in', companyIds]], ['name']
            );

            const companyList = companiesData.map((c: any) => ({ id: c.id, name: c.name }));
            setCompanies(companyList);
            setStep('input'); // Listo para recibir código
        } else {
            throw new Error("Error de configuración: Usuario técnico sin compañías.");
        }

    } catch (err: any) {
        console.error(err);
        setError(err.message || "No se pudo establecer conexión segura con el servidor.");
        setStep('error');
    }
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    
    setStep('processing');
    setError(null);

    // Normalizar código (mayúsculas, sin espacios)
    const code = accessCode.trim().toUpperCase();
    
    // Buscar en el mapa de códigos
    const targetKeyword = COMPANY_ACCESS_CODES[code];

    if (!targetKeyword) {
        setTimeout(() => {
            setError("Código de acceso no reconocido.");
            setStep('input');
        }, 800);
        return;
    }

    // Buscar la compañía real que coincida con la palabra clave
    // NOTA: Se busca si el nombre de la compañía INCLUYE la palabra clave
    let targetCompany = companies.find(c => 
        c.name.toUpperCase().includes(targetKeyword.toUpperCase())
    );
    
    // Fallback: Si con 'REQUESALUD' no encuentra, intenta buscar con el código mismo 'CONSULTORIO'
    if (!targetCompany && code === 'CONSULTORIO') {
         targetCompany = companies.find(c => c.name.toUpperCase().includes('CONSULTORIO'));
    }

    if (targetCompany) {
        // LOGIN EXITOSO
        onLogin({
            url: config.url,
            db: config.db,
            username: config.email,
            apiKey: config.apiKey,
            uid: uid,
            useProxy: config.useProxy,
            companyId: targetCompany.id,
            companyName: targetCompany.name
        });
    } else {
        setTimeout(() => {
            setError(`Código válido, pero no se encontró la empresa '${targetKeyword}' en la base de datos.`);
            setStep('input');
        }, 800);
    }
  };

  const handleRetry = () => initConnection();
  const handleDemo = () => onLogin(null);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header Visual */}
        <div className="bg-slate-900 p-10 text-center relative overflow-hidden">
           {/* Efectos de fondo */}
           <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-emerald-900/20 to-slate-900 z-0"></div>
           <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl"></div>
           
           <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-emerald-700 rounded-xl shadow-lg flex items-center justify-center mb-4 transform rotate-3">
                <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Acceso Seguro</h1>
            <p className="text-slate-400 mt-2 text-sm">Odoo Analytics &copy; 2025</p>
          </div>
        </div>

        <div className="p-8">
          
          {/* STEP 1: CONNECTING (Invisible process mostly) */}
          {step === 'connecting' && (
              <div className="text-center py-6">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-4" />
                  <p className="text-sm text-slate-500 font-medium">Estableciendo túnel seguro...</p>
              </div>
          )}

          {/* STEP 2: ERROR */}
          {step === 'error' && (
              <div className="text-center animate-in fade-in zoom-in duration-300">
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-6 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700 font-medium text-left">{error}</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button onClick={handleRetry} className="btn-primary w-full py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium">
                        Reintentar
                    </button>
                    <button onClick={handleDemo} className="w-full py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium">
                        Ingresar modo Demo
                    </button>
                  </div>
              </div>
          )}

          {/* STEP 3: INPUT CODE */}
          {(step === 'input' || step === 'processing') && (
              <form onSubmit={handleVerifyCode} className="animate-in slide-in-from-bottom-4 duration-500">
                  <div className="mb-6">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">
                          Código de Sucursal
                      </label>
                      <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <KeyRound className={`h-5 w-5 transition-colors ${error ? 'text-red-400' : 'text-slate-400 group-focus-within:text-emerald-500'}`} />
                          </div>
                          <input
                            type="password" 
                            className={`w-full pl-11 pr-4 py-3.5 bg-slate-50 border rounded-xl outline-none transition-all text-center tracking-[0.25em] font-mono text-lg font-bold text-slate-700 placeholder-slate-300 ${
                                error 
                                ? 'border-red-300 focus:ring-2 focus:ring-red-100 bg-red-50/30' 
                                : 'border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'
                            }`}
                            placeholder="••••••"
                            value={accessCode}
                            onChange={(e) => {
                                setAccessCode(e.target.value);
                                if(error) setError(null);
                            }}
                            autoFocus
                            disabled={step === 'processing'}
                          />
                      </div>
                      {error && (
                          <p className="text-red-500 text-xs text-center mt-2 font-medium animate-in slide-in-from-top-1">
                              {error}
                          </p>
                      )}
                  </div>

                  <button
                    type="submit"
                    disabled={accessCode.length < 3 || step === 'processing'}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
                        accessCode.length < 3 || step === 'processing'
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-emerald-500/30'
                    }`}
                  >
                      {step === 'processing' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Validando...
                          </>
                      ) : (
                          <>
                            Acceder al Sistema
                            <ArrowRight className="w-4 h-4" />
                          </>
                      )}
                  </button>

                  <div className="mt-8 text-center">
                    <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1.5 bg-slate-50 py-2 rounded-lg border border-slate-100">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        Conexión cifrada a IGP Master
                    </p>
                  </div>
              </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default Login;