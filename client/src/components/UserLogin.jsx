import React, { useState } from 'react';
import axios from 'axios'; // Use axios for consistency
import { Form, Button, Alert, Spinner } from 'react-bootstrap'; // Add Bootstrap components

// Updated props: txid, onLoginSuccess, onLoginError
export function UserLogin({ txid, onLoginSuccess, onLoginError }) {
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Removed blockNumber state
  // Removed noCards state (error handling covers this)

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nickname.trim()) {
      onLoginError('Please enter a nickname');
      return;
    }

    setIsLoading(true);
    
    try {
      // Use txid and nickname to fetch cards
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      console.log('Attempting to fetch cards from:', `${apiUrl}/cards`); // Log the URL
      const response = await axios.get(`${apiUrl}/cards`, {
        params: { txId: txid, nickname: nickname.trim() }
      });
      
      // Assuming success means we got data with a cards array
      if (response.data && response.data.cards) {
         if (response.data.cards.length > 0) {
            // Call success callback with the required UserSession structure
            onLoginSuccess({ 
                nickname: nickname.trim(), 
                cards: response.data.cards 
            });
         } else {
             onLoginError(`No cards found for nickname '${nickname.trim()}' in this game.`);
         }
      } else {
        // Handle unexpected response structure
        console.error('Unexpected response structure:', response.data);
        onLoginError('Received an unexpected response from the server.');
      }

    } catch (err) {
      console.error('Login error:', err);
      let errorMessage = 'Login failed. Please try again.';
      if (axios.isAxiosError(err) && err.response) {
        // Use specific error from backend if available
        errorMessage = err.response.data?.error || err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      onLoginError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form onSubmit={handleSubmit} className="mb-4 p-4 border rounded bg-light">
       <h3 className="mb-3">Enter Nickname</h3>
       {/* Removed block number input */}
      <Form.Group className="mb-3" controlId="nicknameInput">
        <Form.Label>Nickname</Form.Label>
        <Form.Control
          type="text"
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          placeholder="Enter nickname used in participant list"
          disabled={isLoading}
          required
        />
      </Form.Group>
      
      <Button variant="primary" type="submit" disabled={isLoading}>
        {isLoading ? (
          <>
            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
            Logging In...
          </>
        ) : (
          'View My Cards'
        )}
      </Button>
    </Form>
  );
} 