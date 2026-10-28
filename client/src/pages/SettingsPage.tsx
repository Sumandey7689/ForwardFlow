import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  UserCheck,
  Shield,
  Key,
  Database,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { admin, updateProfile } = useAuth();

  const [name, setName] = useState(admin?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      await updateProfile({
        name,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });

      setStatusMessage({ type: 'success', text: 'Admin profile updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Platform Settings & Security</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage administrator credentials, inspect WhatsApp provider architecture, and review security policies.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Admin Profile Form */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Administrator Profile</h2>
            <p className="text-xs text-slate-500">Update account name and change login credentials</p>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-xl text-xs">
          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              disabled
              value={admin?.email || ''}
              className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Email cannot be changed directly for security audit reasons.
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Administrator Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <span className="font-bold text-slate-800 text-xs block">Change Password (Optional)</span>

            <div>
              <label className="block text-slate-600 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Required only if changing password"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Provider Evaluation & Technical Comparison */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">WhatsApp Integration Architecture Evaluation</h2>
            <p className="text-xs text-slate-500">Technical comparison of WhatsApp library mechanisms and trade-offs</p>
          </div>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="pb-2.5">Provider Engine</th>
                <th className="pb-2.5">Connection Model</th>
                <th className="pb-2.5">Memory Usage</th>
                <th className="pb-2.5">Community & Announcements Support</th>
                <th className="pb-2.5">Suitability Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-3 font-bold text-slate-900">Baileys (Active Fork)</td>
                <td className="py-3 font-mono text-slate-600">Direct WebSocket (Multi-Device)</td>
                <td className="py-3 font-mono text-emerald-700">~35-50 MB / account</td>
                <td className="py-3 text-emerald-700 font-medium">Full groupFetchAllParticipating & Community parent/announcement metadata</td>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">
                    Selected (Default)
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-slate-900">whatsapp-web.js</td>
                <td className="py-3 font-mono text-slate-600">Headless Chrome / Puppeteer</td>
                <td className="py-3 font-mono text-rose-700">~450-800 MB / account</td>
                <td className="py-3 text-slate-600">Basic group support; high crash frequency under load</td>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-600">
                    Evaluated (Heavy)
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-slate-900">Official Cloud API</td>
                <td className="py-3 font-mono text-slate-600">Meta Graph REST / Webhooks</td>
                <td className="py-3 font-mono text-emerald-700">Stateless REST</td>
                <td className="py-3 text-rose-600 font-medium">Unsupported: cannot join organic Communities or read user group chats</td>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-rose-100 text-rose-800">
                    Not Viable for Groups
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Encryption & Security Status */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
          <Lock className="w-4 h-4 text-emerald-600" />
          <span>Security & Session Protection Safeguards</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          - <strong>AES-256-GCM Session Encryption:</strong> All persistent WhatsApp credentials, authorization tokens, and session references are encrypted at rest using an environment master secret key.
          <br />
          - <strong>Account Tenant Isolation:</strong> Every account maintains isolated filesystem credentials and dedicated WebSocket state to prevent cross-account pollution.
          <br />
          - <strong>HTTP-Only Secure Cookies:</strong> Admin authentication tokens are safeguarded against cross-site scripting (XSS).
        </p>
      </div>
    </div>
  );
};
