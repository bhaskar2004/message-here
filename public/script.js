// Get local IP dynamically (to be replaced during deployment)
const LOCAL_IP = window.location.hostname;
const socket = io(`http://${LOCAL_IP}:3000`);

let uniqueId;
let connectedUser = null;
let isEncryptionEnabled = false;
let localDevices = [];

// DOM Elements
const elements = {
    userMessageArea: document.getElementById('userMessageArea'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    encryptToggle: document.getElementById('encryptToggle'),
    userIdDisplay: document.getElementById('userIdDisplay'),
    connectIdInput: document.getElementById('connectIdInput'),
    connectBtn: document.getElementById('connectBtn'),
    notificationArea: document.getElementById('notificationArea'),
    requestsDiv: document.getElementById('requests'),
    appContainer: document.getElementById('appContainer'),
    fileShareBtn: document.getElementById('fileShareBtn'),
    fileInput: document.getElementById('fileInput'),
    deviceDiscoveryBtn: document.getElementById('deviceDiscoveryBtn'),
    deviceListContainer: document.getElementById('deviceListContainer')
};

// Local Network Device Discovery
async function discoverLocalDevices() {
    try {
        console.log('Starting device discovery...');
        const response = await fetch('/discover-devices');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Discovered devices:', data);
        
        localDevices = data;
        
        if (!localDevices || localDevices.length === 0) {
            elements.deviceListContainer.innerHTML = '<div class="p-2">No devices found</div>';
            return;
        }
        
        // Rest of your existing code...
        
    } catch (error) {
        console.error('Device discovery failed:', error);
        elements.deviceListContainer.innerHTML = 
            `<div class="p-2 text-red-500">Error: ${error.message}</div>`;
    }
}
function connectToLocalDevice(ip, port) {
    // Emit local device connection request
    socket.emit('local-connect', { 
        ip: ip, 
        port: port,
        uniqueId: uniqueId
    });
}

// Simple encryption function (for demonstration)
function simpleEncrypt(message) {
    return message.split('').map(char => 
        String.fromCharCode(char.charCodeAt(0) + 1)
    ).join('');
}

// Simple decryption function
function simpleDecrypt(message) {
    return message.split('').map(char => 
        String.fromCharCode(char.charCodeAt(0) - 1)
    ).join('');
}

// Generate Unique ID
document.getElementById('generateIdBtn').addEventListener('click', () => {
    uniqueId = Math.floor(1000 + Math.random() * 9000);
    elements.userIdDisplay.textContent = `Your Unique ID: ${uniqueId}`;
    elements.userIdDisplay.style.display = 'block';
    
    // Register device with server
    socket.emit('register', uniqueId);
    socket.emit('register-local-device', {
        uniqueId: uniqueId,
        hostname: window.location.hostname
    });
});

// Add device discovery button event listener
elements.deviceDiscoveryBtn.addEventListener('click', () => {
    console.log('Discovery button clicked');
    discoverLocalDevices();
});

// Socket event for local connection response
socket.on('local-connection-response', (response) => {
    if (response.status === 'success') {
        alert('Connected to local device successfully!');
    } else {
        alert('Failed to connect to local device');
    }
});


// Handle incoming connection requests
socket.on('connection request', ({ from }) => {
    elements.notificationArea.style.display = 'block';
    elements.requestsDiv.innerHTML += `
        <div class="request-item">
            Connection request from ID: ${from} 
            <div class="request-buttons">
                <button class="acceptBtn" data-id="${from}">Accept</button>
                <button class="rejectBtn" data-id="${from}">Reject</button>
            </div>
        </div>
    `;
});

// Handle connection request responses
elements.requestsDiv.addEventListener('click', (event) => {
    const target = event.target;
    if (target.classList.contains('acceptBtn')) {
        const fromId = target.dataset.id;
        socket.emit('accept connection', { from: fromId, to: uniqueId });
        connectedUser = fromId;
        elements.notificationArea.style.display = 'none';
        elements.appContainer.style.display = 'block';
        elements.requestsDiv.innerHTML = ''; // Clear requests
    } else if (target.classList.contains('rejectBtn')) {
        const fromId = target.dataset.id;
        socket.emit('reject connection', { from: fromId, to: uniqueId });
        target.closest('.request-item').remove();
    }
});

// Connection acceptance handling
socket.on('connection accepted', ({ to }) => {
    connectedUser = to;
    elements.appContainer.style.display = 'block';
    elements.notificationArea.style.display = 'none';
    alert(`Connected with User ${to}`);
});

// Connection rejection handling
socket.on('connection rejected', ({ to }) => {
    alert(`Connection request to User ${to} was rejected`);
});

// Sending Messages
elements.sendBtn.addEventListener('click', () => {
    const message = elements.userInput.value.trim();
    if (message && connectedUser) {
        // Apply encryption if enabled
        const processedMessage = isEncryptionEnabled 
            ? simpleEncrypt(message) 
            : message;

        socket.emit('chat message', { 
            message: processedMessage, 
            to: connectedUser, 
            from: uniqueId,
            encrypted: isEncryptionEnabled
        });
        
        // Display sent message locally
        const msgElement = document.createElement('div');
        msgElement.classList.add('bg-blue-50', 'p-3', 'rounded-lg', 'mb-2');
        msgElement.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <strong class="text-blue-700">You:</strong> 
                    ${isEncryptionEnabled ? '<i class="ri-lock-line text-green-500 mr-2"></i>' : ''}
                    ${message}
                </div>
            </div>
            <small class="text-gray-500 block mt-1">${new Date().toLocaleTimeString()}</small>
        `;
        elements.userMessageArea.appendChild(msgElement);
        elements.userMessageArea.scrollTop = elements.userMessageArea.scrollHeight;
        
        elements.userInput.value = '';
    }
});

// Receive Messages
socket.on('chat message', (data) => {
    // Decrypt message if it was encrypted
    const displayMessage = data.encrypted 
        ? simpleDecrypt(data.message)
        : data.message;

    const msgElement = document.createElement('div');
    msgElement.classList.add('bg-green-50', 'p-3', 'rounded-lg', 'mb-2');
    msgElement.innerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <strong class="text-green-700">User ${data.from}:</strong> 
                ${data.encrypted ? '<i class="ri-lock-line text-green-500 mr-2"></i>' : ''}
                ${displayMessage}
            </div>
        </div>
        <small class="text-gray-500 block mt-1">${new Date().toLocaleTimeString()}</small>
    `;
    elements.userMessageArea.appendChild(msgElement);
    elements.userMessageArea.scrollTop = elements.userMessageArea.scrollHeight;
});

// Error Handling
socket.on('request error', (message) => {
    alert(message);
});

socket.on('message error', (message) => {
    alert(message);
});

// Encryption Toggle
elements.encryptToggle.addEventListener('click', () => {
    isEncryptionEnabled = !isEncryptionEnabled;
    elements.encryptToggle.innerHTML = `
        <i class="ri-lock-line mr-2"></i>Encryption: ${isEncryptionEnabled ? 'ON' : 'OFF'}
    `;
    elements.encryptToggle.classList.toggle('bg-green-500', isEncryptionEnabled);
    elements.encryptToggle.classList.toggle('bg-gray-200', !isEncryptionEnabled);
});

// File Share Button Click Handler
elements.fileShareBtn.addEventListener('click', () => {
    if (!connectedUser) {
        alert('Please connect to a user first');
        return;
    }
    elements.fileInput.click();
});

// File Selection Handler
elements.fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // File size check
    if (file.size > 50 * 1024 * 1024) {
        alert('File size exceeds 50MB limit');
        return;
    }

    // Create form data for upload
    const formData = new FormData();
    formData.append('file', file);

    try {
        // Upload file to server
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('File upload failed');
        }

        const fileData = await response.json();

        // Send file details to connected user
        socket.emit('file upload', {
            from: uniqueId,
            to: connectedUser,
            fileName: fileData.fileName,
            fileSize: fileData.fileSize,
            fileType: fileData.fileType,
            fileUrl: fileData.fileUrl
        });

        // Display file in message area
        const fileElement = document.createElement('div');
        fileElement.classList.add('bg-blue-50', 'p-3', 'rounded-lg', 'mb-2');
        fileElement.innerHTML = `
            <div class="flex items-center justify-between">
                <div>
                    <strong class="text-blue-700">You:</strong> 
                    <span class="ml-2">Sent a file</span>
                </div>
                <a 
                    href="${fileData.fileUrl}" 
                    target="_blank" 
                    class="text-blue-600 hover:underline flex items-center"
                >
                    <i class="ri-file-line mr-2"></i>${fileData.fileName}
                </a>
            </div>
            <small class="text-gray-500 block mt-1">${new Date().toLocaleTimeString()}</small>
        `;
        elements.userMessageArea.appendChild(fileElement);
        elements.userMessageArea.scrollTop = elements.userMessageArea.scrollHeight;

        // Reset file input
        elements.fileInput.value = '';

    } catch (error) {
        console.error('File upload error:', error);
        alert('Failed to upload file');
    }
});

// Handle received files
socket.on('file received', (fileData) => {
    const fileElement = document.createElement('div');
    fileElement.classList.add('bg-green-50', 'p-3', 'rounded-lg', 'mb-2');
    fileElement.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <strong class="text-green-700">User ${fileData.from}:</strong> 
                <span class="ml-2">Sent a file</span>
            </div>
            <a 
                href="${fileData.fileUrl}" 
                target="_blank" 
                class="text-green-600 hover:underline flex items-center"
            >
                <i class="ri-file-line mr-2"></i>${fileData.fileName}
            </a>
        </div>
        <small class="text-gray-500 block mt-1">${new Date().toLocaleTimeString()}</small>
    `;
    elements.userMessageArea.appendChild(fileElement);
    elements.userMessageArea.scrollTop = elements.userMessageArea.scrollHeight;
});