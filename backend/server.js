import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
app.use(cors());
app.use(express.json());

// تخزن بيانات السيارة
let carData = { rpm: 0, speed: 0, temp: 0 };

// ===== API =====

// GET
app.get('/api/obd2', (req, res) => {
    res.json(carData);
});

// POST (من الجهاز أو OBD)
app.post('/api/obd2', (req, res) => {
    carData = req.body;

    // نرسل البيانات مباشرة للفرونت إند عبر السوكيت
    io.emit('car_data', carData);

    res.send("Data Received");
});

// ===== SOCKET.IO =====
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // يسمح لأي فرونت إند بالاتصال
    },
});

io.on('connection', (socket) => {
    console.log("Client connected via Socket.io");
    // نرسل آخر بيانات مباشرة عند الاتصال لأول مرة
    socket.emit('car_data', carData);
});

// ===== PORT (مهم لـ Render) =====
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});