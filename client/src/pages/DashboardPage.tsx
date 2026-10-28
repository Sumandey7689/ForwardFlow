import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Smartphone,
  CheckCircle2,
  GitFork,
  MessageSquare,
  Send,
  AlertTriangle,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../api/client.js';
import { DashboardStats, ForwardingRule } from '../types/index.js';
import { SafetyBanner } from '../components/Common/SafetyBanner.js';
import { JobStatusBadge } from '../components/UI/StatusBadge.js';
import { useSocket } from '../context/SocketContext.js';

export const DashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const { data, isLoading, refetch } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get<DashboardStats>('/activity/stats'),
    refetchInterval: 10000,
  });

  const { data: rulesData } = useQuery<{ rules: ForwardingRule[] }>({
    queryKey: ['forwarding-rules'],
    queryFn: () => api.get<{ rules: ForwardingRule[] }>('/forwarding-rules'),
  });

  // Listen to live Socket.IO events to update dashboard in real time
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['forwarding-rules'] });
    };

    socket.on('forwarding:message-received', handleUpdate);
    socket.on('forwarding:job-completed', handleUpdate);
    socket.on('forwarding:job-failed', handleUpdate);
    socket.on('whatsapp:connection-status', handleUpdate);

    return () => {
      socket.off('forwarding:message-received', handleUpdate);
      socket.off('forwarding:job-completed', handleUpdate);
      socket.off('forwarding:job-failed', handleUpdate);
      socket.off('whatsapp:connection-status', handleUpdate);
    };
  }, [socket, queryClient]);

  const metrics = data?.metrics || {
    totalAccounts: 0,
    connectedAccounts: 0,
    activeRules: 0,
    messagesReceivedToday: 0,
    forwardingAttemptsToday: 0,
    failedAttemptsToday: 0,
    successRate: 100,
  };

  const statCards = [
    {
      label: 'Total WhatsApp Accounts',
      value: metrics.totalAccounts,
      icon: Smartphone,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      link: '/accounts',
    },
    {
      label: 'Connected Channels',
      value: metrics.connectedAccounts,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      link: '/accounts',
    },
    {
      label: 'Active Forwarding Rules',
      value: metrics.activeRules,
      icon: GitFork,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
      link: '/rules',
    },
    {
      label: 'Received Today',
      value: metrics.messagesReceivedToday,
      icon: MessageSquare,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      border: 'border-teal-100',
      link: '/activity',
    },
    {
      label: 'Forwarding Attempts',
      value: metrics.forwardingAttemptsToday,
      icon: Send,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      border: 'border-sky-100',
      link: '/activity',
    },
    {
      label: 'Failed Attempts',
      value: metrics.failedAttemptsToday,
      icon: AlertTriangle,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-100',
      link: '/logs',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Platform Overview</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time monitoring of WhatsApp Communities, rules and message delivery pipelines.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to="/rules/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            New Forwarding Rule
          </Link>
        </div>
      </div>

      {/* Safety Notice Banner */}
      <SafetyBanner />

      {/* 6 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            to={card.link}
            className={`p-4 rounded-xl bg-white border ${card.border} shadow-sm hover:shadow-md transition-all duration-150 group`}
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-lg ${card.bg} ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900">{card.value}</div>
              <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{card.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* 24-Hour Analytics & Success Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Forwarding Volume (Past 24 Hours)</h2>
              <p className="text-xs text-slate-500 mt-0.5">Live message throughput across active accounts</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Received
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Forwarded
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Failed
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.hourlyActivity || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorForwarded" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="received" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReceived)" />
                <Area type="monotone" dataKey="forwarded" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorForwarded)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Success Rate & Quick Health */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Delivery Reliability</h2>
            <p className="text-xs text-slate-500 mt-0.5">Overall successful forwarding ratio</p>

            <div className="my-6 text-center">
              <div className="text-5xl font-extrabold text-slate-900 tracking-tight">
                {metrics.successRate}%
              </div>
              <div className="mt-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> High Delivery Health
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-4 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Successful Forwardings</span>
                <span className="font-semibold text-slate-900">
                  {Math.max(0, metrics.forwardingAttemptsToday - metrics.failedAttemptsToday)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Failed / Retried</span>
                <span className="font-semibold text-rose-600">{metrics.failedAttemptsToday}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Deduplication Prevention</span>
                <span className="font-semibold text-emerald-600">Active (Idempotent)</span>
              </div>
            </div>
          </div>

          <Link
            to="/rules/new"
            className="w-full mt-6 py-2.5 text-center text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
          >
            Configure Rules & Destinations →
          </Link>
        </div>
      </div>

      {/* Bottom Grid: Recent Activity & Active Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Forwarding Activity Stream */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Live Forwarding Activity</h2>
              <p className="text-xs text-slate-500 mt-0.5">Incoming Community events and transmission outcomes</p>
            </div>
            <Link to="/activity" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
              View All Logs →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 font-medium">
                  <th className="pb-3">Source Conversation</th>
                  <th className="pb-3">Destination</th>
                  <th className="pb-3">Message Type</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data?.recentJobs && data.recentJobs.length > 0 ? (
                  data.recentJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 font-medium text-slate-900 max-w-[180px] truncate">
                        {job.incomingMessage?.sourceConversation?.name || 'Community Channel'}
                      </td>
                      <td className="py-3 text-slate-600 max-w-[180px] truncate">
                        {job.destinationConversation?.name || 'Target Group'}
                      </td>
                      <td className="py-3">
                        <span className="uppercase text-[10px] font-semibold tracking-wider px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                          {job.incomingMessage?.messageType || 'text'}
                        </span>
                      </td>
                      <td className="py-3">
                        <JobStatusBadge status={job.status} />
                      </td>
                      <td className="py-3 text-right text-slate-400">
                        {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No forwarding activity recorded yet. Create an account and rule to begin monitoring!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Rules Overview */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Forwarding Rules</h2>
              <p className="text-xs text-slate-500 mt-0.5">Active automations</p>
            </div>
            <Link to="/rules" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
              Manage →
            </Link>
          </div>

          <div className="space-y-3">
            {rulesData?.rules && rulesData.rules.length > 0 ? (
              rulesData.rules.slice(0, 5).map((rule) => (
                <div
                  key={rule.id}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-900 truncate max-w-[170px]">
                      {rule.name}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        rule.enabled
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {rule.enabled ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                    <span className="text-slate-700 font-medium">{rule.sourceConversation.name}</span>
                    <span>→</span>
                    <span>{rule.destinations.length} destination(s)</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                No active forwarding rules.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
