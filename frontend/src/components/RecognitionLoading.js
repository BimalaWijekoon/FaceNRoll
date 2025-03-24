import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProcessingPage.css'; // We'll reuse the terminal styling
import axios from 'axios';

const RecognitionLoading = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState(['Initializing Face Recognition System...']);
  const [isProcessing, setIsProcessing] = useState(true);
  const terminalRef = useRef(null);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);

  const addLog = (message) => {
    setLogs(prevLogs => [...prevLogs, message]);
  };

  // Auto scroll terminal to bottom when new logs are added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Capture a test image from video stream
  const captureTestImage = () => {
    if (!videoRef.current || !canvasRef.current || !videoReady) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    try {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      // Draw current video frame to canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to base64
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      return imageData;
    } catch (error) {
      console.error('Error capturing test image:', error);
      return null;
    }
  };

  const initializeSystem = async () => {
    try {
      // Step 1: Start camera initialization
      addLog('Initializing camera...');
      const cameraInitialized = await initializeCamera().catch(error => {
        addLog(`❌ Camera initialization failed: ${error.message}`);
        return false;
      });
      
      if (!cameraInitialized) {
        addLog('⚠️ Continuing without camera access');
      } else {
        addLog('✅ Camera initialized successfully');
      }
      
      // Step 2: Fetch embeddings
      addLog('Loading face recognition data...');
      const embeddingsData = await fetchEmbeddings();
      if (!embeddingsData) {
        addLog('❌ Failed to load face recognition data');
        addLog('Redirecting to processing page to generate embeddings...');
        setTimeout(() => {
          navigate('/processing');
        }, 2000);
        return;
      }
      addLog('✅ Face recognition data loaded successfully');
      
      // Step 3: Test recognition endpoint
      addLog('Testing recognition endpoint...');
      let endpointWorking = false;
      try {
        endpointWorking = await testRecognitionEndpoint();
        if (endpointWorking) {
          addLog('✅ Recognition service is responding');
        }
      } catch (error) {
        addLog(`❌ Recognition service error: ${error.message}`);
        addLog('⚠️ Continuing without recognition service verification');
      }
      
      // Step 4: Test a sample image if camera is working
      if (cameraInitialized && videoReady) {
        addLog('Testing image capture...');
        const testImage = captureTestImage();
        if (testImage) {
          addLog('✅ Test image captured successfully');
        } else {
          addLog('⚠️ Warning: Could not capture test image');
        }
      }
      
      // Step 5: Clean up and redirect
      addLog('All systems operational! Launching recognition interface...');
      
      // Clean up camera stream before navigating
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Redirect to recognition page after a short delay
      setTimeout(() => {
        navigate('/face', { 
          state: { 
            preInitialized: true,
            embeddingsLoaded: !!embeddingsData,
            recognitionServiceAvailable: endpointWorking
          } 
        });
      }, 1500);
      
    } catch (error) {
      console.error('Initialization error:', error);
      addLog(`❌ Error during system initialization: ${error.message}`);
      addLog('Please refresh the page and try again');
    }
  };

  const initializeCamera = () => {
    return new Promise(async (resolve, reject) => {
      try {
        // Try to get camera with HD resolution first
        const constraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };
        
        addLog('Requesting camera access...');
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          
          // Set up event listeners for video element
          videoRef.current.onloadedmetadata = () => {
            setVideoReady(true);
            const width = videoRef.current?.videoWidth || 'unknown';
            const height = videoRef.current?.videoHeight || 'unknown';
            addLog(`Camera activated at ${width}x${height} resolution`);
            resolve(true);
          };
          
          videoRef.current.onerror = (err) => {
            addLog(`❌ Video element error: ${err.message || 'Unknown error'}`);
            reject(new Error('Video element error'));
          };
          
          // Set timeout in case metadata loading takes too long
          setTimeout(() => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              setVideoReady(true);
              resolve(true);
            } else {
              reject(new Error('Camera initialization timeout'));
            }
          }, 5000);
        } else {
          reject(new Error('Video reference not available'));
        }
      } catch (error) {
        addLog(`❌ Camera access error: ${error.message}`);
        reject(error);
      }
    });
  };

  const fetchEmbeddings = async () => {
    try {
      addLog('Contacting database for embeddings data...');
      const response = await axios.get('http://localhost:5000/embeddings/latest');
      
      const data = response.data;
      if (data.embeddings && data.embeddings.embeddings) {
        addLog(`Retrieved embeddings for ${Object.keys(data.embeddings.embeddings).length} individuals`);
        return data.embeddings.embeddings;
      } else {
        addLog('⚠️ No embeddings found in the database');
        return null;
      }
    } catch (error) {
      addLog(`❌ Error fetching embeddings: ${error.message}`);
      return null;
    }
  };

  const testRecognitionEndpoint = async () => {
    try {
      addLog('Testing connection to recognition service...');
      
      // Just send a simple ping to check if the server is responsive
      const response = await axios.get('http://localhost:5001/api/status');
      
      if (response.status === 200) {
        addLog('Recognition service is online');
        return true;
      } else {
        throw new Error(`Unexpected status: ${response.status}`);
      }
    } catch (error) {
      addLog(`❌ Recognition service error: ${error.message}`);
      throw error;
    }
  };

  // Start initialization after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      initializeSystem();
    }, 1000);

    return () => {
      clearTimeout(timer);
      // Clean up camera stream if component unmounts
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="processing-container">
      <div className="processing-content">
        <div className="terminal-container">
          <div className="terminal-header">
            <span>Face Recognition System Initialization</span>
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
          </div>
        </div>
        
        {/* Hidden video element for camera initialization */}
        <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted
            width="640"
            height="480"
          />
          
          {/* Hidden canvas for test image capture */}
          <canvas 
            ref={canvasRef} 
            width="640"
            height="480"
          />
        </div>
      </div>
    </div>
  );
};

export default RecognitionLoading;