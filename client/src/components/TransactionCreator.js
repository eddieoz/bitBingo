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
  blockHash,
  apiUrl
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

      const response = await axios.post(`${apiUrl}/submit-transaction`, {
        txId: submittedTxId.trim()
      });
      
      setMessage('Transaction ID submitted successfully!');
      onTransactionCreated(response.data);
    } catch (err) {
      console.error('Error submitting transaction ID:', err);
      setError(err.response?.data?.error || 'Error submitting transaction ID');
    } finally {
      setLoading(false);
    }
  };

  const checkTransactionStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      setMessage('Checking transaction status...');

      const response = await axios.get(`${apiUrl}/check-transaction`);
      
      if (response.data.confirmed) {
        setMessage(`Transaction confirmed in block! Confirmations: ${response.data.confirmations || 1}`);
        onTransactionConfirmed(response.data);
      } else if (response.data.status === 'pending') {
        setMessage('Transaction found but not yet confirmed in a block. Try checking again later.');
      } else if (response.data.status === 'not_found') {
        setMessage('Transaction ID not found on the blockchain yet. It may still be propagating.');
      } else if (response.data.status === 'invalid') {
        setError('Transaction does not contain the correct IPFS hash');
      }
    } catch (err) {
      console.error('Error checking transaction status:', err);
      setError(`Error checking transaction: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderHexCIDInstructions = () => {
    if (!fileHash) return null;
    
    return (
      <Card className="mt-3 mb-3 bg-light">
        <Card.Body>
          <Card.Title>Create Transaction Instructions</Card.Title>
          <p>For security, this app doesn't handle private keys or create transactions. Please follow these steps:</p>
          <ol>
            <li>Copy the hex CID below</li>
            <li>Create a Bitcoin transaction in your preferred wallet that includes this CID in an OP_RETURN output</li>
            <li>Submit the transaction ID once broadcast</li>
          </ol>
          
          <InputGroup className="mb-3">
            <Form.Control
              type="text"
              value={fileHash}
              readOnly
              onClick={(e) => e.target.select()}
            />
            <Button 
              variant="outline-secondary" 
              onClick={copyHexCIDToClipboard}
            >
              Copy
            </Button>
          </InputGroup>
        </Card.Body>
      </Card>
    );
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
          {!isConfirmed && (
            <Button 
              variant="primary"
              onClick={checkTransactionStatus}
              disabled={loading}
              className="mt-3"
            >
              {loading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                  Checking...
                </>
              ) : 'Check Transaction Status'}
            </Button>
          )}
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
              disabled={isDisabled || !fileHash}
            />
            <Button 
              variant="primary" 
              type="submit"
              disabled={isDisabled || loading || !fileHash || !submittedTxId.trim()}
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
      {error && <Alert variant="danger">{error}</Alert>}
      {message && <Alert variant="info">{message}</Alert>}
      
      {renderHexCIDInstructions()}
      {renderTxIdForm()}
      {renderTransactionDetails()}
    </div>
  );
};

export default TransactionCreator; 