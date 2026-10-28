import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  GitFork,
  Plus,
  Play,
  Pause,
  Trash2,
  ArrowRight,
  Clock,
  CheckCircle2,
  MessageSquare,
  Image,
  Video,
  FileText,
  Volume2,
} from 'lucide-react';
import { api } from '../api/client.js';
import { ForwardingRule } from '../types/index.js';
import { ConversationTypeBadge } from '../components/UI/StatusBadge.js';

export const ForwardingRulesPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ rules: ForwardingRule[] }>({
    queryKey: ['forwarding-rules'],
    queryFn: () => api.get<{ rules: ForwardingRule[] }>('/forwarding-rules'),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/forwarding-rules/${id}/activate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forwarding-rules'] }),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/forwarding-rules/${id}/pause`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forwarding-rules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/forwarding-rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forwarding-rules'] }),
  });

  const rules = data?.rules || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Forwarding Rules</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure automated message delivery routing from sources to destination conversations.
          </p>
        </div>
        <Link
          to="/rules/new"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm shadow-emerald-600/20"
        >
          <Plus className="w-4 h-4" />
          Create Forwarding Rule
        </Link>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules.length > 0 ? (
          rules.map((rule) => (
            <div
              key={rule.id}
              className={`p-6 rounded-2xl bg-white border transition-all duration-150 shadow-sm hover:shadow-md ${
                rule.enabled ? 'border-slate-200/80' : 'border-slate-200 bg-slate-50/50 opacity-80'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Rule Title & State */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-slate-900">{rule.name}</h3>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        rule.enabled
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {rule.enabled ? 'Active Engine' : 'Paused'}
                    </span>
                    <span className="text-xs text-slate-400">
                      Account: <strong className="text-slate-700">{rule.whatsappAccount.displayName}</strong>
                    </span>
                  </div>

                  {/* Flow: Source -> Destinations */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-emerald-950 font-medium">
                      <span className="text-[10px] uppercase font-bold text-emerald-700">Source:</span>
                      <span>{rule.sourceConversation.name}</span>
                      <ConversationTypeBadge type={rule.sourceConversation.conversationType} />
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

                    <div className="flex flex-wrap items-center gap-1.5">
                      {rule.destinations.map((dest) => (
                        <div
                          key={dest.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50/80 border border-blue-200 text-blue-950 font-medium"
                        >
                          <span className="text-[10px] uppercase font-bold text-blue-700">Target:</span>
                          <span>{dest.destinationConversation.name}</span>
                          <ConversationTypeBadge type={dest.destinationConversation.conversationType} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-3 self-end lg:self-center">
                  <button
                    onClick={() => {
                      if (rule.enabled) {
                        pauseMutation.mutate(rule.id);
                      } else {
                        activateMutation.mutate(rule.id);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      rule.enabled
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    {rule.enabled ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        Pause Rule
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Activate Rule
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Delete rule "${rule.name}"?`)) {
                        deleteMutation.mutate(rule.id);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

                {/* Configurations Overview Chips */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-600">Permitted Media:</span>
                    <div className="flex items-center gap-1">
                      {rule.messageTypeConfiguration.text && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">Text</span>
                      )}
                      {rule.messageTypeConfiguration.image && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">Images</span>
                      )}
                      {rule.messageTypeConfiguration.video && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">Video</span>
                      )}
                      {rule.messageTypeConfiguration.document && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">Docs</span>
                      )}
                      {rule.messageTypeConfiguration.audio && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">Audio</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {rule.formattingConfiguration.includeSourceLabel && (
                      <span className="flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Source Label
                      </span>
                    )}
                    {rule.scheduleConfiguration.allDay ? (
                      <span className="flex items-center gap-1 text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> 24/7 Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-700 font-medium">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        {rule.scheduleConfiguration.startTime} - {rule.scheduleConfiguration.endTime}
                      </span>
                    )}
                  </div>
                </div>
            </div>
          ))
        ) : (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <GitFork className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No forwarding rules configured</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Create an automatic forwarding rule to pipe messages from Community announcement feeds directly into your target groups.
            </p>
            <Link
              to="/rules/new"
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Forwarding Rule
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
