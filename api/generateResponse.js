import { ChatOpenAI } from 'langchain/chat_models/openai';
import { AIMessage, HumanMessage } from 'langchain/schema';

export default async function handler(req, res) {
  try {
    // Parse the request body to get the message content
    const currentMessageContent = await req.text(); 

    // Optionally perform vector search if needed
    const vectorSearch = await fetch("https://your-vercel-url/api/vectorSearch", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: currentMessageContent,
    }).then(res => res.json());

    // Define the template for the conversation
    const TEMPLATE = `
    I want you to act as a document that I am having a conversation with. Your name is "Sales Bot". Customers will ask you questions about the printers given in context, and you have to answer those to the best of your capabilities.
    You also need to ask for the customer's name and contact number and then store them.
    If there is nothing in the context relevant to the question at hand, just say "Hmm, I'm not sure" and stop after that. Refuse to answer any question not about the info. Never break character.
    ------------
    ${currentMessageContent}
    ------------
    REMEMBER: If there is no relevant information within the context, just say "Hmm, I'm not sure but we will get back to you shortly with your answer". Don't try to make up an answer. Never break character.
    `;

    // Initialize the ChatOpenAI model
    const llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: false,
    });

    // Call the model with the message content
    const result = await llm.call(new HumanMessage(TEMPLATE));

    // Respond with the generated text
    res.status(200).json({ text: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error generating response" });
  }
}
