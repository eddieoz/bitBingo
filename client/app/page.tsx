'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Row, Col, Card, Alert, Spinner, Button, Modal, ButtonGroup, Form } from 'react-bootstrap'; // Added Alert, Spinner, Button, Modal, ButtonGroup, Form
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
import type { WinnerInfo } from '../src/types/index'; // Adjust path and import WinnerInfo
import QRCode from 'qrcode'; // Import from the base qrcode library

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

// --- Helper function to shorten TX ID ---
function shortenTxId(txId: string | null, startLength = 6, endLength = 6): string {
  if (!txId) return '';
  if (txId.length <= startLength + endLength) return txId;
  return `${txId.substring(0, startLength)}...${txId.substring(txId.length - endLength)}`;
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
  
  const [gmToken, setGmToken] = useState<string | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winners, setWinners] = useState<WinnerInfo[]>([]);
  const [statistics, setStatistics] = useState<string>('');
  const [isLoadingDraw, setIsLoadingDraw] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const pollingIntervalId = useRef<NodeJS.Timeout | null>(null);
  // --- NEW: State for partial win handling ---
  const [partialWinOccurred, setPartialWinOccurred] = useState<boolean>(false);
  const [partialWinners, setPartialWinners] = useState<WinnerInfo[] | null>(null);
  const [fullCardWinners, setFullCardWinners] = useState<WinnerInfo[] | null>(null);
  // --- End partial win state ---
  // State for continueAfterPartialWin fetched from backend
  const [continueAfterPartialWin, setContinueAfterPartialWin] = useState<boolean>(false);

  // === Restore QR code state ===
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null); // State for Data URL
  const [isPlayLinkCopied, setIsPlayLinkCopied] = useState(false); // State for copy button text
  // --- NEW: Game Mode State --- 
  const [selectedGameMode, setSelectedGameMode] = useState<'partialAndFull' | 'fullCardOnly'>('fullCardOnly');

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
     if (!currentTxId) return;
    
    const url = `${API_URL}/api/game-state/${currentTxId}`;
    console.log('Polling game state:', url);
    setPollingError(null);

    try {
      // Ensure GM token is included if available, to get full state including stats
      const headers: { Authorization?: string } = {};
      const storedToken = gmToken || JSON.parse(localStorage.getItem('gmTokens') || '{}')[currentTxId]; // Use component state or fallback to local storage
      if (storedToken) {
        headers.Authorization = `Bearer ${storedToken}`;
      }

      // Add gm=true query param to ensure GM stats are fetched
      const response = await axios.get(url, { headers, params: { gm: 'true' } }); 
      const { 
          drawnNumbers: newDrawnNumbers, 
          isOver: newIsGameOver, 
          statistics: newStatistics, 
          // New fields
          gameMode: newGameMode, // We don't have state for this yet, maybe add later if needed
          partialWinOccurred: newPartialWinOccurred,
          partialWinners: newPartialWinners,
          fullCardWinners: newFullCardWinners,
          continueAfterPartialWin: newContinueAfterPartialWin // <-- Fetch new field
      } = response.data;

      // Update state with all fetched fields
      setDrawnNumbers(newDrawnNumbers || []);
      setStatistics(newStatistics || '');
      setIsGameOver(newIsGameOver || false);
      setPartialWinOccurred(newPartialWinOccurred || false);
      setPartialWinners(newPartialWinners || null);
      setFullCardWinners(newFullCardWinners || null);
      setContinueAfterPartialWin(newContinueAfterPartialWin || false); // <-- Update state
      
      // Combine winners for display? Or keep separate?
      // Let's keep the old `winners` state updated with *final* winners for now
      // If game is over, final winners are either partial (if ended early) or full card.
      if (newIsGameOver) {
        setWinners(newFullCardWinners || newPartialWinners || []); // Prioritize full card, then partial
        console.log('Game is over. Final Winners:', newFullCardWinners || newPartialWinners);
        stopPolling();
      } else {
         // If game not over, clear the final winners state
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
      // Reset game state when txId is cleared
      setDrawnNumbers([]);
      setIsGameOver(false);
      setWinners([]);
      setStatistics('');
      setPollingError(null);
      // Reset new state fields too
      setPartialWinOccurred(false);
      setPartialWinners(null);
      setFullCardWinners(null);
      setContinueAfterPartialWin(false); // <-- Reset backend-driven state
    }
  }, [stopPolling, gmToken]);

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
      // Reset new state fields too
      setPartialWinOccurred(false);
      setPartialWinners(null);
      setFullCardWinners(null);
      setContinueAfterPartialWin(false); // <-- Reset backend-driven state
    }
    // Cleanup function to stop polling when component unmounts or txId changes
    return () => stopPolling(); 
  }, [raffleState.txId, startPolling, stopPolling]); // Include start/stop in dependencies

  const handleFileUploadSuccess = (data: { 
    filename: string; 
    message: string; 
    hexCid: string; 
    ipfsCid: string; 
    participantCount: number; 
  }) => { 
     console.log('File upload successful, API response:', data);
     console.log(`Received from API -> hexCid: ${data.hexCid}, ipfsCid: ${data.ipfsCid}, count: ${data.participantCount}`); 
     setRaffleState(prevState => ({
      ...prevState,
      fileUploaded: true,
      participantFilename: data.filename,
      // Store the received data
      fileHash: data.hexCid, // Store hexCid in fileHash
      participantCount: data.participantCount, // Store participantCount
      ipfsHash: data.ipfsCid, // Store ipfsCid in ipfsHash
      error: null // Clear any previous upload errors
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
        const gameEnded = response.data.isOver;
        const partialWinJustOccurred = response.data.partialWinOccurred && !partialWinOccurred; // Check against current state

        if (gameEnded || partialWinJustOccurred) {
           console.log('[Draw Handler] Game ended or partial win occurred. Updating local state from draw response...');
           const newStats = response.data.statistics; // Get stats from draw response

           if (gameEnded) {
               console.log('[Draw Handler] Game Ended. Updating local state.');
               setDrawnNumbers(prev => [...prev, response.data.drawnNumber]);
               setIsGameOver(true);
               setWinners(response.data.fullCardWinners || response.data.partialWinners || []); 
               setPartialWinOccurred(response.data.partialWinOccurred); 
               setPartialWinners(response.data.partialWinners);
               setFullCardWinners(response.data.fullCardWinners);
               if (newStats) setStatistics(newStats); // Update stats immediately
               stopPolling(); // Stop polling now, we have final state
           } else if (partialWinJustOccurred) {
               console.log('[Draw Handler] Partial win occurred. Updating local state.');
               setDrawnNumbers(prev => [...prev, response.data.drawnNumber]);
               setPartialWinOccurred(true);
               setPartialWinners(response.data.partialWinners || []);
               if (newStats) setStatistics(newStats); // Update stats immediately
               // Don't stop polling here, game continues
           }
        } else {
            // If nothing significant changed state-wise (no win, no end), just fetch normally
            console.log('[Draw Handler] No win/end this draw, fetching normal state...');
            fetchCurrentGameState(raffleState.txId);
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

  // --- NEW: Handler for End Game button ---
  const handleEndGame = async () => {
    if (!raffleState.txId || !gmToken) {
      console.error('Cannot end game: Missing txId or GM Token.');
      setPollingError('Cannot end game: Missing txId or GM Token.');
      return;
    }
    console.log(`[End Game Button] Attempting to end game ${raffleState.txId}`);
    // Set loading state? Maybe reuse isLoadingDraw or add a new one?
    // Let's add a specific one for clarity
    // const [isEndingGame, setIsEndingGame] = useState(false); // <-- Add this state higher up
    // setIsEndingGame(true);
    setPollingError(null);

    try {
      const headers = { Authorization: `Bearer ${gmToken}` };
      const response = await axios.post(`${API_URL}/api/end-game/${raffleState.txId}`, null, { headers });
      console.log('End game successful:', response.data);
      // API response should indicate game is over. Polling will pick it up,
      // or we can force a state update/refetch here.
      setIsGameOver(true); // Force UI update immediately
      // Maybe update winners state based on response.data.partialWinners?
      // Polling already handles setting final winners when isOver is true.
      fetchCurrentGameState(raffleState.txId); // Force immediate refetch
      stopPolling(); // Stop polling as game ended
    } catch (error: any) {
      console.error('Error ending game:', error);
      let errorMsg = 'Failed to end game';
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      setPollingError(errorMsg);
    } finally {
      // setIsEndingGame(false); // <-- If loading state was added
    }
  };
  // --- End End Game Handler ---

  // --- NEW: Handler for Continue Game button ---
  const handleContinueGame = async () => {
    if (!raffleState.txId || !gmToken) {
      console.error('Cannot continue game: Missing txId or GM Token.');
      setPollingError('Cannot continue game: Missing txId or GM Token.');
      return;
    }
    console.log(`[Continue Game Button] Attempting to continue game ${raffleState.txId}`);
    setPollingError(null);
    // Add loading state?

    try {
      const headers = { Authorization: `Bearer ${gmToken}` };
      await axios.post(`${API_URL}/api/continue-game/${raffleState.txId}`, null, { headers });
      console.log('Continue game successful.');
      // Backend state updated. Fetch latest state to update UI and stats.
      fetchCurrentGameState(raffleState.txId); 
    } catch (error: any) {
      console.error('Error continuing game:', error);
      let errorMsg = 'Failed to continue game';
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      setPollingError(errorMsg);
    } finally {
      // Stop loading state
    }
  };
  // --- End Continue Game Handler ---

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

  const playerPageUrl = raffleState.txId ? `${window.location.origin}/play/${raffleState.txId}` : '';

  const handleCopyLink = () => {
    if (!playerPageUrl) return;
    navigator.clipboard.writeText(playerPageUrl)
      .then(() => {
        setIsPlayLinkCopied(true);
        setTimeout(() => setIsPlayLinkCopied(false), 1500); // Reset after 1.5 seconds
      })
      .catch(err => {
        console.error('Failed to copy link: ', err);
        alert('Failed to copy link.'); // Keep error alert for now
      });
  };

  // === Restore QR code handlers ===
  const handleShowQr = () => setShowQrModal(true);
  const handleCloseQr = () => {
    setShowQrModal(false);
    setQrCodeDataUrl(null); // Clear data URL when closing
  };

  // --- Effect to generate QR Code Data URL when modal opens --- 
  useEffect(() => {
    if (showQrModal && playerPageUrl) {
      QRCode.toDataURL(playerPageUrl, { errorCorrectionLevel: 'H', margin: 2, width: 384 })
        .then(url => {
          setQrCodeDataUrl(url);
        })
        .catch(err => {
          console.error('Failed to generate QR code:', err);
          // Optionally show an error message in the modal
          setQrCodeDataUrl(null); // Ensure it's null on error
        });
    } else {
       setQrCodeDataUrl(null); // Clear if modal closed or no URL
    }
  }, [showQrModal, playerPageUrl]); // Re-run if modal state or URL changes

  return (
    <Container>
       <header className="App-header my-4"> {/* Kept App-header class for styling */} 
        <h1>bitBingo - Admin</h1>
        <p className="lead mb-3">Manage the Bingo Game Setup</p> {/* Added mb-3 */}
        {/* === Player Link Section Updated - Simplified Design === */}
        {raffleState.txId && playerPageUrl && (
          <div className="mb-3 d-flex align-items-center justify-content-start flex-wrap">
            <strong className="me-2">Player Page:</strong>
            <a href={playerPageUrl} target="_blank" rel="noopener noreferrer" className="me-3 text-break">
              {/* Display shortened link - adjusted for context */}
              {`${window.location.origin}/play/${shortenTxId(raffleState.txId)}`}
            </a>
            <ButtonGroup size="sm">
              <Button variant="outline-secondary" onClick={handleCopyLink}>
                {isPlayLinkCopied ? 'Copied!' : 'Copy Link'}
              </Button>
              {/* === Restore QR code button === */}
              <Button variant="outline-info" onClick={handleShowQr}>
                QR Code
              </Button>
            </ButtonGroup>
          </div>
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

      {/* === Force string rendering for pollingError - Fixed null check === */}
      {pollingError !== null && (
          <Alert variant="danger">
              {String(pollingError)}
          </Alert>
      )}

      {/* Combined Row for Upload and Transaction Creation */} 
      <Row className="mb-4">
          {/* Column 1: Upload Participants */} 
          <Col md={6}>
              <Card className="h-100"> {/* Ensure cards have same height */} 
                  <Card.Header>1. Upload Participants</Card.Header>
                  <Card.Body>
                      <FileUpload 
                          apiUrl={API_URL}
                          onUploadSuccess={handleFileUploadSuccess} 
                          isDisabled={raffleState.fileUploaded} // FileUpload handles internal disabling
                      />
                  </Card.Body>
              </Card>
          </Col>

          {/* Column 2: Create Transaction (Always render Card, let component handle state) */} 
          <Col md={6}>
               <Card className="h-100"> {/* Ensure cards have same height */} 
                  {/* Header changes based on whether file is uploaded/tx exists */}
                  <Card.Header>
                    {raffleState.fileUploaded ? 
                      (raffleState.txId ? 'Transaction Status' : '2. Create Transaction') : 
                      '2. Create Transaction'}
                  </Card.Header>
                  <Card.Body>
                      {/* --- NEW: Game Mode Selection (Show after upload, before TX) --- */}
                      {raffleState.fileUploaded && !raffleState.txId && (
                          <Form.Group className="mb-3">
                              <Form.Label><strong>Select Game Mode:</strong></Form.Label>
                              <Form.Check 
                                  type="radio"
                                  label="Full Card Win Only"
                                  name="gameModeRadio"
                                  id="modeFullCardOnly"
                                  value="fullCardOnly"
                                  checked={selectedGameMode === 'fullCardOnly'}
                                  onChange={(e) => setSelectedGameMode(e.target.value as 'fullCardOnly')} 
                                  disabled={raffleState.txConfirmed || drawnNumbers.length > 0}
                              />
                              <Form.Check 
                                  type="radio"
                                  label="Partial Win (Any Line) & Full Card"
                                  name="gameModeRadio"
                                  id="modePartialAndFull"
                                  value="partialAndFull"
                                  checked={selectedGameMode === 'partialAndFull'}
                                  onChange={(e) => setSelectedGameMode(e.target.value as 'partialAndFull')} 
                                  disabled={raffleState.txConfirmed || drawnNumbers.length > 0}
                              />
                          </Form.Group>
                      )}
                      {/* --- End Game Mode Selection --- */}
                      
                      {/* Render TransactionCreator always, pass props to control its state */}
                      <TransactionCreator 
                          apiUrl={API_URL}
                          participantFilename={raffleState.participantFilename} 
                          selectedGameMode={selectedGameMode}
                          onTransactionCreated={handleTransactionCreated} 
                          onTransactionConfirmed={handleTransactionConfirmed}
                          // Disable based on file upload status or existing txId
                          isDisabled={!raffleState.fileUploaded || raffleState.txId !== null} 
                          isConfirmed={raffleState.txConfirmed}
                          txId={raffleState.txId}
                          blockHash={raffleState.blockHash}
                          onReset={handleReset} 
                          fileHash={raffleState.fileHash} 
                      />
                      {/* Add placeholder text if file not uploaded yet */}
                      {!raffleState.fileUploaded && (
                          <p className="text-muted mt-3">Upload participants list first to see instructions.</p>
                      )}
                  </Card.Body>
              </Card>
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
                          
                          {/* --- Display FINAL Winners (Game Over) --- */}
                          {isGameOver && (partialWinners || fullCardWinners) && ( // Check if either winner list exists
                              <Alert variant="success">
                                  <h4 className="alert-heading">Game Over!</h4>
                                  {/* Display Partial Winners if they exist */} 
                                  {partialWinners && partialWinners.length > 0 && (
                                      <div className="mb-3">
                                          <p className="mb-1"><strong>Partial Winner{partialWinners.length > 1 ? 's' : ''} (Line Win):</strong></p>
                                          {partialWinners.map((winner, index) => (
                                            <div key={`p-${index}`} className="small ms-2">
                                              <span>{winner.username} (Card: {winner.cardId}) - Sequence: {winner.sequence.map(n => n === null ? 'FREE' : n).join(', ')}</span>
                                            </div>
                                          ))}
                                      </div>
                                  )}
                                  {/* Display Full Card Winners if they exist */} 
                                  {fullCardWinners && fullCardWinners.length > 0 && (
                                      <div>
                                          <p className="mb-1"><strong>Full Card Winner{fullCardWinners.length > 1 ? 's' : ''}:</strong></p>
                                          {fullCardWinners.map((winner, index) => (
                                            <div key={`f-${index}`} className="small ms-2">
                                               <span>{winner.username} (Card: {winner.cardId}) - Sequence: {winner.sequence}</span>
                                            </div>
                                          ))}
                                      </div>
                                  )}
                              </Alert>
                          )}
                          
                          {/* --- Display PARTIAL Winners (Game Not Over) --- */}
                          {partialWinOccurred && !isGameOver && partialWinners && partialWinners.length > 0 && (
                              <Alert variant="warning">
                                  <h4 className="alert-heading">Partial Win Detected!</h4>
                                  {partialWinners.map((winner, index) => (
                                    <div key={index} className="mb-2">
                                      <p className="mb-0"><strong>{winner.username}</strong> (Card ID: {winner.cardId})</p>
                                      <small>Sequence: {typeof winner.sequence === 'string' ? winner.sequence : winner.sequence.map(n => n === null ? 'FREE' : n).join(', ')}</small>
                                    </div>
                                  ))}
                                  <hr />
                                  <p className="mb-0">Choose whether to continue playing for a Full Card win.</p>
                              </Alert>
                          )}
                          
                          {/* --- Game Controls --- */} 
                          {raffleState.txConfirmed && !isGameOver && (
                              <> 
                                  {/* Show Draw Button if game hasn't had a partial win OR if GM has confirmed continuation */}
                                  {(!partialWinOccurred || (partialWinOccurred && continueAfterPartialWin)) && (
                                      <DrawNumberButton 
                                          onDraw={handleDrawNumber} 
                                          isDisabled={isLoadingDraw} 
                                          isLoading={isLoadingDraw}
                                      />
                                  )}

                                  {/* Show Continue/End buttons ONLY if partial win HAS occurred AND GM has NOT confirmed continuation */} 
                                  {partialWinOccurred && !continueAfterPartialWin && (
                                      <div className="mt-3">
                                          <h5>Partial Win Options:</h5>
                                          <ButtonGroup>
                                              {/* Call new handler */}
                                              <Button variant="success" onClick={handleContinueGame}>
                                                  Continue to Full Card
                                              </Button>
                                              <Button variant="danger" onClick={handleEndGame}>
                                                  End Game Now
                                              </Button>
                                          </ButtonGroup>
                                      </div>
                                  )}
                              </>
                          )}
                          {/* Message if TX not confirmed */}
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

      {/* === QR Code Modal (uses img with data URL) === */}
      <Modal show={showQrModal} onHide={handleCloseQr} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Player Page QR Code</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          {qrCodeDataUrl ? (
            <img src={qrCodeDataUrl} alt="Player Page QR Code" style={{ maxWidth: '100%', height: 'auto' }} />
          ) : (
            <p>Generating QR Code...</p> // Loading/Error state
          )}
          <p className="mt-3">Scan this code to go to the player page.</p>
          <p><small>{playerPageUrl}</small></p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseQr}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

    </Container>
  );
} 