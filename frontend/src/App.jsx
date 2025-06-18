import { useState, useRef, useEffect, useCallback } from 'react';

function App() {
  // State to manage user input for text messages
  const [prompt, setPrompt] = useState('');
  // State to store all chat messages (text or voice indicators)
  const [messages, setMessages] = useState([]);
  // State to track if any audio is currently playing
  const [isSpeaking, setIsSpeaking] = useState(false);
  // State to track if the microphone is actively recording
  const [isRecording, setIsRecording] = useState(false);
  // State to track if the AI is processing a request (loading indicator)
  const [isLoading, setIsLoading] = useState(false);

  // useRef to hold the MediaRecorder instance throughout the component's lifecycle
  const mediaRecorderRef = useRef(null);
  // useRef to accumulate audio data chunks as they are recorded
  const audioChunksRef = useRef([]);
  // useRef to hold the Audio object for controlling playback
  const currentAudioRef = useRef(null);
  // useState for playingMessageIndex to trigger re-renders and correctly manage button states
  const [playingMessageIndex, setPlayingMessageIndex] = useState(null); 
  // Ref for the chat container to enable auto-scrolling
  const chatContainerRef = useRef(null);


  // Base URL for your backend API. IMPORTANT: Ensure this matches your backend server's port.
  const API_BASE_URL = 'http://localhost:5000'; 

  // Effect to scroll to the bottom of the chat window on message update
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // --- Utility for playing audio (from backend TTS) ---
  const playAudioBlob = useCallback((audioBlob, messageIndex = null) => {
    // Stop any currently playing audio before starting a new one
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    
    // Create a URL for the audio Blob
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    currentAudioRef.current = audio; // Store reference to current audio
    
    // Immediately set the playing message index state to trigger re-render
    setPlayingMessageIndex(messageIndex); 
    
    audio.oncanplaythrough = () => {
      audio.play();
      setIsSpeaking(true); // Set speaking state
      console.log("Playing audio response from backend...");
    };
    
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl); // Clean up the object URL after playing
      setIsSpeaking(false);
      currentAudioRef.current = null;
      setPlayingMessageIndex(null); // Clear playing index
      console.log("Audio playback ended.");
    };

    audio.onerror = (e) => {
      console.error("Error playing audio:", e);
      URL.revokeObjectURL(audioUrl);
      setIsSpeaking(false);
      currentAudioRef.current = null;
      setPlayingMessageIndex(null); // Clear playing index
      // setMessages(prev => [...prev, { sender: 'system', text: `Please try again` }]);
    };
  }, [setPlayingMessageIndex]); // Dependency added for setPlayingMessageIndex

  // --- Function to stop audio playback ---
  const stopPlayingAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = ''; // Clear source to stop loading
      currentAudioRef.current = null;
      setIsSpeaking(false);
      setPlayingMessageIndex(null); // Clear state to trigger re-render
      console.log("Audio playback manually stopped.");
    }
  }, [setPlayingMessageIndex]);

  // --- Function to handle user submitting a text prompt ---
  const handleTextSubmit = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return; 

    setIsLoading(true); // Start loading indicator
    stopPlayingAudio(); // Stop any ongoing AI speech

    // Add user's message to the chat display
    setMessages(prev => [...prev, { sender: 'user', text: trimmedPrompt }]);
    setPrompt(''); // Clear the input field

    try {
      // Send the text prompt to the backend's /chat-text endpoint
      const res = await fetch(`${API_BASE_URL}/chat-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmedPrompt })
      });

      if (!res.ok) {
        const errorData = await res.json(); 
        throw new Error(`Backend error: ${errorData.error || res.statusText}`);
      }

      const data = await res.json(); 
      const aiResponseText = data.text;
      const aiAudioContentBase64 = data.aiAudioContent; 

      // Update messages state and get the index of the newly added AI message
      const newAiMessageIndex = messages.length;
      const aiMessage = { 
        sender: 'ai', 
        text: aiResponseText, 
        aiAudioContent: aiAudioContentBase64, 
        messageIndex: newAiMessageIndex 
      };

      // Add AI message to state
      setMessages(prev => [...prev, aiMessage]);

      // Immediately play voice responce
      if (aiAudioContentBase64) {
        playBase64AudioWithUI(aiAudioContentBase64, newAiMessageIndex);
      }

    } catch (error) {
      console.error("Text chat error:", error);
      const errorMessage = { sender: 'system', text: `Error: ${error.message}` };
      setMessages(prev => [...prev, errorMessage]); // Add error to end of chat
    } finally {
      setIsLoading(false); // Stop loading indicator
    }
  };

  // --- Functions for Voice Input (STT) and Voice Output (TTS) via Backend ---

  // Function to start recording audio from the microphone
  const startRecording = async () => {
    try {
      // Stop any ongoing AI speech
      stopPlayingAudio();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Create a new MediaRecorder instance.
      // Using 'audio/webm;codecs=opus' for good compatibility and quality.
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      audioChunksRef.current = []; // Clear previous audio chunks

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        console.log("Recorded audio blob:", audioBlob);
        
        // Immediately display a "Processing voice..." message
        setMessages(prev => [...prev, { sender: 'system', text: "Processing voice..." }]);

        await sendVoiceMessage(audioBlob); // Send the recorded audio to the backend

        // Stop the media stream tracks to release microphone access
        stream.getTracks().forEach(track => track.stop());
        console.log("Microphone stream stopped.");
      };

      mediaRecorderRef.current.start();
      setIsRecording(true); // Update recording state
      console.log("Recording started...");
      setMessages(prev => [...prev, { sender: 'system', text: "Voice recording started..." }]);

    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Please allow microphone access to use voice chat."); // Inform the user
      setMessages(prev => [...prev, { sender: 'system', text: `Microphone access denied or error: ${e.message}` }]);
    }
  };

  // Function to stop recording audio
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop(); // Stop the recording
      setIsRecording(false); // Update recording state
      console.log("Recording stopped.");
      // Remove the "Voice recording started..." message
      setMessages(prev => prev.filter(msg => msg.text !== "Voice recording started..."));
    }
  };

  const playBase64AudioWithUI = useCallback((base64Audio, messageIndex) => {
    if (!base64Audio) return;

    // Decode base64 to a Blob
    const audioBlob = new Blob(
      [Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0))],
      { type: 'audio/mpeg' }
    );

    // Set state to reflect active playback
    setPlayingMessageIndex(messageIndex);
    setIsSpeaking(true);

    // Play audio and let existing handlers handle cleanup
    playAudioBlob(audioBlob, messageIndex);       
  }, [playAudioBlob]);

  // Function to send the recorded voice message to the backend
  const sendVoiceMessage = async (audioBlob) => {
    setIsLoading(true); // Start loading indicator

    const formData = new FormData();
    formData.append("audio", audioBlob, "voice_message.webm"); 

    try {
      const res = await fetch(`${API_BASE_URL}/chat-voice`, {
        method: 'POST',
        body: formData, // No 'Content-Type' header needed for FormData; browser sets it automatically
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => res.text()); 
        throw new Error(`Backend voice chat error: ${typeof errorData === 'object' ? errorData.error : errorData || res.statusText}`);
      }

      // Backend now sends a JSON object with user's transcription, AI's text, and base64 audio
      const data = await res.json();
      const userTranscription = data.userTranscription; // User's transcribed text
      const aiResponseText = data.aiText;                // AI's text response
      const aiAudioContentBase64 = data.aiAudioContent;  // AI's audio response

      // Remove "Processing voice..." and add actual user transcription
      setMessages(prev => prev.filter(msg => msg.text !== "Processing voice..."));
      setMessages(prev => [...prev, { sender: 'user', text: userTranscription }]);
      
      // Add the AI's text response to chat, storing its audio content
      setMessages(prev => {
        const newAiMessageIndex = prev.length; // Correct index for the new AI message
        const aiMessage = { sender: 'ai', text: aiResponseText, aiAudioContent: aiAudioContentBase64, messageIndex: newAiMessageIndex };

        // Immediately play voice responce
        if (aiAudioContentBase64) {
          playBase64AudioWithUI(aiAudioContentBase64, newAiMessageIndex);
        }
        return [...prev, aiMessage];
      });

    } catch (error) {
      console.error("Voice message sending error:", error);
      // Remove "Processing voice..." on error
      setMessages(prev => prev.filter(msg => msg.text !== "Processing voice...")); 
      const errorMessage = { sender: 'system', text: `Error processing voice: ${e.message}` };
      setMessages(prev => [...prev, errorMessage]); // Add error to end of chat
    } finally {
      setIsLoading(false); // Stop loading indicator
    }
  };

  // Function to re-play a specific AI audio message from its stored base64 content
  const replayAudioMessage = useCallback((audioContentBase64, messageIndex) => {
    // Stop any currently playing audio before starting a new one, unless it's the same message
    if (isSpeaking && playingMessageIndex === messageIndex) {
      stopPlayingAudio(); // If it's already playing, stop it
      return; // And don't restart playback
    }

    const audioBlobFromBase64 = new Blob(
      [Uint8Array.from(atob(audioContentBase64), c => c.charCodeAt(0))], 
      { type: 'audio/mpeg' }
    );
    playAudioBlob(audioBlobFromBase64, messageIndex);
    
  }, [isSpeaking, playingMessageIndex, playAudioBlob, stopPlayingAudio]); // Dependencies

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4 font-['Inter']">
      {/* Title and subtitle */}
      <header className="text-center mb-4 p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg shadow-md">
        <h1 className="text-3xl font-bold mb-1">AI-Chatbot by Gerald T.</h1>
        <p className="text-md text-purple-100">Powered by Gemini with Google Cloud Voice 🚀</p>
      </header>

      {/* Chat message window */}
      <div 
        ref={chatContainerRef} 
        className="flex-1 overflow-y-auto space-y-4 flex flex-col p-4 bg-gray-50 rounded-lg shadow-inner mb-4"
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-xl shadow-sm max-w-xs transition-all duration-300 ${
              msg.sender === 'user' 
                ? 'bg-blue-500 text-white rounded-br-none' 
                : 'bg-gray-200 text-gray-800 rounded-bl-none'
            }`}>
              {msg.text}
              {/* Play/Stop button for AI's spoken responses */}
              {msg.sender === 'ai' && msg.aiAudioContent && ( // Only show if it's an AI message AND has audio content
                <div className="mt-2 flex gap-2">
                  <button 
                    onClick={() => replayAudioMessage(msg.aiAudioContent, i)} 
                    // Disabled if currently speaking AND this specific message is the one playing
                    disabled={isSpeaking && playingMessageIndex === i} 
                    className="text-sm bg-green-600 text-white px-2 py-1 rounded-md shadow-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {isSpeaking && playingMessageIndex === i ? 'Playing...' : '▶ Play'} 
                  </button>
                  <button 
                    onClick={stopPlayingAudio} 
                    // Only enable if currently speaking AND this specific message is the one playing
                    disabled={!isSpeaking} 
                    className="text-sm bg-red-600 text-white px-2 py-1 rounded-md shadow-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    ■ Stop
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {/* Loading indicator for AI processing */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="p-3 rounded-xl shadow-sm bg-gray-200 text-gray-800 rounded-bl-none animate-pulse">
              AI is thinking...
            </div>
          </div>
        )}
      </div>

      {/* Message input field and voice controls */}
      <div className="mt-4 flex flex-col gap-3 p-4 bg-white rounded-lg shadow-lg">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none"
          placeholder="Type your message..."
          rows="3" // Provide ample space for typing
          disabled={isRecording || isSpeaking || isLoading} // Disable typing while recording, speaking, or loading
        />
        <div className="flex gap-3">
          <button
            onClick={handleTextSubmit}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isRecording || isSpeaking || isLoading || !prompt.trim()} // Disable if recording, speaking, loading, or prompt is empty
          >
            Send Text
          </button>
          {!isRecording ? ( // Show "Start Voice" if not recording
            <button
              onClick={startRecording}
              className="flex-shrink-0 bg-purple-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-purple-700 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSpeaking || isLoading} // Disable starting recording if AI is speaking or loading
            >
              Start Voice 🎤
            </button>
          ) : ( // Show "Stop Voice" if recording
            <button
              onClick={stopRecording}
              className="flex-shrink-0 bg-red-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-red-700 transition-all duration-200 font-semibold"
              disabled={isLoading} // Can stop recording even if AI is loading (user might finish speaking)
            >
              Stop Recording ■
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
