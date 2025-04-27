'use client'; // Keep this for potential client-side hooks

import React, { useState, use } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserLogin } from '@/components/UserLogin';
import UserCardsDisplay from '@/components/user-cards-display/UserCardsDisplay';
import type { UserCardData, GameState, UserSession, GameStateStat } from '@/types/index';
import axios from 'axios';
import { Container, Alert, Badge, Button } from 'react-bootstrap';

// API fetch function (always fetch as non-GM)
const fetchGameState = async (txid: string): Promise<GameState> => {
  // Use the environment variable for the API base URL
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  const url = `${apiUrl}/game-state/${txid}`; // Use absolute URL
  console.log(`Fetching game state from: ${url}`); // Log the absolute URL
  const { data } = await axios.get(url);
  // Ensure drawnNumbers is always an array, even if missing from response
  return { ...data, drawnNumbers: data.drawnNumbers || [] };
};

// Helper to get BINGO letter for a number
function getBingoLetter(num: number): string {
  if (num >= 1 && num <= 15) return 'B';
  if (num >= 16 && num <= 30) return 'I';
  if (num >= 31 && num <= 45) return 'N';
  if (num >= 46 && num <= 60) return 'G';
  if (num >= 61 && num <= 75) return 'O';
  return '?';
}

// Define props for the page, including txid
interface PlayPageProps {
  // params object itself might be a promise-like structure
  params: { 
     txid: string;
  }
}

// Use imported UserSession type
// interface UserSession { ... } // Removed local definition

// Update component definition to accept props
export default function PlayPage({ params }: PlayPageProps) {
  // Resolve params using the use() hook
  const resolvedParams = use(params); 
  const { txid } = resolvedParams; // Destructure txid from the resolved params
  
  const queryClient = useQueryClient();
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  // Define login handlers
  const handleLoginSuccess = (session: UserSession) => {
    setUserSession(session);
    setLoginError(null); 
  };
  const handleLoginError = (errorMsg: string) => {
    setLoginError(errorMsg);
    setUserSession(null);
  };
  const handleLogout = () => {
    setUserSession(null);
    setLoginError(null);
  };

  // --- TanStack Query Hook for Game State --- 
  const { 
    data: gameState, 
    error: gameStateError, 
    isLoading: isLoadingGameState 
  } = useQuery<GameState, Error>({
    queryKey: ['gameState', txid], 
    queryFn: () => fetchGameState(txid), 
    enabled: !!txid, 
    refetchInterval: 3000, 
    refetchIntervalInBackground: true,
  });

  if (!txid) {
    // This check might be less necessary with App Router structure
    return <Container><div className="p-4 text-red-500">Error: Transaction ID is missing.</div></Container>;
  }

  return (
    <Container className="py-4">
      <h1 className="text-3xl font-bold mb-4">bitBingo Game</h1>
      <p className="mb-1">Game Transaction ID: <strong>{txid}</strong></p>
      {loginError && (
         <Alert variant="danger" className="mt-3">Error: {loginError}</Alert>
      )}

      <div className="my-4 p-4 border rounded bg-gray-50">
        <h2 className="text-xl font-semibold mb-2">Game State</h2>
        {isLoadingGameState && <p>Loading game state...</p>}
        {gameStateError && <Alert variant="warning" className="mt-2">Error loading game state: {gameStateError.message}</Alert>}
        {gameState && (
          <div>
            <div className="mt-2">
              <strong>Drawn Numbers:</strong>
              {gameState.drawnNumbers && gameState.drawnNumbers.length > 0 ? (
                <div className="d-flex flex-wrap gap-2 mt-1">
                  {gameState.drawnNumbers.map((num: number, index: number) => (
                    <Badge pill bg="info" key={`${num}-${index}`} className="fs-6">
                      {getBingoLetter(num)}{num}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No numbers drawn yet.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {!userSession ? (
        <UserLogin
          onLoginSuccess={handleLoginSuccess}
          onLoginError={handleLoginError}
          txid={txid}
        />
      ) : (
        <div className="mt-4">
           <p className="mb-2">Logged in as: <strong>{userSession.nickname}</strong></p>
           <UserCardsDisplay 
              cards={userSession.cards} 
              drawnNumbers={gameState?.drawnNumbers || []} 
           />
           <Button 
              onClick={handleLogout}
              variant="secondary"
              className="mt-4"
           >
              Logout / Change Nickname
           </Button>
        </div>
      )}
    </Container>
  );
} 