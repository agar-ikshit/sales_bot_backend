import express from 'express';
import healthCheckHandler from './api/healthcheck.mjs';
import vectorSearchHandler from './api/vectorSearch.mjs';
import generateResponseHandler from './api/generateResponse.mjs';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/api/health', healthCheckHandler);

// Vector search endpoint
app.post('/api/vectorSearch', vectorSearchHandler);

// Generate response endpoint
app.post('/api/generateResponse', generateResponseHandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
