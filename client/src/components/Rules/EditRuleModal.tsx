import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Save,
  Trash2,
  Plus,
  Phone,
  Clock,
  ArrowRight,
  Repeat,
  Inbox,
  Send,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { api } from '../../api/client.js';
import { ForwardingRule, Conversation } from '../../types/index.js';
import { ConversationTypeBadge } from '../UI/StatusBadge.js';

interface EditRuleModalProps {
  rule: ForwardingRule | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditRuleModal: React.FC<EditRuleModalProps> = ({
  rule,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  // Form State
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<'RECEIVED' | 'SENT' | 'BOTH'>('BOTH');
  const [bidirectional, setBidirectional] = useState(false);
  const [enabled, setEnabled] = useState(true);

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
    prefixText: '⚡ [UPDATE]',
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

  const [currentDestinations, setCurrentDestinations] = useState<Conversation[]>([]);
  const [newPhoneInput, setNewPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sync state when rule opens
  useEffect(() => {
    if (rule) {
      setName(rule.name || '');
      setDirection((rule.direction as any) || 'BOTH');
      setBidirectional(Boolean(rule.bidirectional));
      setEnabled(rule.enabled);

      if (rule.messageTypeConfiguration) {
        setMessageTypes({
          text: rule.messageTypeConfiguration.text ?? true,
          image: rule.messageTypeConfiguration.image ?? true,
          video: rule.messageTypeConfiguration.video ?? true,
          audio: rule.messageTypeConfiguration.audio ?? true,
          document: rule.messageTypeConfiguration.document ?? true,
        });
      }

      if (rule.formattingConfiguration) {
        setFormatting({
          includeSourceLabel: rule.formattingConfiguration.includeSourceLabel ?? true,
          forwardSenderName: rule.formattingConfiguration.forwardSenderName ?? false,
          includePrefix: rule.formattingConfiguration.includePrefix ?? false,
          prefixText: rule.formattingConfiguration.prefixText || '⚡ [UPDATE]',
          includeSuffix: rule.formattingConfiguration.includeSuffix ?? false,
          suffixText: rule.formattingConfiguration.suffixText || '',
          preserveCaptions: rule.formattingConfiguration.preserveCaptions ?? true,
        });
      }

      if (rule.scheduleConfiguration) {
        setSchedule({
          allDay: rule.scheduleConfiguration.allDay ?? true,
          activeDays: rule.scheduleConfiguration.activeDays || [0, 1, 2, 3, 4, 5, 6],
          startTime: rule.scheduleConfiguration.startTime || '08:00',
          endTime: rule.scheduleConfiguration.endTime || '22:00',
          timezone: rule.scheduleConfiguration.timezone || 'UTC',
        });
      }

      const destConvs = rule.destinations?.map((d) => d.destinationConversation) || [];
      setCurrentDestinations(destConvs);
      setNewPhoneInput('');
      setPhoneError(null);
      setSubmitError(null);
    }
  }, [rule, isOpen]);

  // Mutation to update rule
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!rule) throw new Error('No rule selected');
      if (currentDestinations.length === 0) {
        throw new Error('At least one destination conversation or phone number is required');
      }

      return api.patch<{ rule: ForwardingRule }>(`/forwarding-rules/${rule.id}`, {
        name: name.trim() || rule.name,
        direction,
        bidirectional,
        enabled,
        destinationConversationIds: currentDestinations.map((d) => d.id),
        messageTypes,
        formatting,
        schedule,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forwarding-rules'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setSubmitError(err.message || 'Failed to update rule');
    },
  });

  const handleAddPhoneNumber = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPhoneInput.trim() || !rule) return;
    setPhoneError(null);

    const parts = newPhoneInput.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;

    try {
      const res = await api.post<{ conversations: Conversation[] }>(
        `/whatsapp/accounts/${rule.whatsappAccountId}/custom-numbers`,
        { phoneNumbers: parts }
      );

      if (res.conversations && res.conversations.length > 0) {
        const existingIds = new Set(currentDestinations.map((d) => d.id));
        const toAdd = res.conversations.filter((c) => !existingIds.has(c.id));
        setCurrentDestinations([...currentDestinations, ...toAdd]);
      }
      setNewPhoneInput('');
    } catch (err: any) {
      setPhoneError(err.message || 'Failed to add phone number');
    }
  };

  const handleRemoveDestination = (id: string) => {
    if (currentDestinations.length <= 1) {
      setSubmitError('A rule must have at least one destination.');
      return;
    }
    setCurrentDestinations(currentDestinations.filter((d) => d.id !== id));
  };

  if (!isOpen || !rule) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Edit Forwarding Rule</h2>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  enabled
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {enabled ? 'Active' : 'Paused'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Source: <span className="font-semibold text-slate-700">{rule.sourceConversation?.name}</span> ({rule.whatsappAccount?.displayName})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Rule Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Rule Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VIP Announcements -> Regional Team Groups"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium"
            />
          </div>

          {/* FORWARDING DIRECTION (Send, Received, Both) */}
          <div className="space-y-2.5 p-4 rounded-xl bg-gradient-to-br from-emerald-50/40 via-white to-slate-50 border border-emerald-100">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Message Direction & Trigger Filter
                </label>
                <p className="text-[11px] text-slate-500">
                  Select which messages to forward: received from others, sent by you, or both.
                </p>
              </div>
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200">
                Direction
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Option 1: BOTH */}
              <div
                onClick={() => setDirection('BOTH')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  direction === 'BOTH'
                    ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-600/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    direction === 'BOTH' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Repeat className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-slate-900 text-xs">Both (All)</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Forward messages sent by you <span className="font-semibold text-emerald-700">AND</span> received from others.
                </p>
              </div>

              {/* Option 2: RECEIVED */}
              <div
                onClick={() => setDirection('RECEIVED')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  direction === 'RECEIVED'
                    ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-600/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    direction === 'RECEIVED' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Inbox className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-slate-900 text-xs">Received Only</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Only forward incoming messages received from other contacts.
                </p>
              </div>

              {/* Option 3: SENT */}
              <div
                onClick={() => setDirection('SENT')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  direction === 'SENT'
                    ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-600/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    direction === 'SENT' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Send className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-slate-900 text-xs">Sent Only</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Only forward messages you send from your phone/WhatsApp.
                </p>
              </div>
            </div>

            {/* TWO-WAY / BIDIRECTIONAL FORWARDING */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer shadow-2xs">
                <input
                  type="checkbox"
                  checked={bidirectional}
                  onChange={(e) => setBidirectional(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 mt-0.5"
                />
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Two-Way Forwarding (Bidirectional)</span>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                      Sync Replies
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Automatically forward messages and replies arriving in the Destination conversation(s) back to the Source conversation.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* ACTIVE STATUS TOGGLE */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="font-bold text-slate-900 text-xs">Rule Status</span>
              <p className="text-[11px] text-slate-500">
                Pause or activate this rule in the real-time background worker.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                enabled ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* CURRENT DESTINATIONS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Configured Destinations ({currentDestinations.length})
              </label>
              <span className="text-[10px] text-slate-400">At least one required</span>
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {currentDestinations.map((dest) => (
                <div
                  key={dest.id}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    {dest.conversationType === 'INDIVIDUAL' ? (
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    ) : null}
                    <span className="font-semibold text-slate-800">{dest.name}</span>
                    <ConversationTypeBadge type={dest.conversationType} />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveDestination(dest.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Remove destination"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Quick Add Personal Destination (+91) */}
            <form onSubmit={handleAddPhoneNumber} className="flex gap-2 pt-1">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                  +91
                </div>
                <input
                  type="text"
                  value={newPhoneInput}
                  onChange={(e) => {
                    setNewPhoneInput(e.target.value);
                    if (phoneError) setPhoneError(null);
                  }}
                  placeholder="Add 10-digit number (e.g. 9876543210)"
                  className="w-full pl-11 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={!newPhoneInput.trim()}
                className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1 shadow-xs disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Number
              </button>
            </form>
            {phoneError && (
              <p className="text-[11px] text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {phoneError}
              </p>
            )}
          </div>

          {/* PERMITTED MESSAGE TYPES */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Permitted Message Types
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              {Object.keys(messageTypes).map((type) => (
                <label
                  key={type}
                  className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer capitalize ${
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
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* FORMATTING & ATTRIBUTION */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Formatting & Attribution
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formatting.includeSourceLabel}
                  onChange={(e) =>
                    setFormatting({ ...formatting, includeSourceLabel: e.target.checked })
                  }
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>Include Source Label (📌 *Forwarded from*)</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formatting.forwardSenderName}
                  onChange={(e) =>
                    setFormatting({ ...formatting, forwardSenderName: e.target.checked })
                  }
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>Include Sender Name (👤 *Sender*)</span>
              </label>
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 mb-1">
                <input
                  type="checkbox"
                  checked={formatting.includePrefix}
                  onChange={(e) =>
                    setFormatting({ ...formatting, includePrefix: e.target.checked })
                  }
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                <span>Custom Prefix Header</span>
              </label>
              {formatting.includePrefix && (
                <input
                  type="text"
                  value={formatting.prefixText}
                  onChange={(e) =>
                    setFormatting({ ...formatting, prefixText: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate()}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
