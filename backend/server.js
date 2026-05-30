const express = require('express')
require('dotenv').config();
const cors = require('cors')
const PORT = process.env.PORT || 8081;
const app = express();
const pool = require('./db')
const cookieParser = require("cookie-parser");
const authrouter = require('./routes/auth')
app.use(cookieParser());

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});
app.use(express.json());
app.use('/auth',authrouter);

app.listen(PORT, () => { console.log(`server is running on port ${PORT}...`) })   