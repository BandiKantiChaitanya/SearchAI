// const sql = require('mssql');

// const config = {
//   user: 'OnJobSupport',
//   password: 'India@2025',
//   server: 'mynopcommerce.database.windows.net',
//   database: 'onjobsupport', // start with default, then switch later
//   options: {
//     encrypt: true,
//   },
// };

// async function exploreDB() {
//   try {
//     const pool = await sql.connect(config);

//      const tablesResult = await pool.request().query(`
//       SELECT TABLE_NAME 
//       FROM INFORMATION_SCHEMA.TABLES 
//       WHERE TABLE_TYPE = 'BASE TABLE'
//     `);
//     console.log("✅ Tables in 'onjobsupport' database:");
//     const tableNames = tablesResult.recordset.map(t => t.TABLE_NAME);
//     tableNames.forEach(name => console.log('- ' + name));

//     // Step 2: Preview data from each table
//     for (const table of tableNames) {
//       console.log(`\n🔍 Previewing table: ${table}`);
//       const preview = await pool.request().query(`SELECT TOP 3 * FROM ${table}`);
//       console.log(preview.recordset);
//     }

//     // Done
//     console.log("\n✅ Data exploration complete.");
//   } catch (err) {
//     console.error('SQL Error:', err);
//   }
// }

// exploreDB();




import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios';
import freelancers from './data.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;

let lastMentionedExpert = null;
let lastExpertList = [];

app.post('/chat', async (req, res) => {
  const { message } = req.body;

  
  // finding relevant matches
  const lowerMsg = message.toLowerCase();
  const matchedByExpertise  = freelancers.filter(expert =>
    lowerMsg.includes(expert.expertise.toLowerCase())
  );
  
  // matching by name 
  const matchedByName = freelancers.filter(expert =>
    lowerMsg.includes(expert.name.toLowerCase())
  );
  
  const isFollowUp = /more info|more about|tell me more|her|him|details/.test(lowerMsg);
  
  let selectedExpert = null;
  let responseList = [];

  // Exact name mentioned
   if (matchedByName.length>0) {
    selectedExpert = matchedByName[0];
    lastMentionedExpert = matchedByName.name; // Save last mentioned
  } 
  // Follow-up after listing experts
  else if (isFollowUp && Array.isArray(lastExpertList) && lastExpertList.length > 0) {
    if (lastExpertList.length === 1) {
      selectedExpert = lastExpertList[0];
      lastMentionedExpert = selectedExpert;
    } else {
      responseList = lastExpertList;
    }
  }
  //  First-time query with topic
  else if (matchedByExpertise.length > 0) {
    responseList = matchedByExpertise;
    lastExpertList = matchedByExpertise;
    lastMentionedExpert = null; // reset selected expert
  }
  
  


  //  Format the expert info to give to Gemini
  let expertContext = '';
  // if (relevantExperts.length > 0) {
  //   expertContext = 'Here are some experts related to the query:\n' + 
  //     relevantExperts.map(e => `- ${e.name} (${e.expertise}): ${e.bio}`).join('\n');
  // } else {
  //   expertContext = 'No matching experts found in our mock dataset.';
  // }


  // If user is asking for more info on one expert
   if (selectedExpert) {
    expertContext = `Expert Details:\nName: ${selectedExpert.name}\nExpertise: ${selectedExpert.expertise}\nBio: ${selectedExpert.bio} all details:${JSON.stringify(selectedExpert)}`;
  }
  // If matching multiple experts by expertise
  else if (responseList.length > 0) {
    expertContext = `Here are some experts related to your query:\n` + 
      // responseList.map(expert =>
      //   `- ${expert.name} (${expert.expertise}): ${expert.bio} all details:${expert}`
      // ).join('\n') 
      `${JSON.stringify(responseList)}`
      + `\n\nIf you'd like to know more about any of them, just say their name or ask for more info.`;
  }
   else {
    expertContext = 'No matching experts found in the current dataset.';
  }


  const prompt = `
The user said: "${message}"

${expertContext}

Based on this, reply in a helpful, friendly way. If expert info is available, describe in a meaningful way or else display as adaptive cards(this is yourr primary work). If user is asking for more details, expand on what you have. If no expert matches, politely explain.
and ask if user wants more infromation on any exprtisce also.
`;



  try {
    const geminiRes = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ]
      },
      {
        headers: {
          'x-goog-api-key': API_KEY,
          'Content-Type': 'application/json',
        }
      }
    );

    const reply = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No valid response from Gemini.';
    res.json({ reply });

  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Gemini API failed.' });
  }
});


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at ${PORT}`);
});

