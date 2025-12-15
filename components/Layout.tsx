import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  PieChart, 
  Settings, 
  LogOut, 
  TrendingUp, 
  ShoppingBag,
  Menu,
  Citrus,
  X
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  currentView: string;
  onNavigate: (view: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, onLogout, currentView, onNavigate }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const handleNavigate = (view: string) => {
    onNavigate(view);
    setIsMobileMenuOpen(false);
  };

  const NavItem = ({ view, icon: Icon, label }: { view: string, icon: any, label: string }) => (
    <button 
      onClick={() => handleNavigate(view)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
        currentView === view 
          ? 'bg-brand-500/10 text-brand-500 border border-brand-500/20 shadow-sm' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon className={`w-5 h-5 ${currentView === view ? 'text-brand-500' : 'text-slate-500 group-hover:text-white'}`} />
      <span className="font-condensed text-base tracking-wide">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 flex-col bg-slate-900 text-white transition-transform duration-300 ease-in-out shadow-xl
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 md:static md:flex md:h-screen
      `}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-brand-500 p-1.5 rounded-lg shadow-[0_0_15px_rgba(132,204,22,0.3)]">
              <Citrus className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <h2 className="font-bold text-xl leading-none tracking-tight">LEMON BI</h2>
              <p className="text-[10px] text-brand-400 font-medium tracking-wide mt-1">INTEGRADO CON ODOO</p>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="font-condensed text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-3 mt-2">
            Principal
          </div>
          
          <NavItem view="general" icon={LayoutDashboard} label="Dashboard General" />
          <NavItem view="rentabilidad" icon={TrendingUp} label="Rentabilidad" />

          <div className="font-condensed text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-3 mt-6">
            Gestión
          </div>

          <NavItem view="ventas" icon={ShoppingBag} label="Ventas y Pedidos" />
          <NavItem view="reportes" icon={PieChart} label="Reportes Gráficos" />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors mb-1">
            <Settings className="w-5 h-5" />
            <span className="font-condensed text-base tracking-wide">Configuración</span>
          </button>
          
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-condensed text-base tracking-wide">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 transition-all w-full h-screen overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-2">
            <Citrus className="w-6 h-6 text-brand-500" />
            <span className="font-bold text-lg">LEMON BI</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-slate-300 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {children}
      </main>
    </div>
  );
};

export default Layout;