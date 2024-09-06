import { OpenAIEmbeddings } from "@langchain/openai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import mongoClientPromise from '../lib/mongodb';
// Remove punycode if it's not needed
// const punycode = require('punycode');

export default async function handler(req, res) {
  try {
    const client = await mongoClientPromise;
    const dbName = "docs";
    const collectionName = "embeddings";
    const collection = client.db(dbName).collection(collectionName);

    // Access request body directly
    const question = req.body; // Assuming body contains the question as text

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

    const retriever = vectorStore.asRetriever({
      searchType: "mmr",
      searchKwargs: {
        fetchK: 20,
        lambda: 0.1,
      },
    });

    const retrieverOutput = await retriever.invoke(question);

    res.status(200).json(retrieverOutput);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error in vector search" });
  }
}
