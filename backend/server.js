// Version 3.0 - WITH SOCKET.IO + API

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

// نخزن بيانات السيارة
let carData = { rpm: 0, speed: 0, temp: 0 };

// ===== API =====

// GET
app.get('/api/obd2', (req, res) => {
    res.json(carData);
});

// POST (من الجهاز أو OBD)
app.post('/api/obd2', (req, res) => {
    carData = req.body;

    // 🔥 أهم سطر: نرسل البيانات مباشرة للفرونت
    io.emit('car_data', carData);

    res.send("Data Received");
});

// ===== SOCKET.IO =====
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

io.on('connection', (socket) => {
    console.log("Client connected");

    // نرسل آخر بيانات مباشرة عند الاتصال
    socket.emit('car_data', carData);
});

// ===== PORT (مهم لـ Render) =====
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});