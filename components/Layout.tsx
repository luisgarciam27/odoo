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
}

const Layout: React.FC<LayoutProps> = ({ children, onLogout }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-white fixed h-full z-10 transition-all">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-emerald-500 p-1.5 rounded-lg">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">Analytics</h2>
            <p className="text-xs text-slate-400">for Odoo ERP</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3 mt-2">
            Principal
          </div>
          
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 bg-emerald-600/10 text-emerald-400 rounded-lg border border-emerald-600/20">
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Dashboard General</span>
          </a>

          <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <TrendingUp className="w-5 h-5" />
            <span className="font-medium">Rentabilidad</span>
          </a>

          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3 mt-6">
            Gestión
          </div>

          <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <ShoppingBag className="w-5 h-5" />
            <span className="font-medium">Ventas</span>
          </a>

          <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <PieChart className="w-5 h-5" />
            <span className="font-medium">Reportes</span>
          </a>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors mb-2">
            <Settings className="w-5 h-5" />
            <span className="font-medium">Configuración</span>
          </a>
          
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 transition-all">
        {/* Mobile Header */}
        <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-20">
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