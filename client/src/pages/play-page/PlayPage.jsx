import React, { useState, useEffect, useRef } from 'react';
import { Container, Form, Button, Alert, Spinner, Row, Col } from 'react-bootstrap';
import axios from 'axios';
// Remove unused imports related to client-side generation/fetching
// import Papa from 'papaparse';
// import { Buffer } from 'buffer';
// import { CID } from 'multiformats/cid'; 
// import crypto from 'crypto-browserify'; 
// import { derivePublicKey, generateBingoCard } from '../../lib/bingo-utils';
import UserCardsDisplay from '../../components/user-cards-display/UserCardsDisplay';

// Remove unused client-side configuration
// const BLOCKCYPHER_API_BASE_URL = ...
// const BLOCKCYPHER_NETWORK = ...
// const IPFS_GATEWAY_BASE_URL = ...

// Define the backend API URL (use environment variable if available)
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const POLLING_INTERVAL = 2000; // Poll every 2 seconds

function PlayPage() {
  const [nickname, setNickname] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState(null);
  const [userCards, setUserCards] = useState([]);

  // --- New State for Game --- 
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winners, setWinners] = useState([]);
  const [statistics, setStatistics] = useState('');
  const [isGM, setIsGM] = useState(false); 
  const [gmToken, setGmToken] = useState(null); // Store token if user is GM
  const pollingIntervalId = useRef(null); // Use ref to store interval ID

  // --- New State for Draw Button --- 
  const [isLoadingDraw, setIsLoadingDraw] = useState(false);

  // --- GM Token Handling --- 
  // Function to get GM token for a specific TXID from local storage
  const getStoredGmToken = (txid) => {
      try {
          const tokens = JSON.parse(localStorage.getItem('gmTokens') || '{}');
          return tokens[txid] || null;
      } catch (e) {
          console.error("Error reading GM tokens from localStorage:", e);
          return null;
      }
  };

  // Function to store GM token for a specific TXID in local storage
  const storeGmToken = (txid, token) => {
      try {
          const tokens = JSON.parse(localStorage.getItem('gmTokens') || '{}');
          tokens[txid] = token;
          localStorage.setItem('gmTokens', JSON.stringify(tokens));
          console.log(`Stored GM token for ${txid}`);
      } catch (e) {
          console.error("Error storing GM token in localStorage:", e);
      }
  };
  
  // Check if user is GM for the current transactionId when it changes
  useEffect(() => {
      if (transactionId) {
          const storedToken = getStoredGmToken(transactionId);
          if (storedToken) {
              console.log(`Found stored GM token for ${transactionId}. Assuming GM role.`);
              setGmToken(storedToken);
              setIsGM(true);
          } else {
              console.log(`No stored GM token found for ${transactionId}. Assuming Player role.`);
              setGmToken(null);
              setIsGM(false);
          }
          // Start polling when txid is set
          startPolling(transactionId);
      } else {
          // Clear game state and stop polling if txid is removed
          stopPolling();
          setDrawnNumbers([]);
          setIsGameOver(false);
          setWinners([]);
          setStatistics('');
          setIsGM(false);
          setGmToken(null);
          setUserCards([]); // Also clear cards
      }

      // Cleanup function to stop polling when component unmounts or txid changes
      return () => stopPolling(); 
  }, [transactionId]); // Re-run only when transactionId changes

  // --- Polling Logic --- 
  const fetchGameState = async (txid) => {
      console.log(`Polling game state for ${txid}...`);
      try {
          const response = await axios.get(`${API_BASE_URL}/api/game-state/${txid}`);
          const { drawnNumbers: newDrawnNumbers, isOver: newIsGameOver, winners: newWinners, statistics: newStatistics } = response.data;
          
          setDrawnNumbers(newDrawnNumbers || []);
          setStatistics(newStatistics || '');
          
          if (newIsGameOver) {
              console.log('Game is over. Winners:', newWinners);
              setIsGameOver(true);
              setWinners(newWinners || []);
              stopPolling(); // Stop polling once game is over
          } else {
              // Ensure game over state is reset if backend somehow reverts it (unlikely)
              setIsGameOver(false);
              setWinners([]);
          }

      } catch (err) {
          console.error('Error polling game state:', err);
          // Handle specific errors? e.g., 404 might mean game ended or TXID is wrong
          if (axios.isAxiosError(err) && err.response?.status === 404) {
              setError(`Game state not found for TXID ${txid}. The game may not have started or the TXID is incorrect.`);
              stopPolling(); // Stop polling on 404
          } else {
              // Keep polling on other errors? Or show a persistent error?
              // For now, just log it.
          }
      }
  };

  const startPolling = (txid) => {
      if (!txid) return;
      stopPolling(); // Clear any existing interval before starting a new one
      console.log(`Starting polling for ${txid}`);
      // Fetch immediately first time
      fetchGameState(txid);
      // Then set interval
      pollingIntervalId.current = setInterval(() => fetchGameState(txid), POLLING_INTERVAL);
  };

  const stopPolling = () => {
      if (pollingIntervalId.current) {
          console.log('Stopping polling.');
          clearInterval(pollingIntervalId.current);
          pollingIntervalId.current = null;
      }
  };

  // --- Card Fetching Logic --- 
  const handleFetchCards = async (e) => {
    e.preventDefault();
    setError(null);
    setUserCards([]);
    setIsLoading(true);
    setLoadingMessage('Fetching your bingo cards...');

    if (!nickname || !transactionId) {
      setError('Please enter both nickname and transaction ID.');
      setIsLoading(false);
      setLoadingMessage('');
      return;
    }

    try {
      // Call the backend API endpoint to get cards
      // UPDATED endpoint based on server/index.js
      const apiUrl = `${API_BASE_URL}/api/cards/${transactionId}/${nickname}`;
      console.log(`Fetching cards from backend: ${apiUrl}`);
      
      const response = await axios.get(apiUrl);

      // Structure from /api/cards/:txid/:nickname seems to be { cards: [...] }
      if (response.data && response.data.cards && response.data.cards.length > 0) {
             setUserCards(response.data.cards);
             console.log('Received cards from backend:', response.data.cards);
             // Start polling *after* successfully fetching cards for the first time
             // Note: Polling might already be started by the useEffect on txid change,
             // but calling startPolling here ensures it runs even if txid was entered before nickname
             startPolling(transactionId); 
      } else {
            // Handle case where backend found the user but returned no cards (shouldn't happen)
             setError(`Nickname "${nickname}" found for TXID ${transactionId}, but no cards were returned. This might indicate an issue.`);
             setUserCards([]); // Ensure cards are cleared
      }

    } catch (err) {
      console.error('Error fetching cards from backend:', err);
      let errorMessage = 'An error occurred while fetching your cards.';
      if (axios.isAxiosError(err)) {
           const status = err.response?.status;
           const backendMessage = err.response?.data?.message; // Use 'message' field from backend
           if (status === 404) {
              errorMessage = backendMessage || `Nickname "${nickname}" not found for Transaction ID "${transactionId}", or the game hasn't started.`;
           } else if (status === 400) {
              errorMessage = backendMessage || 'Invalid request. Please check your nickname and transaction ID.';
           } else if (backendMessage) {
              errorMessage = `Backend Error: ${backendMessage}`;
           } else if (err.message.includes('Network Error')) {
               errorMessage = 'Network error contacting the server. Please check if the server is running.';
           } else {
              errorMessage = `Request Failed: ${err.message}`;
           }
       } else if (err instanceof Error) {
           errorMessage = err.message;
       }
      setError(errorMessage);
      setUserCards([]);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // --- Draw Number Handler (Placeholder - assumes DrawNumberButton component exists) ---
  const handleDrawNumber = async () => {
      if (!isGM || !gmToken) {
          setError("Only the Game Master can draw numbers.");
          return;
      }
      if (isGameOver) {
          setError("The game is already over.");
          return;
      }
      setIsLoadingDraw(true); // Set loading state for draw button
      setError(null);
      try {
          console.log(`GM attempting draw for ${transactionId} with token ${gmToken.substring(0,4)}...`);
          const response = await axios.post(`${API_BASE_URL}/api/draw/${transactionId}`, {}, {
              headers: {
                  Authorization: `Bearer ${gmToken}`
              }
          });
          console.log('Draw successful:', response.data);
          // The polling mechanism will automatically pick up the new number
          // We might want to store the GM token from the *first* draw response
          if (response.data.gmToken && !getStoredGmToken(transactionId)) {
              console.log('Received new GM token from first draw, storing...');
              storeGmToken(transactionId, response.data.gmToken);
              setGmToken(response.data.gmToken);
              setIsGM(true); // Explicitly set GM status
          }
      } catch (err) {
          console.error('Error drawing number:', err);
          let drawError = 'Failed to draw number.';
          if (axios.isAxiosError(err)) {
              drawError = err.response?.data?.message || drawError;
          }
          setError(drawError);
      }
      setIsLoadingDraw(false); // Reset loading state for draw button
  }

  return (
    <Container>
      <h2>Play Bingo</h2>
      <p>Enter your nickname and the transaction ID used to anchor the participant list to find your bingo cards.</p>
      <p>The game state will update automatically.</p>

      <Form onSubmit={handleFetchCards}>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="formNickname">
              <Form.Label>Nickname</Form.Label>
              <Form.Control 
                type="text" 
                placeholder="Enter your nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                disabled={isLoading || userCards.length > 0} // Disable if loading or cards loaded
              />
              <Form.Text className="text-muted">
                Case-insensitive match from the participant list.
              </Form.Text>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="formTransactionId">
              <Form.Label>Transaction ID</Form.Label>
              <Form.Control 
                type="text"
                placeholder="Enter transaction ID (txid)"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)} // Changing TXID will trigger useEffect to reset/poll
                required
                disabled={isLoading || userCards.length > 0} // Disable if loading or cards loaded
              />
               <Form.Text className="text-muted">
                The Bitcoin transaction anchoring the game.
              </Form.Text>
            </Form.Group>
          </Col>
        </Row>

        {error && <Alert variant="danger">{error}</Alert>}

        <Button 
          variant="primary" 
          type="submit" 
          disabled={isLoading || userCards.length > 0} // Disable if loading or cards loaded
          className="mb-3"
        >
          {isLoading ? (
            <>
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
              <span className="ms-2">{loadingMessage || 'Loading...'}</span>
            </>
          ) : (
            'Find My Cards & Join Game'
          )}
        </Button>
      </Form>

      {/* --- Game Display Area --- */} 
      {userCards.length > 0 && (
          <div className="mt-4">
              {/* Placeholder for Game State Display */} 
              {/* <GameStateDisplay drawnNumbers={drawnNumbers} statistics={statistics} /> */}
              <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
                  <h4>Game State</h4>
                  <p><strong>Drawn Numbers ({drawnNumbers.length}/75):</strong> {drawnNumbers.join(', ') || 'None yet'}</p>
                  <p><strong>Statistics:</strong></p>
                  <pre style={{ whiteSpace: 'pre-wrap', background: '#f8f9fa', padding: '0.5rem' }}>{statistics || 'No statistics available.'}</pre>
              </div>

              {/* Placeholder for Winner Display */} 
              {isGameOver && (
                  /* <WinnerDisplay winners={winners} /> */
                  <Alert variant="success">
                      <h4>Game Over!</h4>
                      <p>Winner(s): <strong>{winners.join(', ')}</strong></p>
                  </Alert>
              )}

              {/* Placeholder for GM Controls */} 
              {isGM && (
                  <div className="mb-3">
                      {/* <DrawNumberButton onDraw={handleDrawNumber} disabled={isGameOver || isLoadingDraw} /> */}
                       <Button 
                          variant="warning" 
                          onClick={handleDrawNumber} 
                          disabled={isGameOver || isLoadingDraw} // Disable if game over or draw is loading 
                          className="mt-2"
                        >
                            {isLoadingDraw ? (
                                <>
                                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                                    <span className="ms-1">Drawing...</span>
                                </>
                            ) : (
                                'Draw Next Number'
                            )}
                        </Button>
                        <p className="text-muted small mt-1">GM Controls Visible</p>
                  </div>
              )}

              <h3>Your Bingo Cards</h3>
              {/* TODO: Pass drawnNumbers to UserCardsDisplay and update BingoCard to mark numbers */}
              <UserCardsDisplay cards={userCards} drawnNumbers={drawnNumbers} /> 
          </div>
      )}

    </Container>
  );
}

export default PlayPage; 