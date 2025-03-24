import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UserOutlined, CalendarOutlined, PhoneOutlined, MailOutlined, HomeOutlined, IdcardOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import './UserList.css';

const UserList = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await axios.get('http://localhost:5000/users-complete');
        
        if (response.data.success) {
          setUsers(response.data.users);
        } else {
          throw new Error('Failed to fetch users');
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError(err.message || 'Failed to load users');
        setLoading(false);
      }
    };

    fetchUsers();

    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

    // Add this function to the UserList component
const handleBackToDashboard = () => {
  navigate('/admin');
};
  const handleViewProfile = (email) => {
    // Properly pass email as a parameter to the user detail page
    
    navigate(`/user/${encodeURIComponent(email)}`);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.id?.toLowerCase().includes(searchLower)
    );
  });

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="user-list-container loading">
        <div className="loading-spinner">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-list-container error">
        <div className="error-message">Error: {error}</div>
        <button className="refresh-button" onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="main-user">
      <div className="back-button" onClick={handleBackToDashboard}>
    <ArrowLeftOutlined />
    <span>Back to Dashboard</span>
  </div>
    <div className="user-list-container">
      <div className="user-list-header">
        <h1>User Directory</h1>
        <div className="time-display">
          {formatTime(currentTime)}
        </div>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>
      </div>

      <div className="user-count">
        {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} found
      </div>

      <div className="user-list">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user, index) => (
            <div 
              key={user.email} 
              className="user-card" 
              onClick={() => handleViewProfile(user.email)}
              style={{ animationDelay: `${0.1 * (index % 10)}s` }}
            >
              <div className="user-info">
                <h3 className="user-name">{user.firstName} {user.lastName}</h3>
                <div className="user-details">
                  <div className="user-detail">
                    <MailOutlined /> <span>{user.email}</span>
                  </div>
                  <div className="user-detail">
                    <IdcardOutlined /> <span>{user.id || 'No ID'}</span>
                  </div>
                  <div className="user-detail">
                    <PhoneOutlined /> <span>{user.telephone || 'No Phone'}</span>
                  </div>
                  <div className="user-detail">
                    <HomeOutlined /> <span>{user.address ? (user.address.length > 25 ? user.address.substring(0, 25) + '...' : user.address) : 'No Address'}</span>
                  </div>
                  <div className="user-detail">
                    <CalendarOutlined /> <span>Registered: {new Date(user.registrationDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="view-profile">
                View Profile &rarr;
              </div>
            </div>
          ))
        ) : (
          <div className="no-users-message">
            No users found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default UserList;