import { useState } from 'react';

function App() {
  // State to manage user input
  const [prompt, setPrompt] = useState('');
  // State to store all chat messages
  const [messages, setMessages] = useState([]);
  // State to track if speech synthesis is active
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Speech synthesis instance
  const synth = window.speechSynthesis;

  // Function to speak given text using Web Speech API
  const speak = (text) => {
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = synth.getVoices().find(v => v.name === 'Google US English') || synth.getVoices()[0];
    utterance.pitch = 1;
    utterance.rate = 1;
    utterance.onend = () => setIsSpeaking(false);
    synth.speak(utterance);
    setIsSpeaking(true);
  };

  // Function to stop currently playing speech
  const stop = () => {
    synth.cancel();
    setIsSpeaking(false);
  };

  // Function to handle user submitting a prompt
  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    // Add user's message to chat
    const userMessage = { sender: 'user', text: prompt };
    setMessages(prev => [userMessage, ...prev]);
    setPrompt('');

    // Send request to backend API
    const res = await fetch('http://localhost:5000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();

    // Add AI's response to chat
    const aiMessage = { sender: 'ai', text: data.text };
    setMessages(prev => [aiMessage, ...prev]);
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      {/* Title and subtitle */}
      <header className="text-center mb-4">
        <h1 className="text-2xl font-bold">AI-Chatbot by Gerald T.</h1>
        <p className="text-sm text-gray-500">powered by Gemini</p>
      </header>

      {/* Chat message window */}
      <div className="flex-1 overflow-y-auto space-y-4 flex flex-col-reverse">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-xs ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'}`}>
              {msg.text}
              {/* Play/pause controls for AI messages */}
              {msg.sender === 'ai' && (
                <div className="mt-2 flex gap-2">
                  <button onClick={() => speak(msg.text)} disabled={isSpeaking} className="text-sm bg-green-600 text-white px-2 py-1 rounded disabled:opacity-50">▶</button>
                  <button onClick={stop} disabled={!isSpeaking} className="text-sm bg-red-600 text-white px-2 py-1 rounded disabled:opacity-50">■</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Message input field */}
      <div className="mt-4 flex gap-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="flex-1 p-2 border rounded"
          placeholder="Type your message..."
        />
        <button
          onClick={handleSubmit}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default App;
