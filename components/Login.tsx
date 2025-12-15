import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, AlertTriangle, KeyRound, ShieldCheck, Citrus } from 'lucide-react';
import { OdooClient } from '../services/odoo';
import { OdooSession } from '../types';

interface LoginProps {
  onLogin: (session: OdooSession | null) => void;
}

interface Company {
  id: number;
  name: string;
}

const COMPANY_ACCESS_CODES: Record<string, string> = {
    'CONSULTORIO': 'REQUESALUD',
    'MULTIFARMA': 'MULTIFARMA',
    'ADMIN': 'ALL'
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
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

        const userData: any[] = await client.searchRead(
            userId, config.apiKey, 'res.users',
            [['id', '=', userId]], ['company_ids']
        );

        if (userData && userData.length > 0) {
            const companyIds = userData[0].company_ids || [];
            const companiesData: any[] = await client.searchRead(
                userId, config.apiKey, 'res.company',
                [['id', 'in', companyIds]], ['name']
            );
            const companyList = companiesData.map((c: any) => ({ id: c.id, name: c.name }));
            setCompanies(companyList);
            setStep('input');
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

    const code = accessCode.trim().toUpperCase();
    const targetKeyword = COMPANY_ACCESS_CODES[code];

    if (!targetKeyword) {
        setTimeout(() => {
            setError("Código de acceso no reconocido.");
            setStep('input');
        }, 800);
        return;
    }

    let targetCompany = companies.find(c => 
        c.name.toUpperCase().includes(targetKeyword.toUpperCase())
    );
    
    if (!targetCompany && code === 'CONSULTORIO') {
         targetCompany = companies.find(c => c.name.toUpperCase().includes('CONSULTORIO'));
    }

    if (targetCompany) {
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
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      
      {/* SECCIÓN IZQUIERDA: BRANDING & CÓMO FUNCIONA */}
      <div className="w-full md:w-1/2 lg:w-5/12 bg-white relative overflow-hidden flex flex-col justify-between p-8 md:p-12 border-r border-slate-200">
        {/* Decorative Background */}
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
                Tus datos de Odoo, <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-brand-600">frescos y claros.</span>
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

        <div className="mt-12 text-[10px] text-slate-400 font-mono">
            &copy; 2025 LEMON BI Analytics v2.0.0
        </div>
      </div>

      {/* SECCIÓN DERECHA: FORMULARIO */}
      <div className="w-full md:w-1/2 lg:w-7/12 flex items-center justify-center p-6 md:p-12 relative bg-slate-50">
         {/* Decorative Grid */}
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
                <p className="text-slate-500 font-light text-sm">Ingresa tus credenciales para acceder al panel de control.</p>
            </div>

            {/* STATUS STATES */}
            {step === 'connecting' && (
                <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-2xl border border-slate-100 animate-pulse">
                    <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-4" />
                    <p className="text-slate-500 font-mono text-xs tracking-widest uppercase">Estableciendo conexión segura...</p>
                </div>
            )}

            {step === 'error' && (
                <div className="animate-in fade-in zoom-in duration-300">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-6 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-600 font-medium">{error}</p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <button onClick={handleRetry} className="w-full py-3.5 bg-slate-800 text-white rounded-xl hover:bg-slate-900 font-bold transition-all shadow-lg shadow-slate-200">
                            Reintentar Conexión
                        </button>
                        <button onClick={handleDemo} className="w-full py-3.5 text-slate-500 hover:text-slate-800 text-sm font-medium hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-200">
                            Continuar en modo Demo
                        </button>
                    </div>
                </div>
            )}

            {(step === 'input' || step === 'processing') && (
                <form onSubmit={handleVerifyCode} className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                            Código de Sucursal
                        </label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <KeyRound className={`h-5 w-5 transition-colors ${error ? 'text-red-400' : 'text-slate-400 group-focus-within:text-brand-500'}`} />
                            </div>
                            <input
                                type="password" 
                                className={`w-full pl-11 pr-4 py-4 bg-slate-50 border rounded-xl outline-none transition-all duration-300 text-center tracking-[0.25em] font-mono text-xl font-bold text-slate-800 placeholder-slate-400 ${
                                    error 
                                    ? 'border-red-300 focus:ring-2 focus:ring-red-100 bg-red-50' 
                                    : 'border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 hover:border-brand-300'
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
                            <p className="text-red-500 text-xs mt-3 font-medium animate-in slide-in-from-top-1 ml-1 flex items-center gap-2">
                                <AlertTriangle className="w-3 h-3" /> {error}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={accessCode.length < 3 || step === 'processing'}
                        className={`w-full py-4 rounded-xl font-bold text-base shadow-lg flex items-center justify-center gap-2 transition-all duration-300 transform active:scale-[0.98] ${
                            accessCode.length < 3 || step === 'processing'
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200'
                            : 'bg-brand-500 text-white hover:bg-brand-600 hover:shadow-brand-200 shadow-brand-100'
                        }`}
                    >
                        {step === 'processing' ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="tracking-wide">VALIDANDO...</span>
                            </>
                        ) : (
                            <>
                                ACCEDER AL DASHBOARD
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>

                    <div className="flex items-center justify-center gap-2 pt-2 opacity-60 hover:opacity-100 transition-opacity">
                        <ShieldCheck className="w-3 h-3 text-brand-500" />
                        <p className="text-[10px] text-slate-500 font-light uppercase tracking-wider">Conexión cifrada a IGP Master</p>
                    </div>
                </form>
            )}
        </div>
      </div>
    </div>
  );
};

export default Login;