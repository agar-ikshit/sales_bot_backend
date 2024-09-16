import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import fetch from 'node-fetch';
import mongoClientPromise from '../lib/mongodb.mjs';
import dotenv from 'dotenv';
import { parse, serialize } from 'cookie'; 

dotenv.config(); 

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://sales-bot-eight.vercel.app',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
};

const COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: 'Strict', maxAge: 30 * 60 * 1000, path: '/' };

export default async function generateResponseHandler(req, res) {
  // Set CORS headers
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const inputdata = req.body;

    if (!inputdata || typeof inputdata.message !== 'string') {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    const cookies = parse(req.headers.cookie || '');
    let sessionId = cookies.sessionId;

    if (!sessionId) {
      sessionId = generateUniqueSessionId();
      res.setHeader('Set-Cookie', serialize('sessionId', sessionId, COOKIE_OPTIONS)); // Set cookie
    }

    const currentMessageContent = inputdata.message;

    const client = await mongoClientPromise;
    const dbName = "chat_history";
    const collectionName = "messages";
    const collection = client.db(dbName).collection(collectionName);

    let sessionData = await collection.findOne({ sessionId });

    if (!sessionData) {
      sessionData = { sessionId, history: [] };
    }

    sessionData.history.push({ role: 'user', content: currentMessageContent });

    const lastFourMessages = sessionData.history.slice(-4);

    const formattedChatHistory = lastFourMessages
      .map((message) => `${message.role === 'user' ? 'User' : 'Bot'}: ${message.content}`)
      .join('\n');

    const vectorSearchResponse = await fetch('https://backend-theta-eosin.vercel.app/api/vectorSearch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: currentMessageContent }),
    });

    if (!vectorSearchResponse.ok) {
      throw new Error('Vector search failed');
    }

    const vectorSearchResult = await vectorSearchResponse.json();
    const context = vectorSearchResult.text || 'No context available';

    const TEMPLATE = `
    I want you to act as a sales man who is here to help me understand the different kinds of printers we sell at adriotec. Customers will ask you questions about the printers given in context, and you have to answer those to the best of your capabilities.
    
    If there is nothing in the context relevant to the question at hand, just say "Hmm, I'm not sure" and stop after that. Refuse to answer any question not about the info. Never break character.
    ------------
    ${context}
    ------------
    Chat History:
    ${formattedChatHistory}
    ------------
    Current Message: ${currentMessageContent}
    Answer based on the context you recieve 
    `;

    const llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: false,
    });

    const result = await llm.call([new HumanMessage({ content: TEMPLATE })]);
    console.log('LLM result:', result);

    const responseContent = result?.content || 'No content returned from LLM';

    sessionData.history.push({ role: 'bot', content: responseContent });

    await collection.updateOne(
      { sessionId },
      { $set: { history: sessionData.history } },
      { upsert: true }
    );

    res.status(200).json({ text: responseContent });
  } catch (error) {
    console.error('Error generating response:', error.message, error.stack);
    res.status(500).json({ error: 'Error generating response' });
  }
}

function generateUniqueSessionId() {
  return (Math.random() * 1e18).toString(36);
}
