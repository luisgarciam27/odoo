
import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Store, 
  ShoppingBag, 
  ShoppingCart,
  Palette,
  PackageSearch,
  X,
  Menu,
  Citrus,
  LogOut,
  Bell,
  PieChart,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Percent
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  currentView: string;
  onNavigate: (view: string) => void;
  showStoreLink?: boolean;
  clientCode?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, onLogout, currentView, onNavigate, showStoreLink }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const NavItem = ({ view, icon: Icon, label }: { view: string, icon: any, label: string }) => (
    <button 
      onClick={() => { onNavigate(view); setIsMobileMenuOpen(false); }}
      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all mb-1.5 group ${
        currentView === view 
          ? 'bg-brand-500 text-white font-black shadow-lg shadow-brand-500/20' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
      title={isCollapsed ? label : ''}
    >
      <Icon className={`w-5 h-5 shrink-0 ${currentView === view ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'}`} />
      {!isCollapsed && <span className="text-[11px] uppercase tracking-widest truncate">{label}</span>}
    </button>
  );

  return (
    <div className="min-h-screen flex font-sans text-slate-800 bg-[#F8FAFC]">
      
      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-100 flex flex-col transition-all duration-500 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
        ${isCollapsed ? 'md:w-24' : 'md:w-72'}
      `}>
        <div className={`p-8 flex items-center justify-between transition-all ${isCollapsed ? 'justify-center' : ''}`}>
           <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 bg-brand-500 rounded-2xl flex items-center justify-center shadow-xl shadow-brand-500/20 shrink-0">
                 <Citrus className="w-6 h-6 text-white" />
              </div>
              {!isCollapsed && <h1 className="font-black text-xl tracking-tighter text-slate-900 animate-in fade-in">LEMON<span className="text-brand-600">BI</span></h1>}
           </div>
           <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400"><X/></button>
           
           <button 
             onClick={() => setIsCollapsed(!isCollapsed)}
             className="hidden md:flex absolute -right-4 top-10 bg-white border border-slate-100 p-2 rounded-full shadow-md text-slate-400 hover:text-brand-500 hover:scale-110 transition-all z-[60]"
           >
             {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
           </button>
        </div>

        <nav className={`flex-1 px-5 overflow-y-auto no-scrollbar ${isCollapsed ? 'items-center' : ''}`}>
           {!isCollapsed && <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4 px-4 mt-4 animate-in fade-in">Analítica POS</div>}
           <NavItem view="general" icon={LayoutDashboard} label="Dashboard" />
           <NavItem view="rentabilidad" icon={Percent} label="Rentabilidad" />
           <NavItem view="comparativa" icon={Store} label="Sedes y Cajas" />
           <NavItem view="ventas" icon={ShoppingBag} label="Ventas" />
           <NavItem view="reportes" icon={BarChart3} label="Reportes" />
           
           {showStoreLink && (
             <>
               {!isCollapsed && <div className="text-[9px] font-black text-brand-400 uppercase tracking-[0.3em] mb-4 px-4 mt-8 animate-in fade-in">Tienda Online</div>}
               <NavItem view="store" icon={ShoppingCart} label="Ver Tienda" />
               <NavItem view="product-manager" icon={PackageSearch} label="Productos" />
               <NavItem view="store-config" icon={Palette} label="Configurar" />
             </>
           )}
        </nav>

        <div className="p-6 border-t border-slate-50">
           <button onClick={onLogout} className={`w-full flex items-center gap-4 px-4 py-4 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all ${isCollapsed ? 'justify-center' : ''}`}>
              <LogOut className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span className="text-[11px] font-black uppercase tracking-widest">Cerrar Sesión</span>}
           </button>
        </div>
      </aside>

      <main className={`
        flex-1 h-screen overflow-y-auto transition-all duration-500 ease-in-out
        ${isCollapsed ? 'md:pl-24' : 'md:pl-72'}
      `}>
         <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 py-6 px-8 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-3 bg-slate-50 rounded-xl text-slate-900"><Menu size={20}/></button>
                <div className="hidden md:block">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Smart Business Intelligence</p>
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest mt-0.5">
                        {currentView === 'general' ? 'Dashboard Ejecutivo' : 
                         currentView === 'rentabilidad' ? 'Análisis de Rentabilidad' :
                         currentView === 'store' ? 'Punto de Venta Web' : 'Panel de Gestión'}
                    </h2>
                </div>
            </div>
            
            <div className="flex items-center gap-6">
               <div className="hidden sm:flex items-center gap-3 px-5 py-2.5 bg-slate-50 rounded-full border border-slate-100">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sincronizado</span>
               </div>
               <button className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-brand-50 hover:text-brand-500 transition-all relative">
                  <Bell className="w-5 h-5"/>
               </button>
            </div>
         </header>

         <div className="animate-in fade-in duration-700">
            {children}
         </div>
      </main>

      {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}
    </div>
  );
};

export default Layout;
