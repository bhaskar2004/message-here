const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

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

// Store active users and their socket IDs
const users = {};
const connections = {};
const pendingRequests = {};

io.on('connection', (socket) => {
    console.log('A user connected');

    // User registration
    socket.on('register', (uniqueId) => {
        users[uniqueId] = socket.id;
        console.log(`User registered with ID: ${uniqueId}`);
    });

    // File upload handling
    socket.on('file upload', (data) => {
        // Check if users are connected
        if (connections[data.from] === data.to || connections[data.to] === data.from) {
            // Broadcast file details to recipient
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
            // Emit error if not connected
            socket.emit('message error', 'Not connected to this user');
        }
    });

    // Existing connection and messaging logic remains the same...
    // (Keep the previous connection and chat message handling code)
    
    
        // Send connection request
        socket.on('send connection request', ({ from, to }) => {
            const recipientSocketId = users[to];
            if (recipientSocketId) {
                // Store pending request
                if (!pendingRequests[to]) {
                    pendingRequests[to] = [];
                }
                pendingRequests[to].push(from);
    
                // Emit connection request to recipient
                io.to(recipientSocketId).emit('connection request', { from });
                console.log(`Connection request from ${from} to ${to}`);
            } else {
                // Notify sender if recipient not found
                socket.emit('request error', 'User not found');
            }
        });
    
        // Handle connection acceptance
        socket.on('accept connection', ({ from, to }) => {
            const fromSocketId = users[from];
            const toSocketId = users[to];
            
            if (fromSocketId && toSocketId) {
                // Remove from pending requests
                if (pendingRequests[to]) {
                    pendingRequests[to] = pendingRequests[to].filter(requestFrom => requestFrom !== from);
                }
    
                // Establish connection
                connections[from] = to;
                connections[to] = from;
                
                // Notify both users
                io.to(fromSocketId).emit('connection accepted', { to });
                io.to(toSocketId).emit('connection accepted', { to: from });
                
                console.log(`Connection established between ${from} and ${to}`);
            }
        });
    
        // Handle connection rejection
        socket.on('reject connection', ({ from, to }) => {
            const fromSocketId = users[from];
            
            if (fromSocketId) {
                // Remove from pending requests
                if (pendingRequests[to]) {
                    pendingRequests[to] = pendingRequests[to].filter(requestFrom => requestFrom !== from);
                }
    
                // Notify sender of rejection
                io.to(fromSocketId).emit('connection rejected', { to });
                console.log(`Connection request from ${from} to ${to} rejected`);
            }
        });
    
        // Handle chat messages (only between connected users)
        socket.on('chat message', (msg) => {
            // Check if users are connected
            if (connections[msg.from] === msg.to || connections[msg.to] === msg.from) {
                const recipientSocketId = users[msg.to];
                if (recipientSocketId) {
                    io.to(recipientSocketId).emit('chat message', msg);
                }
            } else {
                // Emit error if not connected
                socket.emit('message error', 'Not connected to this user');
            }
        });
    
        // Cleanup on disconnect
        socket.on('disconnect', () => {
            for (const [id, socketId] of Object.entries(users)) {
                if (socketId === socket.id) {
                    // Remove user's connections
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

    // Generate a URL for the uploaded file
    const fileUrl = `/uploads/${req.file.filename}`;
    
    res.json({
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        fileUrl: fileUrl
    });
});

// Start the server
// Replace existing server.listen() with:
const HOST = '0.0.0.0';  // Listen on all network interfaces
server.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
});