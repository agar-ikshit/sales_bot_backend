import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import fetch from 'node-fetch'; // Ensure node-fetch is installed
import mongoClientPromise from '../lib/mongodb.mjs';
import dotenv from 'dotenv';

dotenv.config(); // Ensure environment variables are loaded

const sessionChatHistory = new Map();

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

    const currentMessageContent = inputdata.message;
    const sessionId = req.sessionID || inputdata.sessionId; // Get session ID or any identifier for the conversation

    // Retrieve current session history from in-memory store
    let allSessionChatHistory = sessionChatHistory.get(sessionId) || [];
    let currentChatHistory = allSessionChatHistory.slice(-4); // Last 4 messages

    // Add current message to all session chat history
    allSessionChatHistory.push(new HumanMessage({ content: currentMessageContent }));

    // Update in-memory store with the full chat history
    sessionChatHistory.set(sessionId, allSessionChatHistory);

    // Format the last 4 messages into a string
    const formattedChatHistory = currentChatHistory
      .map((message) => `User: ${message.content}`)
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

    // Combine the chat history and context in the prompt
    const TEMPLATE = `
    I want you to act as a document that I am having a conversation with. Your are "Sales Bot". Customers will ask you questions about the printers given in context, and you have to answer those to the best of your capabilities.
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

    // Ensure the LLM result has a valid 'content' field
    const responseContent = result?.content || 'No content returned from LLM';
    
    // Add the response to the chat history
    allSessionChatHistory.push(new HumanMessage({ content: responseContent }));

    // Save all session chat history to MongoDB
    const client = await mongoClientPromise;
    const dbName = "chat_history";
    const collectionName = "messages";
    const collection = client.db(dbName).collection(collectionName);
    await collection.updateOne(
      { sessionId },
      { $set: { history: allSessionChatHistory } },
      { upsert: true }
    );

    res.status(200).json({ text: responseContent });
  } catch (error) {
    console.error('Error generating response:', error);
    res.status(500).json({ error: 'Error generating response' });
  }
}
