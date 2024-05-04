const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Client: PostgreSQLClient } = require('pg');
const redis = require('redis');
const kafka = require('kafka-node');

const app = express();
app.use(bodyParser.json());

const server = http.createServer(app);
const webSocketServer = new WebSocket.Server({ server });
const pgClient = new PostgreSQLClient({
    connectionString: 'postgres://postgres:root@localhost:5432/postgres'
});
pgClient.connect();
const redisClient = redis.createClient();
const kafkaClient = new kafka.KafkaClient({ kafkaHost: 'localhost:9092' });
const kafkaProducer = new kafka.Producer(kafkaClient);

app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const encryptedPassword = await bcrypt.hash(password, 10);
        await pgClient.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, encryptedPassword]);
        res.status(201).json({ success: true, message: 'User registered successfully' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ success: false, error: 'Failed to register user' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pgClient.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid username or password' });
        }
        const user = result.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, error: 'Invalid username or password' });
        }
        const token = jwt.sign({ username: user.username }, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJJc3N1ZXIiOiJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTcxNDU2NTc4NiwiaWF0IjoxNzE0NTY1Nzg2fQ.FnN4o4SuiwALR-tUaqy2hUgEo1HdVExzaPkjNwacVtY');
        res.json({ success: true, token });
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ success: false, error: 'Failed to login user' });
    }
});


webSocketServer.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const { sender, receiver, content } = JSON.parse(message);
            const kafkaMessage = { sender, receiver, content, timestamp: new Date().toISOString() };
            await pgClient.query('INSERT INTO messages (sender, receiver, content) VALUES ($1, $2, $3)', [sender, receiver, content]);
            kafkaProducer.send([{ topic: 'messages', messages: JSON.stringify(kafkaMessage) }], (err, data) => {
                if (err) console.error('Error publishing message to Kafka:', err);
                else console.log('Message published to Kafka:', data);
            });
            const recentMessagesKey = `recent_messages_${receiver}`;
            redisClient.lpush(recentMessagesKey, JSON.stringify(kafkaMessage));
            redisClient.ltrim(recentMessagesKey, 0, 99);
            webSocketServer.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN && (client.username === receiver || client.username === sender))
                    client.send(JSON.stringify(kafkaMessage));
            });
        } catch (error) {
            console.error('Error handling incoming message:', error);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
