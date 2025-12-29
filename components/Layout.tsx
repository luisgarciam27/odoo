
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  PieChart, 
  LogOut, 
  TrendingUp, 
  ShoppingBag,
  Menu,
  Citrus,
  X,
  CreditCard,
  Store,
  ShoppingCart,
  Palette,
  PackageSearch,
  Bell,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { PedidoTienda } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  currentView: string;
  onNavigate: (view: string) => void;
  showStoreLink?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, onLogout, currentView, onNavigate, showStoreLink }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<PedidoTienda[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  // Escuchar pedidos en tiempo real
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos_tienda' },
        (payload) => {
          const newOrder = payload.new as PedidoTienda;
          setNotifications(prev => [newOrder, ...prev]);
          setHasNew(true);
          // Opcional: Sonido de notificación
          try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play(); } catch(e){}
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleNavigate = (view: string) => {
    onNavigate(view);
    setIsMobileMenuOpen(false);
  };

  const NavItem = ({ view, icon: Icon, label, color = 'text-brand-600' }: { view: string, icon: any, label: string, color?: string }) => (
    <button 
      onClick={() => handleNavigate(view)}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden mb-1.5 font-medium ${
        currentView === view 
          ? 'text-brand-700 bg-brand-50 shadow-sm border border-brand-200' 
          : 'text-slate-500 hover:text-slate-800 hover:bg-white hover:shadow-sm border border-transparent'
      }`}
    >
      <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 duration-300 ${currentView === view ? color : 'text-slate-400 group-hover:text-brand-500'}`} />
      <span className="font-sans text-sm tracking-wide">{label}</span>
      
      {currentView === view && (
        <div className="absolute right-3 w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse"></div>
      )}
    </button>
  );

  return (
    <div className="min-h-screen flex font-sans text-slate-800 selection:bg-brand-200 selection:text-brand-900">
      
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 flex-col bg-white/80 backdrop-blur-xl border-r border-slate-200/60 transition-transform duration-300 ease-out shadow-[4px_0_24px_-4px_rgba(0,0,0,0.03)]
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 md:static md:flex md:h-screen
      `}>
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-brand-400 to-brand-500 p-2.5 rounded-2xl shadow-lg shadow-brand-500/30 transform rotate-3 hover:rotate-6 transition-transform">
              <Citrus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-xl leading-none tracking-tight text-slate-800">LEMON BI</h2>
              <p className="text-[10px] text-brand-600 font-bold tracking-widest mt-1 uppercase">Analytics</p>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 p-5 space-y-1 overflow-y-auto">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-4 mt-2">
            Análisis
          </div>
          
          <NavItem view="general" icon={LayoutDashboard} label="Dashboard General" />
          <NavItem view="rentabilidad" icon={TrendingUp} label="Rentabilidad" />

          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-4 mt-6">
            Operaciones
          </div>

          <NavItem view="comparativa" icon={Store} label="Sedes y Cajas" />
          <NavItem view="ventas" icon={ShoppingBag} label="Ventas y Pedidos" />
          <NavItem view="pagos" icon={CreditCard} label="Métodos de Pago" />
          <NavItem view="reportes" icon={PieChart} label="Reportes Gráficos" />

          {showStoreLink && (
            <>
              <div className="text-[11px] font-bold text-brand-500 uppercase tracking-widest mb-3 px-4 mt-6">
                Venta Online
              </div>
              <NavItem view="product-manager" icon={PackageSearch} label="Mis Productos" color="text-brand-500" />
              <NavItem view="store-config" icon={Palette} label="Configurar Tienda" color="text-brand-500" />
              <NavItem view="store" icon={ShoppingCart} label="Ver Mi Tienda" color="text-brand-500" />
            </>
          )}
        </nav>

        <div className="p-5 border-t border-slate-100 bg-slate-50/50">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all group"
          >
            <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            <span className="font-sans text-sm font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 transition-all w-full h-screen overflow-y-auto relative z-10 scroll-smooth">
        {/* TOP BAR CON CAMPANA */}
        <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 text-slate-800 p-4 flex items-center justify-between sticky top-0 z-20 shadow-sm px-8">
          <div className="flex items-center gap-2">
            <Citrus className="w-6 h-6 text-brand-500 md:hidden" />
            <span className="font-bold text-lg hidden md:block uppercase tracking-tighter">Panel de Gestión</span>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="relative">
                <button 
                  onClick={() => { setShowNotifPanel(!showNotifPanel); setHasNew(false); }}
                  className={`p-2.5 rounded-xl border transition-all relative ${hasNew ? 'bg-brand-50 border-brand-200 text-brand-600 animate-pulse' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                >
                  <Bell className="w-5 h-5" />
                  {hasNew && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>}
                </button>

                {showNotifPanel && (
                  <div className="absolute top-14 right-0 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-top-4 duration-300">
                     <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vouchers Recientes</span>
                        <button onClick={() => setNotifications([])} className="text-[9px] font-bold text-slate-300 hover:text-red-500 uppercase">Limpiar</button>
                     </div>
                     <div className="max-h-96 overflow-y-auto p-2 space-y-2">
                        {notifications.length === 0 ? (
                           <div className="py-10 text-center opacity-20 flex flex-col items-center gap-2"><Clock className="w-10 h-10"/><p className="text-[10px] font-black uppercase tracking-widest">Sin actividad</p></div>
                        ) : notifications.map(n => (
                           <div key={n.id} className="p-4 bg-white border border-slate-50 rounded-2xl hover:bg-slate-50 transition-colors flex gap-4">
                              <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center shrink-0 border border-brand-100">
                                 {n.voucher_url ? <img src={n.voucher_url} className="w-full h-full object-cover rounded-lg" /> : <ShoppingBag className="w-5 h-5 text-brand-500"/>}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <p className="text-[10px] font-black uppercase truncate">{n.cliente_nombre}</p>
                                 <p className="text-[11px] font-bold text-brand-600 mt-0.5">S/ {n.monto.toFixed(2)}</p>
                                 <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[8px] font-black px-2 py-0.5 bg-slate-100 rounded text-slate-400">{n.order_name}</span>
                                    {n.voucher_url && <a href={n.voucher_url} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline"><ExternalLink className="w-3 h-3"/></a>}
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
                )}
             </div>

             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-slate-500 hover:text-slate-800">
                <Menu className="w-6 h-6" />
             </button>
          </div>
        </div>
        
        <div className="p-4 md:p-0">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
