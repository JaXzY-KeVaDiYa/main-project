import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Snackbar,
  Alert
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { createWorker } from 'tesseract.js';
import './styles.css';

const ImageToText = ({ onSwitchToTTS }) => {
  const [imagePreview, setImagePreview] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  
  const fileInputRef = useRef(null);
  const uploadAreaRef = useRef(null);
  const workerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const initializeWorker = async () => {
    try {
      const worker = await createWorker();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      workerRef.current = worker;
    } catch (error) {
      console.error('Error initializing worker:', error);
      throw new Error('Failed to initialize OCR worker');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploadAreaRef.current) {
      uploadAreaRef.current.classList.add('highlight');
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploadAreaRef.current) {
      uploadAreaRef.current.classList.remove('highlight');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploadAreaRef.current) {
      uploadAreaRef.current.classList.remove('highlight');
    }
    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleFiles = (files) => {
    if (files.length > 0) {
      const file = files[0];
      if (!file.type.match('image.*')) {
        setError('Please select an image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        // Create an image to get dimensions
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions maintaining aspect ratio
          const maxWidth = 800;
          const maxHeight = 600;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (maxWidth * height) / width;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = (maxHeight * width) / height;
            height = maxHeight;
          }

          // Create canvas to resize image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Set the resized image as preview
          setImagePreview(canvas.toDataURL('image/jpeg', 0.8));
          setExtractedText('');
          setError('');
        };
        img.src = e.target.result;
      };
      reader.onerror = () => {
        setError('Error reading file');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    handleFiles(e.target.files);
  };

  const handleRemoveImage = () => {
    setImagePreview('');
    setExtractedText('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const extractText = async () => {
    if (!imagePreview) {
      setError('Please upload an image first');
      return;
    }

    try {
      setIsProcessing(true);
      setError('');
      setProgress(0);

      if (!workerRef.current) {
        await initializeWorker();
      }

      // Perform OCR
      const result = await workerRef.current.recognize(imagePreview);
      setExtractedText(result.data.text || 'No text found in image');
      setProgress(100);
    } catch (err) {
      console.error('OCR Error:', err);
      setError('Error processing the image. Please try again.');
      
      if (workerRef.current) {
        await workerRef.current.terminate();
        workerRef.current = null;
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(extractedText);
      setShowCopySuccess(true);
    } catch (err) {
      setError('Failed to copy text to clipboard');
    }
  };

  const handleSendToSpeech = () => {
    if (extractedText) {
      // Store both the text and a flag to indicate we should start speaking
      localStorage.setItem('textToSpeak', extractedText);
      localStorage.setItem('shouldSpeak', 'true');
      onSwitchToTTS();
    }
  };

  return (
    <Box className="image-to-text-container">
      <Paper elevation={3} className="upload-panel">
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h5" gutterBottom>
              Image to Text
            </Typography>
          </Grid>

          <Grid item xs={12}>
            {!imagePreview ? (
              <Box
                ref={uploadAreaRef}
                className="upload-area"
                onClick={handleUploadClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <CloudUploadIcon fontSize="large" />
                <Typography variant="body1">
                  Drag & Drop an image here or click to upload
                </Typography>
              </Box>
            ) : (
              <Box className="preview-container">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="preview-image"
                  style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
                />
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleRemoveImage}
                  startIcon={<DeleteIcon />}
                  className="remove-btn"
                >
                  Remove Image
                </Button>
              </Box>
            )}
          </Grid>

          {error && (
            <Grid item xs={12}>
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            </Grid>
          )}

          <Grid item xs={12}>
            <Box display="flex" justifyContent="center" gap={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={extractText}
                disabled={!imagePreview || isProcessing}
                startIcon={isProcessing ? <CircularProgress size={24} /> : <TextSnippetIcon />}
                className="primary-btn"
              >
                {isProcessing ? `Processing ${progress}%` : 'Extract Text'}
              </Button>
            </Box>
          </Grid>

          {extractedText && (
            <Grid item xs={12}>
              <Paper elevation={1} className="results-container">
                <Typography variant="h6" gutterBottom>
                  Extracted Text:
                </Typography>
                <Typography variant="body1" className="extracted-text" style={{ whiteSpace: 'pre-wrap' }}>
                  {extractedText}
                </Typography>
                <Box display="flex" gap={2} mt={2}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleCopyText}
                    startIcon={<ContentCopyIcon />}
                    className="primary-btn"
                    fullWidth
                  >
                    Copy Text
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleSendToSpeech}
                    startIcon={<RecordVoiceOverIcon />}
                    className="primary-btn"
                    fullWidth
                  >
                    Send to Text-to-Speech
                  </Button>
                </Box>
              </Paper>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Snackbar
        open={showCopySuccess}
        autoHideDuration={2000}
        onClose={() => setShowCopySuccess(false)}
      >
        <Alert onClose={() => setShowCopySuccess(false)} severity="success">
          Text copied to clipboard!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ImageToText; 