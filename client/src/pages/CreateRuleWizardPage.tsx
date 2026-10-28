import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Smartphone,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  ShieldAlert,
  Clock,
  Sparkles,
  Sliders,
  Send,
} from 'lucide-react';
import { api } from '../api/client.js';
import { WhatsAppAccount, Conversation } from '../types/index.js';
import { ConversationTypeBadge } from '../components/UI/StatusBadge.js';

export const CreateRuleWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<number>(1);
  const [ruleName, setRuleName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(searchParams.get('accountId') || '');
  const [selectedSourceId, setSelectedSourceId] = useState<string>(searchParams.get('sourceId') || '');
  const [selectedDestinationIds, setSelectedDestinationIds] = useState<string[]>(
    searchParams.get('destId') ? [searchParams.get('destId')!] : []
  );

  // Behavior configuration
  const [messageTypes, setMessageTypes] = useState({
    text: true,
    image: true,
    video: true,
    audio: true,
    document: true,
  });

  const [formatting, setFormatting] = useState({
    includeSourceLabel: true,
    forwardSenderName: false,
    includePrefix: false,
    prefixText: '⚡ [COMMUNITY UPDATE]',
    includeSuffix: false,
    suffixText: '',
    preserveCaptions: true,
  });

  const [schedule, setSchedule] = useState({
    allDay: true,
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    startTime: '08:00',
    endTime: '22:00',
    timezone: 'UTC',
  });

  const [retry, setRetry] = useState({
    maxRetries: 3,
    backoffMs: 5000,
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  // Fetch accounts
  const { data: accountsData } = useQuery<{ accounts: WhatsAppAccount[] }>({
    queryKey: ['whatsapp-accounts'],
    queryFn: () => api.get<{ accounts: WhatsAppAccount[] }>('/whatsapp/accounts'),
  });

  const accounts = accountsData?.accounts || [];

  // Default to first connected account if none selected
  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      const connected = accounts.find((a) => a.connectionStatus === 'CONNECTED');
      if (connected) setSelectedAccountId(connected.id);
      else setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  // Fetch conversations for selected account
  const { data: convData } = useQuery<{ conversations: Conversation[] }>({
    queryKey: ['conversations', selectedAccountId],
    queryFn: () => api.get<{ conversations: Conversation[] }>(`/whatsapp/accounts/${selectedAccountId}/conversations`),
    enabled: Boolean(selectedAccountId),
  });

  const conversations = convData?.conversations || [];

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const selectedSource = conversations.find((c) => c.id === selectedSourceId);
  const selectedDestinations = conversations.filter((c) => selectedDestinationIds.includes(c.id));

  // Mutation to create rule
  const createRuleMutation = useMutation({
    mutationFn: (payload: any) => api.post('/forwarding-rules', payload),
    onSuccess: () => {
      navigate('/rules');
    },
    onError: (err: any) => {
      setValidationError(err.message || 'Failed to save forwarding rule');
    },
  });

  const handleNext = () => {
    setValidationError(null);

    if (step === 1) {
      if (!selectedAccountId) {
        setValidationError('Please select a connected WhatsApp account to proceed.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!selectedSourceId) {
        setValidationError('Please select a source conversation or announcement feed.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (selectedDestinationIds.length === 0) {
        setValidationError('Please select at least one destination conversation.');
        return;
      }
      setStep(4);
    } else if (step === 4) {
      if (!ruleName.trim()) {
        const defaultName = `${selectedSource?.name || 'Source'} → ${selectedDestinations.length} Destination(s)`;
        setRuleName(defaultName);
      }
      setStep(5);
    }
  };

  const handleSaveRule = () => {
    const finalRuleName = ruleName.trim() || `${selectedSource?.name} → Forward Flow`;
    createRuleMutation.mutate({
      name: finalRuleName,
      whatsappAccountId: selectedAccountId,
      sourceConversationId: selectedSourceId,
      destinationConversationIds: selectedDestinationIds,
      messageTypes,
      formatting,
      schedule,
      retry,
      enabled: true,
    });
  };

  const toggleDestination = (id: string) => {
    if (selectedDestinationIds.includes(id)) {
      setSelectedDestinationIds(selectedDestinationIds.filter((d) => d !== id));
    } else {
      setSelectedDestinationIds([...selectedDestinationIds, id]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Wizard Progress Stepper */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between text-xs font-semibold">
          {[
            { num: 1, title: 'WhatsApp Account' },
            { num: 2, title: 'Source Feed' },
            { num: 3, title: 'Destinations' },
            { num: 4, title: 'Behavior & Filters' },
            { num: 5, title: 'Review & Activate' },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s.num
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-4 ring-emerald-50'
                    : step > s.num
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span className={`hidden sm:inline ${step === s.num ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {validationError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Step Content */}
      <div className="p-8 rounded-2xl bg-white border border-slate-200/80 shadow-sm min-h-[420px] flex flex-col justify-between">
        {/* STEP 1: SELECT ACCOUNT */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Step 1: Select WhatsApp Account</h2>
              <p className="text-xs text-slate-500 mt-1">
                Choose the connected WhatsApp account that will monitor the source feed and dispatch messages.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedAccountId === acc.id
                      ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20 shadow-sm'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {acc.provider}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        acc.connectionStatus === 'CONNECTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {acc.connectionStatus}
                    </span>
                  </div>
                  <div className="mt-2 font-bold text-slate-900 text-sm">{acc.displayName}</div>
                  <div className="text-xs text-slate-400 mt-0.5 font-mono">
                    {acc.phoneNumber || 'Multi-Device QR Linked'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: SELECT SOURCE */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Step 2: Select Source Conversation</h2>
              <p className="text-xs text-slate-500 mt-1">
                Select the Community announcement feed or group whose incoming messages should be monitored.
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedSourceId(conv.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    selectedSourceId === conv.id
                      ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20 shadow-sm'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        selectedSourceId === conv.id
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedSourceId === conv.id && <Check className="w-2.5 h-2.5" />}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{conv.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{conv.providerConversationId}</div>
                    </div>
                  </div>
                  <ConversationTypeBadge type={conv.conversationType} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: SELECT DESTINATIONS */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Step 3: Select Destination Conversations</h2>
              <p className="text-xs text-slate-500 mt-1">
                Choose one or more target groups, announcement channels, or Communities. Source conversation is disabled to prevent infinite loops.
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {conversations.map((conv) => {
                const isSource = conv.id === selectedSourceId;
                const isDisabled = isSource;
                const isSelected = selectedDestinationIds.includes(conv.id);

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      if (!isDisabled) toggleDestination(conv.id);
                    }}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                      isDisabled
                        ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
                        : isSelected
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20 cursor-pointer shadow-sm'
                        : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => {}}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 pointer-events-none"
                      />
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{conv.name}</div>
                        <div className="text-xs text-slate-400 font-mono">
                          {isSource ? '⚠️ Source conversation (Loop prevention)' : conv.providerConversationId}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {conv.conversationType === 'COMMUNITY' && (
                        <span
                          className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200"
                          title="Forwarded messages will automatically be routed into this Community's official announcement feed"
                        >
                          Community Broadcast
                        </span>
                      )}
                      {conv.conversationType === 'COMMUNITY_ANNOUNCEMENT' && conv.capabilityMetadata?.isAdmin && (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Admin Verified
                        </span>
                      )}
                      <ConversationTypeBadge type={conv.conversationType} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4: CONFIGURE BEHAVIOR */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Step 4: Configure Forwarding Behavior</h2>
              <p className="text-xs text-slate-500 mt-1">
                Customize message types, custom headers, source attribution, and operating hours.
              </p>
            </div>

            {/* Rule Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Rule Name
              </label>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="e.g. VIP Announcements -> Regional Team Groups"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Message Types */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Permitted Message Types
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                {Object.keys(messageTypes).map((type) => (
                  <label
                    key={type}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer capitalize ${
                      (messageTypes as any)[type]
                        ? 'bg-emerald-50/50 border-emerald-300 font-semibold text-emerald-950'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>{type}</span>
                    <input
                      type="checkbox"
                      checked={(messageTypes as any)[type]}
                      onChange={(e) =>
                        setMessageTypes({ ...messageTypes, [type]: e.target.checked })
                      }
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Formatting & Labels */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Formatting & Source Attribution
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formatting.includeSourceLabel}
                    onChange={(e) =>
                      setFormatting({ ...formatting, includeSourceLabel: e.target.checked })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>
                    <strong>Include Source Label</strong> (e.g. <em>📌 Forwarded from: Community</em>)
                  </span>
                </label>

                <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formatting.forwardSenderName}
                    onChange={(e) =>
                      setFormatting({ ...formatting, forwardSenderName: e.target.checked })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>
                    <strong>Include Sender Name</strong> (e.g. <em>👤 Sender: Alex</em>)
                  </span>
                </label>
              </div>

              {/* Custom Prefix */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 mb-1">
                  <input
                    type="checkbox"
                    checked={formatting.includePrefix}
                    onChange={(e) =>
                      setFormatting({ ...formatting, includePrefix: e.target.checked })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Add custom broadcast prefix header</span>
                </label>
                {formatting.includePrefix && (
                  <input
                    type="text"
                    value={formatting.prefixText}
                    onChange={(e) => setFormatting({ ...formatting, prefixText: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="⚡ [OFFICIAL BROADCAST]"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW & ACTIVATE */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Step 5: Review & Activate Rule</h2>
              <p className="text-xs text-slate-500 mt-1">
                Please verify your forwarding rule specifications before activating live monitoring.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-500">Rule Name:</span>
                <span className="font-bold text-slate-900 text-sm">{ruleName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-500">WhatsApp Account:</span>
                <span className="font-bold text-slate-900">{selectedAccount?.displayName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-500">Source Conversation:</span>
                <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                  {selectedSource?.name}
                </span>
              </div>
              <div className="py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-500 block mb-1">Destination Conversations:</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDestinations.map((d) => (
                    <span key={d.id} className="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                      {d.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-semibold text-slate-500">Source Attribution Header:</span>
                <span className="font-medium text-slate-800">
                  {formatting.includeSourceLabel ? 'Enabled (📌 Forwarded from)' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>
          ) : (
            <div></div>
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveRule}
              disabled={createRuleMutation.isPending}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-lg shadow-emerald-600/30 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {createRuleMutation.isPending ? 'Activating Rule...' : 'Save & Activate Forwarding Rule'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
