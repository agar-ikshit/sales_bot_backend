import express from 'express';
import router from './api/routes.js';



const app = express();

const port = process.env.PORT || 3000;




app.use(express.json());

// Use the router for API routes
app.use(router);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});