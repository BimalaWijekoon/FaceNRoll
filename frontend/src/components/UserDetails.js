import React, { useState, useEffect, useRef } from 'react';
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
  EditOutlined,
  SaveOutlined,
  DeleteOutlined,
  CloseOutlined,
  CheckOutlined,
  WarningOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import './UserDetails.css';

const UserDetail = () => {
  const { email } = useParams();
  const navigate = useNavigate();
  const verificationInputRef = useRef(null);
  
  // User data states
  const [userDetails, setUserDetails] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editedDetails, setEditedDetails] = useState({});
  const [emailChanged, setEmailChanged] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [sentVerificationCode, setSentVerificationCode] = useState('');
  const [newEmail, setNewEmail] = useState('');
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
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
    // In UserDetail.js, modify the fetchUserData function to add better error handling

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
    setEditedDetails(userResponse.data.user);
    
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

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Check if email is being changed
    if (name === 'email' && value !== userDetails.email) {
      setEmailChanged(true);
      setNewEmail(value);
    } else if (name === 'email' && value === userDetails.email) {
      setEmailChanged(false);
    }
    
    setEditedDetails(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Start editing mode
  const handleStartEditing = () => {
    setIsEditing(true);
    setEditedDetails(userDetails);
    setEmailChanged(false);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedDetails(userDetails);
    setEmailChanged(false);
    setShowVerification(false);
  };

  // Send verification code
  const handleSendVerificationCode = async () => {
    try {
      // Generate a random 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setSentVerificationCode(code);
      
      // Send verification email
      const response = await axios.post('http://localhost:5000/send-verification-email', {
        email: userDetails.email,
        newEmail: newEmail,
        code: code
      });
      
      if (response.data.success) {
        setShowVerification(true);
        setVerificationStatus('');
        setTimeout(() => {
          if (verificationInputRef.current) {
            verificationInputRef.current.focus();
          }
        }, 300);
      } else {
        throw new Error('Failed to send verification code');
      }
    } catch (err) {
      console.error('Error sending verification code:', err);
      setVerificationStatus('error');
    }
  };

  // Verify code
  const handleVerifyCode = () => {
    if (verificationCode === sentVerificationCode) {
      setVerificationStatus('success');
      // Continue with save after verification
      handleSaveChanges(true);
    } else {
      setVerificationStatus('error');
    }
  };

  // Save changes
  const handleSaveChanges = async (verified = false) => {
    try {
      // If email changed and not verified yet, trigger verification
      if (emailChanged && !verified) {
        handleSendVerificationCode();
        return;
      }
      
      // Save changes to database
      const response = await axios.put(`http://localhost:5000/update-user/${userDetails._id}`, editedDetails);
      
      if (response.data.success) {
        // If email was changed, send confirmation to new email
        if (emailChanged && verified) {
          await axios.post('http://localhost:5000/send-email-update-confirmation', {
            email: newEmail,
            firstName: editedDetails.firstName,
            previousEmail: userDetails.email
          });
        }
        
        // Update local state
        setUserDetails(editedDetails);
        setIsEditing(false);
        setShowVerification(false);
        setEmailChanged(false);
      } else {
        throw new Error('Failed to update user details');
      }
    } catch (err) {
      console.error('Error saving changes:', err);
      setError('Failed to save changes. Please try again.');
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    try {
      const response = await axios.delete(`http://localhost:5000/delete-user/${userDetails._id}`);
      
      if (response.data.success) {
        navigate('/user-list');
      } else {
        throw new Error('Failed to delete user');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Failed to delete user. Please try again.');
    }
  };

  // Navigate back to user list
  const handleBackToUserList = () => {
    navigate('/userlist');
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
        <button className="back-button-full" onClick={handleBackToUserList}>
          <ArrowLeftOutlined /> Back to User List
        </button>
      </div>
    );
  }

  return (
    <div className="user-detail-main">
      <div className="back-button01" onClick={handleBackToUserList}>
        <ArrowLeftOutlined />
        <span>Back to User List</span>
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
                {!isEditing ? (
                  <button className="edit-button" onClick={handleStartEditing}>
                    <EditOutlined /> Edit
                  </button>
                ) : (
                  <div className="edit-actions">
                    <button className="save-button" onClick={() => handleSaveChanges()}>
                      <SaveOutlined /> Save
                    </button>
                    <button className="cancel-button" onClick={handleCancelEdit}>
                      <CloseOutlined /> Cancel
                    </button>
                  </div>
                )}
              </div>
              
              {/* Verification Modal */}
              {showVerification && (
                <div className="verification-modal">
                  <div className="verification-content">
                    <h3>Email Verification Required</h3>
                    <p>A verification code has been sent to your current email ({userDetails.email}).</p>
                    <div className="verification-input-group">
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        ref={verificationInputRef}
                      />
                      <button onClick={handleVerifyCode}>Verify</button>
                    </div>
                    {verificationStatus === 'error' && (
                      <p className="verification-error">Invalid code. Please try again.</p>
                    )}
                    <button className="secondary-button" onClick={handleCancelEdit}>Cancel</button>
                  </div>
                </div>
              )}
              
              {/* User Details Form */}
              <div className="user-details-form">
                <div className="form-group">
                  <label><UserOutlined /> First Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="firstName"
                      value={editedDetails.firstName || ''}
                      onChange={handleInputChange}
                      required
                    />
                  ) : (
                    <div className="detail-value">{userDetails.firstName}</div>
                  )}
                </div>
                
                <div className="form-group">
                  <label><UserOutlined /> Last Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="lastName"
                      value={editedDetails.lastName || ''}
                      onChange={handleInputChange}
                      required
                    />
                  ) : (
                    <div className="detail-value">{userDetails.lastName}</div>
                  )}
                </div>
                
                <div className="form-group">
                  <label><MailOutlined /> Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      name="email"
                      value={editedDetails.email || ''}
                      onChange={handleInputChange}
                      required
                    />
                  ) : (
                    <div className="detail-value">{userDetails.email}</div>
                  )}
                </div>
                
                <div className="form-group">
                  <label><IdcardOutlined /> ID</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="id"
                      value={editedDetails.id || ''}
                      onChange={handleInputChange}
                    />
                  ) : (
                    <div className="detail-value">{userDetails.id || 'Not provided'}</div>
                  )}
                </div>
                
                <div className="form-group">
                  <label><PhoneOutlined /> Phone</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      name="telephone"
                      value={editedDetails.telephone || ''}
                      onChange={handleInputChange}
                    />
                  ) : (
                    <div className="detail-value">{userDetails.telephone || 'Not provided'}</div>
                  )}
                </div>
                
                <div className="form-group full-width">
                  <label><HomeOutlined /> Address</label>
                  {isEditing ? (
                    <textarea
                      name="address"
                      value={editedDetails.address || ''}
                      onChange={handleInputChange}
                      rows="2"
                    />
                  ) : (
                    <div className="detail-value">{userDetails.address || 'Not provided'}</div>
                  )}
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
        
        {/* Delete User Section */}
        <div className="delete-user-section">
          {!showDeleteConfirm ? (
            <button className="delete-user-button" onClick={() => setShowDeleteConfirm(true)}>
              <DeleteOutlined /> Delete User
            </button>
          ) : (
            <div className="delete-confirmation">
              <p>Are you sure you want to delete this user? This action cannot be undone.</p>
              <div className="confirmation-buttons">
                <button className="confirm-delete" onClick={handleDeleteUser}>
                  Yes, Delete User
                </button>
                <button className="cancel-delete" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDetail;