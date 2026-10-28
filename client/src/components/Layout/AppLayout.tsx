import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { Navbar } from './Navbar.js';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { WhatsAppAccount } from '../../types/index.js';

export const AppLayout: React.FC = () => {
  const { data: accountsData } = useQuery<{ accounts: WhatsAppAccount[] }>({
    queryKey: ['whatsapp-accounts'],
    queryFn: () => api.get<{ accounts: WhatsAppAccount[] }>('/whatsapp/accounts'),
    refetchInterval: 15000,
  });

  const connectedAccountsCount =
    accountsData?.accounts?.filter((a) => a.connectionStatus === 'CONNECTED').length || 0;

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans">
      <Sidebar connectedAccountsCount={connectedAccountsCount} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
