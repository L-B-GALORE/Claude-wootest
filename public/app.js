// Global variables
let device;
let currentConnection;
let isMuted = false;
let callTimer;
let callStartTime;

// DOM elements
const setupScreen = document.getElementById('setup-screen');
const phoneScreen = document.getElementById('phone-screen');
const setupForm = document.getElementById('setup-form');
const setupStatus = document.getElementById('setup-status');
const statusDiv = document.getElementById('status');

const idleState = document.getElementById('idle-state');
const incomingState = document.getElementById('incoming-state');
const activeState = document.getElementById('active-state');

const phoneInput = document.getElementById('phone-input');
const callBtn = document.getElementById('call-btn');
const answerBtn = document.getElementById('answer-btn');
const rejectBtn = document.getElementById('reject-btn');
const muteBtn = document.getElementById('mute-btn');
const hangupBtn = document.getElementById('hangup-btn');

const callerNumber = document.getElementById('caller-number');
const activeNumber = document.getElementById('active-number');
const callTimerDiv = document.getElementById('call-timer');

// Global error logging function
async function logError(error, context = {}) {
    try {
        await fetch('/api/log-error', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: error.message || error.toString(),
                stack: error.stack || null,
                context: {
                    ...context,
                    userAgent: navigator.userAgent,
                    url: window.location.href
                }
            })
        });
    } catch (logError) {
        console.error('Failed to log error to backend:', logError);
    }
}

// Global error handler
window.addEventListener('error', (event) => {
    logError(event.error || new Error(event.message), {
        type: 'uncaught',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });
});

// Global promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    logError(event.reason || new Error('Unhandled promise rejection'), {
        type: 'promise_rejection'
    });
});

// Initialize app
async function init() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();

        if (data.initialized) {
            // Already initialized, show phone screen
            setupScreen.classList.add('hidden');
            phoneScreen.classList.remove('hidden');
            await initializePhone();
        } else {
            // Show setup screen
            setupScreen.classList.remove('hidden');
            phoneScreen.classList.add('hidden');
        }
    } catch (error) {
        console.error('Initialization error:', error);
        logError(error, { function: 'init' });
        showStatus('Error checking initialization status', true);
    }
}

// Setup form handler
setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const accountSid = document.getElementById('accountSid').value.trim();
    const authToken = document.getElementById('authToken').value.trim();
    const phoneNumber = document.getElementById('phoneNumber').value.trim();

    setupStatus.textContent = 'Initializing... This may take a moment.';
    setupStatus.className = '';

    try {
        const response = await fetch('/api/setup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ accountSid, authToken, phoneNumber })
        });

        const data = await response.json();

        if (response.ok) {
            setupStatus.textContent = 'Setup completed successfully! Loading phone...';
            setupStatus.className = 'success';

            // Wait a moment then switch to phone screen
            setTimeout(async () => {
                setupScreen.classList.add('hidden');
                phoneScreen.classList.remove('hidden');
                await initializePhone();
            }, 1500);
        } else {
            setupStatus.textContent = `Error: ${data.error}`;
            setupStatus.className = 'error';
        }
    } catch (error) {
        logError(error, { function: 'setupForm', accountSid });
        setupStatus.textContent = `Error: ${error.message}`;
        setupStatus.className = 'error';
    }
});

// Initialize Twilio Device
async function initializePhone() {
    try {
        showStatus('Connecting to Twilio...');

        const response = await fetch('/api/token');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error);
        }

        // Initialize Twilio Device
        device = new Twilio.Device(data.token, {
            codecPreferences: ['opus', 'pcmu'],
            fakeLocalDTMF: true,
            enableRingingState: true
        });

        // Device event handlers
        device.on('ready', () => {
            showStatus('Ready to make and receive calls', false);
            showState('idle');
        });

        device.on('error', (error) => {
            console.error('Twilio Device Error:', error);
            logError(error, { source: 'twilio_device' });
            showStatus(`Error: ${error.message}`, true);
        });

        device.on('connect', (conn) => {
            console.log('Call connected');
            currentConnection = conn;
            showState('active');
            startCallTimer();

            // Get the phone number
            const params = conn.customParameters || {};
            const number = params.To || conn.parameters.To || 'Unknown';
            activeNumber.textContent = number;
        });

        device.on('disconnect', () => {
            console.log('Call disconnected');
            currentConnection = null;
            stopCallTimer();
            isMuted = false;
            muteBtn.textContent = '🔇 Mute';
            muteBtn.classList.remove('active');
            showState('idle');
            phoneInput.value = '';
        });

        device.on('incoming', (conn) => {
            console.log('Incoming call');
            currentConnection = conn;

            // Get caller info
            const from = conn.parameters.From || 'Unknown';
            callerNumber.textContent = from;

            showState('incoming');

            // Handle disconnect during ringing
            conn.on('disconnect', () => {
                if (incomingState.classList.contains('hidden') === false) {
                    showState('idle');
                }
            });
        });

    } catch (error) {
        console.error('Phone initialization error:', error);
        logError(error, { function: 'initializePhone' });
        showStatus(`Error: ${error.message}`, true);
    }
}

// Dialpad handlers
document.querySelectorAll('.dial-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const digit = btn.dataset.digit;
        phoneInput.value += digit;
    });
});

document.querySelectorAll('.dial-btn-small').forEach(btn => {
    btn.addEventListener('click', () => {
        const digit = btn.dataset.digit;
        if (currentConnection) {
            currentConnection.sendDigits(digit);
        }
    });
});

// Call button
callBtn.addEventListener('click', async () => {
    const number = phoneInput.value.trim();
    if (!number) {
        alert('Please enter a phone number');
        return;
    }

    try {
        const params = {
            To: number
        };
        await device.connect(params);
        console.log('Calling:', number);
    } catch (error) {
        console.error('Call error:', error);
        logError(error, { function: 'makeCall', number });
        alert('Failed to make call: ' + error.message);
    }
});

// Answer button
answerBtn.addEventListener('click', () => {
    if (currentConnection) {
        currentConnection.accept();
        const from = currentConnection.parameters.From || 'Unknown';
        activeNumber.textContent = from;
    }
});

// Reject button
rejectBtn.addEventListener('click', () => {
    if (currentConnection) {
        currentConnection.reject();
        currentConnection = null;
        showState('idle');
    }
});

// Mute button
muteBtn.addEventListener('click', () => {
    if (!currentConnection) return;

    isMuted = !isMuted;
    currentConnection.mute(isMuted);

    if (isMuted) {
        muteBtn.textContent = '🔊 Unmute';
        muteBtn.classList.add('active');
    } else {
        muteBtn.textContent = '🔇 Mute';
        muteBtn.classList.remove('active');
    }
});

// Hangup button
hangupBtn.addEventListener('click', () => {
    if (currentConnection) {
        currentConnection.disconnect();
    }
});

// UI helper functions
function showState(state) {
    idleState.classList.add('hidden');
    incomingState.classList.add('hidden');
    activeState.classList.add('hidden');

    switch (state) {
        case 'idle':
            idleState.classList.remove('hidden');
            break;
        case 'incoming':
            incomingState.classList.remove('hidden');
            break;
        case 'active':
            activeState.classList.remove('hidden');
            break;
    }
}

function showStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.className = 'status';
    if (isError) {
        statusDiv.classList.add('error');
    } else if (message.includes('Ready')) {
        statusDiv.classList.add('ready');
    }
}

function startCallTimer() {
    callStartTime = Date.now();
    callTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        callTimerDiv.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function stopCallTimer() {
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
    }
    callTimerDiv.textContent = '00:00';
}

// Allow Enter key to submit phone number
phoneInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        callBtn.click();
    }
});

// Start the app
init();
