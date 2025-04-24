import React, { useState } from 'react';
import { Card, Button, Badge, Row, Col } from 'react-bootstrap';

const RaffleStatus = ({ raffleState, onRefresh, onReset }) => {
  const {
    fileUploaded,
    fileHash,
    participantCount,
    txId,
    txConfirmed,
    blockHash,
    winner,
    ipfsHash,
    loading
  } = raffleState;

  const [copyButtonText, setCopyButtonText] = useState('Copy');
  const ipfsGatewayBase = process.env.REACT_APP_PINATA_PUBLIC_GATEWAY_BASE || 'https://ipfs.io/ipfs/';

  const getStatusBadge = (completed, text) => {
    return (
      <Badge bg={completed ? 'success' : 'secondary'}>
        {completed ? '✓ ' + text : 'Pending'}
      </Badge>
    );
  };

  const truncateHash = (hash) => {
    if (!hash) return '';
    return hash.substring(0, 8) + '...' + hash.substring(hash.length - 8);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyButtonText('Copied!');
      setTimeout(() => setCopyButtonText('Copy'), 2000); // Reset after 2 seconds
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      setCopyButtonText('Error');
      setTimeout(() => setCopyButtonText('Copy'), 2000);
    });
  };

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>
          Raffle Status
          <a href="https://github.com/eddieoz/bitRaffle/blob/master/docs/how-to-use.md" target="_blank" rel="noopener noreferrer" className="ms-2 small">(How to Use)</a>
        </span>
        <div>
          <Button 
            variant="outline-primary" 
            size="sm" 
            onClick={onRefresh}
            disabled={loading}
            className="me-2"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button 
            variant="outline-danger" 
            size="sm" 
            onClick={onReset}
            disabled={loading}
          >
            {loading ? 'Resetting...' : 'Reset'}
          </Button>
        </div>
      </Card.Header>
      <Card.Body>
        <Row>
          <Col md={4} className="mb-3">
            <h6>File Upload {getStatusBadge(fileUploaded, 'Uploaded')}</h6>
            {fileUploaded && (
              <div className="small">
                <div>Participants: {participantCount}</div>
                <div>Hex CID: {truncateHash(fileHash)}</div>
                {ipfsHash && (
                  <div>
                    IPFS: <a href={`${ipfsGatewayBase}${ipfsHash}`} target="_blank" rel="noopener noreferrer">{truncateHash(ipfsHash)}</a>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="ms-2 py-0 px-1"
                      onClick={() => handleCopy(`${ipfsGatewayBase}${ipfsHash}`)}
                    >
                      {copyButtonText}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Col>
          <Col md={4} className="mb-3">
            <h6>Transaction {getStatusBadge(txId !== null, 'Submitted')}</h6>
            {txId && (
              <div className="small">
                <div>TX ID: {truncateHash(txId)}</div>
                <div>Status: {txConfirmed ? 'Confirmed' : 'Monitoring...'}</div>
                {blockHash && <div>Block Hash: {truncateHash(blockHash)}</div>}
              </div>
            )}
          </Col>
          <Col md={4} className="mb-3">
            <h6>Winner {getStatusBadge(winner !== null && winner.length > 0, 'Drawn')}</h6>
            {winner && winner.length > 0 && (
              <div className="small">
                <div>Name: {winner[0].name || 'Unknown'}</div>
                <div>Ticket #: {winner[0].ticket || 'N/A'}</div>
              </div>
            )}
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

export default RaffleStatus; 