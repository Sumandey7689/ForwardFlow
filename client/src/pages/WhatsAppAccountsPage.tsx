import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Smartphone,
  Plus,
  RefreshCw,
  Trash2,
  Power,
  RotateCcw,
  QrCode,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { api } from '../api/client.js';
import { WhatsAppAccount } from '../types/index.js';
import { ConnectionStatusBadge } from '../components/UI/StatusBadge.js';
import { useSocket } from '../context/SocketContext.js';

export const WhatsAppAccountsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [provider, setProvider] = useState<'baileys' | 'mock'>('baileys');
  const [activeQrCode, setActiveQrCode] = useState<{ accountId: string; qr: string } | null>(null);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ accounts: WhatsAppAccount[] }>({
    queryKey: ['whatsapp-accounts'],
    queryFn: () => api.get<{ accounts: WhatsAppAccount[] }>('/whatsapp/accounts'),
  });

  // Listen for real-time QR code and connection updates
  useEffect(() => {
    if (!socket) return;

    const handleQr = (payload: { accountId: string; qrCode: string }) => {
      setActiveQrCode({ accountId: payload.accountId, qr: payload.qrCode });
    };

    const handleStatus = (payload: { accountId: string; status: string }) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      if (payload.status === 'CONNECTED') {
        setActiveQrCode(null);
        setIsAddModalOpen(false);
      }
    };

    socket.on('whatsapp:qr-code', handleQr);
    socket.on('whatsapp:connection-status', handleStatus);

    return () => {
      socket.off('whatsapp:qr-code', handleQr);
      socket.off('whatsapp:connection-status', handleStatus);
    };
  }, [socket, queryClient]);

  const createAccountMutation = useMutation({
    mutationFn: (payload: { displayName: string; provider: string }) =>
      api.post<{ account: WhatsAppAccount }>('/whatsapp/accounts', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      setDisplayName('');
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to create account');
    },
  });

  const syncConversationsMutation = useMutation({
    mutationFn: (accountId: string) =>
      api.post(`/whatsapp/accounts/${accountId}/sync`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      setSyncingAccountId(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Sync failed');
      setSyncingAccountId(null);
    },
  });

  const connectAccountMutation = useMutation({
    mutationFn: (accountId: string) =>
      api.post(`/whatsapp/accounts/${accountId}/connect`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
    },
  });

  const disconnectAccountMutation = useMutation({
    mutationFn: (accountId: string) =>
      api.post(`/whatsapp/accounts/${accountId}/disconnect`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (accountId: string) =>
      api.delete(`/whatsapp/accounts/${accountId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
    },
  });

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setErrorMessage(null);
    createAccountMutation.mutate({ displayName: displayName.trim(), provider });
  };

  const handleSync = (accountId: string) => {
    setSyncingAccountId(accountId);
    syncConversationsMutation.mutate(accountId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">WhatsApp Accounts</h1>
          <p className="text-sm text-slate-500 mt-1">
            Connect and manage multi-device WhatsApp sessions with isolated storage.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm shadow-emerald-600/20"
        >
          <Plus className="w-4 h-4" />
          Add WhatsApp Account
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-xs font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Account Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.accounts && data.accounts.length > 0 ? (
          data.accounts.map((acc) => (
            <div
              key={acc.id}
              className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-150 flex flex-col justify-between"
            >
              <div>
                {/* Top Row: Provider & Status */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    {acc.provider === 'baileys' ? 'Baileys Multi-Device' : 'Mock Simulator'}
                  </span>
                  <ConnectionStatusBadge status={acc.connectionStatus} />
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-base">{acc.displayName}</h3>
                    <p className="text-xs text-slate-400">
                      {acc.phoneNumber || 'Linked via Multi-Device QR'}
                    </p>
                  </div>
                </div>

                {/* Account Metrics */}
                <div className="grid grid-cols-3 gap-2 mt-5 py-3 border-y border-slate-100 text-center text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{acc._count?.conversations || 0}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Synced Chats</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">{acc._count?.forwardingRules || 0}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Active Rules</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">{acc._count?.incomingMessages || 0}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Messages</div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="mt-4 space-y-1 text-xs text-slate-500">
                  <div className="flex justify-between">
                    <span>Last Connected:</span>
                    <span className="font-medium text-slate-700">
                      {acc.lastConnectedAt ? new Date(acc.lastConnectedAt).toLocaleString() : 'Never'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Synced:</span>
                    <span className="font-medium text-slate-700">
                      {acc.lastSyncAt ? new Date(acc.lastSyncAt).toLocaleString() : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {acc.connectionStatus === 'CONNECTED' ? (
                    <>
                      <button
                        onClick={() => handleSync(acc.id)}
                        disabled={syncingAccountId === acc.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                        title="Synchronize groups and community conversations"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncingAccountId === acc.id ? 'animate-spin' : ''}`} />
                        Sync Chats
                      </button>
                      <button
                        onClick={() => disconnectAccountMutation.mutate(acc.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                        title="Disconnect active session"
                      >
                        <Power className="w-3.5 h-3.5" />
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => connectAccountMutation.mutate(acc.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Connect QR
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete "${acc.displayName}"? Session keys will be destroyed.`)) {
                      deleteAccountMutation.mutate(acc.id);
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Remove account and delete credentials"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <Smartphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No WhatsApp accounts connected</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Add your first WhatsApp account to monitor Community channels and forward announcements automatically.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add WhatsApp Account
            </button>
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Add WhatsApp Account</h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setActiveQrCode(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {activeQrCode ? (
              <div className="py-6 text-center space-y-4">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl inline-block shadow-inner">
                  <img
                    src={activeQrCode.qr}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 mx-auto rounded-lg"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-900">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Scan with WhatsApp on your phone
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Open WhatsApp &gt; Settings &gt; Linked Devices &gt; Link a Device and point your camera here.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateAccount} className="space-y-4 py-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Account Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Marketing Lead Phone / Primary Bot"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Integration Provider
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setProvider('baileys')}
                      className={`p-3 rounded-xl border text-left text-xs transition-all ${
                        provider === 'baileys'
                          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 font-semibold ring-1 ring-emerald-500'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="font-bold text-slate-900">Baileys MD</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Direct WebSockets (Production)</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProvider('mock')}
                      className={`p-3 rounded-xl border text-left text-xs transition-all ${
                        provider === 'mock'
                          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 font-semibold ring-1 ring-emerald-500'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="font-bold text-slate-900">Mock Sandbox</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">QA & Dev Testing</div>
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createAccountMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  >
                    {createAccountMutation.isPending ? 'Initializing...' : 'Generate Connection QR'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
