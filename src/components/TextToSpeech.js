import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
} from '@mui/material';
import './styles.css';

const TextToSpeech = () => {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [voices, setVoices] = useState([]);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [translatedText, setTranslatedText] = useState('');
  const [showTranslation, setShowTranslation] = useState(false);
  
  // New state for voice recording and effects
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const analyserRef = useRef(null);

  useEffect(() => {
    // Load available voices
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      console.log('Available voices:', availableVoices); // Debug available voices
      setVoices(availableVoices);
      if (availableVoices.length > 0) {
        setSelectedVoice(availableVoices[0].name);
      }
    };

    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Check for text from ImageToText
    const textToSpeak = localStorage.getItem('textToSpeak');
    if (textToSpeak) {
      setText(textToSpeak);
      localStorage.removeItem('textToSpeak');
    }

    // Initialize audio context
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 2048;

    return () => {
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const findVoiceForLanguage = (languageCode) => {
    // Get fresh list of voices
    const availableVoices = speechSynthesis.getVoices();
    console.log('Finding voice for language:', languageCode);
    console.log('Available voices:', availableVoices.map(v => `${v.name} (${v.lang})`));

    // Try to find exact match first
    let voice = availableVoices.find(voice => 
      voice.lang.toLowerCase() === languageCode.toLowerCase() ||
      voice.lang.toLowerCase().startsWith(languageCode.toLowerCase() + '-')
    );

    // If no exact match, try to find a voice that starts with the language code
    if (!voice) {
      voice = availableVoices.find(voice => 
        voice.lang.toLowerCase().startsWith(languageCode.toLowerCase())
      );
    }

    // If still no match, try to find any voice containing the language code
    if (!voice) {
      voice = availableVoices.find(voice => 
        voice.lang.toLowerCase().includes(languageCode.toLowerCase())
      );
    }

    console.log('Selected voice:', voice ? `${voice.name} (${voice.lang})` : 'No matching voice found');
    return voice || availableVoices[0]; // Fallback to first available voice if no match
  };

  const handleTranslate = async () => {
    if (!text) return;

    try {
      // Show loading state in the translation result
      setTranslatedText('Translating...');
      setShowTranslation(true);

      const response = await fetch('http://localhost:8000/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          from: sourceLanguage,
          to: targetLanguage
        })
      });

      if (!response.ok) {
        throw new Error('Translation API error');
      }

      const data = await response.json();
      console.log('Translation response:', data); // For debugging

      if (data.translatedText) {
        setTranslatedText(data.translatedText);
      } else {
        throw new Error('No translation received');
      }
    } catch (error) {
      console.error('Translation error:', error);
      setTranslatedText('Translation failed. Please try again.');
    }
  };

  const handleSpeak = () => {
    if (!text) return;

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoiceObj = voices.find(voice => voice.name === selectedVoice);
    if (selectedVoiceObj) {
      utterance.voice = selectedVoiceObj;
    }
    utterance.rate = rate;
    utterance.pitch = pitch;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    speechSynthesis.speak(utterance);
  };

  const handlePause = () => {
    if (speechSynthesis.speaking && !isPaused) {
      speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const handleResume = () => {
    if (isPaused) {
      speechSynthesis.resume();
      setIsPaused(false);
    }
  };

  const handleStop = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  };

  const handleSpeakTranslation = () => {
    if (!translatedText) return;

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(translatedText);
    
    // Map language codes to their full locale codes if needed
    const languageMapping = {
      'en': 'en-US',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'zh': 'zh-CN',
      'ja': 'ja-JP',
      'ru': 'ru-RU'
    };

    // Set the language and find appropriate voice
    const targetLocale = languageMapping[targetLanguage] || targetLanguage;
    utterance.lang = targetLocale;
    
    const voice = findVoiceForLanguage(targetLocale);
    if (voice) {
      console.log('Using voice:', voice.name, 'for language:', targetLocale);
      utterance.voice = voice;
    }

    // Set rate and pitch
    utterance.rate = rate;
    utterance.pitch = pitch;

    utterance.onstart = () => {
      console.log('Started speaking translation in', targetLocale);
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      console.log('Finished speaking translation');
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
      setIsPaused(false);
    };

    speechSynthesis.speak(utterance);
  };

  // Update the language options to match retry.js exactly
  const languageOptions = [
    { value: 'auto', label: 'Auto-detect', targetOnly: false },
    { value: 'en', label: 'English', targetOnly: true },
    { value: 'es', label: 'Spanish', targetOnly: true },
    { value: 'fr', label: 'French', targetOnly: true },
    { value: 'de', label: 'German', targetOnly: true },
    { value: 'zh', label: 'Chinese', targetOnly: true },
    { value: 'ja', label: 'Japanese', targetOnly: true },
    { value: 'ru', label: 'Russian', targetOnly: true }
  ];

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // You could add a toast notification here
      console.log('Text copied successfully');
    }).catch(err => {
      console.error('Failed to copy text:', err);
    });
  };

  const createVoiceEffect = (audioBuffer, effectType) => {
    const context = audioContextRef.current;
    const source = context.createBufferSource();
    source.buffer = audioBuffer;

    switch (effectType) {
      case 'robot': {
        const oscillator = context.createOscillator();
        const modulator = context.createGain();
        const modulatorGain = context.createGain();
        
        oscillator.frequency.value = 50;
        modulator.gain.value = 0.5;
        
        oscillator.connect(modulator);
        modulator.connect(modulatorGain.gain);
        source.connect(modulatorGain);
        modulatorGain.connect(context.destination);
        oscillator.start();
        break;
      }
      case 'chipmunk': {
        source.playbackRate.value = 1.5;
        const highpass = context.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 500;
        
        source.connect(highpass);
        highpass.connect(context.destination);
        break;
      }
      case 'deep': {
        source.playbackRate.value = 0.7;
        const lowpass = context.createBiquadFilter();
        lowpass.type = 'lowshelf';
        lowpass.frequency.value = 300;
        lowpass.gain.value = 10;
        
        source.connect(lowpass);
        lowpass.connect(context.destination);
        break;
      }
      case 'echo': {
        const delay = context.createDelay();
        const feedback = context.createGain();
        const filter = context.createBiquadFilter();
        
        delay.delayTime.value = 0.3;
        feedback.gain.value = 0.5;
        
        source.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(context.destination);
        source.connect(context.destination);
        break;
      }
      default: {
        // Original voice
        source.connect(context.destination);
      }
    }

    return source;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      // Start speech recognition immediately
      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.lang = sourceLanguage === 'auto' ? 'en-US' : sourceLanguage;
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        setText(prevText => prevText + ' ' + transcript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        stopRecording();
      };

      recognition.onend = () => {
        setIsRecording(false);
        stopRecording();
      };

      // Start recording and recognition
      mediaRecorderRef.current.start();
      recognition.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <div className="text-to-speech-container">
      <div className="voice-options">
        <div className="option-group">
          <label htmlFor="tts-voice">Voice</label>
          <select 
            id="tts-voice" 
            className="voice-selector"
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
          >
            {voices.map((voice) => (
              <option key={voice.name} value={voice.name}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </div>
        <div className="option-group">
          <label htmlFor="tts-rate">Speed</label>
          <input 
            type="range" 
            id="tts-rate" 
            min="0.5" 
            max="2" 
            step="0.1" 
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
          />
          <span id="rate-value">{rate.toFixed(1)}</span>
        </div>
        <div className="option-group">
          <label htmlFor="tts-pitch">Pitch</label>
          <input 
            type="range" 
            id="tts-pitch" 
            min="0.5" 
            max="2" 
            step="0.1" 
            value={pitch}
            onChange={(e) => setPitch(parseFloat(e.target.value))}
          />
          <span id="pitch-value">{pitch.toFixed(1)}</span>
        </div>
      </div>

      <div className="translation-options">
        <div className="option-group">
          <label htmlFor="source-language">Source Language</label>
          <select 
            id="source-language" 
            className="voice-selector"
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.target.value)}
          >
            {languageOptions
              .filter(lang => !lang.targetOnly || lang.value !== 'auto')
              .map(lang => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))
            }
          </select>
        </div>
        <div className="option-group">
          <label htmlFor="target-language">Target Language</label>
          <select 
            id="target-language" 
            className="voice-selector"
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
          >
            {languageOptions
              .filter(lang => lang.value !== 'auto')
              .map(lang => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))
            }
          </select>
        </div>
      </div>

      <div className="text-input-area">
        <div className="textarea-container">
          <textarea 
            id="speech-text" 
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to convert to speech or click the microphone to record speech..."
          />
          <div className="textarea-controls">
            <button 
              className="icon-button"
              onClick={() => handleCopyText(text)}
              title="Copy text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button 
              className={`icon-button ${isRecording ? 'recording' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              title={isRecording ? "Stop recording" : "Start recording"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </button>
          </div>
          <div className="char-count">
            <span id="char-count">{text.length}</span> characters
          </div>
        </div>
      </div>

      {showTranslation && (
        <div className="translation-result" id="translation-result">
          <div className="translation-header">
            <h4>Translation:</h4>
            <button 
              className="icon-button"
              onClick={() => handleCopyText(translatedText)}
              title="Copy translation"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
          <div id="translated-text" style={{ whiteSpace: 'pre-wrap' }}>
            {translatedText}
          </div>
          {translatedText && translatedText !== 'Translating...' && translatedText !== 'Translation failed. Please try again.' && (
            <button 
              id="speak-translation-btn" 
              className="primary-btn"
              onClick={handleSpeakTranslation}
              disabled={isSpeaking}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
              Speak Translation
            </button>
          )}
        </div>
      )}

      <div className="translation-controls">
        <button 
          id="translate-btn" 
          className="primary-btn"
          onClick={handleTranslate}
          disabled={!text}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 8l5 5 5-5"></path>
            <path d="M12 3v10"></path>
            <path d="M3 21h18"></path>
          </svg>
          Translate
        </button>
      </div>

      <div className="tts-controls">
        <button 
          id="speak-btn" 
          className="primary-btn"
          onClick={handleSpeak}
          disabled={!text || isSpeaking}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
          Speak
        </button>
        <button 
          id="pause-btn" 
          className="secondary-btn"
          onClick={isPaused ? handleResume : handlePause}
          disabled={!isSpeaking}
        >
          {isPaused ? "Resume" : "Pause"}
        </button>
        <button 
          id="stop-speech-btn" 
          className="secondary-btn"
          onClick={handleStop}
          disabled={!isSpeaking && !isPaused}
        >
          Stop
        </button>
        <button 
          id="download-audio-btn" 
          className="secondary-btn"
          disabled={!text}
          onClick={() => alert("Audio download functionality requires a RecordRTC or similar library to capture the audio output.")}
        >
          Download
        </button>
      </div>
    </div>
  );
};

export default TextToSpeech; 