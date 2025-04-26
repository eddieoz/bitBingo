import React, { useState } from 'react';
import { Container, Form, Button, Alert, Spinner } from 'react-bootstrap';
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

function PlayPage() {
  const [nickname, setNickname] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(''); // Keep for UI feedback
  const [error, setError] = useState(null);
  const [userCards, setUserCards] = useState([]);

  const handleFetchCards = async (e) => {
    e.preventDefault();
    setError(null);
    setUserCards([]);
    setIsLoading(true);
    setLoadingMessage('Fetching your bingo cards...'); // Updated message

    if (!nickname || !transactionId) {
      setError('Please enter both nickname and transaction ID.');
      setIsLoading(false);
      setLoadingMessage('');
      return;
    }

    try {
      // Call the backend API endpoint to get cards
      const apiUrl = `${API_BASE_URL}/api/cards`;
      console.log(`Fetching cards from backend: ${apiUrl}?txId=${transactionId}&nickname=${nickname}`);
      
      const response = await axios.get(apiUrl, {
        params: {
          txId: transactionId,
          nickname: nickname
        }
      });

      if (response.data && response.data.status === 'success') {
        if (response.data.cards && response.data.cards.length > 0) {
             setUserCards(response.data.cards);
             console.log('Received cards from backend:', response.data.cards);
        } else {
            // Handle case where backend found the user but returned no cards (shouldn't happen with current logic but good practice)
            setError(`Nickname "${nickname}" found, but no cards were generated. Please contact support.`);
        }
      } else {
        // Handle potential non-success status from backend (if implemented)
        throw new Error(response.data.error || 'Backend returned an unexpected response.');
      }

    } catch (err) {
      console.error('Error fetching cards from backend:', err);
      let errorMessage = 'An error occurred while fetching your cards.';
      if (axios.isAxiosError(err)) {
           const status = err.response?.status;
           const backendError = err.response?.data?.error;
           if (status === 404) {
              errorMessage = backendError || `Nickname "${nickname}" or Transaction ID "${transactionId}" not found, or the combination is invalid.`;
           } else if (status === 400) {
              errorMessage = backendError || 'Invalid request. Please check your nickname and transaction ID.';
           } else if (backendError) {
              errorMessage = `Backend Error: ${backendError}`;
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

  return (
    <Container>
      <h2>Play Bingo</h2>
      <p>Enter your nickname and the transaction ID used to anchor the participant list to find your bingo cards.</p>

      <Form onSubmit={handleFetchCards}>
        <Form.Group className="mb-3" controlId="formNickname">
          <Form.Label>Nickname</Form.Label>
          <Form.Control 
            type="text" 
            placeholder="Enter your nickname" 
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            disabled={isLoading}
          />
          <Form.Text className="text-muted">
            This should match the name used in the uploaded CSV file.
          </Form.Text>
        </Form.Group>

        <Form.Group className="mb-3" controlId="formTransactionId">
          <Form.Label>Transaction ID</Form.Label>
          <Form.Control 
            type="text"
            placeholder="Enter transaction ID (txid)"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            required
            disabled={isLoading}
          />
           <Form.Text className="text-muted">
            The Bitcoin transaction ID containing the IPFS CID in its OP_RETURN data.
          </Form.Text>
        </Form.Group>

        {error && <Alert variant="danger">{error}</Alert>}

        <Button variant="primary" type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
              <span className="ms-2">{loadingMessage || 'Loading...'}</span>
            </>
          ) : (
            'Find My Cards'
          )}
        </Button>
      </Form>

      {userCards.length > 0 && (
          <div className="mt-4">
              <h3>Your Bingo Cards</h3>
               <UserCardsDisplay cards={userCards} />
          </div>
      )}

    </Container>
  );
}

export default PlayPage; 