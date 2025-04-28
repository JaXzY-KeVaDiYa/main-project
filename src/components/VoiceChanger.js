import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import './styles.css';

const VoiceChanger = () => {
  const [selectedVoice, setSelectedVoice] = useState('robot');
  const [status, setStatus] = useState('Ready to record');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const canvasRef = useRef(null);
  const canvasCtxRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioBufferRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current) {
      canvasCtxRef.current = canvasRef.current.getContext('2d');
      resizeCanvas();
    }

    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
  };

  const resizeCanvas = () => {
    if (canvasRef.current) {
      canvasRef.current.width = canvasRef.current.clientWidth;
      canvasRef.current.height = canvasRef.current.clientHeight;
    }
  };

  const setupFrequencyVisualization = (audioNode) => {
    if (!audioNode || !analyserRef.current || !canvasCtxRef.current || !canvasRef.current) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    audioNode.connect(analyserRef.current);
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!canvasRef.current || !canvasCtxRef.current) return;

      animationFrameRef.current = requestAnimationFrame(draw);

      analyserRef.current.getByteFrequencyData(dataArray);
      canvasCtxRef.current.fillStyle = "rgb(248, 249, 250)";
      canvasCtxRef.current.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      const barWidth = (canvasRef.current.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 2;
        
        const gradient = canvasCtxRef.current.createLinearGradient(0, canvasRef.current.height, 0, 0);
        gradient.addColorStop(0, '#3498db');
        gradient.addColorStop(1, '#2ecc71');
        
        canvasCtxRef.current.fillStyle = gradient;
        canvasCtxRef.current.fillRect(x, canvasRef.current.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  };

  const handleRecord = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 44100,
          latencyHint: 'interactive'
        });
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
      }

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          autoGainControl: false
        }
      });

      recordingStreamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });
      
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const bufferCopy = arrayBuffer.slice(0);

          try {
            audioBufferRef.current = await audioContextRef.current.decodeAudioData(bufferCopy);
            setStatus('Recording complete! Ready to apply effects.');
          } catch (decodeError) {
            console.error('Error decoding audio:', decodeError);
            setStatus('Error processing audio. Please try again.');
          }

          if (recordingStreamRef.current) {
            recordingStreamRef.current.getTracks().forEach(track => track.stop());
          }
        } catch (error) {
          console.error('Error processing recording:', error);
          setStatus('Error: Could not process recording');
        }
      };

      recorder.start(100);
      setIsRecording(true);
      setStatus('Recording... Speak now');

      const microphoneSource = audioContextRef.current.createMediaStreamSource(stream);
      setupFrequencyVisualization(microphoneSource);

    } catch (error) {
      console.error('Error starting recording:', error);
      setStatus('Error: Could not start recording. Please check microphone permissions.');
    }
  };

  const handleStop = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setStatus('Processing recording...');
    }
  };

  const createVoiceEffect = () => {
    if (!audioContextRef.current) return null;

    switch (selectedVoice) {
      case "original": {
        const input = audioContextRef.current.createGain();
        return { input, output: input };
      }

      case "robot": {
        const input = audioContextRef.current.createGain();
        const oscillator = audioContextRef.current.createOscillator();
        const modulator = audioContextRef.current.createGain();
        const ringModOutput = audioContextRef.current.createGain();

        oscillator.frequency.value = 50;
        modulator.gain.value = 0.5;

        input.connect(ringModOutput);
        oscillator.connect(modulator);
        modulator.connect(ringModOutput.gain);
        oscillator.start();

        return { input, output: ringModOutput };
      }

      case "chipmunk": {
        const input = audioContextRef.current.createGain();
        const highpass = audioContextRef.current.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = 500;

        input.connect(highpass);
        
        if (sourceRef.current) {
          sourceRef.current.playbackRate.value = 1.5;
        }

        return { input, output: highpass };
      }

      case "deep": {
        const input = audioContextRef.current.createGain();
        const lowShelf = audioContextRef.current.createBiquadFilter();
        lowShelf.type = "lowshelf";
        lowShelf.frequency.value = 300;
        lowShelf.gain.value = 10;

        input.connect(lowShelf);
        
        if (sourceRef.current) {
          sourceRef.current.playbackRate.value = 0.7;
        }

        return { input, output: lowShelf };
      }

      case "echo": {
        const input = audioContextRef.current.createGain();
        const delay = audioContextRef.current.createDelay();
        const feedback = audioContextRef.current.createGain();
        const wetGain = audioContextRef.current.createGain();
        const dryGain = audioContextRef.current.createGain();
        const merger = audioContextRef.current.createGain();

        delay.delayTime.value = 0.3;
        feedback.gain.value = 0.5;
        wetGain.gain.value = 0.5;
        dryGain.gain.value = 1.0;

        input.connect(dryGain);
        input.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wetGain);
        dryGain.connect(merger);
        wetGain.connect(merger);

        return { input, output: merger };
      }

      default: {
        const input = audioContextRef.current.createGain();
        return { input, output: input };
      }
    }
  };

  const handlePlay = async () => {
    if (!audioBufferRef.current || !audioContextRef.current) return;

    try {
      if (isPlaying && sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        setIsPlaying(false);
        setStatus('Playback stopped');
        return;
      }

      const sourceNode = audioContextRef.current.createBufferSource();
      sourceNode.buffer = audioBufferRef.current;
      sourceRef.current = sourceNode;

      const effect = createVoiceEffect();
      if (!effect) return;

      sourceNode.connect(effect.input);
      effect.output.connect(audioContextRef.current.destination);
      
      setupFrequencyVisualization(effect.output);
      
      sourceNode.onended = () => {
        setIsPlaying(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        setStatus('Playback complete');
      };

      sourceNode.start(0);
      setIsPlaying(true);
      setStatus(`Playing with ${selectedVoice} effect`);

    } catch (error) {
      console.error('Error playing audio:', error);
      setStatus('Error: Could not play audio');
      setIsPlaying(false);
    }
  };

  return (
    <Box className="voice-changer-container">
      <Paper elevation={3} className="control-panel">
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h5" gutterBottom>
              Voice Changer
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Voice Effect</InputLabel>
              <Select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                disabled={isRecording || isPlaying}
                className="voice-selector"
              >
                <MenuItem value="original">Original Voice</MenuItem>
                <MenuItem value="robot">Robot Voice</MenuItem>
                <MenuItem value="chipmunk">Chipmunk Voice</MenuItem>
                <MenuItem value="deep">Deep Voice</MenuItem>
                <MenuItem value="echo">Echo Voice</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <Box className="visualization-container">
              <canvas ref={canvasRef} className="audio-visualizer" />
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Typography
              variant="body1"
              className={isRecording ? 'recording' : ''}
              gutterBottom
            >
              {status}
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Box display="flex" justifyContent="center" gap={2}>
              <Button
                variant="contained"
                color={isRecording ? "error" : "primary"}
                onClick={isRecording ? handleStop : handleRecord}
                startIcon={isRecording ? <StopIcon /> : <MicIcon />}
                className="primary-btn"
              >
                {isRecording ? "Stop Recording" : "Start Recording"}
              </Button>

              <Button
                variant="contained"
                color={isPlaying ? "error" : "secondary"}
                onClick={handlePlay}
                disabled={!audioBufferRef.current || isRecording}
                startIcon={isPlaying ? <StopIcon /> : <PlayArrowIcon />}
                className="primary-btn"
              >
                {isPlaying ? "Stop Playing" : "Play Changed Voice"}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default VoiceChanger; 