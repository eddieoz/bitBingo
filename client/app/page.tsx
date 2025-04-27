'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Row, Col, Card, Alert, Spinner } from 'react-bootstrap'; // Added Alert, Spinner
// Assuming bootstrap CSS is imported globally in layout.tsx
// import 'bootstrap/dist/css/bootstrap.min.css'; 
import '../src/App.css'; // Adjust path to App.css
import FileUpload from '../src/components/FileUpload'; // Adjust path
import RaffleStatus from '../src/components/RaffleStatus'; // Adjust path
import TransactionCreator from '../src/components/TransactionCreator'; // Adjust path
import Footer from '../src/components/Footer'; // Adjust path
import axios from 'axios';
import GameStateDisplay from '../src/components/GameStateDisplay'; // Adjust path
import DrawNumberButton from '../src/components/DrawNumberButton'; // Adjust path

// Ensure NEXT_PUBLIC_ prefix for client-side access in Next.js
// --- CHANGED API_URL Definition ---
// const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'; // Old
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'; // New - Base URL only

// --- Define Interface for Raffle State --- 
interface RaffleState {
  fileUploaded: boolean;
  fileHash: string | null;
  participantCount: number;
  txId: string | null;
  txConfirmed: boolean;
  blockHash: string | null;
  ipfsHash: string | null;
  participantFilename: string | null;
  loading: boolean;
  error: string | null;
}

// Renamed AdminPage to HomePage or just export default function
export default function AdminHomePage() { // Renamed back to default export 
  console.log('Rendering FULL AdminHomePage...'); // ADDED/CHANGED log
  const [raffleState, setRaffleState] = useState<RaffleState>({
    fileUploaded: false,
    fileHash: null,
    participantCount: 0,
    txId: null,
    txConfirmed: false,
    blockHash: null,
    ipfsHash: null,
    participantFilename: null,
    loading: false,
    error: null,
  });
  
  const [gmToken, setGmToken] = useState<string | null>(null); // Added type annotation
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winners, setWinners] = useState<string[]>([]);
  const [statistics, setStatistics] = useState<string>('');
  const [isLoadingDraw, setIsLoadingDraw] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null); // Separate error for polling
  const pollingIntervalId = useRef<NodeJS.Timeout | null>(null); // Ref for interval ID

  // --- GM Token Check Effect (Run once on mount or when txId changes) --- 
  useEffect(() => {
      if (raffleState.txId) {
          // Reuse function from PlayPage or define inline
          const getStoredGmToken = (txid: string): string | null => {
              try {
                  const tokens = JSON.parse(localStorage.getItem('gmTokens') || '{}');
                  return tokens[txid] || null;
              } catch (e) {
                  console.error("Error reading GM tokens from localStorage:", e);
                  return null;
              }
          };
          const storedToken = getStoredGmToken(raffleState.txId);
          if (storedToken) {
              console.log(`Found stored GM token for ${raffleState.txId}. Setting GM token.`);
              setGmToken(storedToken);
          } else {
              console.log(`No stored GM token for ${raffleState.txId}.`);
              setGmToken(null); // Ensure it's null if not found
          }
      }
  }, [raffleState.txId]);

  // --- Polling Logic --- 
  const stopPolling = useCallback(() => {
    if (pollingIntervalId.current) {
      console.log('Stopping polling.');
      clearInterval(pollingIntervalId.current);
      pollingIntervalId.current = null;
    }
  }, []); // No dependencies needed for stopPolling

  const fetchCurrentGameState = useCallback(async (currentTxId: string) => {
     // Removed check: if (!raffleState.txId) return;
     if (!currentTxId) return; // Check passed txId directly
    
    const url = `${API_URL}/api/game-state/${currentTxId}`; 
    console.log('Polling game state:', url);
    setPollingError(null); // Clear previous polling errors
    // Removed loading state from old gameState structure

    try {
      const response = await axios.get(url);
      const { drawnNumbers: newDrawnNumbers, isOver: newIsGameOver, winners: newWinners, statistics: newStatistics } = response.data;

      setDrawnNumbers(newDrawnNumbers || []);
      setStatistics(newStatistics || '');

      if (newIsGameOver) {
        console.log('Game is over. Winners:', newWinners);
        setIsGameOver(true);
        setWinners(newWinners || []);
        stopPolling(); // Stop polling once game is over
      } else {
        // Ensure game over state is reset if backend somehow reverts it
        setIsGameOver(false);
        setWinners([]);
      }
      
    } catch (error: any) {
      console.error('Error polling game state:', error);
      // Ensure we get a string, default to generic message
      let errorMsg = 'Failed to fetch game state';
      if (error.response?.data?.message && typeof error.response.data.message === 'string') {
        errorMsg = error.response.data.message;
      } else if (error.message && typeof error.message === 'string') {
        errorMsg = error.message;
      } else if (typeof error === 'string') {
          errorMsg = error;
      } // If it's still an object, errorMsg remains the default string

      setPollingError(errorMsg);
      // Consider stopping polling on certain errors (e.g., 404 Not Found)
      if (error.response?.status === 404) {
          console.log('Polling stopped due to 404 error.');
          stopPolling();
      }
      // Clear state if game not found?
      // setDrawnNumbers([]); setStatistics(''); setIsGameOver(false); setWinners([]);
    }
  }, [stopPolling]); // Depends on stopPolling callback

  const startPolling = useCallback((txid: string) => {
      if (!txid || pollingIntervalId.current) return; // Don't start if no txid or already polling
      stopPolling(); // Clear any existing interval
      console.log(`Starting polling for ${txid}`);
      fetchCurrentGameState(txid); // Fetch immediately
      pollingIntervalId.current = setInterval(() => fetchCurrentGameState(txid), 2000);
  }, [fetchCurrentGameState, stopPolling]); // Depends on fetch/stop callbacks

  // --- Effect to Start/Stop Polling Based on txId --- 
  useEffect(() => {
    if (raffleState.txId) {
      startPolling(raffleState.txId);
    } else {
      stopPolling();
      // Reset game state when txId is cleared
      setDrawnNumbers([]);
      setIsGameOver(false);
      setWinners([]);
      setStatistics('');
      setPollingError(null);
    }
    // Cleanup function to stop polling when component unmounts or txId changes
    return () => stopPolling(); 
  }, [raffleState.txId, startPolling, stopPolling]); // Include start/stop in dependencies

  const handleFileUploadSuccess = (data: { filename: string, message: string }) => { // More specific type for data
     console.log('File upload successful, API response:', data);
     setRaffleState(prevState => ({
      ...prevState,
      fileUploaded: true,
      participantFilename: data.filename,
      // Remove attempts to set hash/count from this response
      fileHash: null, // Explicitly set back to null if needed, or just don't touch
      participantCount: 0, // Explicitly set back to 0 if needed, or just don't touch
      ipfsHash: null // Explicitly set back to null if needed, or just don't touch
    }));
    // Log state *after* setting it (React state updates might be async)
    // Better to log inside useEffect or rely on the render log
  };

  const handleTransactionCreated = (data: { txId: string }) => { // Added type
     setRaffleState(prevState => ({
      ...prevState,
      txId: data.txId
    }));
  };

  const handleTransactionConfirmed = (data: { txid: string, blockHash: string, gmToken?: string }) => { 
     console.log('Transaction confirmed with blockHash:', data.blockHash);
     setRaffleState(prevState => ({
      ...prevState,
      txConfirmed: true,
      blockHash: data.blockHash
      // Note: txId should already be set by handleTransactionCreated
    }));

    // --- Store the token if received (means new game initialized) --- 
    // Use data.txid directly, as raffleState.txId might be stale
    if (data.gmToken && data.txid) { 
        console.log(`Received initial GM Token from confirmation: ${data.gmToken.substring(0,4)}... Storing for txid ${data.txid}.`);
        try {
            const tokens = JSON.parse(localStorage.getItem('gmTokens') || '{}');
            tokens[data.txid] = data.gmToken; // Use data.txid as key
            localStorage.setItem('gmTokens', JSON.stringify(tokens));
            // Also set the state immediately for the first draw
            setGmToken(data.gmToken); 
        } catch (e) {
            console.error("Error storing initial GM token in localStorage:", e);
        }
    }
  };
  
  // checkTransactionStatus might not be needed if TransactionCreator handles checks
  // const checkTransactionStatus = ...

  const handleDrawNumber = async () => {
      if (!raffleState.txId) { 
        console.error('Cannot draw number: Missing txId.');
        setPollingError('Cannot draw number: Missing txId.'); // Use pollingError state
        return;
      }
      
      // --- NEW: Check if game over or draw loading ---
      if (isLoadingDraw || isGameOver) {
          console.log('Draw attempt blocked:', { isLoadingDraw, isGameOver });
          return; 
      }

      setIsLoadingDraw(true); // Set loading true
      setPollingError(null); // Clear previous errors
      
      const headers: { Authorization?: string } = {};
      if (gmToken) {
          headers.Authorization = `Bearer ${gmToken}`;
          console.log('Sending draw request with GM Token.');
      } else {
          console.log('Sending first draw request (no GM Token).');
      }
      
      try {
        const response = await axios.post(
          `${API_URL}/api/draw/${raffleState.txId}`, 
          null, 
          { headers: headers } 
        );
        console.log('Draw successful:', response.data);
        // Immediately fetch game state ONLY if the draw didn't end the game
        if (!response.data.isOver) {
             fetchCurrentGameState(raffleState.txId); 
        } else {
            // If draw caused game over, update state directly from response
            // to avoid waiting for the next poll cycle
            console.log('Draw ended the game. Updating state directly.');
            setDrawnNumbers(prev => [...prev, response.data.drawnNumber]); // Add the last drawn number
            setIsGameOver(true);
            setWinners(response.data.winners || []);
            // Fetch stats one last time if needed, or rely on previous poll?
            // Let's fetch it to be sure it reflects the final state
            fetchCurrentGameState(raffleState.txId); 
            stopPolling(); // Ensure polling stops
        }
        
      } catch (error: any) {
        console.error('Error drawing number:', error);
        // Ensure we get a string, default to generic message
        let errorMsg = 'Failed to draw number';
        if (error.response?.data?.message && typeof error.response.data.message === 'string') {
          errorMsg = error.response.data.message;
        } else if (error.message && typeof error.message === 'string') {
          errorMsg = error.message;
        } else if (typeof error === 'string') {
            errorMsg = error;
        } // If it's still an object, errorMsg remains the default string

        setPollingError(errorMsg);
      } finally {
          setIsLoadingDraw(false); // Set loading false
      }
  };

  const handleReset = async () => {
     // --- MOVE STATE RESET BEFORE API CALL ---
    setRaffleState({
        fileUploaded: false,
        fileHash: null,
        participantCount: 0,
        txId: null,
        txConfirmed: false,
        blockHash: null,
        ipfsHash: null,
        participantFilename: null,
        loading: true, // Set loading true initially for the API call attempt
        error: null,
      });
      setGmToken(null);
      setDrawnNumbers([]);
      setIsGameOver(false);
      setWinners([]);
      setStatistics('');
      setPollingError(null);
      
    // --- ADD DEBUG LOG --- 
    console.log('State immediately after reset calls:', {
        fileUploaded: false,
        txId: null,
        // (Simulating expected values as direct state read might be stale)
    });

    try {
      console.log('Attempting to call /api/reset (expected to fail gracefully)');
      // --- REMOVE API CALL --- 
      // Attempt API call, but client state is already reset
      // await axios.post(`${API_URL}/api/reset`); 
      
      // If API call were successful, maybe set loading false here
      // setRaffleState(prev => ({...prev, loading: false })); 
    } catch (error: any) { // --- ADD TYPE TO ERROR --- 
      // console.error('Error calling /api/reset (expected if endpoint doesnt exist):', error.message); // No longer expected
      // Error is expected, maybe clear the loading state set before the try block
      // --- Optionally handle unexpected errors if the call were kept ---
      console.error('Error during reset (API call removed, should not happen):', error.message); 
      setRaffleState(prevState => ({
        ...prevState,
        loading: false,
        // Optionally clear the error message if 404 is acceptable
        // error: null 
        error: `Reset Error: ${error.message}` // Keep error reporting for unexpected issues
      }));
    } finally {
        // Ensure loading is false even if API call succeeds unexpectedly
        setRaffleState(prevState => ({ ...prevState, loading: false }));
    }
  };

  // --- ADD DEBUG LOG --- 
  console.log('AdminHomePage rendering with raffleState:', raffleState);

  return (
    <Container>
       <header className="App-header my-4"> {/* Kept App-header class for styling */} 
        <h1>bitBingo - Admin</h1>
        <p className="lead">Manage the Bingo Game Setup</p>
        {/* Simple Link to Player Page Base */} 
        {raffleState.txId && (
          <p><a href={`/play/${raffleState.txId}`} target="_blank" rel="noopener noreferrer">Go to Player Page for {raffleState.txId}</a></p>
        )}
      </header>

       <Row className="mb-4">
        <Col>
          <RaffleStatus 
            raffleState={raffleState} 
            onReset={handleReset}
          />
        </Col>
      </Row>

      {/* === Force string rendering for pollingError === */} 
      {pollingError != null && (
          <Alert variant="danger">
              {String(pollingError)}
          </Alert>
      )}

      {/* Combined Row for Upload and Transaction Creation */} 
      <Row className="mb-4">
          {/* Column 1: Upload Participants (Always shown initially, content disabled later) */} 
          <Col md={6}>
              <Card>
                  <Card.Header>1. Upload Participants</Card.Header>
                  <Card.Body>
                      <FileUpload 
                          apiUrl={API_URL}
                          onUploadSuccess={handleFileUploadSuccess} 
                          isDisabled={raffleState.fileUploaded} // Disables controls inside component
                      />
                  </Card.Body>
              </Card>
          </Col>

          {/* Column 2: Create Transaction (Conditionally shown based on state) */} 
          <Col md={6}>
              {/* Only render the card if file is uploaded and no txId yet */} 
              {raffleState.fileUploaded && raffleState.participantFilename && !raffleState.txId && (
                  <Card>
                      <Card.Header>2. Create Transaction</Card.Header>
                      <Card.Body>
                          <TransactionCreator 
                              apiUrl={API_URL}
                              participantFilename={raffleState.participantFilename} 
                              onTransactionCreated={handleTransactionCreated} 
                              onTransactionConfirmed={handleTransactionConfirmed}
                              isDisabled={raffleState.txId !== null} 
                              isConfirmed={raffleState.txConfirmed}
                              txId={raffleState.txId}
                              blockHash={raffleState.blockHash}
                              onReset={handleReset} 
                              fileHash={null} 
                          />
                      </Card.Body>
                  </Card>
              )}
              {/* Optional: Show placeholder or message if conditions not met */} 
              {(!raffleState.fileUploaded || !raffleState.participantFilename || raffleState.txId) && (
                  <Card className="h-100 border-dashed">
                      <Card.Body className="d-flex align-items-center justify-content-center">
                          <p className="text-muted">{raffleState.txId ? "Transaction submitted." : "Upload participants first."}</p>
                      </Card.Body>
                  </Card>
              )}
          </Col>
      </Row>

      {/* Section for Game Control and State - Shown when TX is available */} 
      {raffleState.txId && (
          <Row className="mb-4">
              <Col>
                  <Card>
                      <Card.Header>Game Management (TxID: {raffleState.txId})</Card.Header>
                      <Card.Body>
                          {/* Transaction Confirmation Check - Maybe move logic into TransactionCreator or RaffleStatus */} 
                          {!raffleState.txConfirmed && (
                              <p>Waiting for transaction confirmation...</p> 
                              // Potentially add a manual check button if TransactionCreator doesn't poll
                          )}
                          
                          {/* Game Over Display */} 
                          {isGameOver && (
                              <Alert variant="success">
                                  <h4>Game Over!</h4>
                                  <p>Winner(s): <strong>{winners.join(', ')}</strong></p>
                              </Alert>
                          )}
                          
                          {/* Draw Button */} 
                          {raffleState.txConfirmed && (
                              <DrawNumberButton 
                                  onDraw={handleDrawNumber} 
                                  isDisabled={isGameOver || isLoadingDraw}
                                  isLoading={isLoadingDraw}
                              />
                          )}
                          {!raffleState.txConfirmed && (
                              <p className="text-muted">Please wait for transaction confirmation before drawing numbers.</p>
                          )}

                          {/* Game State Display */} 
                          <GameStateDisplay 
                              drawnNumbers={drawnNumbers} 
                              statistics={statistics}
                          />
                      </Card.Body>
                  </Card>
              </Col>
          </Row>
      )}
      
      <Footer /> { /* Keep Footer if desired */ }
    </Container>
  );
} 