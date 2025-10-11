import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios';
import sqllite from 'sqlite3'
import freelancers from './data.js';
import { open } from 'sqlite';
import { createInterface } from 'readline';
import { spawn } from 'child_process';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;


// db sql
let db;

async function initilaizeDb() {

  db=await open({
    filename:'./database.db',
    driver: sqllite.Database
  })

  await db.exec(`
    CREATE TABLE IF NOT EXISTS Products (
      ProductID INTEGER PRIMARY KEY AUTOINCREMENT,
      Name TEXT NOT NULL,
      ShortDescription TEXT,
      FullDescription TEXT,
      Embedding TEXT NOT NULL -- stored as JSON string
    );
  `);

}


// convert query to embedding
async function getEmbeddingFromPython(text) {
  return new Promise((resolve, reject) => {
    const py = spawn('python', ['embed.py', text]);

    let data = '';
    let error = '';

    py.stdout.on('data', (chunk) => data += chunk);
    py.stderr.on('data', (err) => error += err);

    py.on('close', (code) => {
      if (code !== 0) return reject(error);
      try {
        const parsed = JSON.parse(data);
        resolve(parsed);
      } catch (e) {
        reject('Failed to parse embedding');
      }
    });
  });
}




// cosine similarity
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (magA * magB);
}


// rag implemnetation
async function getGeminiResponse(query, matchedProducts,history) {

  const context = matchedProducts.map(p => 
    `Name: ${p.Name}\nShort: ${p.ShortDescription}\nFull: ${p.FullDescription}`
  ).join('\n\n');


   const conversationText = history.map(h => 
    `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`
  ).join('\n');

  const prompt = `
You are an expert-matching assistant for OnJobSupport. Based on the user's query and the available expert profiles, identify and suggest the most relevant experts.

Use the conversation below to understand the user's intent. Then, suggest experts from the given profiles.

If the user asks a general question like "Who are you" or "What can you do", just explain briefly:
- You're an AI assistant for OnJobSupport.
- You help users find the right experts/profiles/peoples who are freelnacers you just show their profiles


Conversation:
${conversationText}

User Query:
"${query}"

Expert Profiles:
${context}

Instructions:
- Understand the user query in context (e.g., if they say "his company", refer to the last expert mentioned).
- Identify up to 3 relevant experts based on the user's query.
- If no expert matches, say so briefly.
- Before listing the expert cards, write **1-2 friendly lines** introducing the results (e.g., “Sure! Here are some people who can help…”).
 Always present expert results in the following format:
  
  Product: [Expert/product Name]  
  Description: [One-liner summary]  
  Details: [More detailed explanation of how they help]

- If no experts match the query, say so politely and ask if the user wants help with something else.
- End by asking if the user wants more information or help with something else.

Respond in a helpful and friendly tone.
`;




  const geminiRes = await axios.post(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      contents: [{ parts: [{ text: prompt }] }]
    },
    {
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Type': 'application/json',
      }
    }
  );

  return geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
}






app.post('/chat', async (req, res) => {
   const { message,history } = req.body
   

  try {

 
    const queryEmbedding = await getEmbeddingFromPython(message);

    const products = await db.all(`SELECT * FROM Products`);

    const scored = products.map(p => ({
    ...p,
    score: cosineSimilarity(queryEmbedding, JSON.parse(p.Embedding))
    }));

    scored.sort((a, b) => b.score - a.score);

    const topResults = scored.slice(0, 3);
    
    // const isValidHistory =
    //   Array.isArray(history) &&
    //   history.every(item => item && typeof item.role === 'string' && typeof item.content === 'string');

    // const safeHistory = isValidHistory ? history : [];

    const reply = await getGeminiResponse(message,topResults,history);
    res.json({ reply });

  } catch (err) {
    console.error('❌ Error:', err); 
    res.status(500).json({ error: 'Server error' });
  }
});



const PORT = 3000;
initilaizeDb().then(()=>{
app.listen(PORT, () => {
  console.log(`Server running at ${PORT}`);
}); 
})


