// Global variables
let device;
let currentCall;
let isMuted = false;
let callTimer;
let callStartTime;

// DOM elements
const phoneScreen = document.getElementById('phone-screen');
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

        // Check if we need to redirect to setup page
        if (!data.voice_setup_completed && !data.sms_setup_completed && !data.initialized) {
            // No setup completed - redirect to setup page
            window.location.href = '/setup.html';
            return;
        }

        // Show phone screen and initialize
        phoneScreen.classList.remove('hidden');
        await initializePhone();
    } catch (error) {
        console.error('Initialization error:', error);
        logError(error, { function: 'init' });
        showStatus('Error checking initialization status', true);
    }
}

// Initialize Twilio Device with SDK 2.x
async function initializePhone() {
    try {
        showStatus('Connecting to Twilio...');

        const response = await fetch('/api/token');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error);
        }

        // Initialize Twilio Device (SDK 2.x)
        const { Device } = Twilio;
        device = new Device(data.token, {
            codecPreferences: ['opus', 'pcmu'],
            enableImprovedSignalingErrorPrecision: true
        });

        // Device event handlers for SDK 2.x
        device.on('registered', () => {
            console.log('Device registered');
            showStatus('Ready to make and receive calls', false);
            showState('idle');
        });

        device.on('unregistered', () => {
            console.log('Device unregistered');
        });

        device.on('error', (error) => {
            console.error('Twilio Device Error:', error);
            logError(error, { source: 'twilio_device' });
            showStatus(`Error: ${error.message}`, true);
        });

        device.on('incoming', (call) => {
            console.log('Incoming call from:', call.parameters.From);
            currentCall = call;

            // Get caller info
            const from = call.parameters.From || 'Unknown';
            callerNumber.textContent = from;

            showState('incoming');

            // Set up call event handlers
            setupCallHandlers(call);
        });

        // Register the device
        await device.register();

    } catch (error) {
        console.error('Phone initialization error:', error);
        logError(error, { function: 'initializePhone' });
        showStatus(`Error: ${error.message}`, true);
    }
}

// Set up event handlers for a call
function setupCallHandlers(call) {
    call.on('accept', () => {
        console.log('Call accepted');
        currentCall = call;
        showState('active');
        startCallTimer();

        // Get the phone number
        const number = call.parameters.To || call.parameters.From || 'Unknown';
        activeNumber.textContent = number;
    });

    call.on('disconnect', () => {
        console.log('Call disconnected');
        currentCall = null;
        stopCallTimer();
        isMuted = false;
        muteBtn.textContent = '🔇 Mute';
        muteBtn.classList.remove('active');
        showState('idle');
        phoneInput.value = '';
    });

    call.on('reject', () => {
        console.log('Call rejected');
        currentCall = null;
        showState('idle');
    });

    call.on('cancel', () => {
        console.log('Call cancelled');
        if (incomingState.classList.contains('hidden') === false) {
            showState('idle');
        }
    });

    call.on('error', (error) => {
        console.error('Call error:', error);
        logError(error, { source: 'twilio_call' });
    });
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
        if (currentCall) {
            currentCall.sendDigits(digit);
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

        // Connect returns a Call object in SDK 2.x
        currentCall = await device.connect({ params });
        console.log('Calling:', number);

        // Set up handlers for the outbound call
        setupCallHandlers(currentCall);

    } catch (error) {
        console.error('Call error:', error);
        logError(error, { function: 'makeCall', number });
        alert('Failed to make call: ' + error.message);
    }
});

// Answer button
answerBtn.addEventListener('click', () => {
    if (currentCall) {
        currentCall.accept();
    }
});

// Reject button
rejectBtn.addEventListener('click', () => {
    if (currentCall) {
        currentCall.reject();
        currentCall = null;
        showState('idle');
    }
});

// Mute button
muteBtn.addEventListener('click', () => {
    if (!currentCall) return;

    isMuted = !isMuted;
    currentCall.mute(isMuted);

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
    if (currentCall) {
        currentCall.disconnect();
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
