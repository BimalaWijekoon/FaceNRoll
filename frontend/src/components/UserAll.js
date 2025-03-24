import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  UserOutlined, 
  CalendarOutlined, 
  PhoneOutlined, 
  MailOutlined, 
  HomeOutlined, 
  IdcardOutlined, 
  ArrowLeftOutlined,
  CheckOutlined,
  WarningOutlined,
  CloseOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import './UserDetails.css';

const UserAll = () => {
  const { email } = useParams();
  const navigate = useNavigate();
  
  // User data states
  const [userDetails, setUserDetails] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Active image state
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Calculate account age
  const calculateAccountAge = (registrationDate) => {
    const now = new Date();
    const registered = new Date(registrationDate);
    const diffTime = Math.abs(now - registered);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} days`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} ${months === 1 ? 'month' : 'months'}`;
    } else {
      const years = Math.floor(diffDays / 365);
      const remainingMonths = Math.floor((diffDays % 365) / 30);
      return `${years} ${years === 1 ? 'year' : 'years'}${remainingMonths > 0 ? ` and ${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}` : ''}`;
    }
  };

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        // Add console logs to debug the request
        console.log('Fetching user with email:', email);
        
        // Fetch user details
        const userResponse = await axios.get(`http://localhost:5000/user/${encodeURIComponent(email)}`);
        console.log('User API response:', userResponse.data);
        
        if (!userResponse.data.success) {
          throw new Error('Failed to fetch user details');
        }
        setUserDetails(userResponse.data.user);
        
        // Fetch attendance
        const attendanceResponse = await axios.get(`http://localhost:5000/user-attendance/${encodeURIComponent(email)}`);
        console.log('Attendance API response:', attendanceResponse.data);
        
        if (!attendanceResponse.data.success) {
          throw new Error('Failed to fetch attendance records');
        }
        setAttendanceHistory(attendanceResponse.data.attendance);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching user data:', err);
        // More detailed error handling
        if (err.response) {
          console.error('Response error:', err.response.data);
          setError(`Server error: ${err.response.status} - ${err.response.data.message || 'Unknown error'}`);
        } else if (err.request) {
          console.error('Request error:', err.request);
          setError('No response received from server. Please check if the backend is running.');
        } else {
          setError(err.message || 'Failed to load user data');
        }
        setLoading(false);
      }
    };

    if (email) {
      fetchUserData();
    }
  }, [email]);

  // Navigate back to attendance records
  const handleBackToAttendance = () => {
    navigate('/attendance');
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format time for display
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Get attendance status icon
  const getAttendanceIcon = (status) => {
    switch (status) {
      case 'present':
        return <CheckOutlined style={{ color: '#52c41a' }} />;
      case 'leave':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      case 'warning':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      default:
        return <CloseOutlined style={{ color: '#ff4d4f' }} />;
    }
  };

  // Get progress status icon
  const getProgressIcon = (status) => {
    switch (status) {
      case 'not late':
        return <CheckOutlined style={{ color: '#52c41a' }} />;
      case 'late':
        return <ClockCircleOutlined style={{ color: '#faad14' }} />;
      case 'leave ontime':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      case 'leave early':
        return <WarningOutlined style={{ color: '#ff4d4f' }} />;
      case 'not marked as present on morning':
        return <CloseOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="user-detail-container loading">
        <div className="loading-spinner">Loading user data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-detail-container error">
        <div className="error-message">Error: {error}</div>
        <button className="refresh-button" onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  if (!userDetails) {
    return (
      <div className="user-detail-container error">
        <div className="error-message">User not found</div>
        <button className="back-button-full" onClick={handleBackToAttendance}>
          <ArrowLeftOutlined /> Back to Attendance Records
        </button>
      </div>
    );
  }

  return (
    <div className="user-detail-main">
      <div className="back-button01" onClick={handleBackToAttendance}>
        <ArrowLeftOutlined />
        <span>Back to Attendance</span>
      </div>
      
      <div className="user-detail-container">
        <h1 className="page-title">User Profile</h1>
        
        <div className="profile-content">
          {/* Left section - User Images */}
          <div className="profile-images-section">
            <h2 className="section-title">User Images</h2>
            
            {userDetails.pictures && userDetails.pictures.length > 0 ? (
              <div className="images-container">
                <div className="main-image">
                  <img 
                    src={userDetails.pictures[activeImageIndex].imageData}
                    alt={userDetails.pictures[activeImageIndex].poseName || 'User'} 
                  />
                  <div className="pose-name">{userDetails.pictures[activeImageIndex].poseName || 'Unnamed Pose'}</div>
                </div>
                
                <div className="thumbnail-container">
                  {userDetails.pictures.map((pic, index) => (
                    <div 
                      key={index}
                      className={`thumbnail ${activeImageIndex === index ? 'active' : ''}`}
                      onClick={() => setActiveImageIndex(index)}
                    >
                      <img 
                        src={pic.imageData} 
                        alt={pic.poseName || `Image ${index + 1}`} 
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="no-images">
                <UserOutlined />
                <p>No images available</p>
              </div>
            )}
          </div>
          
          {/* Right section - User Details and Attendance */}
          <div className="profile-details-section">
            {/* User Information */}
            <div className="user-information">
              <div className="section-header">
                <h2 className="section-title">User Information</h2>
              </div>
              
              {/* User Details Form */}
              <div className="user-details-form">
                <div className="form-group">
                  <label><UserOutlined /> First Name</label>
                  <div className="detail-value">{userDetails.firstName}</div>
                </div>
                
                <div className="form-group">
                  <label><UserOutlined /> Last Name</label>
                  <div className="detail-value">{userDetails.lastName}</div>
                </div>
                
                <div className="form-group">
                  <label><MailOutlined /> Email</label>
                  <div className="detail-value">{userDetails.email}</div>
                </div>
                
                <div className="form-group">
                  <label><IdcardOutlined /> ID</label>
                  <div className="detail-value">{userDetails.id || 'Not provided'}</div>
                </div>
                
                <div className="form-group">
                  <label><PhoneOutlined /> Phone</label>
                  <div className="detail-value">{userDetails.telephone || 'Not provided'}</div>
                </div>
                
                <div className="form-group full-width">
                  <label><HomeOutlined /> Address</label>
                  <div className="detail-value">{userDetails.address || 'Not provided'}</div>
                </div>
                
                <div className="form-group">
                  <label><CalendarOutlined /> Registration Date</label>
                  <div className="detail-value">{formatDate(userDetails.registrationDate)}</div>
                </div>
                
                <div className="form-group">
                  <label><ClockCircleOutlined /> Account Age</label>
                  <div className="detail-value active-badge">
                    Active for {calculateAccountAge(userDetails.registrationDate)}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Attendance History */}
            <div className="attendance-history">
              <h2 className="section-title">Attendance History</h2>
              
              {attendanceHistory.length > 0 ? (
                <div className="attendance-table-container">
                  <table className="attendance-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceHistory.map((record, index) => (
                        <tr key={index}>
                          <td>{formatDate(record.date)}</td>
                          <td>{formatTime(record.time)}</td>
                          <td>
                            <div className="status-badge">
                              {getAttendanceIcon(record.attendance)}
                              <span>{record.attendance}</span>
                            </div>
                          </td>
                          <td>
                            <div className="progress-badge">
                              {getProgressIcon(record.progress)}
                              <span>{record.progress}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-records">No attendance records found</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserAll;