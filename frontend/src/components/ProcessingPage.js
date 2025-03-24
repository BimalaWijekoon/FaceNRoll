// src/ProcessingPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProcessingPage.css';
import axios from 'axios';

const ProcessingPage = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState(['Initializing FacenRoll system...']);
  const [isProcessing, setIsProcessing] = useState(true);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [systemWaiting, setSystemWaiting] = useState(false);
  const terminalRef = useRef(null);
  const inputRef = useRef(null);

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
        addLog('Continuing to system...');
        // Add a fade effect before navigating to startup page
        setTimeout(() => {
          navigate('/start');
        }, 1500);
      } else if (input === 'n' || input === 'no') {
        addLog('Process terminated.');
        setWaitingForInput(false);
        setSystemWaiting(true);
        addLog('Press any key to restart the system...');
        
        // We're adding this event listener later in useEffect to ensure it only fires
        // after the state updates and when we're actually in waiting mode
      } else {
        addLog('Invalid input. Please type "y" to continue or "n" to cancel.');
        // Keep input field active
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    }
  };

  // Separate useEffect for system waiting state
  useEffect(() => {
    let restartHandler = null;
    
    if (systemWaiting) {
      // Define the handler
      restartHandler = (e) => {
        // Remove the event listener first to prevent multiple restarts
        document.removeEventListener('keydown', restartHandler);
        
        addLog('Restarting system...');
        setSystemWaiting(false);
        
        // Reset the state to restart the processing
        setTimeout(() => {
          setLogs(['Initializing FacenRoll system...']);
          setIsProcessing(true);
          
          // Start processing after a short delay
          setTimeout(() => {
            processImages();
          }, 1000);
        }, 500);
      };
      
      // Add the event listener only when we're in waiting state
      document.addEventListener('keydown', restartHandler);
    }
    
    // Cleanup function to remove event listener when component unmounts or state changes
    return () => {
      if (restartHandler) {
        document.removeEventListener('keydown', restartHandler);
      }
    };
  }, [systemWaiting]); // Only re-run when systemWaiting changes

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

  const processImages = async () => {
    try {
      // Step 1: Fetch all users with their images
      addLog(`Fetching all users with their images from database...`);
      const response = await axios.get(`http://localhost:5000/users-with-images`);
      const users = response.data.users;
      
      if (!users || users.length === 0) {
        addLog(`❌ No users with images found in the database.`);
        requestUserConfirmation();
        return;
      }
      
      addLog(`Found ${users.length} users with images in the database.`);
      
      // Step 2: Check if we already have embeddings for these users
      addLog(`Checking for existing embeddings...`);
      
      try {
        const embeddingsResponse = await axios.get('http://localhost:5000/embeddings/latest');
        
        // If we successfully retrieved embeddings
        if (embeddingsResponse.status === 200) {
          const existingEmbeddings = embeddingsResponse.data.embeddings;
          
          // Check if embeddings exist and are not empty
          if (existingEmbeddings && existingEmbeddings.embeddings && 
              Object.keys(existingEmbeddings.embeddings).length > 0) {
            
            const embeddingsData = existingEmbeddings.embeddings;
            
            // Check if all users have embeddings
            const userNames = users.map(user => user.firstName);
            const embeddingsUserNames = Object.keys(embeddingsData);
            
            // Check if all current users are in the embeddings
            const allUsersHaveEmbeddings = userNames.every(name => 
              embeddingsUserNames.includes(name)
            );
            
            // Count total images in users
            let totalUserImages = 0;
            users.forEach(user => {
              totalUserImages += user.images.length;
            });
            
            // Count total embeddings
            let totalEmbeddingImages = 0;
            Object.values(embeddingsData).forEach(personEmbeddings => {
              totalEmbeddingImages += personEmbeddings.length;
            });
            
            if (allUsersHaveEmbeddings && totalUserImages === totalEmbeddingImages) {
              addLog(`✅ Found valid embeddings for all ${users.length} users.`);
              addLog(`✅ Embeddings cover all ${totalUserImages} images.`);
              addLog(`⏱️ Embeddings last processed: ${new Date(existingEmbeddings.timestamp).toLocaleString()}`);
              addLog(`🎉 No processing needed - using existing embeddings.`);
              addLog(`System initialization complete. Ready to use FacenRoll.`);
              
              // Skip processing and ask for user confirmation
              requestUserConfirmation();
              return;
            } else {
              // If we have embeddings but they don't match our users
              if (allUsersHaveEmbeddings) {
                addLog(`⚠️ Found embeddings but they only cover ${totalEmbeddingImages}/${totalUserImages} images.`);
              } else {
                addLog(`⚠️ Found embeddings but they don't include all users.`);
              }
              addLog(`⚙️ Need to process images to update embeddings.`);
            }
          } else {
            addLog(`⚠️ No existing embeddings found. Proceeding with image processing.`);
          }
        }
      } catch (error) {
        addLog(`⚠️ Error checking embeddings: ${error.message}. Proceeding with image processing.`);
      }
      
      // Prepare all images for processing
      let allImages = [];
      users.forEach(user => {
        addLog(`Processing images for user: ${user.firstName} ${user.lastName}`);
        addLog(`Found ${user.images.length} images for ${user.firstName}`);
        allImages = [...allImages, ...user.images];
      });
      
      addLog(`Total images to process: ${allImages.length}`);
      
      // Step 3: Process all images with the Python backend
      addLog(`Sending all images to processing server...`);
      const processingResponse = await axios.post('http://localhost:5001/api/process-images', {
        images: allImages
      });
      
      // Step 4: Display the logs from the Python processing
      const processingLogs = processingResponse.data.logs;
      for (const log of processingLogs) {
        // Add a small delay between logs to simulate real-time processing
        await new Promise(resolve => setTimeout(resolve, 100));
        addLog(log);
      }
      
      // Step 5: Save the embeddings to the database
      addLog(`Saving embeddings to database...`);
      await axios.post('http://localhost:5000/embeddings', {
        embeddings: processingResponse.data.embeddings,
        timestamp: processingResponse.data.timestamp,
        logs: processingLogs
      });
      
      addLog(`🎉 Processing completed successfully!`);
      addLog(`System initialization complete. Ready to use FacenRoll.`);
      
      // Ask for user confirmation instead of automatically hiding
      requestUserConfirmation();
      
    } catch (error) {
      console.error('Processing error:', error);
      if (error.response) {
        addLog(`❌ Error during processing: ${error.response.data.error || error.message}`);
      } else {
        addLog(`❌ Error during processing: ${error.message}`);
      }
      addLog(`Please check the system logs and try again.`);
      
      // Ask for user confirmation even after an error
      requestUserConfirmation();
    }
  };

  const requestUserConfirmation = () => {
    addLog(`Type "y" and press Enter to continue to the system, or "n" to terminate the process...`);
    setIsProcessing(false);
    setWaitingForInput(true);
  };

  // Start processing after a short delay to let the component render
  useEffect(() => {
    const timer = setTimeout(() => {
      processImages();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="processing-container">
      <div className="processing-content">
        <div className="terminal-container">
          <div className="terminal-header">
            <span>FacenRoll System Initialization</span>
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
            {systemWaiting && (
              <div className="terminal-line">
                <span className="terminal-prompt">$ </span>
                <span className="terminal-text system-waiting">System waiting for restart... <span className="blink">_</span></span>
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

export default ProcessingPage;