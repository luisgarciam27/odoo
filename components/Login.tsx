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
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      
      {/* SECCIÓN IZQUIERDA: BRANDING & CÓMO FUNCIONA */}
      <div className="w-full md:w-1/2 lg:w-5/12 bg-slate-900 text-white p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-400/5 rounded-full blur-2xl transform -translate-x-1/3 translate-y-1/3"></div>

        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-brand-500 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20">
                    <Citrus className="w-6 h-6 text-slate-900" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white">LEMON BI</h1>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
                Tus datos de Odoo, <span className="text-brand-400">convertidos en decisiones inteligentes.</span>
            </h2>
            <p className="text-slate-400 text-lg font-light mb-12 max-w-md">
                Plataforma de analítica avanzada integrada nativamente con tu ERP. Simple, rápido y en tiempo real.
            </p>
        </div>

        <div className="relative z-10 space-y-8">
            <h3 className="text-xs font-bold text-brand-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Cómo funciona</h3>
            
            <div className="flex gap-4 items-start group">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-brand-400 flex items-center justify-center font-mono text-sm font-bold group-hover:bg-brand-500 group-hover:text-slate-900 transition-colors">1</div>
                <div>
                    <h4 className="font-bold text-white mb-1">Conecta</h4>
                    <p className="text-sm text-slate-400 font-light">Ingresa tu código de sucursal para establecer una conexión segura.</p>
                </div>
            </div>

            <div className="flex gap-4 items-start group">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-brand-400 flex items-center justify-center font-mono text-sm font-bold group-hover:bg-brand-500 group-hover:text-slate-900 transition-colors">2</div>
                <div>
                    <h4 className="font-bold text-white mb-1">Sincroniza</h4>
                    <p className="text-sm text-slate-400 font-light">Accedemos a tus datos de ventas e inventario de Odoo en tiempo real.</p>
                </div>
            </div>

             <div className="flex gap-4 items-start group">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-brand-400 flex items-center justify-center font-mono text-sm font-bold group-hover:bg-brand-500 group-hover:text-slate-900 transition-colors">3</div>
                <div>
                    <h4 className="font-bold text-white mb-1">Decide</h4>
                    <p className="text-sm text-slate-400 font-light">Visualiza métricas clave y toma el control de tu rentabilidad.</p>
                </div>
            </div>
        </div>

        <div className="mt-12 text-xs text-slate-600 font-light">
            &copy; 2025 LEMON BI Analytics. Integrado con Odoo.
        </div>
      </div>

      {/* SECCIÓN DERECHA: FORMULARIO */}
      <div className="w-full md:w-1/2 lg:w-7/12 flex items-center justify-center p-6 md:p-12 relative bg-white">
        <div className="max-w-md w-full">
            
            <div className="text-center mb-10 md:hidden">
                <div className="inline-flex items-center gap-2 mb-2">
                    <Citrus className="w-6 h-6 text-brand-600" />
                    <span className="font-bold text-xl text-slate-900">LEMON BI</span>
                </div>
                <p className="text-slate-500 text-sm">Integrado con Odoo</p>
            </div>

            <div className="mb-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Bienvenido de nuevo</h3>
                <p className="text-slate-500 font-light">Por favor, ingresa tus credenciales de acceso para continuar al dashboard.</p>
            </div>

            {/* STATUS STATES */}
            {step === 'connecting' && (
                <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-xl border border-slate-100">
                    <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-4" />
                    <p className="text-slate-600 font-medium">Estableciendo túnel seguro con Odoo...</p>
                </div>
            )}

            {step === 'error' && (
                <div className="animate-in fade-in zoom-in duration-300">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-6 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700 font-medium">{error}</p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <button onClick={handleRetry} className="w-full py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 font-medium transition-all">
                            Reintentar Conexión
                        </button>
                        <button onClick={handleDemo} className="w-full py-3 text-slate-500 hover:text-slate-700 text-sm font-medium hover:bg-slate-50 rounded-xl transition-all">
                            Continuar en modo Demo
                        </button>
                    </div>
                </div>
            )}

            {(step === 'input' || step === 'processing') && (
                <form onSubmit={handleVerifyCode} className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Código de Sucursal
                        </label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <KeyRound className={`h-5 w-5 transition-colors ${error ? 'text-red-400' : 'text-slate-400 group-focus-within:text-brand-500'}`} />
                            </div>
                            <input
                                type="password" 
                                className={`w-full pl-11 pr-4 py-4 bg-slate-50 border rounded-xl outline-none transition-all text-center tracking-[0.25em] font-mono text-xl font-bold text-slate-800 placeholder-slate-300 ${
                                    error 
                                    ? 'border-red-300 focus:ring-2 focus:ring-red-100 bg-red-50/30' 
                                    : 'border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 hover:border-brand-300'
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
                            <p className="text-red-500 text-xs mt-2 font-medium animate-in slide-in-from-top-1 ml-1">
                                {error}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={accessCode.length < 3 || step === 'processing'}
                        className={`w-full py-4 rounded-xl font-bold text-base shadow-xl shadow-brand-500/10 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] ${
                            accessCode.length < 3 || step === 'processing'
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                            : 'bg-brand-500 text-white hover:bg-brand-600 hover:shadow-brand-500/25'
                        }`}
                    >
                        {step === 'processing' ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Validando...
                            </>
                        ) : (
                            <>
                                Acceder al Dashboard
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>

                    <div className="flex items-center justify-center gap-2 pt-4">
                        <ShieldCheck className="w-3 h-3 text-brand-500" />
                        <p className="text-xs text-slate-400 font-light">Conexión cifrada a IGP Master</p>
                    </div>
                </form>
            )}
        </div>
      </div>
    </div>
  );
};

export default Login;