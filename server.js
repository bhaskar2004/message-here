const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const os = require('os');
const mdns = require('mdns-js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Function to get local IP address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (const alias of iface) {
            if (alias.family === 'IPv4' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return 'localhost';
}

const LOCAL_IP = getLocalIP();
console.log(`Local IP: ${LOCAL_IP}`);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB file size limit
});

// Serve static files and uploads
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));
app.use(express.json());

// Local network device discovery
app.get('/discover-devices', (req, res) => {
    const networkInterfaces = os.networkInterfaces();
    const devices = [];

    Object.keys(networkInterfaces).forEach((interfaceName) => {
        networkInterfaces[interfaceName].forEach((details) => {
            if (details.family === 'IPv4' && !details.internal) {
                devices.push({
                    ip: details.address,
                    hostname: os.hostname(),
                    port: PORT
                });
            }
        });
    });

    res.json(devices);
});

// Store active users and their connections
const users = {};
const connections = {};
const pendingRequests = {};
const localDevices = new Set();

// mDNS Service Advertisement
const ad = mdns.createAdvertisement(mdns.tcp('http'), PORT, {
    name: `SecureChat-${os.hostname()}`
});

// Socket.IO Connection Handling
io.on('connection', (socket) => {
    console.log('A user connected');

    // Register local device
    socket.on('register-local-device', (deviceInfo) => {
        localDevices.add(deviceInfo);
        console.log('Local device registered:', deviceInfo);
    });

    // User registration
    socket.on('register', (uniqueId) => {
        users[uniqueId] = socket.id;
        console.log(`User registered with ID: ${uniqueId}`);
    });

    // Local network connection request
    socket.on('local-connect', (deviceInfo) => {
        console.log('Local connection request:', deviceInfo);
        // Implement local network connection logic
        socket.emit('local-connection-response', { 
            status: 'success', 
            message: 'Connected to local device' 
        });
    });

    // Existing connection and messaging logic
    socket.on('send connection request', ({ from, to }) => {
        const recipientSocketId = users[to];
        if (recipientSocketId) {
            if (!pendingRequests[to]) {
                pendingRequests[to] = [];
            }
            pendingRequests[to].push(from);

            io.to(recipientSocketId).emit('connection request', { from });
            console.log(`Connection request from ${from} to ${to}`);
        } else {
            socket.emit('request error', 'User not found');
        }
    });

    socket.on('accept connection', ({ from, to }) => {
        const fromSocketId = users[from];
        const toSocketId = users[to];
        
        if (fromSocketId && toSocketId) {
            if (pendingRequests[to]) {
                pendingRequests[to] = pendingRequests[to].filter(requestFrom => requestFrom !== from);
            }

            connections[from] = to;
            connections[to] = from;
            
            io.to(fromSocketId).emit('connection accepted', { to });
            io.to(toSocketId).emit('connection accepted', { to: from });
            
            console.log(`Connection established between ${from} and ${to}`);
        }
    });

    socket.on('reject connection', ({ from, to }) => {
        const fromSocketId = users[from];
        
        if (fromSocketId) {
            if (pendingRequests[to]) {
                pendingRequests[to] = pendingRequests[to].filter(requestFrom => requestFrom !== from);
            }

            io.to(fromSocketId).emit('connection rejected', { to });
            console.log(`Connection request from ${from} to ${to} rejected`);
        }
    });

    socket.on('chat message', (msg) => {
        if (connections[msg.from] === msg.to || connections[msg.to] === msg.from) {
            const recipientSocketId = users[msg.to];
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('chat message', msg);
            }
        } else {
            socket.emit('message error', 'Not connected to this user');
        }
    });

    // File upload handling
    socket.on('file upload', (data) => {
        if (connections[data.from] === data.to || connections[data.to] === data.from) {
            const recipientSocketId = users[data.to];
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('file received', {
                    from: data.from,
                    fileName: data.fileName,
                    fileSize: data.fileSize,
                    fileType: data.fileType,
                    fileUrl: data.fileUrl
                });
            }
        } else {
            socket.emit('message error', 'Not connected to this user');
        }
    });

    socket.on('disconnect', () => {
        for (const [id, socketId] of Object.entries(users)) {
            if (socketId === socket.id) {
                delete connections[id];
                delete pendingRequests[id];
                delete users[id];
                break;
            }
        }
        console.log('User disconnected');
    });
});

// File upload route
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    
    res.json({
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        fileUrl: fileUrl
    });
});

// Start the server
const HOST = '0.0.0.0';  // Listen on all network interfaces
server.listen(PORT, HOST, () => {
    console.log(`Server running on http://${LOCAL_IP}:${PORT}`);
});