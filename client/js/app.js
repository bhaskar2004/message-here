import PeerConnection from './peer-connection.js';
import ConnectionUI from './ui-handler.js';
import Encryption from './encryption.js';

class SecureLocalChat {
    constructor() {
        // Core application state
        this.state = {
            currentUser: null,
            connectedPeers: new Map(),
            messages: [],
            isEncryptionEnabled: false
        };

        // Core components
        this.peerConnection = new PeerConnection();
        this.encryption = new Encryption();
        this.connectionUI = new ConnectionUI(this.peerConnection);

        // DOM Elements
        this.elements = {
            userIdDisplay: document.getElementById('userIdDisplay'),
            generateIdBtn: document.getElementById('generateIdBtn'),
            connectIdInput: document.getElementById('connectIdInput'),
            connectBtn: document.getElementById('connectBtn'),
            chatContainer: document.getElementById('appContainer'),
            messageArea: document.getElementById('userMessageArea'),
            messageInput: document.getElementById('userInput'),
            sendBtn: document.getElementById('sendBtn'),
            encryptToggle: document.getElementById('encryptToggle'),
            fileShareBtn: document.getElementById('fileShareBtn'),
            fileInput: document.getElementById('fileInput')
        };

        this.initializeEventListeners();
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // User ID Generation
        this.elements.generateIdBtn.addEventListener('click', () => this.generateUserId());

        // Connection Handlers
        this.elements.connectBtn.addEventListener('click', () => this.initiateConnection());

        // Message Sending
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Encryption Toggle
        this.elements.encryptToggle.addEventListener('click', () => this.toggleEncryption());

        // File Sharing
        this.elements.fileShareBtn.addEventListener('click', () => this.initiateFileShare());

        // Peer Message Listener
        document.addEventListener('peer-message', (event) => this.handleIncomingMessage(event.detail));
    }

    // Generate Unique User ID
    generateUserId() {
        // Create a more robust unique ID
        this.state.currentUser = {
            id: `USER-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            createdAt: new Date()
        };

        // Update UI
        this.elements.userIdDisplay.textContent = `Your ID: ${this.state.currentUser.id}`;
        this.elements.userIdDisplay.classList.remove('hidden');

        // Optional: Copy to clipboard
        navigator.clipboard.writeText(this.state.currentUser.id)
            .then(() => console.log('User ID copied to clipboard'));
    }

    // Initiate Connection
    async initiateConnection() {
        if (!this.state.currentUser) {
            alert('Please generate a User ID first');
            return;
        }

        const targetId = this.elements.connectIdInput.value.trim();
        if (!targetId) {
            alert('Please enter a connection ID');
            return;
        }

        try {
            // Create peer connection
            await this.peerConnection.createPeerConnection();

            // Generate connection offer
            const offer = await this.peerConnection.createOffer();

            // Add connection to state
            this.state.connectedPeers.set(targetId, {
                id: targetId,
                connectionEstablished: false,
                offer: offer
            });

            // Update UI
            this.updateConnectionUI(targetId);
        } catch (error) {
            console.error('Connection failed:', error);
            alert(`Connection failed: ${error.message}`);
        }
    }

    // Send Message
    sendMessage() {
        const messageText = this.elements.messageInput.value.trim();
        if (!messageText) return;

        // Prepare message
        const message = {
            id: `MSG-${Date.now()}`,
            text: this.state.isEncryptionEnabled 
                ? this.encryption.encrypt(messageText) 
                : messageText,
            sender: this.state.currentUser.id,
            timestamp: new Date(),
            encrypted: this.state.isEncryptionEnabled
        };

        // Send via peer connection
        this.peerConnection.sendMessage(JSON.stringify(message));

        // Update local message area
        this.displayMessage(message);

        // Clear input
        this.elements.messageInput.value = '';
    }

    // Handle Incoming Messages
    handleIncomingMessage(rawMessage) {
        try {
            const message = JSON.parse(rawMessage);

            // Decrypt if necessary
            if (message.encrypted) {
                message.text = this.encryption.decrypt(message.text);
            }

            // Display message
            this.displayMessage(message, 'incoming');
        } catch (error) {
            console.error('Message parsing error:', error);
        }
    }

    // Display Message in UI
    displayMessage(message, type = 'outgoing') {
        const messageElement = document.createElement('div');
        messageElement.classList.add(
            'p-3', 'rounded-lg', 'mb-2',
            type === 'incoming' ? 'bg-green-50' : 'bg-blue-50'
        );

        messageElement.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <strong class="${type === 'incoming' ? 'text-green-700' : 'text-blue-700'}">
                        ${message.sender}
                    </strong>
                    ${message.encrypted ? '<i class="ri-lock-line text-green-500 ml-2"></i>' : ''}
                    <p>${message.text}</p>
                </div>
            </div>
            <small class="text-gray-500 block mt-1">
                ${message.timestamp.toLocaleTimeString()}
            </small>
        `;

        this.elements.messageArea.appendChild(messageElement);
        this.elements.messageArea.scrollTop = this.elements.messageArea.scrollHeight;
    }

    // Toggle Encryption
    toggleEncryption() {
        this.state.isEncryptionEnabled = !this.state.isEncryptionEnabled;
        
        this.elements.encryptToggle.innerHTML = `
            <i class="ri-lock-line mr-2"></i>
            Encryption: ${this.state.isEncryptionEnabled ? 'ON' : 'OFF'}
        `;
        
        this.elements.encryptToggle.classList.toggle('bg-green-500', this.state.isEncryptionEnabled);
        this.elements.encryptToggle.classList.toggle('bg-gray-200', !this.state.isEncryptionEnabled);
    }

    // File Sharing
    initiateFileShare() {
        this.elements.fileInput.click();
    }

    // Update Connection UI
    updateConnectionUI(targetId) {
        // Show chat container
        this.elements.chatContainer.classList.remove('hidden');
        
        // Optional: Update connection status
        console.log(`Connected to ${targetId}`);
    }

    // Error Handling
    handleError(error) {
        console.error('Application Error:', error);
        // Optionally show error to user
        const errorDisplay = document.createElement('div');
        errorDisplay.classList.add('bg-red-100', 'p-3', 'rounded-lg', 'mb-2');
        errorDisplay.textContent = `Error: ${error.message}`;
        this.elements.messageArea.appendChild(errorDisplay);
    }
}

// Initialize the application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.secureLocalChat = new SecureLocalChat();
});

export default SecureLocalChat;