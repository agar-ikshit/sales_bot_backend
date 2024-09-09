import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

const uri = process.env.MONGODB_URI;  
const options = {
  // useNewUrlParser: true,
  // useUnifiedTopology: true,
  // serverSelectionTimeoutMS: 5000, // Adjust timeout as needed
};

let client;
let clientPromise;



if (!uri) {
  throw new Error("Please add your Mongo URI to .env.local");
}

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so the connection is cached across module reloads
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production, always create a new client
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
