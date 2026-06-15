require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/filings', require('./src/routes/filings'));
app.use('/api/quotes', require('./src/routes/quotes'));
app.use('/api/chat', require('./src/routes/chat'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`super-dollop running at http://localhost:${PORT}`));
