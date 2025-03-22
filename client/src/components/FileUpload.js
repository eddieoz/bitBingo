import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { Button, Alert, Spinner, Form } from 'react-bootstrap';

const FileUpload = ({ onUploadSuccess, isDisabled, apiUrl }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const onDrop = acceptedFiles => {
    // Only accept CSV files
    const selectedFile = acceptedFiles[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setError(null);
    } else {
      setFile(null);
      setError('Please select a CSV file');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: false,
    disabled: isDisabled || uploading
  });

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setMessage(null);

      const formData = new FormData();
      formData.append('csvFile', file);

      const response = await axios.post(apiUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setMessage('File uploaded successfully!');
      console.log('Upload response:', response.data);
      onUploadSuccess(response.data);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err.response?.data?.error || 'Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div
        {...getRootProps()}
        className={`dropzone p-4 mb-3 text-center border rounded ${
          isDragActive ? 'border-primary' : ''
        } ${isDisabled ? 'bg-light' : ''}`}
        style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
      >
        <input {...getInputProps()} disabled={isDisabled || uploading} />
        {isDragActive ? (
          <p>Drop the CSV file here...</p>
        ) : (
          <p>Drag and drop a CSV file here, or click to select a file</p>
        )}
        {file && <p className="mt-2">Selected: {file.name}</p>}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Button
        variant="primary"
        onClick={handleUpload}
        disabled={!file || uploading || isDisabled}
        className="w-100"
      >
        {uploading ? (
          <>
            <Spinner
              as="span"
              animation="border"
              size="sm"
              role="status"
              aria-hidden="true"
              className="me-2"
            />
            Uploading...
          </>
        ) : (
          'Upload CSV File'
        )}
      </Button>

      {isDisabled && file && (
        <Alert variant="info" className="mt-3">
          A file has already been uploaded for this raffle.
        </Alert>
      )}
    </div>
  );
};

export default FileUpload; 