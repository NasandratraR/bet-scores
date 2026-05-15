const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/bet', express.static('/home/nasandratra/Documents/BET'));
app.use('/api', require('./src/routes'));

module.exports = app;
