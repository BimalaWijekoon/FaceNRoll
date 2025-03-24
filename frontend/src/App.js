// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import StartupPage from '../src/components/StartupPage';
import Login from '../src/components/Login';
import Signup from '../src/components/Signup';
import Admin from '../src/components/AdminDashboard'; 
import Register from '../src/components/UserRegistration'; 
import Process from '../src/components/ProcessingPage'; 
import ProcessMain from '../src/components/ProcessMain'; 
import ProcessFace from '../src/components/FaceValidationPage'; 
import Face from '../src/components/FaceRecognition'; 
import CamTest from '../src/components/RecognitionLoading'; 
import UserDetail from '../src/components/UserDetails'; 
import UserAll from '../src/components/UserAll'; 
import UserList from '../src/components/UserList'; 
import Attendance from '../src/components/AttendanceDetails'; 
import AttendanceAnalyze from '../src/components/AttendanceAnalytics'; 


const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/start" element={<StartupPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/registeruser" element={<Register />} />
        <Route path="/" element={<Process />} />
        <Route path="/processmain" element={<ProcessMain />} />
        <Route path="/face-validation" element={<ProcessFace />} />
        <Route path="/face" element={<Face />} />
        <Route path="/cam" element={<CamTest />} />
        <Route path="/userlist" element={<UserList />} />
        <Route path="/user/:email" element={<UserDetail />} />
        <Route path="/userall/:email" element={<UserAll />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/attendanceanalyze" element={<AttendanceAnalyze />} />









      </Routes>
    </Router>
  );
};

export default App;
