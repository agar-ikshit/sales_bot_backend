import { OpenAIEmbeddings } from "@langchain/openai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import mongoClientPromise from '../lib/mongodb.mjs';

export default async function vectorSearchHandler(req, res) {
  try {
    const client = await mongoClientPromise;
    const dbName = "docs";
    const collectionName = "embeddings";
    const collection = client.db(dbName).collection(collectionName);

    const question = req.body.message;
    if (typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: 'Invalid or missing question' });
    }

    console.log("Question:", question);

    const vectorStore = new MongoDBAtlasVectorSearch(
      new OpenAIEmbeddings({
        modelName: 'text-embedding-ada-002',
        stripNewLines: true,
      }), {
      collection,
      indexName: "default",
      textKey: "text",
      embeddingKey: "embedding",
    });

    console.log("VectorStore created");

    const retriever = vectorStore.asRetriever({
      searchType: "mmr",
      searchKwargs: {
        fetchK: 20,
        lambda: 0.1,
      },
    });

    console.log("Retriever created");

    const retrieverOutput = await retriever.invoke(question);

    console.log("Retriever Output:", retrieverOutput);

    res.status(200).json(retrieverOutput);
  } catch (error) {
    console.error('Error during vector search:', error);
    res.status(500).json({ error: 'Error in vector search' });
  }
}
