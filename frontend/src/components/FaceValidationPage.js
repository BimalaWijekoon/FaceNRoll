// src/FaceValidationPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './ProcessingPage.css'; // Reusing the CSS from ProcessingPage
import axios from 'axios';

const FaceValidationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [logs, setLogs] = useState(['Initializing face validation...']);
  const [isProcessing, setIsProcessing] = useState(true);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [userInput, setUserInput] = useState('');
  const terminalRef = useRef(null);
  const inputRef = useRef(null);
  const [failedPoses, setFailedPoses] = useState([]);
  const [userData, setUserData] = useState(null);

  const addLog = (message) => {
    setLogs(prevLogs => [...prevLogs, message]);
  };

  const handleInputChange = (e) => {
    setUserInput(e.target.value);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      const input = userInput.trim().toLowerCase();
      addLog(`> ${userInput}`);
      setUserInput('');
      
      if (input === 'y' || input === 'yes') {
        if (failedPoses.length > 0) {
          // If there were failed poses, go back to registration with failed pose information
          addLog('Returning to image capture to retake failed poses...');
          setTimeout(() => {
            navigate('/registeruser', { 
              state: { 
                failedPoses,
                userData: location.state.userData,
                returnToStep: 2 // Go back to step 2 (image capture)
              } 
            });
          }, 1500);
        } else {
          // If all poses passed, proceed with registration
          addLog('Processing successful! Completing registration...');
          
          // Send data to the server
          submitRegistration(location.state.userData);
        }
      } else if (input === 'n' || input === 'no') {
        // Handle the 'no' case properly
        addLog('Registration process terminated. Clearing the form and redirecting...');
        
        // Redirect to registration form with cleared data after a short delay
        setTimeout(() => {
          navigate('/registeruser');
        }, 2000);
      } else {
        // For invalid input, provide clear instructions to try again
        addLog('❓ Invalid input. Please type "y" to continue or "n" to cancel.');
        addLog('Waiting for your response (y/n)...');
      }
    }
  };

  // Function to submit registration to the backend
  const submitRegistration = async (registrationData) => {
    try {
      addLog('Sending registration data to server...');
      
      const response = await fetch('http://localhost:5000/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        addLog('✅ Registration successful!');
        addLog('✉️ Confirmation email has been sent to your inbox.');
        
        // Redirect to registration form with cleared data
        setTimeout(() => {
          navigate('/processmain');
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to submit registration');
      }
    } catch (error) {
      addLog(`❌ Error submitting registration: ${error.message}`);
      addLog('Please try again later.');
    }
  };

  // Auto scroll terminal to bottom when new logs are added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Focus the input field when waiting for input
  useEffect(() => {
    if (waitingForInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [waitingForInput]);

  // Process the images when component mounts
  useEffect(() => {
    const validateFaces = async () => {
      try {
        // Get user data from navigation state
        if (!location.state || !location.state.userData) {
          addLog('❌ No user data found. Please go back to registration form.');
          requestUserConfirmation();
          return;
        }
        
        const userData = location.state.userData;
        setUserData(userData);
        
        addLog(`Processing registration for: ${userData.firstName} ${userData.lastName}`);
        addLog(`Found ${userData.pictures.length} images to validate`);
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Call the face validation API endpoint
        addLog('Sending images to face detection service...');
        const response = await axios.post('http://localhost:5001/api/validate-faces', {
          images: userData.pictures.map(p => p.imageData)
        });
        
        // Process validation results
        const validationResults = response.data;
        const failed = [];
        
        validationResults.forEach((result, index) => {
          const poseName = `Pose ${index + 1}`;
          
          if (result.isValid) {
            addLog(`✅ ${poseName}: Face detected successfully`);
          } else {
            addLog(`❌ ${poseName}: ${result.errorMessage || 'Face detection failed'}`);
            failed.push(index);
          }
        });
        
        setFailedPoses(failed);
        
        if (failed.length > 0) {
          addLog(`⚠️ Found ${failed.length} poses with face detection issues.`);
          addLog('You need to retake these photos before proceeding.');
          addLog('Please type "y" to return to the image capture screen and retake failed poses.');
          addLog('Or type "n" to cancel registration.');
        } else {
          addLog('🎉 All faces detected successfully!');
          addLog('Please type "y" to proceed with registration submission.');
          addLog('Or type "n" to cancel registration.');
        }
        addLog('Waiting for your response (y/n)...');
        
        requestUserConfirmation();
      } catch (error) {
        console.error('Processing error:', error);
        addLog(`❌ Error during face validation: ${error.message}`);
        addLog('Please check your connection and try again.');
        addLog('Type "y" to retry or "n" to cancel.');
        addLog('Waiting for your response (y/n)...');
        requestUserConfirmation();
      }
    };

    const requestUserConfirmation = () => {
      setIsProcessing(false);
      setWaitingForInput(true);
    };

    // Start processing after a short delay to let the component render
    const timer = setTimeout(() => {
      validateFaces();
    }, 1000);

    return () => clearTimeout(timer);
  }, [location.state, navigate]);

  return (
    <div className="processing-container">
      <div className="processing-content">
        <div className="terminal-container">
          <div className="terminal-header">
            <span>FacenRoll Face Validation</span>
          </div>
          <div className="terminal-body" ref={terminalRef}>
            {logs.map((log, index) => (
              <div key={index} className="terminal-line">
                <span className="terminal-prompt">$ </span>
                <span className="terminal-text">{log}</span>
              </div>
            ))}
            {isProcessing && (
              <div className="terminal-line">
                <span className="terminal-prompt">$ </span>
                <span className="terminal-cursor"></span>
              </div>
            )}
            {waitingForInput && (
              <div className="terminal-line input-line">
                <span className="terminal-prompt">$ </span>
                <input
                  type="text"
                  value={userInput}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  className="terminal-input"
                  ref={inputRef}
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceValidationPage;