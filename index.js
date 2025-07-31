// index.js (CommonJS version)
const express = require("express");
const dotenv = require("dotenv");
const axios = require("axios");
const pdf = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

// ...rest of your code remains the same...


const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY not found in .env");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Download PDF buffer
async function downloadPDF(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return res.data;
}

// Extract text from PDF buffer
async function extractText(buffer) {
  const data = await pdf(buffer);
  return data.text;
}

// Chunk text by word count
function chunkText(text, chunkSize = 1500) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
}

// Ask Gemini a question with a chunk
async function askGemini(chunk, question) {
  const prompt = `
Use the following insurance policy content to answer the question clearly and factually.

Policy Text:
"""${chunk}"""

Question: ${question}

Answer:
  `;

  try {
    const chat = await model.startChat();
    const response = await chat.sendMessage(prompt);
    return response.response.text();
  } catch (err) {
    console.error("Gemini Error:", err.message);
    return null;
  }
}

// Main QA function
async function runQA(pdfUrl, questions) {
  const buffer = await downloadPDF(pdfUrl);
  const text = await extractText(buffer);
  const chunks = chunkText(text);

  const answers = [];

  for (const question of questions) {
    let bestAnswer = "";
    let bestLength = -1;

    for (const chunk of chunks) {
      const ans = await askGemini(chunk, question);
      if (ans && ans.length > bestLength) {
        bestAnswer = ans;
        bestLength = ans.length;
      }
    }
    answers.push(bestAnswer);
  }

  return answers;
}

// Express route
app.post("/qa", async (req, res) => {
  const { pdfUrl, questions } = req.body;
  if (!pdfUrl || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: "pdfUrl and questions array are required" });
  }

  try {
    const answers = await runQA(pdfUrl, questions);
    res.json({ answers });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to process request" });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
