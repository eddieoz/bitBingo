'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap'; // Removed Nav import
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
  const [gameState, setGameState] = useState({ 
      drawnNumbers: [] as number[], // Added type annotation
      stats: [] as any[], // Use specific type if available (e.g., GameStateStat[])
      drawIndex: 0, 
      loading: false, 
      error: null as string | null // Added type annotation
  });

  const fetchCurrentGameState = useCallback(async () => {
     if (!raffleState.txId) return;
    
    // --- PREPEND /api here ---
    const url = `${API_URL}/api/game-state/${raffleState.txId}?gm=true`; 
    console.log('Fetching game state:', url);
    setGameState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await axios.get(url);
      setGameState(prev => ({
        ...prev,
        drawnNumbers: response.data.drawnNumbers || [],
        stats: response.data.stats || [],
        drawIndex: response.data.drawIndex || 0,
        loading: false,
      }));
    } catch (error: any) { // Added type any for error
      console.error('Error fetching game state:', error);
      setGameState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error.response?.data?.error || 'Failed to fetch game state' 
      }));
    }
  }, [raffleState.txId]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null; // Added type
    if (raffleState.txConfirmed && gmToken) {
      fetchCurrentGameState(); 
      intervalId = setInterval(fetchCurrentGameState, 15000); // Poll every 15 seconds
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [raffleState.txConfirmed, gmToken, fetchCurrentGameState]);

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

  const handleTransactionConfirmed = (data: { blockHash: string }) => { // REMOVED gmToken from expected data type
     console.log('Transaction confirmed with blockHash:', data.blockHash);
     setRaffleState(prevState => ({
      ...prevState,
      txConfirmed: true,
      blockHash: data.blockHash
    }));
  };
  
  // checkTransactionStatus might not be needed if TransactionCreator handles checks
  // const checkTransactionStatus = ...

  const handleDrawNumber = async () => {
      // --- ADJUSTED Check: Only require txId --- 
      if (!raffleState.txId) { 
      console.error('Cannot draw number: Missing txId.');
      setGameState(prev => ({ ...prev, error: 'Missing txId.' }));
      return;
    }
    // if (!raffleState.txId || !gmToken) { // Old check requiring token
    //   console.error('Cannot draw number: Missing txId or GM token.');
    //   setGameState(prev => ({ ...prev, error: 'Missing txId or GM token.' }));
    //   return;
    // }

    setGameState(prev => ({ ...prev, loading: true, error: null }));
    
    // --- Conditionally Set Headers --- 
    const headers: { Authorization?: string } = {}; // Use type for headers
    if (gmToken) {
        headers.Authorization = `Bearer ${gmToken}`;
        console.log('Sending draw request with GM Token.');
    } else {
        console.log('Sending first draw request (no GM Token).');
    }
    
    try {
      const response = await axios.post(
        `${API_URL}/api/draw/${raffleState.txId}`, 
        null, // No request body needed for draw
        { headers: headers } // Pass conditional headers
      );
      console.log('Draw successful:', response.data);
      // Immediately fetch game state after successful draw
      fetchCurrentGameState(); 
      
      // --- ADD Check for GM Token in Draw Response --- 
      if (response.data.gmToken && !gmToken) { // Check if token exists in response AND we don't have one yet
          console.log('Received and storing GM Token from draw response:', response.data.gmToken);
          setGmToken(response.data.gmToken);
      }
      
    } catch (error: any) { // Added type
      console.error('Error drawing number:', error);
      setGameState(prev => ({
        ...prev,
        loading: false,
        error: error.response?.data?.error || 'Failed to draw number'
      }));
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
      setGameState({ drawnNumbers: [], stats: [], drawIndex: 0, loading: false, error: null });
      
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

      <Row>
        <Col lg={6} className="mb-4">
          <Card className="h-100">
            <Card.Header>1. Upload Participant List</Card.Header>
            <Card.Body>
              <FileUpload 
                onUploadSuccess={handleFileUploadSuccess} 
                isDisabled={raffleState.fileUploaded}
                apiUrl={API_URL}
              />
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6} className="mb-4">
          <Card className="h-100" id="transaction-creator-component">
            <Card.Header>2. Submit Transaction Information</Card.Header>
            <Card.Body>
              <TransactionCreator 
                onTransactionCreated={handleTransactionCreated}
                onTransactionConfirmed={handleTransactionConfirmed}
                isDisabled={!raffleState.fileUploaded || raffleState.txId !== null}
                isConfirmed={raffleState.txConfirmed}
                fileHash={raffleState.fileHash}
                txId={raffleState.txId}
                participantFilename={raffleState.participantFilename}
                blockHash={raffleState.blockHash}
                apiUrl={API_URL}
                onReset={handleReset}
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col className="mb-4">
          <Card>
            <Card.Header>3. Game Status & Control</Card.Header>
            <Card.Body>
              {/* --- ADJUSTED Rendering Logic --- */}
              {raffleState.txConfirmed ? ( // Show controls once TX is confirmed
                <>
                  {/* GameStateDisplay might still need gmToken if it uses GM-specific data */}
                  {gmToken ? ( 
                    <GameStateDisplay 
                      gameState={gameState} 
                      onRefresh={fetchCurrentGameState} 
                    />
                  ) : (
                    <p className="text-info">Game state details will appear after the first number is drawn.</p>
                  )}
                  
                  {/* Draw button only needs txConfirmed */}
                  <DrawNumberButton 
                    onDraw={handleDrawNumber} 
                    isLoading={gameState.loading}
                    isDisabled={gameState.loading || gameState.drawnNumbers.length >= 75} 
                  />
                </>
              ) : (
                <p className="text-muted">
                   {/* Message when TX not confirmed */}
                   Waiting for transaction confirmation...
                </p>
              )}
              {/* Display message specifically about needing the first draw for token */} 
              {raffleState.txConfirmed && !gmToken && (
                   <p className="text-info mt-2">Click "Draw Number" to start the game and get the Game Master token.</p>
              )}

              {/* Display errors separately */} 
              {raffleState.error && <p className='text-danger mt-2'>Status Error: {raffleState.error}</p>} 
              {gameState.error && <p className='text-danger mt-2'>Game State Error: {gameState.error}</p>} 
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      <Footer /> { /* Keep Footer if desired */ }
    </Container>
  );
} 