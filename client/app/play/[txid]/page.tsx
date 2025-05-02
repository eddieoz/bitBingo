'use client'; // Keep this for potential client-side hooks

import React, { useState, use } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserLogin } from '../../../src/components/UserLogin';
import UserCardsDisplay from '../../../src/components/user-cards-display/UserCardsDisplay';
import type { UserCardData, GameState, UserSession, GameStateStat, WinnerInfo } from '@/types/index';
import axios from 'axios';
import { Container, Alert, Badge, Button } from 'react-bootstrap';
import { UserSession } from '@/types'; // Ensure UserSession is imported

// API fetch function (always fetch as non-GM)
const fetchGameState = async (txid: string): Promise<GameState> => {
  // Use the environment variable for the API base URL (assume it's the base, like http://localhost:5000)
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'; // Default is BASE url
  const url = `${baseUrl}/api/game-state/${txid}`; // Explicitly add /api path
  console.log(`Fetching game state from: ${url}`); // Log the absolute URL
  const { data } = await axios.get(url);
  // Parse all expected fields, providing defaults
  return { 
      drawnNumbers: data.drawnNumbers || [], 
      drawIndex: data.drawIndex ?? 0, // Add drawIndex, default to 0 if missing
      isOver: data.isOver || false,
      gameMode: data.gameMode || 'fullCardOnly', // Default if missing
      partialWinOccurred: data.partialWinOccurred || false,
      partialWinners: data.partialWinners || null,
      fullCardWinners: data.fullCardWinners || null,
      // Add other fields if needed by the component, e.g., status, lastDrawTime
      status: data.status || 'unknown',
      lastDrawTime: data.lastDrawTime || null,
      statistics: data.statistics || '', // Include stats even though player page doesn't show them?
      winners: null // Explicitly return null for optional 'winners' field
  };
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

// Use imported UserSession type
// interface UserSession { ... } // Removed local definition

// Update component definition to accept props
export default function PlayPage({ params }: { params: { txid: string } }) {
  const { txid } = params;
  
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

  // Find if user is among final winners (full or partial if game ended)
  const finalWinners = gameState?.isOver ? (gameState.fullCardWinners || gameState.partialWinners) : null;
  const currentUserFinalWinnerInfo = userSession && finalWinners
    ? finalWinners.find(winner => winner.username.toLowerCase() === userSession.nickname.toLowerCase())
    : null;

  // Find if user is among partial winners (if game hasn't ended)
  const currentUserPartialWinnerInfo = userSession && !gameState?.isOver && gameState?.partialWinOccurred && gameState.partialWinners
    ? gameState.partialWinners.find(winner => winner.username.toLowerCase() === userSession.nickname.toLowerCase())
    : null;

  // Determine the sequence to highlight (prioritize final win, then partial)
  let winningSequence: (number | null)[] | null = null;
  if (currentUserFinalWinnerInfo) {
    if (typeof currentUserFinalWinnerInfo.sequence !== 'string') {
      winningSequence = currentUserFinalWinnerInfo.sequence as (number | null)[];
    }
  } else if (currentUserPartialWinnerInfo) {
    winningSequence = currentUserPartialWinnerInfo.sequence as (number | null)[];
  }

  // Filter out nulls for the prop, as UserCardsDisplay expects number[] | null
  const sequenceForProp = winningSequence ? winningSequence.filter((n): n is number => n !== null) : null;

  if (!txid) {
    // This check might be less necessary with App Router structure
    return <Container><div className="p-4 text-red-500">Error: Transaction ID is missing.</div></Container>;
  }

  return (
    <Container className="py-4">
      <h1 className="text-3xl font-bold mb-4">bitBingo Game</h1>
      <p className="mb-1">Game Transaction ID: <strong>{txid}</strong></p>

      {/* --- FINAL Winner Announcement Banner --- */}
      {gameState?.isOver && (gameState.fullCardWinners || gameState.partialWinners) && (
        <Alert variant="success" className="mt-3 mb-4">
          <Alert.Heading className="text-center">Game Over!</Alert.Heading>
          <hr />
          {/* Display Partial Winners if they exist */} 
          {gameState.partialWinners && gameState.partialWinners.length > 0 && (
              <div className="mb-3 text-center">
                  <p className="mb-1"><strong>Partial Winner{gameState.partialWinners.length > 1 ? 's' : ''} (Line Win):</strong></p>
                  {gameState.partialWinners.map((winner, index) => (
                    <div key={`p-${index}`} className="small">
                      <span>{winner.username} (Card: {winner.cardId}) - Sequence: {winner.sequence.map(n => n === null ? 'FREE' : n).join(', ')}</span>
                    </div>
                  ))}
              </div>
          )}
          {/* Display Full Card Winners if they exist */} 
          {gameState.fullCardWinners && gameState.fullCardWinners.length > 0 && (
              <div className="text-center">
                  <p className="mb-1"><strong>Full Card Winner{gameState.fullCardWinners.length > 1 ? 's' : ''}:</strong></p>
                  {gameState.fullCardWinners.map((winner, index) => (
                    <div key={`f-${index}`} className="small">
                       <span>{winner.username} (Card: {winner.cardId}) - Sequence: {winner.sequence}</span>
                    </div>
                  ))}
              </div>
          )}
        </Alert>
      )}

      {/* --- PARTIAL Winner Announcement Banner --- */}
      {!gameState?.isOver && gameState?.partialWinOccurred && gameState?.partialWinners && gameState.partialWinners.length > 0 && (
        <Alert variant="warning" className="mt-3 mb-4">
          <Alert.Heading className="text-center">Partial Win Detected!</Alert.Heading>
          <hr />
          {gameState.partialWinners?.map((winner, index) => { 
            const sequenceStr = winner.sequence.map(n => n === null ? 'FREE' : n).join(', ');
            return (
              <div key={index} className="mb-2 text-center">
                <p className="mb-0"><strong>{winner.username}</strong> (Card ID: {winner.cardId})</p>
                <small className="text-muted">Winning Sequence: {sequenceStr}</small>
              </div>
            );
          })}
          <hr />
          <p className="text-center mb-0">The game continues towards a Full Card win!</p>
        </Alert>
      )}

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
              winningSequence={sequenceForProp}
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