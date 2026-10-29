import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users2,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  RefreshCw,
  Plus,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../api/client.js';
import { WhatsAppAccount, Conversation, ConversationType } from '../types/index.js';
import { ConversationTypeBadge } from '../components/UI/StatusBadge.js';

export const CommunitiesBrowserPage: React.FC = () => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: accountsData } = useQuery<{ accounts: WhatsAppAccount[] }>({
    queryKey: ['whatsapp-accounts'],
    queryFn: () => api.get<{ accounts: WhatsAppAccount[] }>('/whatsapp/accounts'),
  });

  const accounts = accountsData?.accounts || [];
  const currentAccountId = selectedAccountId || accounts[0]?.id || '';

  const { data: convData, isLoading, refetch } = useQuery<{
    conversations: Conversation[];
    pagination: { total: number };
  }>({
    queryKey: ['conversations', currentAccountId, selectedType, searchQuery],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedType !== 'ALL') params.set('type', selectedType);
      if (searchQuery) params.set('search', searchQuery);
      return api.get(`/whatsapp/accounts/${currentAccountId}/conversations?${params.toString()}`);
    },
    enabled: Boolean(currentAccountId),
  });

  const typeTabs = [
    { id: 'ALL', label: 'All Conversations' },
    { id: 'COMMUNITY', label: 'Communities (Parent)' },
    { id: 'COMMUNITY_ANNOUNCEMENT', label: '📢 Announcements' },
    { id: 'COMMUNITY_GROUP', label: 'Linked Groups' },
    { id: 'GROUP', label: 'Regular Groups' },
    { id: 'INDIVIDUAL', label: '👤 Personal Numbers' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Communities & Groups</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse discovered WhatsApp Communities, announcement feeds, and group conversations.
          </p>
        </div>

        {/* Account Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Account:</label>
          <select
            value={currentAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="px-3 py-2 text-sm font-medium bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.displayName} ({acc.connectionStatus})
              </option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            title="Refresh conversations list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Verified Capability Advisory Card */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs leading-relaxed flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-blue-950">Verified Community Architecture Notice: </span>
          WhatsApp Communities consist of a parent container, a designated announcement feed, and linked member groups.
          Messages cannot be sent directly to the parent Community container. Announcement feeds accept posts only from account administrators.
          The capabilities below reflect actual verified permissions.
        </div>
      </div>

      {/* Filters & Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            {typeTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedType(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedType === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversation..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="pb-3 px-3">Conversation Name</th>
                <th className="pb-3 px-3">Type</th>
                <th className="pb-3 px-3">Participants</th>
                <th className="pb-3 px-3">Source Capable</th>
                <th className="pb-3 px-3">Destination Capable</th>
                <th className="pb-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {convData?.conversations && convData.conversations.length > 0 ? (
                convData.conversations.map((conv) => (
                  <tr key={conv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900 text-sm">{conv.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-xs">
                        {conv.providerConversationId}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <ConversationTypeBadge type={conv.conversationType} />
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-600">
                      {conv.capabilityMetadata?.participantCount ? (
                        <span>{conv.capabilityMetadata.participantCount} members</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        Monitored Source
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {conv.conversationType === 'COMMUNITY' ? (
                        <span
                          className="inline-flex items-center gap-1 text-indigo-700 font-medium bg-indigo-50 px-2 py-0.5 rounded text-[11px] border border-indigo-200"
                          title="Forwarded messages route directly into this Community's official announcement feed"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-indigo-500" />
                          Community Broadcast
                        </span>
                      ) : conv.canSendMessages ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          Permitted Destination
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-slate-700 font-medium bg-slate-100 px-2 py-0.5 rounded text-[11px]"
                          title={conv.capabilityMetadata?.providerNote || 'Destination'}
                        >
                          Destination
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          to={`/rules/new?accountId=${currentAccountId}&sourceId=${conv.id}`}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                        >
                          Use as Source
                        </Link>
                        <Link
                          to={`/rules/new?accountId=${currentAccountId}&destId=${conv.id}`}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                        >
                          Use as Dest
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2 text-slate-500">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                        Loading conversations...
                      </div>
                    ) : (
                      'No conversations discovered. Click "Sync Chats" on your connected WhatsApp account.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
