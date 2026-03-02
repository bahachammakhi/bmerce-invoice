'use client';

import { api } from '@/lib/trpc';
import { useSession } from 'next-auth/react';

export default function DebugPage() {
  const { data: session, status } = useSession();
  const { data: sessionDebug, error } = api.debug.getSession.useQuery();
  const { data: clients } = api.clients.getAll.useQuery();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Debug Page</h1>
      
      <div className="space-y-6">
        <div className="border p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">NextAuth Session</h2>
          <p><strong>Status:</strong> {status}</p>
          {session && (
            <div>
              <p><strong>User ID:</strong> {session.user?.id}</p>
              <p><strong>Email:</strong> {session.user?.email}</p>
              <p><strong>Name:</strong> {session.user?.name}</p>
              <p><strong>Role:</strong> {session.user?.role}</p>
            </div>
          )}
        </div>

        <div className="border p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">tRPC Session Debug</h2>
          {error && <p className="text-red-500">Error: {error.message}</p>}
          {sessionDebug && (
            <div>
              <p><strong>Session User ID:</strong> {sessionDebug.sessionUserId}</p>
              <p><strong>Session Email:</strong> {sessionDebug.sessionUserEmail}</p>
              <p><strong>Session Name:</strong> {sessionDebug.sessionUserName}</p>
              <p><strong>Session Role:</strong> {sessionDebug.sessionUserRole}</p>
            </div>
          )}
        </div>

        <div className="border p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Clients Data</h2>
          {clients ? (
            <div>
              <p><strong>Client Count:</strong> {clients.length}</p>
              {clients.map((client: any) => (
                <div key={client.id} className="ml-4">
                  <p>• {client.name} ({client.email})</p>
                </div>
              ))}
            </div>
          ) : (
            <p>Loading clients...</p>
          )}
        </div>
      </div>
    </div>
  );
}