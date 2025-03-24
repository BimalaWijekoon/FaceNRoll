require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const PDFDocument = require('pdfkit');


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

// User Schema definition
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  telephone: { type: String, required: true },
});

// Registration Schema with pictures array field
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

const embeddingsSchema = new mongoose.Schema({
  embeddings: { type: Object, required: true },
  timestamp: { type: Date, default: Date.now },
  processedImages: { type: Number },
  persons: { type: Number }
});

// Attendance Schema
const attendanceSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  date: { type: Date, required: true },
  attendance: { 
    type: String, 
    enum: ['present', 'leave', 'warning'], 
    required: true 
  },
  progress: { 
    type: String, 
    enum: ['not late', 'late', 'leave ontime', 'leave early', 'not marked as present on morning'], 
    required: true 
  },
  time: { type: Date, required: true }
});

// Create index for faster queries
attendanceSchema.index({ email: 1, date: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);
const Embeddings = mongoose.model('Embeddings', embeddingsSchema);
const User = mongoose.model('User', userSchema);
const Registration = mongoose.model('Registration', registrationSchema);



// Helper function to get the start of current day
const getStartOfDay = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// Helper function to get the end of current day
const getEndOfDay = () => {
  const startOfDay = getStartOfDay();
  return new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
};

// Helper function to clean up duplicate attendance records
async function cleanupDuplicateRecords(email, startOfDay, endOfDay) {
  try {
    // Get all attendance records for the day, grouped by attendance type
    const todayRecords = await Attendance.find({
      email,
      date: { $gte: startOfDay, $lt: endOfDay }
    }).sort({ time: -1 });
    
    // Group records by attendance type
    const recordsByType = {
      present: [],
      leave: [],
      warning: []
    };
    
    todayRecords.forEach(record => {
      if (recordsByType[record.attendance]) {
        recordsByType[record.attendance].push(record);
      }
    });
    
    // For each type, keep only the latest record if there are duplicates
    for (const type in recordsByType) {
      if (recordsByType[type].length > 1) {
        // Skip the first (most recent) record, delete the rest
        const recordsToDelete = recordsByType[type].slice(1);
        for (const record of recordsToDelete) {
          await Attendance.findByIdAndDelete(record._id);
          console.log(`Deleted duplicate ${type} record for ${email} on ${startOfDay.toLocaleDateString()}`);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up duplicate records:', error.message);
  }
}

// Route to mark attendance
app.post('/mark-attendance', async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;
    
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if the user exists in the registration database
    const user = await Registration.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not registered' });
    }
    
    const now = new Date();
    const startOfDay = getStartOfDay();
    const endOfDay = getEndOfDay();
    const hours = now.getHours();
    
    // Get all attendance records for today (for both present and leave)
    const todayRecords = await Attendance.find({
      email,
      date: { $gte: startOfDay, $lt: endOfDay }
    }).sort({ time: -1 });
    
    const existingPresent = todayRecords.find(record => record.attendance === 'present');
    const existingLeave = todayRecords.find(record => record.attendance === 'leave');
    const existingWarning = todayRecords.find(record => record.attendance === 'warning');
    
    let attendance, progress;
    let isDuplicate = false;
    
    // Morning attendance (6am to 9am)
    if (hours >= 6 && hours < 9) {
      // Morning check-in
      attendance = 'present';
      progress = 'not late';
      
      // Check if already marked present
      if (existingPresent) {
        isDuplicate = true;
      }
    }
    
    // Daytime attendance (9am to 4pm)
    else if (hours >= 9 && hours < 16) {
      if (existingPresent) {
        // If already marked present, this is early leaving
        attendance = 'leave';
        progress = 'leave early';
        
        // Check if already marked leave
        if (existingLeave) {
          isDuplicate = true;
        }
      } else {
        // Late arrival
        attendance = 'present';
        progress = 'late';
      }
    }
    
    // Evening/Night attendance (4pm to 6am)
    else { // hours >= 16 || hours < 6
      if (existingPresent) {
        // Normal leaving time
        attendance = 'leave';
        progress = 'leave ontime';
        
        // Check if already marked leave
        if (existingLeave) {
          isDuplicate = true;
        }
      } else {
        // Not marked present in morning
        attendance = 'warning';
        progress = 'not marked as present on morning';
        
        // Check if already marked with warning
        if (existingWarning) {
          isDuplicate = true;
        }
      }
    }
    
    // Handle duplicate attendance
    if (isDuplicate) {
      // Return the existing record instead of an error for better UX
      let existingRecord;
      if (attendance === 'present') {
        existingRecord = existingPresent;
      } else if (attendance === 'leave') {
        existingRecord = existingLeave;
      } else if (attendance === 'warning') {
        existingRecord = existingWarning;
      }
      
      return res.status(200).json({ 
        success: true,
        duplicate: true,
        message: `Already marked as ${attendance} today`,
        attendance: existingRecord
      });
    }
    
    // Create new attendance record
    const newAttendance = new Attendance({
      firstName,
      lastName,
      email,
      attendance,
      progress,
      time: now,
      date: startOfDay
    });
    
    await newAttendance.save();
    
    // Clean up duplicate records after saving (in case there are any)
    cleanupDuplicateRecords(email, startOfDay, endOfDay);
    
    // Send email notification
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Attendance Notification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">Attendance Notification</h2>
          <p>Dear ${firstName} ${lastName},</p>
          <p>Your attendance has been marked as <strong>${attendance}</strong> (${progress}) at ${now.toLocaleTimeString()}.</p>
          <p>Date: ${startOfDay.toLocaleDateString()}</p>
          <p>If you believe this is an error, please contact the administrator.</p>
          <p style="margin-top: 20px;">Best regards,</p>
          <p>The Attendance System Team</p>
        </div>
      `
    };
    
    // Add email sending with error handling
    try {
      await new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error sending attendance email:', error.message);
            // Don't reject the promise, just log the error
            resolve(false);
          } else {
            console.log('Attendance email sent:', info.response);
            resolve(true);
          }
        });
      });
    } catch (emailError) {
      // Log the error but don't fail the request
      console.error('Failed to send email:', emailError.message);
    }
    
    res.status(201).json({ 
      success: true, 
      message: 'Attendance marked successfully',
      attendance: newAttendance
    });
    
  } catch (error) {
    console.error('Error marking attendance:', error.message);
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
});

// Route to get today's attendance status for a user
app.get('/attendance-status/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const startOfDay = getStartOfDay();
    const endOfDay = getEndOfDay();
    
    // Get all attendance records for today
    const todayRecords = await Attendance.find({
      email,
      date: { $gte: startOfDay, $lt: endOfDay }
    }).sort({ time: -1 });
    
    // Format the result in a user-friendly way
    const attendanceStatus = {
      date: startOfDay.toLocaleDateString(),
      present: null,
      leave: null,
      warning: null,
      summary: 'Not marked'
    };
    
    todayRecords.forEach(record => {
      attendanceStatus[record.attendance] = {
        time: record.time,
        progress: record.progress
      };
    });
    
    // Create a summary of the attendance status
    if (attendanceStatus.present && attendanceStatus.leave) {
      attendanceStatus.summary = `Present (${attendanceStatus.present.progress}) → Leave (${attendanceStatus.leave.progress})`;
    } else if (attendanceStatus.present) {
      attendanceStatus.summary = `Present (${attendanceStatus.present.progress})`;
    } else if (attendanceStatus.leave) {
      attendanceStatus.summary = `Leave (${attendanceStatus.leave.progress})`;
    } else if (attendanceStatus.warning) {
      attendanceStatus.summary = `Warning (${attendanceStatus.warning.progress})`;
    }
    
    res.status(200).json({ success: true, attendanceStatus });
    
  } catch (error) {
    console.error('Error fetching attendance status:', error.message);
    res.status(500).json({ error: 'Failed to fetch attendance status' });
  }
});

// Route to get attendance records for a specific user
app.get('/attendance/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { date } = req.query;
    
    let startDate, endDate;
    
    if (date) {
      startDate = new Date(date);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    } else {
      startDate = getStartOfDay();
      endDate = getEndOfDay();
    }
    
    const attendanceRecords = await Attendance.find({
      email,
      date: { $gte: startDate, $lt: endDate }
    }).sort({ time: 1 });
    
    res.status(200).json({ 
      records: attendanceRecords,
      date: startDate.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Error fetching attendance records:', error.message);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

// Route to get all users with their details
app.get('/all-users', async (req, res) => {
  try {
    const users = await Registration.find({}, {
      firstName: 1,
      lastName: 1,
      email: 1,
      id: 1,
      telephone: 1,
      address: 1,
      registrationDate: 1
    });
    
    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'No users found' });
    }
    
    res.status(200).json({ users });
  } catch (error) {
    console.error('Error fetching all users:', error.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Route to get attendance summary for all users for a specific date
app.get('/attendance-summary', async (req, res) => {
  try {
    const { date } = req.query;
    
    let startDate, endDate;
    
    if (date) {
      startDate = new Date(date);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    } else {
      startDate = getStartOfDay();
      endDate = getEndOfDay();
    }
    
    const attendanceRecords = await Attendance.find({
      date: { $gte: startDate, $lt: endDate }
    }).sort({ time: 1 });
    
    // Get all registered users
    const allUsers = await Registration.find({}, {
      firstName: 1,
      lastName: 1,
      email: 1
    });
    
    // Create a map of all users
    const userMap = {};
    allUsers.forEach(user => {
      userMap[user.email] = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        records: []
      };
    });
    
    // Add attendance records to corresponding users
    attendanceRecords.forEach(record => {
      if (userMap[record.email]) {
        userMap[record.email].records.push({
          attendance: record.attendance,
          progress: record.progress,
          time: record.time
        });
      }
    });
    
    res.status(200).json({ 
      date: startDate.toISOString().split('T')[0],
      summary: Object.values(userMap)
    });
  } catch (error) {
    console.error('Error fetching attendance summary:', error.message);
    res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
});

// Route to get attendance analytics (counts, percentages, etc.)
app.get('/attendance-analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let start, end;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      end.setDate(end.getDate() + 1); // Include the end date
    } else {
      // Default to last 30 days
      end = getEndOfDay();
      start = new Date(end);
      start.setDate(start.getDate() - 30);
    }
    
    const attendanceRecords = await Attendance.find({
      date: { $gte: start, $lt: end }
    });
    
    // Get total number of registered users
    const totalUsers = await Registration.countDocuments();
    
    // Process data for analytics
    const analytics = {
      totalRecords: attendanceRecords.length,
      totalUsers,
      byAttendance: {
        present: 0,
        leave: 0,
        warning: 0
      },
      byProgress: {
        'not late': 0,
        'late': 0,
        'leave ontime': 0,
        'leave early': 0,
        'not marked as present on morning': 0
      },
      dailyAttendance: {},
      attendanceRate: 0
    };
    
    // Count records by type
    attendanceRecords.forEach(record => {
      // Count by attendance type
      analytics.byAttendance[record.attendance]++;
      
      // Count by progress
      analytics.byProgress[record.progress]++;
      
      // Organize by date
      const dateStr = record.date.toISOString().split('T')[0];
      if (!analytics.dailyAttendance[dateStr]) {
        analytics.dailyAttendance[dateStr] = {
          present: 0,
          leave: 0,
          warning: 0
        };
      }
      analytics.dailyAttendance[dateStr][record.attendance]++;
    });
    
    // Calculate attendance rate (days with attendance / total days)
    const days = Object.keys(analytics.dailyAttendance).length;
    if (days > 0) {
      let totalPresent = 0;
      for (const date in analytics.dailyAttendance) {
        totalPresent += analytics.dailyAttendance[date].present;
      }
      analytics.attendanceRate = (totalPresent / (days * totalUsers) * 100).toFixed(2);
    }
    
    res.status(200).json({ 
      startDate: start.toISOString().split('T')[0],
      endDate: new Date(end.getTime() - 1).toISOString().split('T')[0],
      analytics 
    });
  } catch (error) {
    console.error('Error fetching attendance analytics:', error.message);
    res.status(500).json({ error: 'Failed to fetch attendance analytics' });
  }
});

// Route to sign up a new user
app.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, telephone } = req.body;

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      telephone,
    });

    await newUser.save();

    res.status(201).json({ message: 'User created successfully.' });

  } catch (error) {
    console.error('Error signing up:', error.message);
    res.status(500).json({ error: 'Failed to sign up' });
  }
});

// Route to log in a user using email and password
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    res.status(200).json({ message: 'Login successful', user });
  } catch (error) {
    console.error('Error logging in:', error.message);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// Route to register a new user with pictures
app.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, id, telephone, address, pictures } = req.body;

    // Check if user already exists
    const existingRegistration = await Registration.findOne({ email });
    if (existingRegistration) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Process the pictures
    const processedPictures = pictures.map(pic => ({
      poseName: firstName + '_' + pic.poseName, // Add firstName prefix to poseName
      imageData: pic.imageData, // Base64 encoded image data
      contentType: pic.contentType // MIME type
    }));

    // Create a new registration document with all fields including pictures
    const newRegistration = new Registration({
      firstName,
      lastName,
      email,
      id,
      telephone,
      address,
      pictures: processedPictures // Set pictures array directly
    });

    await newRegistration.save();

    // Send confirmation email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Registration Successful',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">Registration Successful</h2>
          <p>Dear ${firstName} ${lastName},</p>
          <p>Thank you for registering with our service. Your registration has been successfully completed.</p>
          <p>We have received your submission including all the required pictures.</p>
          <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
          <p style="margin-top: 20px;">Best regards,</p>
          <p>The Team</p>
        </div>
      `
    };

    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error.message);
        // Even if email fails, the registration was successful
        return res.status(201).json({ 
          success: true, 
          message: 'Registration successful, but confirmation email could not be sent',
          emailSent: false
        });
      } else {
        console.log('Confirmation email sent:', info.response);
        return res.status(201).json({ 
          success: true, 
          message: 'Registration successful and confirmation email sent',
          emailSent: true
        });
      }
    });

  } catch (error) {
    console.error('Error registering user:', error.message);
    res.status(500).json({ error: 'Failed to register user' });
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

// Route to get a user's registration with pictures by email
app.get('/registrations/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const registration = await Registration.findOne({ email });
    
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    
    res.status(200).json({ registration });
  } catch (error) {
    console.error('Error fetching registration:', error.message);
    res.status(500).json({ error: 'Failed to fetch registration' });
  }
});

// Route to fetch all images for a specific person by first name
app.get('/images/:firstName', async (req, res) => {
  try {
    const { firstName } = req.params;
    
    // Find all registrations where pictures have poseName starting with the firstName
    const registrations = await Registration.find({
      'pictures.poseName': { $regex: `^${firstName}_` }
    });
    
    if (!registrations || registrations.length === 0) {
      return res.status(404).json({ error: 'No images found for this person' });
    }
    
    // Extract all matching pictures
    let matchingImages = [];
    
    registrations.forEach(reg => {
      const images = reg.pictures.filter(pic => pic.poseName.startsWith(`${firstName}_`));
      
      images.forEach(img => {
        matchingImages.push({
          personName: firstName,
          imageName: img.poseName.substring(firstName.length + 1) + '.jpg', // Remove firstName_ prefix
          imageData: img.imageData,
          contentType: img.contentType
        });
      });
    });
    
    res.status(200).json({ images: matchingImages });
  } catch (error) {
    console.error('Error fetching images:', error.message);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Route to save embeddings
app.post('/embeddings', async (req, res) => {
  try {
    const { embeddings, timestamp, logs } = req.body;
    
    // Calculate metrics
    const persons = Object.keys(embeddings).length;
    const processedImages = Object.values(embeddings).reduce((total, arr) => total + arr.length, 0);
    
    // Create a new embeddings document
    const newEmbeddings = new Embeddings({
      embeddings,
      timestamp: new Date(timestamp),
      processedImages,
      persons
    });
    
    await newEmbeddings.save();
    
    res.status(201).json({ 
      success: true, 
      message: 'Embeddings saved successfully',
      timestamp: newEmbeddings.timestamp
    });
  } catch (error) {
    console.error('Error saving embeddings:', error.message);
    res.status(500).json({ error: 'Failed to save embeddings' });
  }
});

// Route to get the most recent embeddings
app.get('/embeddings/latest', async (req, res) => {
  try {
    const latestEmbeddings = await Embeddings.findOne().sort({ timestamp: -1 });
    
    if (!latestEmbeddings) {
      // Return 200 with empty embeddings object instead of 404
      return res.status(200).json({ 
        embeddings: {
          embeddings: {},
          timestamp: new Date()
        }
      });
    }
    
    res.status(200).json({ embeddings: latestEmbeddings });
  } catch (error) {
    console.error('Error fetching embeddings:', error.message);
    res.status(500).json({ error: 'Failed to fetch embeddings' });
  }
});

// Route to fetch all users with their pictures
app.get('/users-with-images', async (req, res) => {
  try {
    // Find all registrations that have pictures
    const registrations = await Registration.find({ 'pictures.0': { $exists: true } });
    
    if (!registrations || registrations.length === 0) {
      return res.status(404).json({ error: 'No users with images found' });
    }
    
    // Extract all users and their images
    let usersWithImages = [];
    
    registrations.forEach(reg => {
      const userImages = reg.pictures.map(pic => ({
        personName: reg.firstName,
        imageName: pic.poseName.startsWith(reg.firstName + '_') 
          ? pic.poseName.substring(reg.firstName.length + 1) + '.jpg' 
          : pic.poseName + '.jpg',
        imageData: pic.imageData,
        contentType: pic.contentType
      }));
      
      usersWithImages.push({
        firstName: reg.firstName,
        lastName: reg.lastName,
        email: reg.email,
        images: userImages
      });
    });
    
    res.status(200).json({ users: usersWithImages });
  } catch (error) {
    console.error('Error fetching users with images:', error.message);
    res.status(500).json({ error: 'Failed to fetch users with images' });
  }
});

// Route to fetch all users with complete details and images
app.get('/users-complete', async (req, res) => {
  try {
    // Find all registrations
    const registrations = await Registration.find({});
    
    if (!registrations || registrations.length === 0) {
      return res.status(404).json({ error: 'No registered users found' });
    }
    
    // Process each registration to include full user details
    const completeUsers = registrations.map(reg => {
      // Format the pictures for each user
      const userImages = reg.pictures.map(pic => ({
        poseName: pic.poseName,
        imageData: pic.imageData,
        contentType: pic.contentType
      }));
      
      // Return complete user object
      return {
        firstName: reg.firstName,
        lastName: reg.lastName,
        email: reg.email,
        id: reg.id,
        telephone: reg.telephone,
        address: reg.address,
        registrationDate: reg.registrationDate,
        pictures: userImages
      };
    });
    
    res.status(200).json({ 
      success: true,
      count: completeUsers.length,
      users: completeUsers 
    });
  } catch (error) {
    console.error('Error fetching complete user details:', error.message);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// GET route to fetch single user details
app.get('/user/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const user = await Registration.findOne({ email: email });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    return res.status(200).json({ success: true, user: user });
  } catch (error) {
    console.error('Error fetching user details:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET route to fetch user attendance history
app.get('/user-attendance/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const attendance = await Attendance.find({ email: email }).sort({ date: -1 });
    
    return res.status(200).json({ success: true, attendance: attendance });
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT route to update user details
app.put('/update-user/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const updatedData = req.body;
    
    const user = await Registration.findByIdAndUpdate(
      userId,
      updatedData,
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    return res.status(200).json({ success: true, user: user });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST route to send verification email
app.post('/send-verification-email', async (req, res) => {
  try {
    const { email, newEmail, code } = req.body;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Email Change Verification',
      html: `
        <h2>Email Change Request</h2>
        <p>We received a request to change your email address to ${newEmail}.</p>
        <p>Your verification code is: <strong>${code}</strong></p>
        <p>If you did not request this change, please ignore this email or contact support.</p>
      `
    };
    
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending verification email:', error);
        return res.status(500).json({ success: false, message: 'Failed to send verification email' });
      }
      
      return res.status(200).json({ success: true, message: 'Verification email sent' });
    });
  } catch (error) {
    console.error('Error in verification email route:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST route to send email update confirmation
app.post('/send-email-update-confirmation', async (req, res) => {
  try {
    const { email, firstName, previousEmail } = req.body;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Email Address Updated Successfully',
      html: `
        <h2>Hello ${firstName},</h2>
        <p>Your email address has been successfully updated.</p>
        <p>Your previous email was: ${previousEmail}</p>
        <p>Your new email is: ${email}</p>
        <p>If you did not make this change, please contact support immediately.</p>
      `
    };
    
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending confirmation email:', error);
        return res.status(500).json({ success: false, message: 'Failed to send confirmation email' });
      }
      
      return res.status(200).json({ success: true, message: 'Confirmation email sent' });
    });
  } catch (error) {
    console.error('Error in confirmation email route:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE route to remove a user
app.delete('/delete-user/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Delete user from registration collection
    const deletedUser = await Registration.findByIdAndDelete(userId);
    
    if (!deletedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Also delete user's attendance records
    await Attendance.deleteMany({ email: deletedUser.email });
    
    return res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Route to get all attendance records with optional filtering
app.get('/all-attendance', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      email, 
      attendance, 
      progress,
      sortBy = 'date',
      sortOrder = 'desc',
      limit = 100,
      page = 1
    } = req.query;
    
    // Build the query object
    const query = {};
    
    // Add date range filter if provided
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        // Set to end of day
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }
    
    // Add email filter if provided
    if (email) {
      query.email = email;
    }
    
    // Add attendance type filter if provided
    if (attendance) {
      query.attendance = attendance;
    }
    
    // Add progress filter if provided
    if (progress) {
      query.progress = progress;
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Create sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Execute the query with pagination and sorting
    const attendanceRecords = await Attendance.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Attendance.countDocuments(query);
    
    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      records: attendanceRecords
    });
    
  } catch (error) {
    console.error('Error fetching attendance records:', error.message);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

// Route to export attendance data in CSV or PDF format
app.get('/export-attendance', async (req, res) => {
  try {
    const { format, startDate, endDate, user, department } = req.query;
    
    // Build the query based on filters
    let query = {};
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1); // Include the end date
      query.date = { $gte: start, $lt: end };
    }
    
    if (user) {
      query.email = user;
    }
    
    // Fetch attendance records
    const attendanceRecords = await Attendance.find(query)
      .sort({ date: 1, time: 1 })
      .lean();
    
    // Prepare data for export
    const exportData = await Promise.all(attendanceRecords.map(async (record) => {
      // Format date and time
      const date = new Date(record.date).toLocaleDateString();
      const time = new Date(record.time).toLocaleTimeString();
      
      return {
        Date: date,
        Time: time,
        Name: `${record.firstName} ${record.lastName}`,
        Email: record.email,
        Status: record.attendance,
        Progress: record.progress
      };
    }));
    
    // Export based on format
    if (format === 'csv') {
      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendance_report_${new Date().toISOString().slice(0,10)}.csv"`);
      
      // Write CSV directly to response
      const csvStream = csv.format({ headers: true });
      csvStream.pipe(res);
      exportData.forEach(record => csvStream.write(record));
      csvStream.end();
      
    } else if (format === 'pdf') {
      // Create a PDF document
      const doc = new PDFDocument();
      const buffers = [];
      
      // Collect PDF data in buffers
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        
        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="attendance_report_${new Date().toISOString().slice(0,10)}.pdf"`);
        res.setHeader('Content-Length', pdfData.length);
        
        // Send the PDF data
        res.send(pdfData);
      });
      
      // Generate PDF content
      doc.fontSize(16).text('Attendance Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });
      doc.moveDown();
      
      // Add filters information
      doc.fontSize(12).text('Filters Applied:');
      if (startDate && endDate) {
        doc.text(`Date Range: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`);
      }
      if (user) {
        doc.text(`User: ${user}`);
      }
      doc.moveDown();
      
      // Create table header
      const tableTop = 160;
      doc.font('Helvetica-Bold');
      doc.text('Date', 50, tableTop);
      doc.text('Time', 130, tableTop);
      doc.text('Name', 210, tableTop);
      doc.text('Email', 300, tableTop);
      doc.text('Status', 430, tableTop);
      doc.text('Progress', 490, tableTop);
      doc.moveDown();
      
      // Add table rows
      let yPosition = tableTop + 20;
      doc.font('Helvetica');
      
      exportData.forEach((record, i) => {
        // Add a new page if we run out of space
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
          
          // Add table header to new page
          doc.font('Helvetica-Bold');
          doc.text('Date', 50, yPosition);
          doc.text('Time', 130, yPosition);
          doc.text('Name', 210, yPosition);
          doc.text('Email', 300, yPosition);
          doc.text('Status', 430, yPosition);
          doc.text('Progress', 490, yPosition);
          doc.font('Helvetica');
          yPosition += 20;
        }
        
        // Add table data
        doc.text(record.Date, 50, yPosition);
        doc.text(record.Time, 130, yPosition);
        doc.text(record.Name, 210, yPosition);
        doc.text(record.Email, 300, yPosition);
        doc.text(record.Status, 430, yPosition);
        doc.text(record.Progress, 490, yPosition);
        
        yPosition += 20;
      });
      
      // Finalize PDF
      doc.end();
      
    } else {
      res.status(400).json({ error: 'Unsupported export format' });
    }
  } catch (error) {
    console.error('Error exporting attendance data:', error.message);
    res.status(500).json({ error: 'Failed to export attendance data' });
  }
});

// Route to email attendance report
app.post('/email-attendance-report', async (req, res) => {
  try {
    const { recipient, subject, message, filters } = req.body;
    
    // Validate email
    if (!recipient || !subject) {
      return res.status(400).json({ success: false, error: 'Email recipient and subject are required' });
    }
    
    // Build the query based on filters
    let query = {};
    
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      end.setDate(end.getDate() + 1); // Include the end date
      query.date = { $gte: start, $lt: end };
    }
    
    if (filters.user) {
      query.email = filters.user;
    }
    
    // Fetch attendance records
    const attendanceRecords = await Attendance.find(query)
      .sort({ date: 1, time: 1 })
      .lean();
    
    // Create a temporary file for the CSV
    const csvFilePath = path.join(__dirname, 'temp_attendance_report.csv');
    
    // Create a write stream to the temporary file
    const csvStream = csv.format({ headers: true });
    const writeStream = fs.createWriteStream(csvFilePath);
    
    // Write attendance data to CSV
    csvStream.pipe(writeStream);
    
    // Add data to CSV
    attendanceRecords.forEach(record => {
      csvStream.write({
        Date: new Date(record.date).toLocaleDateString(),
        Time: new Date(record.time).toLocaleTimeString(),
        Name: `${record.firstName} ${record.lastName}`,
        Email: record.email,
        Status: record.attendance,
        Progress: record.progress
      });
    });
    
    csvStream.end();
    
    // Wait for the CSV file to be written
    await new Promise(resolve => writeStream.on('finish', resolve));
    
    // Create email with attachment
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipient,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">Attendance Report</h2>
          <p>Please find attached the attendance report as requested.</p>
          <p>${message}</p>
          <p style="margin-top: 20px;">Best regards,</p>
          <p>The Attendance System Team</p>
        </div>
      `,
      attachments: [
        {
          filename: `attendance_report_${new Date().toISOString().slice(0,10)}.csv`,
          path: csvFilePath
        }
      ]
    };
    
    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
      // Clean up the temporary file
      fs.unlinkSync(csvFilePath);
      
      if (error) {
        console.error('Error sending report email:', error);
        return res.status(500).json({ success: false, error: 'Failed to send email' });
      }
      
      console.log('Report email sent:', info.response);
      return res.status(200).json({ success: true, message: 'Report email sent successfully' });
    });
    
  } catch (error) {
    console.error('Error sending attendance report email:', error.message);
    res.status(500).json({ success: false, error: 'Failed to send attendance report' });
  }
});

// Route for getting attendance status distribution
app.get('/analytics/status-distribution', async (req, res) => {
  try {
    const { startDate, endDate, email } = req.query;
    
    // Build query object
    const query = {};
    
    // Add date range filter if provided
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Add email filter if provided
    if (email) {
      query.email = { $regex: email, $options: 'i' };
    }
    
    // Aggregate the data
    const statusDistribution = await Attendance.aggregate([
      { $match: query },
      { $group: {
          _id: "$attendance",
          value: { $count: {} }
        }
      },
      { $project: {
          _id: 0,
          name: "$_id",
          value: 1
        }
      }
    ]);
    
    // Calculate percentages
    const total = statusDistribution.reduce((sum, item) => sum + item.value, 0);
    const result = statusDistribution.map(item => ({
      ...item,
      value: parseFloat(((item.value / total) * 100).toFixed(1))
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching status distribution:', error);
    res.status(500).json({ error: 'Failed to fetch status distribution data' });
  }
});

// Route for getting attendance progress distribution
app.get('/analytics/progress-distribution', async (req, res) => {
  try {
    const { startDate, endDate, email } = req.query;
    
    // Build query object
    const query = {};
    
    // Add date range filter if provided
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Add email filter if provided
    if (email) {
      query.email = { $regex: email, $options: 'i' };
    }
    
    // Aggregate the data
    const progressDistribution = await Attendance.aggregate([
      { $match: query },
      { $group: {
          _id: "$progress",
          value: { $count: {} }
        }
      },
      { $project: {
          _id: 0,
          name: "$_id",
          value: 1
        }
      }
    ]);
    
    // Calculate percentages
    const total = progressDistribution.reduce((sum, item) => sum + item.value, 0);
    const result = progressDistribution.map(item => ({
      ...item,
      value: parseFloat(((item.value / total) * 100).toFixed(1))
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching progress distribution:', error);
    res.status(500).json({ error: 'Failed to fetch progress distribution data' });
  }
});

// Route for getting daily attendance trends
app.get('/analytics/daily-trends', async (req, res) => {
  try {
    const { startDate, endDate, email } = req.query;
    
    // Default to past 30 days if no date range provided
    const endDateObj = endDate ? new Date(endDate) : new Date();
    const startDateObj = startDate ? new Date(startDate) : new Date(endDateObj);
    if (!startDate) {
      startDateObj.setDate(startDateObj.getDate() - 30);
    }
    
    // Build base query object
    const query = {
      date: {
        $gte: startDateObj,
        $lte: endDateObj
      }
    };
    
    // Add email filter if provided
    if (email) {
      query.email = { $regex: email, $options: 'i' };
    }
    
    // Aggregate the data by day
    const dailyTrends = await Attendance.aggregate([
      { $match: query },
      { $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            status: "$attendance"
          },
          count: { $sum: 1 }
        }
      },
      { $group: {
          _id: "$_id.date",
          statuses: {
            $push: {
              status: "$_id.status",
              count: "$count"
            }
          }
        }
      },
      { $project: {
          _id: 0,
          date: "$_id",
          present: {
            $reduce: {
              input: "$statuses",
              initialValue: 0,
              in: {
                $cond: [
                  { $eq: ["$$this.status", "present"] },
                  { $add: ["$$value", "$$this.count"] },
                  "$$value"
                ]
              }
            }
          },
          leave: {
            $reduce: {
              input: "$statuses",
              initialValue: 0,
              in: {
                $cond: [
                  { $eq: ["$$this.status", "leave"] },
                  { $add: ["$$value", "$$this.count"] },
                  "$$value"
                ]
              }
            }
          },
          warning: {
            $reduce: {
              input: "$statuses",
              initialValue: 0,
              in: {
                $cond: [
                  { $eq: ["$$this.status", "warning"] },
                  { $add: ["$$value", "$$this.count"] },
                  "$$value"
                ]
              }
            }
          },
          absent: {
            $literal: 0 // Absent is calculated separately
          }
        }
      },
      { $sort: { date: 1 } }
    ]);
    
    // Fill in missing dates and calculate absent
    const result = [];
    let currentDate = new Date(startDateObj);
    
    while (currentDate <= endDateObj) {
      const dateString = currentDate.toISOString().split('T')[0];
      const existingData = dailyTrends.find(item => item.date === dateString);
      
      if (existingData) {
        // Calculate absent based on registered users minus present/leave/warning
        // This is a simplified approach - in a real app, you'd query the total users for that day
        const totalUsers = await Registration.countDocuments();
        existingData.absent = Math.max(0, totalUsers - existingData.present - existingData.leave - existingData.warning);
        result.push(existingData);
      } else {
        result.push({
          date: dateString,
          present: 0,
          leave: 0,
          warning: 0,
          absent: 0
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching daily trends:', error);
    res.status(500).json({ error: 'Failed to fetch daily trends data' });
  }
});

// Route for getting weekly attendance trends
app.get('/analytics/weekly-trends', async (req, res) => {
  try {
    const { startDate, endDate, email } = req.query;
    
    // Default to past 12 weeks if no date range provided
    const endDateObj = endDate ? new Date(endDate) : new Date();
    const startDateObj = startDate ? new Date(startDate) : new Date(endDateObj);
    if (!startDate) {
      startDateObj.setDate(startDateObj.getDate() - (12 * 7));
    }
    
    // Build base query object
    const query = {
      date: {
        $gte: startDateObj,
        $lte: endDateObj
      }
    };
    
    // Add email filter if provided
    if (email) {
      query.email = { $regex: email, $options: 'i' };
    }
    
    // Aggregate the data by week
    const weeklyTrends = await Attendance.aggregate([
      { $match: query },
      { $project: {
          attendance: 1,
          email: 1,
          yearWeek: {
            $concat: [
              { $toString: { $year: "$date" } },
              "-",
              { $toString: { $week: "$date" } }
            ]
          }
        }
      },
      { $group: {
          _id: {
            yearWeek: "$yearWeek",
            status: "$attendance"
          },
          count: { $sum: 1 }
        }
      },
      { $group: {
          _id: "$_id.yearWeek",
          statuses: {
            $push: {
              status: "$_id.status",
              count: "$count"
            }
          }
        }
      },
      { $project: {
          _id: 0,
          week: {
            $concat: ["Week ", { $arrayElemAt: [{ $split: ["$_id", "-"] }, 1] }]
          },
          yearWeek: "$_id",
          present: {
            $reduce: {
              input: "$statuses",
              initialValue: 0,
              in: {
                $cond: [
                  { $eq: ["$$this.status", "present"] },
                  { $add: ["$$value", "$$this.count"] },
                  "$$value"
                ]
              }
            }
          },
          leave: {
            $reduce: {
              input: "$statuses",
              initialValue: 0,
              in: {
                $cond: [
                  { $eq: ["$$this.status", "leave"] },
                  { $add: ["$$value", "$$this.count"] },
                  "$$value"
                ]
              }
            }
          },
          warning: {
            $reduce: {
              input: "$statuses",
              initialValue: 0,
              in: {
                $cond: [
                  { $eq: ["$$this.status", "warning"] },
                  { $add: ["$$value", "$$this.count"] },
                  "$$value"
                ]
              }
            }
          },
          absent: {
            $literal: 0 // Absent will be calculated afterward
          }
        }
      },
      { $sort: { yearWeek: 1 } }
    ]);
    
    // Calculate absent values and prepare final result
    const result = await Promise.all(weeklyTrends.map(async (week) => {
      // In a real app, you would calculate this more accurately
      const totalUsers = await Registration.countDocuments();
      week.absent = Math.max(0, totalUsers - week.present - week.leave - week.warning);
      return week;
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching weekly trends:', error);
    res.status(500).json({ error: 'Failed to fetch weekly trends data' });
  }
});

// Route for getting monthly attendance trends
app.get('/analytics/monthly-trends', async (req, res) => {
  try {
    const { startDate, endDate, email } = req.query;
    
    // Default to past 12 months if no date range provided
    const endDateObj = endDate ? new Date(endDate) : new Date();
    const startDateObj = startDate ? new Date(startDate) : new Date(endDateObj);
    if (!startDate) {
      startDateObj.setMonth(startDateObj.getMonth() - 12);
    }
    
    // Build base query object
    const query = {
      date: {
        $gte: startDateObj,
        $lte: endDateObj
      }
    };
    
    // Add email filter if provided
    if (email) {
      query.email = { $regex: email, $options: 'i' };
    }
    
    // Aggregate the data by month
    const monthlyTrends = await Attendance.aggregate([
      { $match: query },
      { $project: {
          attendance: 1,
          email: 1,
          yearMonth: {
            $concat: [
              { $toString: { $year: "$date" } },
              "-",
              { $toString: { $month: "$date" } }
            ]
          },
          monthName: {
            $arrayElemAt: [
              ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
              { $subtract: [{ $month: "$date" }, 1] }
            ]
          }
        }
      },
      { $group: {
          _id: {
            yearMonth: "$yearMonth",
            monthName: "$monthName",
            status: "$attendance"
          },
          count: { $sum: 1 }
        }
      },
      { $group: {
          _id: {
            yearMonth: "$_id.yearMonth",
            monthName: "$_id.monthName"
          },
          statuses: {
            $push: {
              status: "$_id.status",
              count: "$count"
            }
          }
        }
      },
      { $project: {
          _id: 0,
          month: "$_id.monthName",
          yearMonth: "$_id.yearMonth",
          present: {
            $reduce: {
              input: "$statuses",
              initialValue: 0,
              in: {
                $cond: [
                  { $eq: ["$$this.status", "present"] },
                  { $add: ["$$value", "$$this.count"] },
                  "$$value"
                ]
              }
            }
          },
          leave: {
            $reduce: {
              input: "$statuses",
              initialValue: 0,
              in: {
                $cond: [
                  { $eq: ["$$this.status", "leave"] },
                  { $add: ["$$value", "$$this.count"] },
                  "$$value"
                ]
              }
            }
          },
          warning: {
            $reduce: {
              input: "$statuses",
              initialValue: 0,
              in: {
                $cond: [
                  { $eq: ["$$this.status", "warning"] },
                  { $add: ["$$value", "$$this.count"] },
                  "$$value"
                ]
              }
            }
          },
          absent: {
            $literal: 0 // Calculated afterward
          }
        }
      },
      { $sort: { yearMonth: 1 } }
    ]);
    
    // Calculate absent values and prepare final result
    const result = await Promise.all(monthlyTrends.map(async (month) => {
      // In a real app, you would calculate this more accurately
      const totalUsers = await Registration.countDocuments();
      month.absent = Math.max(0, totalUsers - month.present - month.leave - month.warning);
      return month;
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching monthly trends:', error);
    res.status(500).json({ error: 'Failed to fetch monthly trends data' });
  }
});

// Route for getting time analysis (check-in/check-out patterns)
app.get('/analytics/time-analysis', async (req, res) => {
  try {
    const { startDate, endDate, email } = req.query;
    
    // Build query object
    const query = {};
    
    // Add date range filter if provided
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Add email filter if provided
    if (email) {
      query.email = { $regex: email, $options: 'i' };
    }
    
    // Aggregate check-in/check-out times by hour
    const timeAnalysis = await Attendance.aggregate([
      { $match: query },
      { $project: {
          email: 1,
          hour: { $hour: "$time" },
          // Use the actual status field instead of determining by hour
          isCheckIn: { 
            $cond: [
              { $eq: ["$status", "check-in"] }, 
              true, 
              false
            ]
          }
        }
      },
      { $group: {
          _id: {
            hour: "$hour",
            isCheckIn: "$isCheckIn"
          },
          count: { $sum: 1 }
        }
      },
      { $project: {
          _id: 0,
          hour: { $concat: [{ $toString: "$_id.hour" }, ":00"] },
          isCheckIn: "$_id.isCheckIn",
          count: "$count"
        }
      },
      { $sort: { hour: 1 } }
    ]);
    
    // Transform the data for the chart format
    const hourMap = {};
    timeAnalysis.forEach(item => {
      if (!hourMap[item.hour]) {
        hourMap[item.hour] = {
          hour: item.hour,
          arrivalCount: 0,  // Changed from checkIns to arrivalCount
          departureCount: 0 // Changed from checkOuts to departureCount
        };
      }
      
      if (item.isCheckIn) {
        hourMap[item.hour].arrivalCount = item.count;  // Renamed to match frontend expectations
      } else {
        hourMap[item.hour].departureCount = item.count; // Renamed to match frontend expectations
      }
    });
    
    // Ensure we have all hours from 6:00 to 20:00 (expanded range)
    const result = [];
    for (let hour = 6; hour <= 20; hour++) {
      const hourString = `${hour}:00`;
      if (hourMap[hourString]) {
        result.push(hourMap[hourString]);
      } else {
        result.push({ hour: hourString, arrivalCount: 0, departureCount: 0 });
      }
    }
    
    // Log the result for debugging
    console.log('Time analysis result:', result);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching time analysis:', error);
    res.status(500).json({ error: 'Failed to fetch time analysis data' });
  }
});

// Route to export attendance analytics data in CSV or PDF format
app.get('/export-attendanceanalyze', async (req, res) => {
  try {
    const { format, startDate, endDate, email, viewType } = req.query;
    
    // Build the query based on filters
    const query = {};
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1); // Include the end date
      query.date = { $gte: start, $lt: end };
    }
    
    if (email) {
      query.email = email;
    }
    
    // Fetch attendance records
    const attendanceRecords = await Attendance.find(query)
      .sort({ date: 1, time: 1 })
      .lean();
    
    // Prepare data for export
    const exportData = await Promise.all(attendanceRecords.map(async (record) => {
      // Format date and time
      const date = new Date(record.date).toLocaleDateString();
      const time = new Date(record.time).toLocaleTimeString();
      
      return {
        Date: date,
        Time: time,
        Name: `${record.firstName} ${record.lastName}`,
        Email: record.email,
        Status: record.attendance,
        Progress: record.progress,
        ArrivalTime: record.arrivalTime ? new Date(record.arrivalTime).toLocaleTimeString() : 'N/A',
        DepartureTime: record.departureTime ? new Date(record.departureTime).toLocaleTimeString() : 'N/A'
      };
    }));
    
    // Export based on format
    if (format === 'csv') {
      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendance_analytics_${new Date().toISOString().slice(0,10)}.csv"`);
      
      // Write CSV directly to response
      const csvStream = csv.format({ headers: true });
      csvStream.pipe(res);
      exportData.forEach(record => csvStream.write(record));
      csvStream.end();
      
    } else if (format === 'pdf') {
      // Create a PDF document
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      
      // Collect PDF data in buffers
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        
        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="attendance_analytics_${new Date().toISOString().slice(0,10)}.pdf"`);
        res.setHeader('Content-Length', pdfData.length);
        
        // Send the PDF data
        res.send(pdfData);
      });
      
      // Generate PDF content
      doc.fontSize(20).text('Attendance Analytics Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });
      doc.moveDown();
      
      // Add filters information
      doc.fontSize(12).text('Filters Applied:', { underline: true });
      doc.moveDown(0.5);
      if (startDate && endDate) {
        doc.text(`Date Range: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`);
      }
      if (email) {
        doc.text(`Email: ${email}`);
      }
      if (viewType) {
        doc.text(`View Type: ${viewType.charAt(0).toUpperCase() + viewType.slice(1)}`);
      }
      doc.moveDown();
      
      // Generate Summary Stats
      doc.fontSize(14).text('Attendance Summary', { underline: true });
      doc.moveDown(0.5);
      
      // Calculate summary metrics
      const totalRecords = attendanceRecords.length;
      const presentCount = attendanceRecords.filter(r => r.attendance === 'present').length;
      const lateCount = attendanceRecords.filter(r => r.progress === 'late').length;
      const leaveCount = attendanceRecords.filter(r => r.attendance === 'leave').length;
      
      doc.text(`Total Records: ${totalRecords}`);
      doc.text(`Present: ${presentCount} (${totalRecords ? Math.round(presentCount/totalRecords*100) : 0}%)`);
      doc.text(`Late Arrivals: ${lateCount} (${totalRecords ? Math.round(lateCount/totalRecords*100) : 0}%)`);
      doc.text(`On Leave: ${leaveCount} (${totalRecords ? Math.round(leaveCount/totalRecords*100) : 0}%)`);
      doc.moveDown();
      
      // Add chart placeholders (in a real implementation, you would generate and embed chart images)
      doc.fontSize(14).text('Attendance Distribution', { underline: true });
      doc.moveDown(0.5);
      
      // In a full implementation, you would generate chart images and add them:
      // doc.image('path-to-generated-chart.png', { width: 500 });
      doc.rect(50, doc.y, 500, 200).stroke();
      doc.text('Status Distribution Chart', 50, doc.y - 190, { align: 'center', width: 500 });
      
      doc.moveDown(11);
      
      // In a full implementation, you would generate chart images and add them:
      doc.fontSize(14).text('Time Analysis', { underline: true });
      doc.moveDown(0.5);
      doc.rect(50, doc.y, 500, 200).stroke();
      doc.text('Time Analysis Chart', 50, doc.y - 190, { align: 'center', width: 500 });
      
      doc.moveDown(11);
      
      // Add a new page for data table
      doc.addPage();
      
      // Create table header
      doc.fontSize(14).text('Detailed Attendance Records', { underline: true });
      doc.moveDown();
      
      doc.font('Helvetica-Bold');
      const tableTop = doc.y;
      doc.fontSize(10);
      doc.text('Date', 50, tableTop);
      doc.text('Time', 110, tableTop);
      doc.text('Name', 170, tableTop);
      doc.text('Email', 270, tableTop);
      doc.text('Status', 380, tableTop);
      doc.text('Progress', 430, tableTop);
      doc.text('Arrival', 490, tableTop);
      
      // Add table rows
      let yPosition = tableTop + 20;
      doc.font('Helvetica');
      
      exportData.forEach((record, i) => {
        // Add a new page if we run out of space
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
          
          // Add table header to new page
          doc.font('Helvetica-Bold');
          doc.fontSize(10);
          doc.text('Date', 50, yPosition);
          doc.text('Time', 110, yPosition);
          doc.text('Name', 170, yPosition);
          doc.text('Email', 270, yPosition);
          doc.text('Status', 380, yPosition);
          doc.text('Progress', 430, yPosition);
          doc.text('Arrival', 490, yPosition);
          doc.font('Helvetica');
          yPosition += 20;
        }
        
        // Add table data
        doc.fontSize(8);
        doc.text(record.Date, 50, yPosition);
        doc.text(record.Time, 110, yPosition);
        doc.text(record.Name, 170, yPosition);
        doc.text(record.Email, 270, yPosition, { width: 100, ellipsis: true });
        doc.text(record.Status, 380, yPosition);
        doc.text(record.Progress, 430, yPosition);
        doc.text(record.ArrivalTime, 490, yPosition);
        
        yPosition += 15;
        
        // Add a light separator line
        if (i < exportData.length - 1) {
          doc.moveTo(50, yPosition - 5)
              .lineTo(550, yPosition - 5)
              .stroke('#EEEEEE');
        }
      });
      
      // Finalize PDF
      doc.end();
      
    } else {
      res.status(400).json({ error: 'Unsupported export format' });
    }
  } catch (error) {
    console.error('Error exporting attendance analytics:', error.message);
    res.status(500).json({ error: 'Failed to export attendance analytics' });
  }
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});