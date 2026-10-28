import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  RotateCcw,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { api } from '../api/client.js';
import { ForwardingJob, JobStatus } from '../types/index.js';
import { JobStatusBadge } from '../components/UI/StatusBadge.js';
import { useSocket } from '../context/SocketContext.js';

export const ActivityLogsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [inspectJob, setInspectJob] = useState<ForwardingJob | null>(null);
  const [isBulkRetryOpen, setIsBulkRetryOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery<{
    jobs: ForwardingJob[];
    pagination: { page: number; total: number; totalPages: number };
  }>({
    queryKey: ['activity-logs', selectedStatus, searchQuery, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedStatus !== 'ALL') params.set('status', selectedStatus);
      if (searchQuery) params.set('search', searchQuery);
      params.set('page', page.toString());
      params.set('limit', '25');
      return api.get(`/activity?${params.toString()}`);
    },
    refetchInterval: 10000,
  });

  // Listen for live forwarding events to keep log refreshed
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    };

    socket.on('forwarding:job-queued', handleUpdate);
    socket.on('forwarding:job-completed', handleUpdate);
    socket.on('forwarding:job-failed', handleUpdate);

    return () => {
      socket.off('forwarding:job-queued', handleUpdate);
      socket.off('forwarding:job-completed', handleUpdate);
      socket.off('forwarding:job-failed', handleUpdate);
    };
  }, [socket, queryClient]);

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.post(`/activity/${id}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      setInspectJob(null);
    },
  });

  const bulkRetryMutation = useMutation({
    mutationFn: () => api.post('/activity/bulk-retry', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      setIsBulkRetryOpen(false);
    },
  });

  const statusOptions = [
    { id: 'ALL', label: 'All Statuses' },
    { id: 'SENT', label: 'Delivered' },
    { id: 'QUEUED', label: 'Queued' },
    { id: 'PROCESSING', label: 'Processing' },
    { id: 'FAILED', label: 'Failed' },
    { id: 'RETRY_SCHEDULED', label: 'Retry Scheduled' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Message Activity & Delivery Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Audit trail of processed Community messages, retry histories, and provider receipts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsBulkRetryOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg shadow-sm"
          >
            <Layers className="w-3.5 h-3.5" />
            Bulk Retry Failed Jobs
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {statusOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                setSelectedStatus(opt.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedStatus === opt.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search text, sender or group..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4">Source Conversation</th>
                <th className="py-3 px-4">Target Destination</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Attempts</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {data?.jobs && data.jobs.length > 0 ? (
                data.jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(job.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {job.forwardingRule?.whatsappAccount?.displayName || 'Channel'}
                    </td>
                    <td className="py-3 px-4 max-w-[180px] truncate font-medium text-slate-800">
                      {job.incomingMessage?.sourceConversation?.name || 'Community Channel'}
                    </td>
                    <td className="py-3 px-4 max-w-[180px] truncate text-slate-600">
                      {job.destinationConversation?.name || 'Target Group'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {job.incomingMessage?.messageType || 'text'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <JobStatusBadge status={job.status} />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {job.attemptCount}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setInspectJob(job)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                          title="Inspect delivery payload and error details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {job.status !== 'SENT' && (
                          <button
                            onClick={() => retryMutation.mutate(job.id)}
                            disabled={retryMutation.isPending}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors"
                            title="Retry forwarding job"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    {isLoading ? 'Loading activity logs...' : 'No message delivery events matching filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Total {data.pagination.total} delivery jobs recorded</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {page} of {data.pagination.totalPages}
              </span>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspect Error / Details Modal */}
      {inspectJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Job Transmission Details</h3>
              <button onClick={() => setInspectJob(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400 block">Job ID:</span>
                  <span className="font-mono text-slate-800">{inspectJob.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Delivery Status:</span>
                  <JobStatusBadge status={inspectJob.status} />
                </div>
                <div>
                  <span className="text-slate-400 block">Idempotency Key:</span>
                  <span className="font-mono text-slate-600 truncate block">{inspectJob.idempotencyKey}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Provider Message ID:</span>
                  <span className="font-mono text-slate-800">{inspectJob.providerSentMessageId || 'Pending'}</span>
                </div>
              </div>

              {inspectJob.incomingMessage?.textBody && (
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">Incoming Message Body:</span>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs whitespace-pre-wrap text-slate-800">
                    {inspectJob.incomingMessage.textBody}
                  </div>
                </div>
              )}

              {inspectJob.errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                  <div className="font-bold flex items-center gap-1.5 mb-1 text-rose-700">
                    <AlertTriangle className="w-4 h-4" />
                    Technical Failure Diagnostic
                  </div>
                  <div className="font-mono text-xs whitespace-pre-wrap">{inspectJob.errorMessage}</div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setInspectJob(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
              {inspectJob.status !== 'SENT' && (
                <button
                  type="button"
                  onClick={() => retryMutation.mutate(inspectJob.id)}
                  disabled={retryMutation.isPending}
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
                >
                  Retry Forwarding Job Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Retry Confirmation Modal */}
      {isBulkRetryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Confirm Bulk Retry</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will re-enqueue up to 100 eligible failed or timed-out forwarding attempts into the queue worker.
              Are you sure you want to proceed?
            </p>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBulkRetryOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => bulkRetryMutation.mutate()}
                disabled={bulkRetryMutation.isPending}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
              >
                {bulkRetryMutation.isPending ? 'Re-queuing...' : 'Execute Bulk Retry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
