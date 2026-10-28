import React, { useState } from 'react';
import { ShieldAlert, X, ExternalLink } from 'lucide-react';

export const SafetyBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative mb-6 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50/90 via-amber-50 to-orange-50/60 p-4 text-amber-900 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="flex-1 text-sm">
          <div className="flex items-center gap-2 font-semibold text-amber-950">
            <span>Platform Compliance & WhatsApp Terms Advisory</span>
            <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-800">
              Important Notice
            </span>
          </div>
          <p className="mt-1 text-amber-800/90 leading-relaxed text-xs">
            Unofficial WhatsApp automation libraries (such as Baileys) communicate via reverse-engineered Multi-Device Web protocols.
            WhatsApp may update its backend protocols or enforce restrictions on high-frequency automated accounts.
            To protect your numbers, adhere to realistic rate limits, forward only to authorized internal groups, and avoid unsolicited bulk spam.
          </p>
          <div className="mt-2 flex items-center gap-4 text-xs font-medium text-amber-900">
            <span className="inline-flex items-center gap-1 hover:underline cursor-pointer">
              Recommended forwarding intervals: 3-5 seconds
            </span>
            <span className="text-amber-400">•</span>
            <span className="inline-flex items-center gap-1 hover:underline cursor-pointer">
              Only post to verified admin destinations
            </span>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-200/50 hover:text-amber-900 transition-colors"
          title="Dismiss advisory"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
