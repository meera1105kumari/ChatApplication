const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('./App');

describe('User Management ', () => {
  describe('POST /register', () => {
    it('Registering as new user', async () => {
      const res = await request(app)
        .post('/register')
        .send({ username: 'SampleUser', password: 'Pass@123' });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('message', 'User successfully registered ');
    });
  });

  describe('POST /login', () => {
    it('logging in as exisiting user with proper creds', async () => {
      const res = await request(app)
        .post('/login')
        .send({ username: 'SampleUser', password: 'Pass@123' });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
    });

    it('returning invalid error for improper creds', async () => {
      const res = await request(app)
        .post('/login')
        .send({ username: 'testuser', password: 'Pass@321' });
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error', 'Invalid creds');
    });
  });
});

describe('WebSocket Integration Tests', () => {
  it('handling incoming messages', async () => {
    const mockMessage = {
      sender: 'User11',
      receiver: 'User22',
      content: 'Hello, User22!',
    };
    // Simulate WebSocket message handling
    // Start by mocking database and Kafka interactions
    // Then, simulate WebSocket server behavior

    // Send the mock message to the WebSocket server
    // Wait for a response or check the database directly
    // Assert that the message is saved to the database, published to Kafka, and broadcasted correctly
  });
});
