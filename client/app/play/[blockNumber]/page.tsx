// Player page: Enter nickname to view cards for a specific block

'use client';

import React, { useState, useEffect } from 'react';
import { UserLogin } from '@/components/user-login/UserLogin'; // Adjust path as needed
import { UserCardsDisplay } from '@/components/user-cards-display/UserCardsDisplay'; // Adjust path
import type { CsvRow, UserCardContext } from '@/lib/types'; // Adjust path
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useParams } from 'next/navigation'; // Use this hook for App Router

// Create a TanStack Query client
const queryClient = new QueryClient();

// Helper to fetch CSV data (replace with actual implementation)
async function fetchCsvData(blockNumber: string | number): Promise<CsvRow[]> {
  console.log(`Fetching CSV data for block ${blockNumber}...`);
  // TODO: Implement actual fetching logic.
  // This might involve fetching the IPFS CID associated with the block
  // and then fetching the content from IPFS.
  // For now, return mock data.
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate fetch
  return [
    { name: 'Alice' },
    { name: 'Bob' },
    { name: 'Alice' },
    { name: 'Charlie' },
    { name: 'Alice' },
    { name: 'Dave' },
  ];
}

export default function PlayerPage() {
  const params = useParams();
  const blockNumber = params?.blockNumber as string | undefined;

  const [csvData, setCsvData] = useState<CsvRow[] | null>(null);
  const [csvLoading, setCsvLoading] = useState(true);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [userContext, setUserContext] = useState<UserCardContext | null>(null);

  useEffect(() => {
    if (blockNumber) {
      setCsvLoading(true);
      fetchCsvData(blockNumber)
        .then(data => {
          setCsvData(data);
          setCsvError(null);
        })
        .catch(err => {
          console.error("Error fetching CSV data:", err);
          setCsvError('Failed to load participant list.');
          setCsvData(null);
        })
        .finally(() => {
          setCsvLoading(false);
        });
    } else {
      setCsvError('Block number not found in URL.');
      setCsvLoading(false);
    }
  }, [blockNumber]);

  const handleCardsReady = (context: UserCardContext) => {
    setUserContext(context);
  };

  if (csvLoading) {
    return <div className="p-4">Loading participant list...</div>; // TODO: Use Skeleton
  }

  if (csvError) {
    return <div className="p-4 text-red-500">Error: {csvError}</div>;
  }

  if (!csvData || !blockNumber) {
    return <div className="p-4 text-red-500">Error: Missing data or block number.</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-4">bitBingo Player View</h1>
        <p className="mb-4">Viewing game associated with Block: <strong>{blockNumber}</strong></p>

        {!userContext ? (
          <UserLogin
            csvData={csvData}
            blockNumberParam={blockNumber}
            onCardsReady={handleCardsReady}
          />
        ) : (
          <UserCardsDisplay
            nickname={userContext.nickname}
            blockHash={userContext.blockHash}
            indices={userContext.indices}
          />
        )}

        {/* Optional: Add button to go back/reset */} 
        {userContext && (
             <button 
                onClick={() => setUserContext(null)}
                className="mt-4 bg-gray-500 text-white p-2 rounded"
             >
                Check Another Nickname
             </button>
        )}
      </div>
    </QueryClientProvider>
  );
} 