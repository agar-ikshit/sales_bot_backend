// File: api/routes.js
import express from 'express';
import healthCheckHandler from './healthcheck.mjs';
import vectorSearchHandler from './vectorSearch.mjs';
import generateResponseHandler from './generateResponse.mjs';

const router = express.Router();

// Health check endpoint
router.get('/api/health', healthCheckHandler);

// Vector search endpoint
router.post('/api/vectorSearch', vectorSearchHandler);

// Generate response endpoint
router.post('/api/generateResponse', generateResponseHandler);

export default router;
