import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import fetch from 'node-fetch'; // Assuming you have node-fetch installed

export default async function generateResponseHandler(req, res) {
  try {
    // Ensure input data is correctly parsed
    const inputdata = req.body;

    if (!inputdata || typeof inputdata.message !== 'string') {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    const currentMessageContent = inputdata.message;

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
    console.log("Vector Search Result:", vectorSearchResult);
    const context = vectorSearchResult.text || '';
    console.log("Context Extracted:", context);

    const TEMPLATE = `
    I want you to act as a document that I am having a conversation with. Your name is "Sales Bot". Customers will ask you questions about the printers given in context, and you have to answer those to the best of your capabilities.
    You also need to ask for the customer's name and contact number and then store them.
    If there is nothing in the context relevant to the question at hand, just say "Hmm, I'm not sure" and stop after that. Refuse to answer any question not about the info. Never break character.
    ------------
    ${context}
    ------------
    REMEMBER: If there is no relevant information within the context, just say "Hmm, I'm not sure but we will get back to you shortly with your answer". Don't try to make up an answer. Never break character.
    ${currentMessageContent}
    `;

    console.log("TEMPLATE:", TEMPLATE);

    const llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: false,
    });

    const result = await llm.call([new HumanMessage({ content: TEMPLATE })]);

    res.status(200).json({ text: result });
  } catch (error) {
    console.error('Error generating response:', error);
    res.status(500).json({ error: 'Error generating response' });
  }
}

