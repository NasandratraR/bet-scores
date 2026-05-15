require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const app            = require('./app');
const { initDb }     = require('./config/db');
const PORT           = process.env.PORT || 3000;

initDb()
  .then(() => app.listen(PORT, () => console.log(`Serveur : http://localhost:${PORT}`)))
  .catch(err => { console.error('Erreur BDD :', err.message); process.exit(1); });
