import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaCog, 
  FaUserPlus, 
  FaUser, 
  FaCalendarAlt, 
  FaChartBar, 
  FaSignOutAlt,
  FaVideo,
  FaClipboardList,
  FaUsersCog
} from 'react-icons/fa';
import { Typography } from 'antd';
import './AdminDashboard.css';

const { Title } = Typography;

const MainDashboard = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState('');
  
  // Function to update the current time
  const updateTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    setCurrentTime(`${hours}:${minutes}:${seconds}`);
  };

  // Navigation cards data
  const navCards = [
    {
      title: "Face Recognition",
      icon: <FaVideo />,
      color: "#FF6B6B",
      path: "/cam",
      description: "Manage face detection system"
    },
    {
      title: "Register User",
      icon: <FaUserPlus />,
      color: "#4ECDC4",
      path: "/registeruser",
      description: "Add new users to the system"
    },
    {
      title: "User Profiles",
      icon: <FaUser />,
      color: "#FFD166",
      path: "/userlist",
      description: "Manage user profile settings"
    },
    {
      title: "Attendance Summary",
      icon: <FaCalendarAlt />,
      color: "#06D6A0",
      path: "/attendance",
      description: "View daily attendance reports"
    },
    {
      title: "Analytics",
      icon: <FaChartBar />,
      color: "#118AB2",
      path: "/attendanceanalyze",
      description: "View attendance statistics"
    },
    {
      title: "Logout",
      icon: <FaSignOutAlt />,
      color: "#EF476F",
      path: "/login",
      description: "Exit admin dashboard"
    }
  ];

  // Start time updates when component mounts
  useEffect(() => {
    updateTime();
    
    // Update time every second
    const timeInterval = setInterval(updateTime, 1000);
    
    // Clean up resources when component unmounts
    return () => {
      clearInterval(timeInterval);
    };
  }, []);

  // Navigate to the selected page
  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
        <div className="main-dashboard">
          <div className="dashboard-content">
            <div className="dashboard-header">
              <Title level={2} style={{ color: 'white' }}>Admin Dashboard</Title>
              <div className="time-display">{currentTime}</div>
            </div>
            
            <div className="cards-container">
              {navCards.map((card, index) => (
                <div 
                  key={index} 
                  className="nav-card" 
                  onClick={() => handleNavigation(card.path)}
                  style={{"--hover-color": card.color}}
                >
                  <div className="card-icon" style={{backgroundColor: card.color}}>
                    {card.icon}
                  </div>
                  <div className="card-content">
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
  );
};

export default MainDashboard;