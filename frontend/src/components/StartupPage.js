// src/StartupPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './StartupPage.css';

const StartupPage = () => {
  const navigate = useNavigate();

  const handleMoveOnClick = () => {
    navigate('/login');
  };

  return (
    <div className="startup-container">
      <div className="startup-content">
        <h1 className="startup-title">Welcome to FacenRoll</h1>
        <p className="startup-description">
          Your smart and seamless face recognition system for effortless attendance marking, ensuring accuracy and efficiency every time.
        </p>
        <button className="startup-button" onClick={handleMoveOnClick}>
          Go to Admin Panel
        </button>
      </div>
    </div>
  );
};

export default StartupPage;