require('dotenv').config();  // Load environment variables from .env file

// Middleware to verify Bearer Token
const verifyToken = (req, res, next) => {
  // Get the token from the Authorization header
  const token = req.headers['authorization'] || req.headers['Authorization'];
  console.log('All Request Headers:', req.headers);  // Log all headers for debugging
  console.log(`Received token: ${token}`);


// Define the expected token from the environment variable
  const expectedToken = `Bearer ${process.env.HEROKU_AUTH_TOKEN}`;
  console.log(`Expected token: ${expectedToken}`);

  // Compare the received token with the expected token
  if (token !== expectedToken) {
    return res.status(401).json({
      error: "Invalid Token",
      details: "The token provided does not match the expected Heroku authorization token.",
      resolution: "Ensure your Authorization header includes the correct Bearer token."
    });
  }

  // Check if token is provided
  if (!token) {
    return res.status(403).json({
      error: "Authorization token missing",
      details: "A Bearer token must be included in the 'Authorization' header to access this resource.",
      example: "Authorization: Bearer <YOUR_TOKEN>",
      resolution: "Please include a valid Bearer token in your request headers."
    });
  }

  // If token is valid, proceed with the request
  next();
};

module.exports = verifyToken;
