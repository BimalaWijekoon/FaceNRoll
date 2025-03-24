require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const helmet = require('helmet');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware setup
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(helmet());

// MongoDB connection setup
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => console.log('Connected to MongoDB'));

// Nodemailer setup for sending emails
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// User Schema definition - updated to match signup form
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  registrationNumber: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  address: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Registration Schema (kept for future usage)
const registrationSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  id: { type: String },
  telephone: { type: String },
  address: { type: String },
  pictures: [{
    poseName: String,
    imageData: String,
    contentType: String
  }],
  registrationDate: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Registration = mongoose.model('Registration', registrationSchema);

// Route to sign up a new user - updated to match the signup form
app.post('/signup', async (req, res) => {
  try {
    const { 
      fullName, 
      email, 
      username, 
      password, 
      registrationNumber, 
      mobileNumber, 
      address 
    } = req.body;

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already exists. Please use a different email address.' });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already exists. Please choose a different username.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      fullName,
      email,
      username,
      password: hashedPassword,
      registrationNumber,
      mobileNumber,
      address
    });

    await newUser.save();

    res.status(201).json({ 
      success: true,
      message: 'User created successfully.' 
    });

  } catch (error) {
    console.error('Error signing up:', error.message);
    res.status(500).json({ error: 'Failed to sign up' });
  }
});

// Route to log in a user using username and password (updated)
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    res.status(200).json({ 
      success: true,
      message: 'Login successful', 
      user: {
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        registrationNumber: user.registrationNumber,
        mobileNumber: user.mobileNumber,
        address: user.address
      }
    });
  } catch (error) {
    console.error('Error logging in:', error.message);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// Route to send a test email
app.get('/send-test-email', async (req, res) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'bmwmiuranda2002@gmail.com', // Replace with the recipient's email
      subject: 'Test Email from Nodemailer',
      text: 'This is a test email sent from Nodemailer using an app-specific password.',
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error.message);
        return res.status(500).json({ error: 'Failed to send test email' });
      } else {
        console.log('Test email sent:', info.response);
        return res.status(200).json({ message: 'Test email sent successfully' });
      }
    });
  } catch (error) {
    console.error('Error in test email route:', error.message);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// Add this route to your index.js file to check admin count
app.get('/admin/count', async (req, res) => {
    try {
      const count = await User.countDocuments();
      res.status(200).json({ 
        success: true,
        count: count
      });
    } catch (error) {
      console.error('Error getting admin count:', error.message);
      res.status(500).json({ error: 'Failed to get admin count' });
    }
  });
  
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});