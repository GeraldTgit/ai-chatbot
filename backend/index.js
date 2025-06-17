// Load environment variables from .env file
require("dotenv").config();

// Import required modules
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// Enable CORS for all origins
app.use(cors());

// Parse incoming JSON requests
app.use(express.json());

// Initialize the Gemini AI model with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// POST /chat endpoint to handle chat messages
app.post("/chat", async (req, res) => {
  const { prompt } = req.body; // Get prompt from request body
  console.log("Received prompt:", prompt);

  try {
    // Create a model instance using Gemini 1.5 Flash
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Generate response from Gemini
    const result = await model.generateContent(prompt);
    const text = result.response.text(); // Extract the plain text

    console.log("Gemini response:", text);

    // Return the generated text as a JSON response
    return res.json({ text });
  } catch (error) {
    // Handle and log any errors
    console.error("Gemini API error:", error);
    return res
      .status(500)
      .json({ error: "Failed to get response from Gemini" });
  }
});

// Start the server on port 5000
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
