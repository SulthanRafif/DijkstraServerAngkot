const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const port = 3000;

// Gunakan middleware CORS
app.use(cors());

// Konfigurasi koneksi database
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'thesis_mgm'
});

// Koneksi ke database
db.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database.');
});

// Endpoint untuk mendapatkan interchanges
app.get('/api/interchanges', (req, res) => {
    db.query("SELECT i.idinterchange, GROUP_CONCAT(lp.idpoint) AS idpoints, GROUP_CONCAT(lp.idline) AS idlines FROM interchanges i LEFT JOIN linepoint lp ON lp.idinterchange = i.idinterchange GROUP BY i.idinterchange ORDER BY i.idinterchange", (err, results) => {
        if (err) {
            console.error('Error fetching interchanges:', err);
            res.status(500).send('Server error');
            return;
        }
        res.json(results);
    });
});

// Endpoint untuk mendapatkan lines
app.get('/api/lines', (req, res) => {
    db.query('SELECT DISTINCT l.*, (SELECT COUNT(*) FROM linepoint lp WHERE lp.idline = l.idline) AS count FROM thesis_mgm.lines l; ', (err, results) => {
        if (err) {
            console.error('Error fetching lines:', err);
            res.status(500).send('Server error');
            return;
        }
        res.json(results);
    });
});

// Endpoint untuk mendapatkan line points berdasarkan idline
app.get('/api/lines/:idline', (req, res) => {
    const { idline } = req.params;
    db.query(`SELECT p.idpoint, p.lat, p.lng, l.sequence, l.stop, l.idinterchange, ln.linecolor, ${idline} AS idline FROM linepoint l LEFT JOIN point p ON p.idpoint = l.idpoint LEFT JOIN thesis_mgm.lines ln ON ln.idline = l.idline WHERE l.idline IN(${idline}) ORDER BY l.sequence; `, (err, results) => {
        if (err) {
            console.error('Error fetching line points:', err);
            res.status(500).send('Server error');
            return;
        }
        res.json(results);
    });
});

app.listen(port, () => {
    console.log(`API server running at http://localhost:${port}`);
});
