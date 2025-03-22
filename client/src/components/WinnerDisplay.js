import React, { useState, useEffect } from 'react';
import { Button, Alert, Spinner, Card, Row, Col } from 'react-bootstrap';
import axios from 'axios';

const WinnerDisplay = ({
  onWinnerCalculated,
  isDisabled,
  blockHash,
  participantCount,
  winner,
  apiUrl,
  onReset,
  calculation
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reset internal state when onReset is called
  useEffect(() => {
    if (onReset) {
      setError(null);
    }
  }, [onReset]);

  const calculateWinner = async () => {
    if (!blockHash) {
      setError('Block hash not available');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${apiUrl}/calculate-winner`);
      onWinnerCalculated(response.data);
    } catch (err) {
      console.error('Error calculating winner:', err);
      setError(err.response?.data?.error || 'Error calculating winner');
    } finally {
      setLoading(false);
    }
  };

  const renderCalculation = () => {
    if (!calculation) return null;
    
    // Determine explorer URL based on blockhash
    const getBlockExplorerUrl = (blockHash) => {
      // Detect if it's testnet or mainnet based on environment or configuration
      // This is a simple heuristic; in a real app you would use a configuration value
      const isTestnet = window.location.hostname.includes('testnet') || 
                       window.location.search.includes('testnet');
      
      return isTestnet
        ? `https://blockstream.info/testnet/block/${blockHash}`
        : `https://blockstream.info/block/${blockHash}`;
    };
    
    return (
      <Card className="mb-3 bg-light">
        <Card.Body>
          <Card.Title>Winner Calculation</Card.Title>
          <div className="small">
            <div>
              <strong>Block Hash:</strong>{' '}
              <a 
                href={getBlockExplorerUrl(calculation.blockHash)} 
                target="_blank" 
                rel="noopener noreferrer"
                title="View block on explorer"
              >
                {calculation.blockHash}
              </a>
            </div>
            <div><strong>Last 8 Characters:</strong> {calculation.blockHash.slice(-8)}</div>
            <div><strong>Numeric Value:</strong> {calculation.numericValue.toLocaleString()}</div>
            <div><strong>Participant Count:</strong> {calculation.participantCount}</div>
            <div><strong>Winner Index:</strong> {calculation.winnerIndex} (Numeric Value % Participant Count)</div>
          </div>
        </Card.Body>
      </Card>
    );
  };

  const renderWinner = () => {
    if (!winner) return null;
    
    return (
      <Card className="mb-3 bg-success text-white">
        <Card.Body className="text-center">
          <Card.Title className="mb-3">🎉 Winner Announced! 🎉</Card.Title>
          <h4>{winner.name || 'Unknown'}</h4>
          <p>Ticket #{winner.ticket || 'N/A'}</p>
        </Card.Body>
      </Card>
    );
  };

  return (
    <div>
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Row>
        <Col md={winner ? 6 : 12}>
          {renderCalculation()}
          
          <Button
            variant="primary"
            onClick={calculateWinner}
            disabled={isDisabled || loading}
            className="w-100"
          >
            {loading ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                Calculating Winner...
              </>
            ) : (
              'Draw Winner'
            )}
          </Button>
          
          {isDisabled && !blockHash && (
            <Alert variant="warning" className="mt-3">
              Please wait for the transaction to be confirmed before drawing a winner.
            </Alert>
          )}
        </Col>
        
        {winner && (
          <Col md={6}>
            {renderWinner()}
          </Col>
        )}
      </Row>
    </div>
  );
};

export default WinnerDisplay; 