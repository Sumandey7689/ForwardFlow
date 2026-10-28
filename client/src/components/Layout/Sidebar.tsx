import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Smartphone,
  Users2,
  GitFork,
  Activity,
  FileText,
  Settings,
  UserCheck,
  LogOut,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

interface SidebarProps {
  connectedAccountsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ connectedAccountsCount = 0 }) => {
  const { logout } = useAuth();

  const navigation = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'WhatsApp Accounts', href: '/accounts', icon: Smartphone },
    { name: 'Communities & Groups', href: '/communities', icon: Users2 },
    { name: 'Forwarding Rules', href: '/rules', icon: GitFork },
    { name: 'Message Activity', href: '/activity', icon: Activity },
    { name: 'Delivery Logs', href: '/logs', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'Admin Profile', href: '/profile', icon: UserCheck },
  ];

  return (
    <aside className="w-64 bg-[#0A1128] text-slate-300 flex flex-col border-r border-slate-800 shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800/80 bg-[#070D1F]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
          <Zap className="w-5 h-5 fill-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white tracking-tight text-base font-sans">ForwardFlow</span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1 rounded">
              SaaS
            </span>
          </div>
          <p className="text-[11px] text-slate-400">WhatsApp Community Engine</p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Core Platform
        </div>
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </div>

      {/* Account Connection Status Pill */}
      <div className="p-3 mx-3 mb-3 rounded-xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Active Channels</span>
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {connectedAccountsCount} Connected
          </span>
        </div>
      </div>

      {/* Logout Footer */}
      <div className="p-3 border-t border-slate-800 bg-[#070D1F]">
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
