import React from 'react';
import { 
  LayoutDashboard, 
  PieChart, 
  Settings, 
  LogOut, 
  TrendingUp, 
  ShoppingBag,
  Menu
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  currentView: string;
  onNavigate: (view: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, onLogout, currentView, onNavigate }) => {
  
  const NavItem = ({ view, icon: Icon, label }: { view: string, icon: any, label: string }) => (
    <button 
      onClick={() => onNavigate(view)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
        currentView === view 
          ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/20 shadow-sm' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon className={`w-5 h-5 ${currentView === view ? 'text-emerald-400' : 'text-slate-500 group-hover:text-white'}`} />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-white fixed h-full z-10 transition-all shadow-xl">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-emerald-500 p-1.5 rounded-lg shadow-lg shadow-emerald-500/20">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight tracking-tight">Analytics</h2>
            <p className="text-xs text-slate-400">for Odoo ERP</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-3 mt-2">
            Principal
          </div>
          
          <NavItem view="general" icon={LayoutDashboard} label="Dashboard General" />
          <NavItem view="rentabilidad" icon={TrendingUp} label="Rentabilidad" />

          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-3 mt-6">
            Gestión
          </div>

          <NavItem view="ventas" icon={ShoppingBag} label="Ventas y Pedidos" />
          <NavItem view="reportes" icon={PieChart} label="Reportes Gráficos" />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors mb-1">
            <Settings className="w-5 h-5" />
            <span className="font-medium text-sm">Configuración</span>
          </button>
          
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 transition-all w-full">
        {/* Mobile Header */}
        <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-emerald-500" />
            <span className="font-bold">Odoo Analytics</span>
          </div>
          <button className="text-slate-300 hover:text-white">
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {children}
      </main>
    </div>
  );
};

export default Layout;