# 🤖 AI Chatbot by Gerald T.

A simple, clean, and white-labeled conversational AI builder built with **React + Node.js** and powered by **Google Gemini**. Supports text-based prompts and voice responses via the **Web Speech API**.

---

## 🧩 Features

- ✅ Clean chat interface (user right / AI left)
- ✅ Chat history with timestamp order
- ✅ Gemini-powered responses (text)
- ✅ Voice playback using browser’s native speech synthesis
- ✅ Responsive UI with Tailwind CSS
- ✅ One-click deploy on Render (backend) and Vercel (frontend)

---

## 📸 Preview

> _Simple chat interface with AI responses and voice playback_

![Preview Screenshot](https://github.com/GeraldTgit/ai-chatbot/blob/main/chatbot_screenshot.png)

---

## ⚙️ Tech Stack

| Frontend         | Backend           | AI / TTS             |
| ---------------- | ----------------- | -------------------- |
| React + Tailwind | Node.js + Express | Google Gemini (text) |
| Web Speech API   | REST API          | Browser TTS (voice)  |

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/GeraldTgit/ai-chatbot.git
cd ai-chatbot
```

### 2. Setup Backend

```bash
cd backend
npm install
```

#### Add `.env` file:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

Then run:

```bash
node index.js
```

> Runs at: `http://localhost:5000`

---

### 3. Setup Frontend

```bash
cd ../frontend
npm install
npm run dev
```

> Runs at: `http://localhost:5173` (default Vite dev server)

---

## 🌐 Deployment Guide

- **Backend** → [Render](https://render.com/)

  - Set environment variable `GEMINI_API_KEY`

- **Frontend** → [Vercel](https://vercel.com/)

  - Point to `frontend/` folder

---

## 🧠 How It Works

```mermaid
sequenceDiagram
  User->>Frontend: Type Prompt + Click Send
  Frontend->>Backend: POST /chat { prompt }
  Backend->>Gemini API: generateContent(prompt)
  Gemini API-->>Backend: Text Response
  Backend-->>Frontend: JSON { text }
  Frontend-->>UI: Display Chat + Enable Voice
```

---

## 📁 Project Structure

```
ai-chatbot/
├── backend/        # Express server for Gemini integration
│   ├── index.js
│   └── .env
│
├── frontend/       # React + Tailwind UI
│   ├── App.jsx
│   └── index.js
```

---

## 🙋‍♂️ Author

**Gerald T.**
🔗 [GitHub](https://github.com/GeraldTgit)

---

## 📝 License

This project is licensed under the [MIT License](LICENSE).

---

```

```
