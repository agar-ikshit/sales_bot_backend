// File: api/vectorSearchHandler.js
import { OpenAIEmbeddings } from "@langchain/openai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import mongoClientPromise from '../lib/mongodb.mjs';

let vectorStore;

async function createVectorStore() {
  
  try {
    const client = await mongoClientPromise;
    const dbName = "docs";
    const collectionName = "embeddings";
    const collection = client.db(dbName).collection(collectionName);

    vectorStore = new MongoDBAtlasVectorSearch(
      new OpenAIEmbeddings({
        modelName: 'text-embedding-ada-002',
        stripNewLines: true,
      }), {
      collection,
      indexName: "vector_index", 
      textKey: "text", 
      embeddingKey: "embedding", 
      similarity: "cosine" 
    });

    console.log("Vector Store created successfully");
  } catch (error) {
    console.error('Error creating Vector Store:', error);
    throw new Error('Failed to create vector store');
  }
}

export default async function vectorSearchHandler(req, res) {
  try {
    console.log("Request Body:", req.body);

    const question = req.body.message;
    if (typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: 'Invalid or missing question' });
    }

    console.log("Question:", question);

    if (!vectorStore) {
      await createVectorStore();
    }

    const retriever = vectorStore.asRetriever({
      searchType: "mmr", // Ensure this matches your search type
      searchKwargs: {
        fetchK: 20,
        lambda: 0.1,
      },
    });

    console.log("Retriever created");

    const retrieverOutput = await retriever.invoke(question);

    console.log("Retriever Output:", retrieverOutput);

    if (retrieverOutput.length === 0) {
      console.log("No results found for query:", question);
    }

    res.status(200).json(retrieverOutput);
  } catch (error) {
    console.error('Error during vector search:', error);
    res.status(500).json({ error: 'Error in vector search' });
  }
}
