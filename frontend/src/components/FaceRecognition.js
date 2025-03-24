import React, { useState, useRef, useEffect } from 'react';
import { Button, Select, Typography } from 'antd';
import { CameraOutlined, CheckCircleOutlined, SyncOutlined, LeftOutlined,RetweetOutlined,ArrowLeftOutlined } from '@ant-design/icons';
import './FaceRecognition.css';
import { useNavigate, useLocation } from 'react-router-dom';


const { Option } = Select;
const { Text, Title } = Typography;

const FaceRecognition = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [currentTime, setCurrentTime] = useState('');
  const [cameraResolution, setCameraResolution] = useState('1280x720');
  const [stream, setStream] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [identifiedPerson, setIdentifiedPerson] = useState(null);
  const [recognitionStatus, setRecognitionStatus] = useState('idle');
  const [embeddings, setEmbeddings] = useState(null);
  const [similarity, setSimilarity] = useState(0);
  const [recognitionError, setRecognitionError] = useState(null);
  const recognitionIntervalRef = useRef(null);
  const [isMirrored, setIsMirrored] = useState(false);
  const navigate = useNavigate();
  const [userAttendanceStatus, setUserAttendanceStatus] = useState(null);
  const location = useLocation();
  const isPreInitialized = location.state?.preInitialized || false;

  // Recognition tracking for reliability
  const [lastThreeResults, setLastThreeResults] = useState([]);
  const [displayedPerson, setDisplayedPerson] = useState(null);
  const [displayedSimilarity, setDisplayedSimilarity] = useState(0);
  const [recognitionTime, setRecognitionTime] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [attendanceError, setAttendanceError] = useState(null);
  
  // Available resolutions
  const resolutions = [
    { label: '1280x720', width: 1280, height: 720 },
    { label: '640x480', width: 640, height: 480 },
    { label: '1920x1080', width: 1920, height: 1080 },
    { label: '320x240', width: 320, height: 240 }
  ];

  // Get list of available cameras
  const getAvailableCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          id: device.deviceId,
          label: device.label || `Camera ${devices.indexOf(device) + 1}`
        }));
      
      setAvailableCameras(cameras);
      
      if (cameras.length > 0 && !selectedCamera) {
        setSelectedCamera(cameras[0].id);
      }
    } catch (error) {
      console.error("Error getting camera devices:", error);
    }
  };
// Add this function to fetch user's attendance status
const fetchAttendanceStatus = async (email) => {
  if (!email) return;
  
  try {
    const response = await fetch(`http://localhost:5000/attendance-status/${email}`);
    const data = await response.json();
    
    if (data.success) {
      setUserAttendanceStatus(data.attendanceStatus);
    }
  } catch (error) {
    console.error("Error fetching attendance status:", error);
  }
};

// Modify the markAttendance function to update attendance status after marking
const markAttendance = async (personName) => {
  if (!personName || personName === "Unknown" || personName === "Not identified") {
    return;
  }
  
  try {
    // Assuming the person name is in format "FirstName LastName"
    const nameParts = personName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    
    // Fetch user's email from the database
    const response = await fetch('http://localhost:5000/all-users');
    const userData = await response.json();
    
    // Find the user with matching name
    const user = userData.users.find(u => 
      u.firstName.toLowerCase() === firstName.toLowerCase() && 
      (lastName === '' || u.lastName.toLowerCase() === lastName.toLowerCase())
    );
    
    if (!user) {
      console.error("User not found in the database");
      return;
    }
    
    // Mark attendance
    const attendanceResponse = await fetch('http://localhost:5000/mark-attendance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }),
    });
    
    const attendanceData = await attendanceResponse.json();
    
    if (attendanceData.success) {
      console.log("Attendance marked successfully:", attendanceData.attendance);
      setAttendanceStatus(attendanceData.attendance);
      
      // Fetch updated attendance status
      fetchAttendanceStatus(user.email);
    } else {
      console.error("Failed to mark attendance:", attendanceData.error);
      setAttendanceError(attendanceData.error);
    }
    
  } catch (error) {
    console.error("Error marking attendance:", error);
    setAttendanceError("Failed to mark attendance");
  }
};

  // Fetch latest embeddings from server
  const fetchEmbeddings = async () => {
    try {
      const response = await fetch('http://localhost:5000/embeddings/latest');
      if (!response.ok) {
        throw new Error(`Failed to fetch embeddings: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.embeddings && data.embeddings.embeddings) {
        console.log("Embeddings fetched successfully");
        setEmbeddings(data.embeddings.embeddings);
        return data.embeddings.embeddings;
      } else {
        console.warn("No embeddings found in the database");
        return null;
      }
    } catch (error) {
      console.error("Error fetching embeddings:", error);
      setRecognitionError("Failed to fetch face data");
      return null;
    }
  };

  // Capture image from video stream
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    const ctx = canvas.getContext('2d');
    
    // If mirrored, flip horizontally when capturing
    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Reset transformation if mirrored
    if (isMirrored) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    
    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    return imageData;
  };

  // Recognize face from image
  const recognizeFace = async (imageData, embeddingsData) => {
    if (!imageData) {
      console.warn("No image data available for recognition");
      return;
    }
    
    if (!embeddingsData) {
      console.warn("No embeddings data available for recognition");
      setIdentifiedPerson("Unknown");
      setSimilarity(0);
      return;
    }
    
    try {
      setRecognitionStatus('processing');
      
      const response = await fetch('http://localhost:5001/api/recognize-face', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageData,
          embeddings: embeddingsData
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Recognition failed: ${errorText}`);
      }
      
      const result = await response.json();
      console.log("Recognition result:", result);
      
      // Record the recognized name with current time
      const recognizedInfo = {
        name: result.recognizedName && result.recognizedName !== "Unknown" ? 
              result.recognizedName : "Unknown",
        similarity: result.recognizedName && result.recognizedName !== "Unknown" ? 
                   result.similarity * 100 : 0,
        timestamp: new Date()
      };
      
      // Update last three results
      setLastThreeResults(prev => {
        const newResults = [...prev, recognizedInfo].slice(-3);
        
        // Apply the reliability logic for displaying person
        updateDisplayedPerson(newResults);
        
        return newResults;
      });
      
      // Set current recognition result (not necessarily displayed)
      setIdentifiedPerson(recognizedInfo.name);
      setSimilarity(recognizedInfo.similarity);
      
      setRecognitionStatus('complete');
      setRecognitionError(null);
    } catch (error) {
      console.error("Face recognition error:", error);
      setRecognitionStatus('error');
      setRecognitionError(error.message);
      setIdentifiedPerson("Recognition failed");
      setSimilarity(0);
    }
  };
  
// Add this to the updateDisplayedPerson function
const updateDisplayedPerson = (results) => {
  if (results.length === 0) return;
  
  // If this is the first recognition, display it immediately
  if (results.length === 1) {
    setDisplayedPerson(results[0].name);
    setDisplayedSimilarity(results[0].similarity);
    setRecognitionTime(results[0].timestamp);
    
    // Only mark attendance if similarity is above 70%
    if (results[0].similarity >= 75) {
      markAttendance(results[0].name);
    }
    return;
  }
  
  // If we have 3 results and the latest is different from currently displayed
  if (results.length === 3 && results[2].name !== displayedPerson) {
    // Check if latest matches the second-latest
    if (results[2].name === results[1].name) {
      // Two consecutive matches of a new person, update display
      setDisplayedPerson(results[2].name);
      setDisplayedSimilarity(results[2].similarity);
      setRecognitionTime(results[2].timestamp);
      
      // Only mark attendance if similarity is above 70%
      if (results[2].similarity >= 70) {
        markAttendance(results[2].name);
      }
    }
    // If the latest doesn't match second-latest, keep current display
  }
  
  // For the case where we have 2 results, keep displaying the first one
  // until we have enough data for the reliability check
};
  

  // Start continuous recognition process
  const startRecognition = async (embeddingsData) => {
    // Clear any existing interval
    if (recognitionIntervalRef.current) {
      clearInterval(recognitionIntervalRef.current);
    }
    
    // Set up recognition interval (every 1.5 seconds to reduce CPU usage)
    recognitionIntervalRef.current = setInterval(() => {
      try {
        const imageData = captureImage();
        if (imageData) {
          recognizeFace(imageData, embeddingsData);
        }
      } catch (error) {
        console.error("Error in recognition interval:", error);
      }
    }, 1500);
  };

  // Function to start the camera
  const startCamera = async () => {
    try {
      // Stop any existing stream
      if (stream) {
        stopCamera();
      }
      
      // Get the selected resolution
      const selectedRes = resolutions.find(res => res.label === cameraResolution) || resolutions[0];
      
      const constraints = {
        video: {
          width: { ideal: selectedRes.width },
          height: { ideal: selectedRes.height },
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Get actual resolution after video is loaded
        videoRef.current.onloadedmetadata = async () => {
          const width = videoRef.current.videoWidth;
          const height = videoRef.current.videoHeight;
          setCameraResolution(`${width}x${height}`);
          
          // Fetch embeddings when camera starts
          setRecognitionStatus('loading');
          
          const embeddingsData = await fetchEmbeddings();
          if (embeddingsData) {
            // Start recognition process
            startRecognition(embeddingsData);
          } else {
            setIdentifiedPerson("No face data available");
            setRecognitionStatus('error');
          }
        };
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      setRecognitionError(`Camera error: ${error.message}`);
    }
  };

  // Function to stop the camera
  const stopCamera = () => {
    // Clear recognition interval
    if (recognitionIntervalRef.current) {
      clearInterval(recognitionIntervalRef.current);
      recognitionIntervalRef.current = null;
    }
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);
      setIdentifiedPerson(null);
      setRecognitionStatus('idle');
      
      // Reset recognition tracking
      setLastThreeResults([]);
      setDisplayedPerson(null);
      setDisplayedSimilarity(0);
      setRecognitionTime(null);
    }
  };

  // Function to toggle camera
  const toggleCamera = () => {
    if (stream) {
      stopCamera();
    } else {
      startCamera();
    }
  };
  
  // Function to toggle mirror mode
  const toggleMirror = () => {
    setIsMirrored(prev => !prev);
  };

  // Handle camera selection change
  const handleCameraChange = (value) => {
    setSelectedCamera(value);
    if (stream) {
      // Restart camera with new device
      startCamera();
    }
  };
  const handleBackToDashboard = () => {
    navigate('/admin'); // Adjust this path to match your dashboard route
  };

  // Handle resolution change
  const handleResolutionChange = (value) => {
    setCameraResolution(value);
    if (stream) {
      // Restart camera with new resolution
      startCamera();
    }
  };

  // Function to update the current time
  const updateTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    setCurrentTime(`${hours}:${minutes}:${seconds}`);
  };

  // Format recognition time
  const formatRecognitionTime = (timestamp) => {
    if (!timestamp) return '';
    
    const hours = timestamp.getHours().toString().padStart(2, '0');
    const minutes = timestamp.getMinutes().toString().padStart(2, '0');
    const seconds = timestamp.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // Start time updates when component mounts
  useEffect(() => {
    updateTime();
    getAvailableCameras();
    
    // Update time every second
    const timeInterval = setInterval(updateTime, 1000);
    
    // If coming from the loading page, auto-start the camera
    if (isPreInitialized) {
      // Start with a slight delay to ensure component is fully mounted
      setTimeout(() => {
        startCamera();
      }, 300);
    }
    
    // Clean up resources when component unmounts
    return () => {
      clearInterval(timeInterval);
      stopCamera();
    };
  }, [isPreInitialized])


  return (
        <div className="admin-dashboard">
          <div className="back-button" onClick={handleBackToDashboard}>
              <ArrowLeftOutlined />
              <span>Back to Dashboard</span>
            </div>
          <div className="back-button-container">
          </div>
          <div className="dashboard-container">
            {/* Left side - Camera container */}
            <div className="camera-container">
              <div className="camera-header">
                <div className="time-display">{currentTime}</div>
                <div className="camera-options">
                <Text style={{ color: '#ff9a5a' }}>Resolution:</Text>
                  <Select 
                    className="resolution-selector"
                    value={cameraResolution}
                    onChange={handleResolutionChange}
                  >
                    {resolutions.map(res => (
                      <Option key={res.label} value={res.label}>
                        {res.label}
                      </Option>
                    ))}
                  </Select>
                </div>
              </div>
              
              <div className="video-wrapper">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  className={`camera-feed ${isMirrored ? 'mirrored' : ''}`}
                />
                
                {/* Hidden canvas for capturing frames */}
                <canvas 
                  ref={canvasRef} 
                  style={{ display: 'none' }}
                />
                
                <div className="scan-overlay">
                  <div className="scan-line"></div>
                </div>
              </div>
              
              <div className="camera-controls">
                <div className="camera-actions">
                  <Select 
                    className="camera-selector"
                    value={selectedCamera}
                    onChange={handleCameraChange}
                    placeholder="Select camera"
                  >
                    {availableCameras.map(camera => (
                      <Option key={camera.id} value={camera.id}>
                        {camera.label}
                      </Option>
                    ))}
                  </Select>
                  <div className="control-buttons">
                    <div 
                      className="mirror-button"
                      onClick={toggleMirror}
                      title="Mirror view"
                    >
                      <RetweetOutlined style={{ fontSize: '24px' }} />
                    </div>
                    <div 
                      className="camera-button"
                      onClick={toggleCamera}
                      title={stream ? "Turn off camera" : "Turn on camera"}
                    >
                      <CameraOutlined style={{ fontSize: '24px' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right side - Person Details container */}
            {/* Right side - Person Details container */}
<div className="details-container01">
  <div className="details-header01">Details of the Person</div>
  
  <div className="person-details01">
    <div className="detail-item01">
      <div className="detail-label01">Name</div>
      <div className="detail-value01">
        {displayedPerson ? displayedPerson : 'Not identified'}
      </div>
    </div>
    
    <div className="detail-item01">
      <div className="detail-label01">Matching Percentage</div>
      <div className="detail-value01">
        {displayedSimilarity > 0 
          ? `${displayedSimilarity.toFixed(2)}%` 
          : '0%'}
      </div>
    </div>
    
    <div className="detail-item01">
      <div className="detail-label01">Time</div>
      <div className="detail-value01">
        {recognitionTime 
          ? formatRecognitionTime(recognitionTime) 
          : currentTime}
      </div>
    </div>
    
    <div className="detail-item01">
      <div className="detail-label01">Date</div>
      <div className="detail-value01">
        {new Date().toLocaleDateString()}
      </div>
    </div>
    
    <div className="detail-item01">
  <div className="detail-label01">Attendance</div>
  <div className="detail-value01">
    {userAttendanceStatus ? userAttendanceStatus.summary : 'Not marked'}
  </div>
</div>

<div className="detail-item01">
  <div className="detail-label01">Progress</div>
  <div className="detail-value01">
    {attendanceStatus ? attendanceStatus.progress : 
     (userAttendanceStatus && userAttendanceStatus.present ? 
      userAttendanceStatus.present.progress : 'Not applicable')}
  </div>
</div>
    
    <div className={`recognition-status01 status-${recognitionStatus}01`}>
      {recognitionStatus === 'idle' && 'Camera is off'}
      {recognitionStatus === 'loading' && 'Loading face data...'}
      {recognitionStatus === 'processing' && 'Processing...'}
      {recognitionStatus === 'complete' && displayedPerson && 'Recognition complete'}
      {recognitionStatus === 'error' && recognitionError}
    </div>
  </div>
</div>
          </div>
        </div>
  );
};

export default FaceRecognition;