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
  raffle
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [winnerCount, setWinnerCount] = useState(1);
  // Reset internal state when onReset is called
  useEffect(() => {
    if (window) {
      let winnerCountLocal = localStorage.getItem("winnerCount")
      setWinnerCount(winnerCountLocal)
    }
    if (onReset) {
      setError(null);
    }
    console.log(raffle)
  }, [onReset]);

  const handleSetWinnerCount = (winnerCountRaw) => {
    const winnerCountNum = parseInt(winnerCountRaw)
    localStorage.setItem("winnerCount", winnerCountNum)
    setWinnerCount(winnerCountNum)
  }

  const calculateWinner = async () => {
    if (!blockHash) {
      setError('Block hash not available');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${apiUrl}/calculate-winner?winnerCount=${winnerCount}`);
      onWinnerCalculated(response.data);
    } catch (err) {
      console.error('Error calculating winner:', err);
      setError(err.response?.data?.error || 'Error calculating winner');
    } finally {
      setLoading(false);
    }
  };

  const renderCalculation = () => {
    if (!raffle?.calculation) return null;

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
        {raffle && 
          <Card.Body>
            <Card.Title>Winner Calculation</Card.Title>
            <div className="small">
              <div>
                <div><strong>Participant Count:</strong> {raffle.calculation.participantCount}</div>
                <strong>Block Hash:</strong>{' '}
                <a
                  href={getBlockExplorerUrl(raffle.calculation.blockHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View block on explorer"
                >
                  {raffle.calculation.blockHash.replace(/^0+/, "")}
                </a>
              </div>
              {raffle?.winner.map((winner) => (
              <div>
                <div><strong>Winner {winner.ticket} Entropy:</strong> 
                    <p>{winner.derivationPath}<br/>
                    {winner.hashPart}</p>
                </div>
              </div>
              ))}
            </div>
          </Card.Body>
          }
      </Card>
    );
  };

  const renderWinner = () => {
    if (!winner) return null;

    return (
      <Card className="mb-3 bg-success text-white">
        <h3 className="d-flex justify-content-center">🎉 Winners Announced! 🎉</h3>
        {raffle && raffle?.winner.map((winner,index) => (
        <Card.Body className="text-center">
          <Card.Title className="mb-3">{winner.name || 'Unknown'} {index+1}º</Card.Title>
          <p>Ticket #{winner.ticket || 'N/A'}</p>
        </Card.Body>))}
      </Card>
    );
  };

  return (
    <div>
      {error && <Alert variant="danger">{error}</Alert>}

      <Row >
        <Col md={winner ? 6 : 12}>
          <div className="form-group">
            <label for="winnerCount">Winner count</label>
            <input className='form-control' type="number" class="form-control" id="winnerCount" value={winnerCount} onInput={(e) => handleSetWinnerCount(e.target.value)} />
          </div>
          </Col>
      </Row>
      <Row>

        <Col md={winner ? 6 : 12}>
          <br />
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
