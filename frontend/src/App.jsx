import { useState } from 'react';
import axios from 'axios';

function App() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/chat', { prompt });
      setResponse(res.data.text);
      setAudioUrl(`http://localhost:5000${res.data.audioUrl}`);
    } catch (err) {
      console.error('Error:', err);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto space-y-4 text-center">
      <h1 className="text-xl font-bold">Powered by: Gemini and 11Labs</h1>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full p-2 border rounded"
        placeholder="Type your prompt here..."
      />
      <button
        onClick={handleSubmit}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        disabled={loading}
      >
        {loading ? 'Loading...' : 'Submit'}
      </button>

      {response && (
        <>
          <p className="mt-4">{response}</p>
          {audioUrl && (
            <audio controls src={audioUrl} className="mt-2 w-full">
              Your browser does not support the audio element.
            </audio>
          )}
        </>
      )}
    </div>
  );
}

export default App;
