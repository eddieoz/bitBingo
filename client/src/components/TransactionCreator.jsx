import React, { useState } from 'react';
import { Button, Alert, Spinner, Card, Form, InputGroup } from 'react-bootstrap';
import axios from 'axios';

const TransactionCreator = ({
  onTransactionCreated,
  onTransactionConfirmed,
  isDisabled,
  isConfirmed,
  fileHash,
  txId,
  participantFilename,
  blockHash,
  apiUrl,
  onReset,
  selectedGameMode
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [submittedTxId, setSubmittedTxId] = useState('');

  // Copy hex CID to clipboard
  const copyHexCIDToClipboard = async () => {
    if (fileHash) {
      try {
        await navigator.clipboard.writeText(fileHash);
        setMessage('CID copied to clipboard!');
        setTimeout(() => setMessage(null), 3000);
      } catch (err) {
        console.error('Failed to copy:', err);
        setError('Failed to copy to clipboard. Please select and copy manually.');
      }
    }
  };

  // Submit transaction ID provided by the user
  const submitTransactionId = async (e) => {
    e.preventDefault();
    
    if (!submittedTxId.trim()) {
      setError('Please enter a transaction ID');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      // Call /api/check-transaction with txid and filename
      const response = await axios.post(`${apiUrl}/api/check-transaction`, { 
        txid: submittedTxId.trim(),
        participantFilename: participantFilename,
        gameMode: selectedGameMode
      });
      
      // The check-transaction endpoint confirms immediately if valid
      console.log('Check transaction response:', response.data);
      setMessage(response.data.message || 'Transaction check successful!');
      
      // Update parent state based on successful check
      onTransactionCreated({ txId: submittedTxId.trim() });
      onTransactionConfirmed(response.data); 
    } catch (err) {
      console.error('Error during transaction check:', err);
      // Use message from server response if available
      const errorMsg = err.response?.data?.message || err.message || 'Error checking transaction';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const renderTransactionDetails = () => {
    if (!txId) return null;
    
    return (
      <Card className="mt-3 mb-3 bg-light">
        <Card.Body>
          <Card.Title>Transaction Details</Card.Title>
          <div className="small">
            <div><strong>TX ID:</strong> {txId}</div>
            {blockHash && (
              <div><strong>Block Hash:</strong> {blockHash}</div>
            )}
            <div><strong>Status:</strong> {isConfirmed ? 'Confirmed' : 'Pending confirmation'}</div>
          </div>
        </Card.Body>
      </Card>
    );
  };

  const renderTxIdForm = () => {
    if (txId) return null;
    
    return (
      <Form onSubmit={submitTransactionId}>
        <Form.Group className="mb-3">
          <Form.Label>Enter Transaction ID</Form.Label>
          <InputGroup>
            <Form.Control
              type="text"
              value={submittedTxId}
              onChange={(e) => setSubmittedTxId(e.target.value)}
              placeholder="Enter the transaction ID after broadcast"
              disabled={isDisabled}
            />
            <Button 
              variant="primary" 
              type="submit"
              disabled={isDisabled || loading || !submittedTxId.trim()}
            >
              {loading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                  Submitting...
                </>
              ) : 'Submit'}
            </Button>
          </InputGroup>
        </Form.Group>
      </Form>
    );
  };

  return (
    <div>
      {/* Error/Message Alerts first */} 
      {error && (
          <Alert variant="danger">
              {typeof error === 'string' ? error : JSON.stringify(error)}
          </Alert>
      )}
      {message && (
          <Alert variant="info">
              {typeof message === 'string' ? message : JSON.stringify(message)}
          </Alert>
      )}

      {/* Conditional rendering based on txId */} 
      {txId ? (
        // If txId exists, only show details
        renderTransactionDetails()
      ) : (
        // If txId does NOT exist, show Instructions (if fileHash exists) and Form (if participantFilename exists)
        <>
          {fileHash && (
            <Card className="mb-3 bg-light border-secondary">
              <Card.Body>
                <Card.Title>Create Transaction Instructions</Card.Title>
                <p className="small">
                  For security, this app doesn't handle private keys or create transactions. 
                  Please follow these steps:
                </p>
                <ol className="small">
                  <li>Copy the hex CID below</li>
                  <li>Create a Bitcoin transaction in your preferred wallet that includes this CID in an OP_RETURN output</li>
                  <li>Submit the transaction ID once broadcast</li>
                </ol>
                <InputGroup className="mb-3">
                  <Form.Control
                    value={fileHash}
                    readOnly
                    aria-label="Hex CID"
                    className="bg-white"
                  />
                  <Button 
                    variant="outline-secondary" 
                    onClick={copyHexCIDToClipboard}
                    disabled={!fileHash}
                  >
                    Copy
                  </Button>
                </InputGroup>
              </Card.Body>
            </Card>
          )}

          {participantFilename && renderTxIdForm()} 
        </>
      )}
    </div>
  );
};

export default TransactionCreator; 