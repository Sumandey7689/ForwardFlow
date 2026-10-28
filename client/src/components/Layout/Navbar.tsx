import React from 'react';
import { Search, Bell, Radio, Shield, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useSocket } from '../../context/SocketContext.js';

interface NavbarProps {
  onSearch?: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = () => {
  const { admin } = useAuth();
  const { isConnected } = useSocket();

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between shrink-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
      {/* Global Search Bar */}
      <div className="flex items-center w-96 relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          type="text"
          placeholder="Search accounts, rules, community groups..."
          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Real-time Socket Live Status */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
            isConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
          title={isConnected ? 'Live WebSocket channel active' : 'Connecting to live socket...'}
        >
          <Radio className={`w-3.5 h-3.5 ${isConnected ? 'animate-pulse text-emerald-500' : 'text-amber-500'}`} />
          <span>{isConnected ? 'Real-Time Sync Active' : 'Connecting Socket'}</span>
        </div>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"></span>
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-200"></div>

        {/* Admin Profile Details */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center text-white text-xs font-semibold shadow-sm">
            {admin?.name?.charAt(0) || 'A'}
          </div>
          <div className="hidden md:block text-left">
            <div className="text-sm font-semibold text-slate-800 leading-none">
              {admin?.name || 'Administrator'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 leading-none">
              {admin?.email || 'admin@forwardflow.io'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
