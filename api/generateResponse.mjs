import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import fetch from 'node-fetch'; // Ensure node-fetch is installed
import mongoClientPromise from '../lib/mongodb.mjs';
import dotenv from 'dotenv';
import { parse, serialize } from 'cookie'; 

dotenv.config(); // Ensure environment variables are loaded

export default async function generateResponseHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://sales-bot-eight.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', true);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const inputdata = req.body;

    if (!inputdata || typeof inputdata.message !== 'string') {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    // Retrieve session ID from cookies
    const cookies = parse(req.headers.cookie || '');
    let sessionId = cookies.sessionId;

    if (!sessionId) {
      // Generate a new session ID if none exists
      sessionId = generateUniqueSessionId();
      res.setHeader('Set-Cookie', serialize('sessionId', sessionId, { httpOnly: true, maxAge: 30 * 60 * 1000, path: '/' })); // Set cookie
    }

    const currentMessageContent = inputdata.message;

    // Connect to MongoDB and retrieve session's chat history
    const client = await mongoClientPromise;
    const dbName = "chat_history";
    const collectionName = "messages";
    const collection = client.db(dbName).collection(collectionName);

    // Retrieve existing session data from MongoDB
    let sessionData = await collection.findOne({ sessionId });

    if (!sessionData) {
      // If session data does not exist, create a new session object
      sessionData = { sessionId, history: [] };
    }

    // Push the user's message to the session's history
    sessionData.history.push({ role: 'user', content: currentMessageContent });

    // Keep only the last 4 messages in the history
    const lastFourMessages = sessionData.history.slice(-4);

    // Format the last 4 messages for context
    const formattedChatHistory = lastFourMessages
      .map((message) => `${message.role === 'user' ? 'User' : 'Bot'}: ${message.content}`)
      .join('\n');

    // Call the vector search handler to get the relevant context
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
    const context = vectorSearchResult.text || '';

    // Combine the context and the last 4 messages in the prompt
    const TEMPLATE = `
    I want you to act as a document that I am having a conversation with. Your name is "Sales Bot". Customers will ask you questions about the printers given in context, and you have to answer those to the best of your capabilities.
    You also need to ask for the customer's name and contact number and then store them.
    If there is nothing in the context relevant to the question at hand, just say "Hmm, I'm not sure" and stop after that. Refuse to answer any question not about the info. Never break character.
    ------------
    ${context}
    ------------
    Chat History:
    ${formattedChatHistory}
    ------------
    Current Message: ${currentMessageContent}
    `;

    const llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: false,
    });

    // Retrieve response from the LLM
    const result = await llm.call([new HumanMessage({ content: TEMPLATE })]);
    console.log('LLM result:', result);

    const responseContent = result?.content || 'No content returned from LLM';

    // Add the bot's response to the session's history
    sessionData.history.push({ role: 'bot', content: responseContent });

    // Save the updated chat history to MongoDB
    await collection.updateOne(
      { sessionId },
      { $set: { history: sessionData.history } },
      { upsert: true }
    );

    res.status(200).json({ text: responseContent });
  } catch (error) {
    console.error('Error generating response:', error);
    res.status(500).json({ error: 'Error generating response' });
  }
}

// Utility function to generate a unique session ID
function generateUniqueSessionId() {
  return (Math.random() * 1e18).toString(36);
}
