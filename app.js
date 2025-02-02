require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

// Make sure to install cors with npm install cors

const app = express();
app.use(express.json());  // Use built-in body parser in Express
app.use(cors({
    origin: '*',  // Adjust according to your requirements
    allowedHeaders: ['Authorization', 'Content-Type']
}));
app.set('trust proxy', true);  // Set trust proxy for Heroku

const AI_ID_DIRT = '7UwFpTj1UbngrccWaxbG';  // AI ID for Dirt
const KINDROID_API_URL = process.env.KINDROID_API_URL || 'https://api.kindroid.ai/v1/send-message';
const FACEBOOK_PAGE_ID = '420968361109770';  // Your Facebook Page ID

// Facebook Webhook Verification Endpoint
app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        res.status(200).send(challenge);
    } else {
        res.status(403).json({
            error: "Verification failed. Token mismatch or invalid request.",
            resolution: "Check VERIFY_TOKEN in environment variables"
        });
    }
});

// Function to send a message to Kindroid AI
const sendMessageToKindroid = async (ai_id, message, token) => {
    try {
        console.log(`Sending to Kindroid: ai_id=${ai_id}, message=${message}`);
        console.log('Using Bearer Token:', token);

        const response = await axios.post(
            KINDROID_API_URL,
            { ai_id, message },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const isJson = typeof response.data === 'object';
        const responseMessage = isJson ? response.data.message : response.data;

        if (!responseMessage) {
            console.error('Error: No valid message in response:', response.data);
            throw new Error("No valid response message from Kindroid");
        }

        return responseMessage;
    } catch (error) {
        console.error('Error sending message to Kindroid:', error.response ? error.response.data : error.message);
        return 'Error communicating with Kindroid AI.';
    }
};

// Secure Endpoint to Handle Messages for Dirt AI (verifyToken middleware commented out to skip verify)
app.post('/dirt-message', async (req, res) => {
    console.log('HEROKU_AUTH_TOKEN:', process.env.HEROKU_AUTH_TOKEN);  // Debug log to check environment variable

    const dirtMessage = req.body.message || "Hi Dirt, What's up?";

    const dirtResponse = await sendMessageToKindroid(AI_ID_DIRT, dirtMessage, process.env.KINDROID_TOKEN_1);
    if (dirtResponse === 'Error communicating with Kindroid AI.') {
        return res.status(500).json({ error: "Error sending message to Dirt" });
    }

    res.json({ dirtResponse });
});

// Handle Webhook Events from Facebook Messenger
const processedEvents = new Set();
const cooldown = new Map();

app.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        res.status(200).send('EVENT_RECEIVED'); // Send the response immediately

        body.entry.forEach(function(entry) {
            entry.messaging.forEach(function(event) {
                const eventId = `${event.sender.id}-${event.timestamp}`;
                if (processedEvents.has(eventId)) {
                    console.log('Duplicate event detected, skipping:', eventId);
                    return; // Skip if already processed
                }
                processedEvents.add(eventId);

                const webhook_event = event;
                console.log(webhook_event);

                const sender_psid = webhook_event.sender.id;
                console.log('Sender PSID: ' + sender_psid);

                if (webhook_event.message) {
                    handleMessage(sender_psid, webhook_event.message);
                } else if (webhook_event.postback) {
                    handlePostback(sender_psid, webhook_event.postback);
                }
            });
        });
    } else {
        res.sendStatus(404);
    }
});

const handleMessage = async (sender_psid, received_message) => {
    const cooldownKey = `${sender_psid}:${received_message.text}`;
    if (cooldown.has(cooldownKey)) {
        console.log('Skipping due to cooldown:', cooldownKey);
        return;
    }

    // Set a 30-second cooldown
    cooldown.set(cooldownKey, Date.now() + 30000);
    setTimeout(() => cooldown.delete(cooldownKey), 30000);

    let response;

    if (received_message.text) {
        const dirtResponse = await sendMessageToKindroid(AI_ID_DIRT, received_message.text, process.env.KINDROID_TOKEN_1);

        response = { "text": dirtResponse };
    }

    callSendAPI(sender_psid, response);
};

const callSendAPI = (sender_psid, response) => {
    const request_body = {
        "recipient": { "id": sender_psid },
        "message": response
    };

    axios.post(`https://graph.facebook.com/v21.0/${FACEBOOK_PAGE_ID}/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`, request_body)
        .then(() => console.log('Message sent!'))
        .catch(error => console.error('Unable to send message:', error));
};

// Test endpoint to verify Authorization header
app.post('/test-auth', (req, res) => {
    const token = req.headers['authorization'] || req.headers['Authorization'];
    console.log('All Request Headers:', JSON.stringify(req.headers, null, 2));  // Log all headers for debugging
    console.log(`Received token: ${token}`);

    if (token) {
        res.json({ message: 'Token received', token });
    } else {
        res.status(403).json({ message: 'No token received' });
    }
});

// Start the Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
