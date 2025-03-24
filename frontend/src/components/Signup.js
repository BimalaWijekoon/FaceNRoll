import React, { useState } from 'react';
import './Signup.css';
import Modal from './Modal';
import { useNavigate } from 'react-router-dom';
import Navbar from "./Navbar";

const Signup = () => {
  // States to manage form inputs
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telephone, setTelephone] = useState('');

  // States to manage form validation and UI feedback
  const [errors, setErrors] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState('info');
  const [isSuccess, setIsSuccess] = useState(false);

  const navigate = useNavigate();

  // Validation function to check the form fields
  const validate = (name, value) => {
    let error = '';
    switch (name) {
      case 'firstName':
      case 'lastName':
      case 'telephone':
        if (!value) {
          error = 'Please fill this field';
        }
        break;
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!value) {
          error = 'Please fill this field';
        } else if (!emailRegex.test(value)) {
          error = 'Invalid email address';
        }
        break;
      case 'password':
        if (!value) {
          error = 'Please fill this field';
        } else if (value.length < 6) {
          error = 'Password must be at least 6 characters long';
        }
        break;
      default:
        break;
    }
    setErrors((prevErrors) => ({
      ...prevErrors,
      [name]: error,
    }));
    return error === '';
  };

  // Handle input changes and validate fields
  const handleChange = (e) => {
    const { name, value } = e.target;
    switch (name) {
      case 'firstName':
        setFirstName(value);
        break;
      case 'lastName':
        setLastName(value);
        break;
      case 'email':
        setEmail(value);
        break;
      case 'password':
        setPassword(value);
        break;
      case 'telephone':
        setTelephone(value);
        break;
      default:
        break;
    }
    validate(name, value);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if the form is valid
    const formIsValid = Object.keys(errors).every((key) => errors[key] === '') &&
      [firstName, lastName, email, password, telephone].every((value) => value !== '');

    if (!formIsValid) {
      setModalMessage('Please check the form again.');
      setModalType('warning');
      setIsSuccess(false);
      setShowModal(true);
      return;
    }

    // Prepare form data to send to backend
    const formData = {
      firstName,
      lastName,
      email,
      password,
      telephone,
    };

    try {
      const response = await fetch('http://localhost:5000/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setModalMessage(errorData.error || 'Failed to sign up.');
        setModalType('error');
        setIsSuccess(false);
        setShowModal(true);
        return;
      }

      setModalMessage('Signup successful.');
      setModalType('success');
      setIsSuccess(true);
      setShowModal(true);

      setTimeout(() => {
        navigate('/login');
      }, 1000);

    } catch (error) {
      console.error('Error signing up:', error.message);
      setModalMessage('Failed to sign up.');
      setModalType('error');
      setIsSuccess(false);
      setShowModal(true);
    }
  };

  // Handle closing the modal
  const handleCloseModal = () => {
    setShowModal(false);
    if (isSuccess) {
      navigate('/login');
    }
  };

  return (
    <>
      <Navbar />
      <Modal show={showModal} handleClose={handleCloseModal} message={modalMessage} type={modalType} />
      <div className="signup-page">
        <div className="signup-outer-container">
          <div className="signup-container">
            <div className="signup-header">
              <div className="signup-title">
                <h2>Sign Up</h2>
              </div>
            </div>
            <form className="signup-form" onSubmit={handleSubmit}>
              <div className="signup-form-row">
                <div className="signup-form-group">
                  <label htmlFor="firstName">First Name</label>
                  <div className="signup-input-container">
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      placeholder="First Name"
                      value={firstName}
                      onChange={handleChange}
                      required
                    />
                    {errors.firstName && <span className="signup-tooltip">{errors.firstName}</span>}
                  </div>
                </div>
                <div className="signup-form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <div className="signup-input-container">
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      placeholder="Last Name"
                      value={lastName}
                      onChange={handleChange}
                      required
                    />
                    {errors.lastName && <span className="signup-tooltip">{errors.lastName}</span>}
                  </div>
                </div>
              </div>
              <div className="signup-form-row">
                <div className="signup-form-group">
                  <label htmlFor="email">Email Address</label>
                  <div className="signup-input-container">
                    <input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="Enter email"
                      value={email}
                      onChange={handleChange}
                      required
                    />
                    {errors.email && <span className="signup-tooltip">{errors.email}</span>}
                  </div>
                </div>
                <div className="signup-form-group">
                  <label htmlFor="password">Password</label>
                  <div className="signup-input-container">
                    <input
                      type="password"
                      id="password"
                      name="password"
                      placeholder="Enter password (min. 6 characters)"
                      value={password}
                      onChange={handleChange}
                      required
                    />
                    {errors.password && <span className="signup-tooltip">{errors.password}</span>}
                  </div>
                </div>
              </div>
              <div className="signup-form-row">
                <div className="signup-form-group">
                  <label htmlFor="telephone">Telephone Number</label>
                  <div className="signup-input-container">
                    <input
                      type="text"
                      id="telephone"
                      name="telephone"
                      placeholder="Enter telephone number"
                      value={telephone}
                      onChange={handleChange}
                      required
                    />
                    {errors.telephone && <span className="signup-tooltip">{errors.telephone}</span>}
                  </div>
                </div>
              </div>
              <button type="submit" className="signup-button">Sign Up</button>
              <div className="signup-already-registered">
                Already registered? <a href="/login">Sign in</a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default Signup;