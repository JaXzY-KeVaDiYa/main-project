import React, { useState } from 'react';
import { Container, Box, Typography, Tabs, Tab, Paper } from '@mui/material';
import VoiceChanger from './components/VoiceChanger';
import ImageToText from './components/ImageToText';
import TextToSpeech from './components/TextToSpeech';
import './App.css';

function App() {
  const [currentTab, setCurrentTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const switchToTTS = () => {
    setCurrentTab(2); // Index of the TextToSpeech tab
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h3" component="h1" align="center" gutterBottom>
          Advanced Voice Changer
        </Typography>
        
        <Paper sx={{ mb: 2 }}>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label="Voice Effects" />
            <Tab label="Image to Text" />
            <Tab label="Text to Speech" />
          </Tabs>
        </Paper>

        {currentTab === 0 && <VoiceChanger />}
        {currentTab === 1 && <ImageToText onSwitchToTTS={switchToTTS} />}
        {currentTab === 2 && <TextToSpeech />}
      </Box>
    </Container>
  );
}

export default App;
