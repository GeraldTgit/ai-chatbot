// Load environment variables from .env file
require("dotenv").config();

// Import required modules
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer"); // For handling file uploads
const fs = require("fs"); // For file system operations (reading audio files)
const path = require("path"); // For path manipulation

const app = express();

// Enable CORS for all origins
app.use(cors());

// Parse incoming JSON requests
app.use(express.json());

// Set up multer for handling file uploads (audio files)
// Files will be temporarily stored in the 'uploads/' directory
const upload = multer({ dest: "uploads/" });

// Initialize the Gemini AI model with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize Google Cloud STT and TTS clients
// IMPORTANT: These clients will look for authentication credentials.
// The recommended way is to set the GOOGLE_APPLICATION_CREDENTIALS
// environment variable to the path of your Google Cloud service account key JSON file.
// Example (PowerShell): $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\your\key.json"
// Ensure Cloud Speech-to-Text API and Cloud Text-to-Speech API are enabled in your GCP project.
// Remember that using these services incurs costs.
const speech = require("@google-cloud/speech").v1p1beta1; // Using v1p1beta1 for features like punctuation
const textToSpeech = require("@google-cloud/text-to-speech").v1;

const speechClient = new speech.SpeechClient();
const ttsClient = new textToSpeech.TextToSpeechClient();

// POST /chat-text endpoint for traditional text-based chat
app.post("/chat-text", async (req, res) => {
  const { prompt } = req.body; // Get prompt from request body
  console.log("Received text prompt:", prompt);

  try {
    // Create a model instance using Gemini 1.5 Flash
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Generate response from Gemini
    const result = await model.generateContent(prompt);
    const geminiTextResponse = result.response.text().replace(/\*/g, ""); // Extract the plain text without asterisk

    console.log("Gemini text response:", geminiTextResponse);

    // --- NEW: Generate TTS audio for the text response ---
    const ttsRequest = {
      input: { text: geminiTextResponse },
      voice: {
        languageCode: "en-US",
        name: "en-US-Neural2-C",
        ssmlGender: "FEMALE",
      },
      audioConfig: { audioEncoding: "MP3" }, // Output format for the audio response
    };

    console.log("Generating audio from Gemini text response via TTS...");
    const [ttsResponse] = await ttsClient.synthesizeSpeech(ttsRequest);
    const ttsAudioContentBase64 = ttsResponse.audioContent.toString("base64"); // Convert audio buffer to base64
    console.log(
      "Generated TTS audio (base64 length) for text chat:",
      ttsAudioContentBase64.length
    );
    // --- END NEW ---

    // Return the generated text AND base64 audio as a JSON response
    return res.json({
      text: geminiTextResponse,
      aiAudioContent: ttsAudioContentBase64, // Now sending audio content for text chat too
    });
  } catch (error) {
    // Handle and log any errors
    console.error("Gemini API error:", error);
    // Add more specific error detail if it's an authentication issue
    if (error.code === 16) {
      return res.status(500).json({
        error:
          "Authentication failed for Google Cloud APIs (Text-to-Speech). Please check your GOOGLE_APPLICATION_CREDENTIALS and project setup (billing, enabled APIs).",
      });
    }
    return res
      .status(500)
      .json({ error: "Failed to get response from Gemini or generate TTS." });
  }
});

// POST /chat-voice endpoint to handle voice messages (audio input, audio output)
app.post("/chat-voice", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file uploaded." });
  }

  const audioFilePath = req.file.path;
  console.log("Received audio file:", audioFilePath);

  try {
    // Log uploaded file size for debugging
    const fileStats = fs.statSync(audioFilePath);
    console.log("Uploaded audio file size on server:", fileStats.size, "bytes");
    if (fileStats.size === 0) {
      console.error("Error: Uploaded audio file is empty. Cannot process STT.");
      fs.unlinkSync(audioFilePath); // Clean up
      return res
        .status(400)
        .json({ error: "Uploaded audio file is empty. Please speak clearly." });
    }

    // --- Step 1: Speech-to-Text (STT) using Google Cloud Speech-to-Text ---
    // Read the uploaded audio file into a Base64 string
    const audioBytes = fs.readFileSync(audioFilePath).toString("base64");
    console.log("Base64 audioBytes length (should be > 0):", audioBytes.length);

    const sttRequest = {
      audio: {
        content: audioBytes,
      },
      config: {
        // IMPORTANT: These encoding and sampleRateHertz MUST match how the audio is recorded on the frontend.
        // Frontend uses 'audio/webm;codecs=opus' which maps to WEBM_OPUS encoding.
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000, // Common for modern browser recordings (WebM Opus)
        languageCode: "en-US",
        enableAutomaticPunctuation: true, // Improve transcription quality
        model: "default", // You can experiment with 'default', 'command_and_search', 'phone_call', 'video'
      },
    };

    console.log("Sending audio to Google Cloud Speech-to-Text...");
    const [sttResponse] = await speechClient.recognize(sttRequest);
    const userTranscription = sttResponse.results
      .map((result) => result.alternatives[0].transcript)
      .join("\n");

    if (!userTranscription) {
      // If no speech was detected or transcribed
      return res
        .status(400)
        .json({ error: "Could not transcribe audio. No discernible speech." });
    }

    console.log("Transcription from STT (User):", userTranscription);

    // --- Step 2: Gemini Interaction ---
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("Sending transcription to Gemini:", userTranscription);
    const geminiResult = await model.generateContent(userTranscription);
    const geminiTextResponse = geminiResult.response.text().replace(/\*/g, ""); // Clean up response

    console.log("Gemini response (text):", geminiTextResponse);

    // --- Step 3: Text-to-Speech (TTS) using Google Cloud Text-to-Speech ---
    const ttsRequest = {
      input: { text: geminiTextResponse },
      voice: {
        languageCode: "en-US",
        name: "en-US-Neural2-C",
        ssmlGender: "FEMALE",
      },
      audioConfig: { audioEncoding: "MP3" }, // Output format for the audio response
    };

    console.log("Generating audio from Gemini response via TTS...");
    const [ttsResponse] = await ttsClient.synthesizeSpeech(ttsRequest);
    const ttsAudioContentBase64 = ttsResponse.audioContent.toString("base64"); // Convert audio buffer to base64

    console.log(
      "Generated TTS audio (base64 length):",
      ttsAudioContentBase64.length
    );

    // --- Step 4: Send user's transcription, AI's text, and base64 audio back to Frontend ---
    // The frontend will receive this JSON, display user's text, AI's text, and play AI's audio.
    return res.json({
      userTranscription: userTranscription, // User's transcribed text
      aiText: geminiTextResponse, // AI's text response
      aiAudioContent: ttsAudioContentBase64, // AI's audio response
    });
  } catch (error) {
    console.error("Error in voice chat endpoint:", error);
    if (error.code === 16) {
      return res.status(500).json({
        error:
          "Authentication failed for Google Cloud APIs (Speech-to-Text/Text-to-Speech). Please check your GOOGLE_APPLICATION_CREDENTIALS and project setup (billing, enabled APIs).",
      });
    } else if (
      error.code === 3 &&
      error.details &&
      error.details.includes("RecognitionAudio not set")
    ) {
      return res
        .status(400)
        .json({
          error:
            "Invalid audio content received by STT. Please ensure microphone is working and speak clearly.",
        });
    }
    return res
      .status(500)
      .json({ error: "Failed to process voice request: " + error.message });
  } finally {
    // Always clean up the temporarily uploaded audio file
    if (fs.existsSync(audioFilePath)) {
      fs.unlinkSync(audioFilePath);
      console.log("Cleaned up uploaded audio file:", audioFilePath);
    }
  }
});

// Start the server on port 5000
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`Text chat endpoint: http://localhost:${PORT}/chat-text`);
  console.log(`Voice chat endpoint: http://localhost:${PORT}/chat-voice`);
  console.log(
    `\n*** IMPORTANT: Ensure Google Cloud billing is enabled for STT and TTS. ***`
  );
  console.log(
    `*** Also, set GOOGLE_APPLICATION_CREDENTIALS env variable for authentication. ***`
  );
});
