import React, { useState, useRef, useEffect } from 'react';
import { Button, Select, Typography, Form, Input, Switch } from 'antd';
import { CameraOutlined, CheckCircleOutlined, SyncOutlined, LeftOutlined , ArrowLeftOutlined} from '@ant-design/icons';
import './UserRegistration.css';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios'; // Import axios for API calls

const { Option } = Select;
const { Text } = Typography;

const UserRegistration = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Form state
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    id: '',            // Changed from idNumber to id to match backend
    telephone: '',     // Changed from mobile to telephone to match backend
    address: ''
  });
  const [errors, setErrors] = useState({});
  
  // Camera state
  const videoRef = useRef(null);
  const [currentTime, setCurrentTime] = useState('');
  const [cameraResolution, setCameraResolution] = useState('1280x720');
  const [stream, setStream] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState(Array(8).fill(null));
  const [isCapturing, setIsCapturing] = useState(false);
  const [mirrorMode, setMirrorMode] = useState(true); // Default to mirror mode on
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Pose instructions
  const poseInstructions = [
    "Look up slightly",
    "Look down slightly",
    "Look straight at camera",
    "Look straight at camera with a smile",
    "Turn head slightly to the left",
    "Turn head slightly to the right",
    "Any pose (with glasses/hat if available)",
    "Another pose (with different accessories if available)"
  ];
  
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
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          facingMode: "user"
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Get actual resolution after video is loaded
        videoRef.current.onloadedmetadata = () => {
          const width = videoRef.current.videoWidth;
          const height = videoRef.current.videoHeight;
          setCameraResolution(`${width}x${height}`);
        };
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };

  // Function to stop the camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);
    }
  };

  // Handle camera selection change
  const handleCameraChange = (value) => {
    setSelectedCamera(value);
    if (stream) {
      // Restart camera with new device
      startCamera();
    }
  };

  // Handle resolution change
  const handleResolutionChange = (value) => {
    setCameraResolution(value);
    if (stream) {
      // Restart camera with new resolution
      startCamera();
    }
  };
  const handleBackToDashboard = () => {
    navigate('/admin'); // Adjust this path to match your dashboard route
  };

  // Handle mirror mode toggle
  const handleMirrorToggle = (checked) => {
    setMirrorMode(checked);
  };

  // Function to update the current time
  const updateTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    setCurrentTime(`${hours}:${minutes}:${seconds}`);
  };

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error when field is updated
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  // Validate the form
  const validateForm = () => {
    const newErrors = {};
    
    // Validate first name
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    // Validate last name
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    // Validate email
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    // Validate ID number
    if (!formData.id.trim()) {
      newErrors.id = 'ID number is required';
    }
    
    // Validate telephone
    if (!formData.telephone.trim()) {
      newErrors.telephone = 'Mobile number is required';
    } else if (!/^\d{10}$/.test(formData.telephone.replace(/\D/g, ''))) {
      newErrors.telephone = 'Mobile number should be 10 digits';
    }
    
    // Validate address
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Function to capture a photo
  const capturePhoto = () => {
    if (!videoRef.current || currentPoseIndex >= 8) return;
    
    setIsCapturing(true);
    
    // Create a canvas to capture the video frame
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    // Draw the video frame onto the canvas
    if (mirrorMode) {
      // If in mirror mode, flip the image horizontally when capturing
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to image data URL
    const imageDataUrl = canvas.toDataURL('image/png');
    
    // Update captured photos array
    const updatedPhotos = [...capturedPhotos];
    updatedPhotos[currentPoseIndex] = imageDataUrl;
    setCapturedPhotos(updatedPhotos);
    
    // Find the next uncaptured pose
    const nextUncapturedIndex = findNextUncapturedPose(updatedPhotos);
    setCurrentPoseIndex(nextUncapturedIndex !== -1 ? nextUncapturedIndex : currentPoseIndex);
    
    setIsCapturing(false);
  };

  // Function to find the next uncaptured pose
  const findNextUncapturedPose = (photos) => {
    for (let i = 0; i < photos.length; i++) {
      if (photos[i] === null) {
        return i;
      }
    }
    return -1; // All poses captured
  };

  // Function to retake a specific photo
  const retakePhoto = (index) => {
    setCurrentPoseIndex(index);
    const updatedPhotos = [...capturedPhotos];
    updatedPhotos[index] = null;
    setCapturedPhotos(updatedPhotos);
  };

  // Function to go to next step
  const goToNextStep = () => {
    if (currentStep === 1) {
      if (validateForm()) {
        setCurrentStep(2);
        // Start camera when moving to photo capture step
        setTimeout(() => {
          startCamera();
        }, 500);
      }
    } else if (currentStep === 2) {
      // Check if all photos have been captured
      if (capturedPhotos.every(photo => photo !== null)) {
        setCurrentStep(3);
        // Stop camera when moving to review step
        stopCamera();
      }
    }
  };

  // Function to go to previous step
  const goToPreviousStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
      stopCamera();
    } else if (currentStep === 3) {
      setCurrentStep(2);
      setTimeout(() => {
        startCamera();
      }, 500);
    }
  };

  // Function to handle form submission
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      // Prepare photos data for submission
      const photos = capturedPhotos.map((photo, index) => {
        // Create a short name for the pose
        const poseName = `pose_${index + 1}`;
        return {
          poseName: poseName,
          imageData: photo,
          contentType: 'image/png'
        };
      });
      
      // Prepare complete registration data - matching backend schema
      const registrationData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        id: formData.id,                 
        telephone: formData.telephone,   
        address: formData.address,       
        pictures: photos
      };
      
      // Navigate to face validation page with registration data
      navigate('/face-validation', {
        state: {
          userData: registrationData
        }
      });
      
    } catch (error) {
      console.error('Error submitting registration:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to reset form data
  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      id: '',          
      telephone: '',   
      address: ''
    });
    setCapturedPhotos(Array(8).fill(null));
    setCurrentPoseIndex(0);
    setCurrentStep(1);
  };

  // Check for returned location state to handle retaking photos
  useEffect(() => {
    if (location.state && location.state.returnToStep === 2 && location.state.userData && location.state.failedPoses) {
      // Set the form data from the returned state
      setFormData({
        firstName: location.state.userData.firstName,
        lastName: location.state.userData.lastName,
        email: location.state.userData.email,
        id: location.state.userData.id,
        telephone: location.state.userData.telephone,
        address: location.state.userData.address
      });
      
      // Copy the existing photos
      const updatedPhotos = [...capturedPhotos];
      
      // Set the pictures that were previously captured
      location.state.userData.pictures.forEach((picture, index) => {
        updatedPhotos[index] = picture.imageData;
      });
      
      // Clear the failed poses that need to be retaken
      location.state.failedPoses.forEach(index => {
        updatedPhotos[index] = null;
      });
      
      // Set first failed pose as current
      if (location.state.failedPoses.length > 0) {
        setCurrentPoseIndex(location.state.failedPoses[0]);
      }
      
      setCapturedPhotos(updatedPhotos);
      setCurrentStep(2);
      
      // Clear location state to prevent reprocessing
      window.history.replaceState({}, document.title);
      
      // Start camera
      setTimeout(() => {
        startCamera();
      }, 500);
    }
  }, [location.state]);

  // Setup initial timers and cleanup
  useEffect(() => {
    updateTime();
    getAvailableCameras();
    
    // Update time every second
    const timeInterval = setInterval(updateTime, 1000);
    
    // Clean up resources when component unmounts
    return () => {
      clearInterval(timeInterval);
      stopCamera();
    };
  }, []);

  // Render Step 1: User Details Form
  const renderStep1 = () => (
    <div className="registration-form">
      <h2>New User Registration</h2>
      <div className="registration-form-row">
        <div className="registration-form-group">
          <label htmlFor="firstName">First Name*</label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            className={errors.firstName ? 'error' : ''}
          />
          {errors.firstName && <span className="error-message">{errors.firstName}</span>}
        </div>
        <div className="registration-form-group">
          <label htmlFor="lastName">Last Name*</label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            className={errors.lastName ? 'error' : ''}
          />
          {errors.lastName && <span className="error-message">{errors.lastName}</span>}
        </div>
      </div>
      <div className="registration-form-row">
        <div className="registration-form-group">
          <label htmlFor="email">Email Address*</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={errors.email ? 'error' : ''}
          />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>
        <div className="registration-form-group">
          <label htmlFor="id">ID Number*</label>
          <input
            type="text"
            id="id"
            name="id"
            value={formData.id}
            onChange={handleChange}
            className={errors.id ? 'error' : ''}
          />
          {errors.id && <span className="error-message">{errors.id}</span>}
        </div>
      </div>
      <div className="registration-form-row">
        <div className="registration-form-group">
          <label htmlFor="telephone">Mobile Number*</label>
          <input
            type="tel"
            id="telephone"
            name="telephone"
            value={formData.telephone}
            onChange={handleChange}
            className={errors.telephone ? 'error' : ''}
          />
          {errors.telephone && <span className="error-message">{errors.telephone}</span>}
        </div>
        <div className="registration-form-group">
          <label htmlFor="address">Address*</label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className={errors.address ? 'error' : ''}
          />
          {errors.address && <span className="error-message">{errors.address}</span>}
        </div>
      </div>
      <div className="registration-button-container">
        <button className="registration-button" onClick={goToNextStep}>
          Next
        </button>
      </div>
    </div>
  );

  // Render Step 2: Photo Capture
  const renderStep2 = () => (
    <div className="registration-camera-container">
      
      <div className="camera-capture-layout">
        {/* Left Side - Camera View */}
        <div className="camera-view-section">
          <div className="video-wrapper">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className={`camera-feed ${mirrorMode ? 'mirrored' : ''}`}
            />
            
            <div className="scan-overlay">
            <div className="scan-mesh"></div>
              <div className="face-position-indicator"></div>
            </div>
            
            <div className="pose-instruction">
              <h3>Pose {currentPoseIndex + 1}/8:</h3>
              <p>{poseInstructions[currentPoseIndex]}</p>
            </div>
            
            <button 
              className="capture-button"
              onClick={capturePhoto}
              disabled={isCapturing || !stream || capturedPhotos[currentPoseIndex] !== null}
            >
              <CameraOutlined style={{ fontSize: '24px' }} />
            </button>
          </div>
          
          <div className="camera-controls-container">
            <div className="camera-selector-container">
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
            </div>
            
            <div className="camera-mirror-toggle">
              <span>Mirror Mode:</span>
              <Switch 
                checked={mirrorMode} 
                onChange={handleMirrorToggle} 
                size="small"
              />
            </div>
          </div>
        </div>
        
        {/* Right Side - Preview Section */}
        <div className="photo-preview-section">
          <div className="photo-preview-grid">
            {capturedPhotos.map((photo, index) => (
              <div 
                key={index} 
                className={`photo-preview-item ${index === currentPoseIndex ? 'active' : ''}`}
              >
                <div className="preview-pose-title">{poseInstructions[index]}</div>
                {photo ? (
                  <>
                    <img src={photo} alt={poseInstructions[index]} />
                    <button className="preview-retake-button" onClick={() => retakePhoto(index)}>
                      <SyncOutlined /> Retake
                    </button>
                  </>
                ) : (
                  <div className="empty-preview">
                    {index + 1}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="preview-button-container">
            <button className="registration-button secondary" onClick={goToPreviousStep}>
              Back
            </button>
            <button 
              className="registration-button" 
              onClick={goToNextStep}
              disabled={!capturedPhotos.every(photo => photo !== null)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Render Step 3: Review and Submit
  const renderStep3 = () => (
    <div className="registration-review-container">
      <h2>Review Registration Details</h2>
      
      <div className="registration-review-section">
        <h3>Personal Information</h3>
        <div className="registration-review-grid">
          <div className="review-item">
            <span className="review-label">First Name:</span>
            <span className="review-value">{formData.firstName}</span>
          </div>
          <div className="review-item">
            <span className="review-label">Last Name:</span>
            <span className="review-value">{formData.lastName}</span>
          </div>
          <div className="review-item">
            <span className="review-label">Email:</span>
            <span className="review-value">{formData.email}</span>
          </div>
          <div className="review-item">
            <span className="review-label">ID Number:</span>
            <span className="review-value">{formData.id}</span>
          </div>
          <div className="review-item">
            <span className="review-label">Mobile:</span>
            <span className="review-value">{formData.telephone}</span>
          </div>
          <div className="review-item">
            <span className="review-label">Address:</span>
            <span className="review-value">{formData.address}</span>
          </div>
        </div>
      </div>
      
      <div className="registration-review-section">
        <h3>Captured Photos</h3>
        <div className="registration-photos-grid">
          {capturedPhotos.map((photo, index) => (
            <div key={index} className="review-photo">
              <img src={photo} alt={`Pose ${index + 1}`} />
              <span className="photo-caption">{poseInstructions[index]}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="registration-button-container">
        <button className="registration-button secondary" onClick={goToPreviousStep}>
          Back
        </button>
        <button 
          className="registration-button" 
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Processing...' : 'Process Registration'}
        </button>
      </div>
    </div>
  );

  // Render the current step
  const renderCurrentStep = () => {
    switch(currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return renderStep1();
    }
  };

  return (
        <div className="admin-dashboard">
          <div className="back-button" onClick={handleBackToDashboard}>
              <ArrowLeftOutlined />
              <span>Back to Dashboard</span>
            </div>
          <div className="back-button-container">
          </div>
          <div className="registration-container">
            <div className="registration-progress">
              <div className={`progress-step ${currentStep >= 1 ? 'active' : ''}`}>
                <div className="step-number">1</div>
                <div className="step-name">Personal Details</div>
              </div>
              <div className="progress-line"></div>
              <div className={`progress-step ${currentStep >= 2 ? 'active' : ''}`}>
                <div className="step-number">2</div>
                <div className="step-name">Face Photos</div>
              </div>
              <div className="progress-line"></div>
              <div className={`progress-step ${currentStep >= 3 ? 'active' : ''}`}>
                <div className="step-number">3</div>
                <div className="step-name">Review & Submit</div>
              </div>
            </div>
            
            {renderCurrentStep()}
          </div>
        </div>
  );
};

export default UserRegistration;