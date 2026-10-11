// Runs before every test file: a fixed signing key so tests can create valid tokens
process.env.JWT_SECRET = "unit-test-signing-key-0123456789";
process.env.FRONTEND_URL = "http://localhost:3000";
