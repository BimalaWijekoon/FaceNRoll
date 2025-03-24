import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeftOutlined,
  SearchOutlined,
  FilterOutlined,
  DownloadOutlined,
  MailOutlined,
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  UserOutlined,
  FileExcelOutlined,
  FilePdfOutlined
} from '@ant-design/icons';
import { DatePicker } from 'antd';
import './AttendanceDetails.css';

const { RangePicker } = DatePicker;

const AttendanceDetails = () => {
  const navigate = useNavigate();
  
  // State for attendance data
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  
  // State for filters
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    email: '',
    attendance: '',
    progress: ''
  });
  
  // State for sorting
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // State for filter panel visibility
  const [showFilters, setShowFilters] = useState(false);
  
  // State for export options
  const [showExportOptions, setShowExportOptions] = useState(false);
  
  // State for email modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailDetails, setEmailDetails] = useState({
    recipient: '',
    subject: 'Attendance Report',
    message: ''
  });
  
  // Email sending state
  const [sending, setSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);

  // State for user details overlay
  const [showUserOverlay, setShowUserOverlay] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);

  // Fetch attendance records
  const fetchAttendanceRecords = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = {
        page: currentPage,
        limit: recordsPerPage,
        sortBy,
        sortOrder
      };
      
      // Add filters if they exist
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.email) params.email = filters.email;
      if (filters.attendance) params.attendance = filters.attendance;
      if (filters.progress) params.progress = filters.progress;
      
      // Log the request parameters for debugging
      console.log('Fetching attendance with params:', params);
      
      // Make API request
      const response = await axios.get('http://localhost:5000/all-attendance', { params });
      
      // Update state with response data
      setAttendanceRecords(response.data.records);
      setTotalPages(response.data.totalPages);
      setTotalRecords(response.data.total);
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching attendance records:', err);
      
      // Detailed error handling
      if (err.response) {
        setError(`Server error: ${err.response.status} - ${err.response.data.error || 'Unknown error'}`);
      } else if (err.request) {
        setError('No response received from server. Please check if the backend is running.');
      } else {
        setError(err.message || 'Failed to load attendance data');
      }
      
      setLoading(false);
    }
  };

  // Fetch user details
  const fetchUserDetails = async (email) => {
    try {
      setUserDetailsLoading(true);
      
      // Make API request to fetch user details
      const response = await axios.get(`http://localhost:5000/user/${email}`);
      
      // Combine user details with attendance record
      const attendanceRecord = attendanceRecords.find(record => record.email === email);
      setSelectedUser({
        ...response.data,
        ...attendanceRecord
      });
      
      setUserDetailsLoading(false);
    } catch (err) {
      console.error('Error fetching user details:', err);
      
      // If we can't fetch full details, just use what we have
      const attendanceRecord = attendanceRecords.find(record => record.email === email);
      setSelectedUser({
        email,
        firstName: 'User',
        lastName: 'Details',
        ...attendanceRecord
      });
      
      setUserDetailsLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchAttendanceRecords();
  }, [currentPage, recordsPerPage, sortBy, sortOrder]);

  // Handle filter changes
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle date range change
  const handleDateRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      setFilters(prev => ({
        ...prev,
        startDate: dates[0].format('YYYY-MM-DD'),
        endDate: dates[1].format('YYYY-MM-DD')
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        startDate: null,
        endDate: null
      }));
    }
  };

  // Apply filters
  const applyFilters = () => {
    setCurrentPage(1);
    fetchAttendanceRecords();
    setShowFilters(false);
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      startDate: null,
      endDate: null,
      email: '',
      attendance: '',
      progress: ''
    });
    setCurrentPage(1);
    setSortBy('date');
    setSortOrder('desc');
    fetchAttendanceRecords();
    setShowFilters(false);
  };

  // Handle sort change
  const handleSortChange = (column) => {
    if (sortBy === column) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort column and default to descending
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Open user details overlay
  const openUserDetails = (email) => {
    fetchUserDetails(email);
    setShowUserOverlay(true);
  };

  // Close user details overlay
  const closeUserOverlay = () => {
    setShowUserOverlay(false);
    setSelectedUser(null);
  };

  // Generate sort icon
  const getSortIcon = (column) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? '↑' : '↓';
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

  // Handle export to CSV
  const handleExportCSV = async () => {
    try {
      const response = await axios.get('http://localhost:5000/export-attendance', {
        params: {
          format: 'csv',
          ...filters
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_report_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting CSV:', err);
      setError('Failed to export data to CSV');
    }
  };

  // Handle export to PDF
  const handleExportPDF = async () => {
    try {
      const response = await axios.get('http://localhost:5000/export-attendance', {
        params: {
          format: 'pdf',
          ...filters
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_report_${new Date().toISOString().slice(0,10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting PDF:', err);
      setError('Failed to export data to PDF');
    }
  };

  // Handle email modal input changes
  const handleEmailInputChange = (e) => {
    const { name, value } = e.target;
    setEmailDetails(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Send email with report
  const handleSendEmail = async () => {
    try {
      setSending(true);
      setEmailStatus(null);
      
      const response = await axios.post('http://localhost:5000/email-attendance-report', {
        ...emailDetails,
        filters
      });
      
      if (response.data.success) {
        setEmailStatus('success');
        setTimeout(() => {
          setShowEmailModal(false);
          setEmailStatus(null);
          setEmailDetails({
            recipient: '',
            subject: 'Attendance Report',
            message: ''
          });
        }, 5000);
      } else {
        throw new Error('Failed to send email');
      }
      
      setSending(false);
    } catch (err) {
      console.error('Error sending email:', err);
      setEmailStatus('error');
      setSending(false);
    }
  };

  // Navigate back to dashboard
  const handleBackToDashboard = () => {
    navigate('/admin');
  };

  // Render loading state
  if (loading && attendanceRecords.length === 0) {
    return (
      <div className="attendance-details-main">
        <div className="attendance-details-container loading">
          <div className="loading-spinner">Loading attendance data...</div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="attendance-details-main">
        <div className="attendance-details-container error">
          <div className="error-message">Error: {error}</div>
          <button className="refresh-button" onClick={() => fetchAttendanceRecords()}>
            <ReloadOutlined /> Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="attendance-details-main">
      <div className="back-button" onClick={handleBackToDashboard}>
        <ArrowLeftOutlined />
        <span>Back to Dashboard</span>
      </div>
      
      <div className="attendance-details-container">
        <h1 className="page-title">Attendance Records</h1>
        
        {/* Action Bar */}
        <div className="action-bar">
          <div className="search-container">
            <input 
              type="text" 
              placeholder="Search by email..." 
              value={filters.email} 
              onChange={(e) => handleFilterChange('email', e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && applyFilters()}
            />
            <SearchOutlined className="search-icon" onClick={applyFilters} />
          </div>
          
          <div className="action-buttons">
            <button 
              className={`filter-button ${showFilters ? 'active' : ''}`} 
              onClick={() => setShowFilters(!showFilters)}
            >
              <FilterOutlined /> Filters
            </button>
            
            <div className="export-container">
              <button 
                className="export-button" 
                onClick={() => setShowExportOptions(!showExportOptions)}
              >
                <DownloadOutlined /> Export
              </button>
              
              {showExportOptions && (
                <div className="export-options">
                  <button onClick={handleExportCSV}>
                    <FileExcelOutlined /> Export to CSV
                  </button>
                  <button onClick={handleExportPDF}>
                    <FilePdfOutlined /> Export to PDF
                  </button>
                  <button onClick={() => setShowEmailModal(true)}>
                    <MailOutlined /> Email Report
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Filter Panel */}
        {showFilters && (
          <div className="filter-panel">
            <div className="filter-group date-filter">
              <label><CalendarOutlined /> Date Range</label>
              <RangePicker onChange={handleDateRangeChange} />
            </div>
            
            <div className="filter-group">
              <label><UserOutlined /> Email</label>
              <input 
                type="text" 
                value={filters.email} 
                onChange={(e) => handleFilterChange('email', e.target.value)} 
                placeholder="Filter by email"
              />
            </div>
            
            <div className="filter-group">
              <label><CheckOutlined /> Attendance Status</label>
              <select 
                value={filters.attendance} 
                onChange={(e) => handleFilterChange('attendance', e.target.value)}
              >
                <option value="">All</option>
                <option value="present">Present</option>
                <option value="leave">Leave</option>
                <option value="absent">Absent</option>
                <option value="warning">Warning</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label><ClockCircleOutlined /> Progress Status</label>
              <select 
                value={filters.progress} 
                onChange={(e) => handleFilterChange('progress', e.target.value)}
              >
                <option value="">All</option>
                <option value="not late">Not Late</option>
                <option value="late">Late</option>
                <option value="leave ontime">Leave On Time</option>
                <option value="leave early">Leave Early</option>
                <option value="not marked as present on morning">Not Marked in Morning</option>
              </select>
            </div>
            
            <div className="filter-actions">
              <button className="apply-filter" onClick={applyFilters}>
                Apply Filters
              </button>
              <button className="reset-filter" onClick={resetFilters}>
                Reset
              </button>
            </div>
          </div>
        )}
        
        {/* Attendance Records Table */}
        <div className="attendance-records-wrapper">
          <div className="attendance-table-container">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th onClick={() => handleSortChange('date')}>
                    Date {getSortIcon('date')}
                  </th>
                  <th onClick={() => handleSortChange('time')}>
                    Time {getSortIcon('time')}
                  </th>
                  <th onClick={() => handleSortChange('email')}>
                    Email {getSortIcon('email')}
                  </th>
                  <th onClick={() => handleSortChange('attendance')}>
                    Status {getSortIcon('attendance')}
                  </th>
                  <th onClick={() => handleSortChange('progress')}>
                    Progress {getSortIcon('progress')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {attendanceRecords.length > 0 ? (
                  attendanceRecords.map((record, index) => (
                    <tr 
                      key={index} 
                      className="attendance-row"
                      onClick={() => openUserDetails(record.email)}
                    >
                      <td>{formatDate(record.date)}</td>
                      <td>{formatTime(record.time)}</td>
                      <td className="email-cell">
                        {record.email}
                      </td>
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
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="no-records">
                      <div className="no-data-message">
                        No attendance records found
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => setCurrentPage(1)} 
                disabled={currentPage === 1}
                className="pagination-button"
              >
                First
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                disabled={currentPage === 1}
                className="pagination-button"
              >
                Previous
              </button>
              
              <div className="page-info">
                Page {currentPage} of {totalPages} ({totalRecords} records)
              </div>
              
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                disabled={currentPage === totalPages}
                className="pagination-button"
              >
                Next
              </button>
              <button 
                onClick={() => setCurrentPage(totalPages)} 
                disabled={currentPage === totalPages}
                className="pagination-button"
              >
                Last
              </button>
            </div>
          )}
          
          {/* Records Per Page Selector */}
          <div className="records-per-page">
            <span>Show</span>
            <select 
              value={recordsPerPage} 
              onChange={(e) => {
                setRecordsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>records per page</span>
          </div>
        </div>
      </div>
      
      {/* Email Modal */}
      {showEmailModal && (
        <div className="modal-overlay">
          <div className="email-modal">
            <div className="email-content">
              <h3>Email Attendance Report</h3>
              <div className="email-form">
                <div className="form-group">
                  <label>Recipient Email</label>
                  <input 
                    type="email" 
                    name="recipient" 
                    value={emailDetails.recipient} 
                    onChange={handleEmailInputChange} 
                    placeholder="Enter recipient email"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Subject</label>
                  <input 
                    type="text" 
                    name="subject" 
                    value={emailDetails.subject} 
                    onChange={handleEmailInputChange} 
                    placeholder="Enter email subject"
                  />
                </div>
                
                <div className="form-group">
                  <label>Message</label>
                  <textarea 
                    name="message" 
                    value={emailDetails.message} 
                    onChange={handleEmailInputChange} 
                    placeholder="Enter email message"
                    rows="4"
                  />
                </div>
                
                <div className="attachment-section">
                  <div className="attachment-file">
                    <FileExcelOutlined style={{ fontSize: '20px', color: '#1E7F4E' }} />
                    <div className="attachment-details">
                      <span className="attachment-name">attendance_report_{new Date().toISOString().slice(0,10)}.csv</span>
                      <span className="attachment-size">Generated from current filters</span>
                    </div>
                  </div>
                  <div className="attachment-note">
                    <small>* CSV file will be generated with current filter settings</small>
                  </div>
                </div>
                
                {emailStatus === 'success' && (
                  <div className="email-success-overlay">
                    <div className="email-success-modal">
                      <div className="email-success-header">
                        <div className="email-success-title">Success</div>
                        <button className="email-success-close">×</button>
                      </div>
                      <div className="email-success-content">
                        Email sent successfully!
                      </div>
                      <button className="email-success-button">Continue</button>
                    </div>
                  </div>
                )}
                
                {emailStatus === 'error' && (
                  <div className="email-success-overlay">
                    <div className="email-success-modal">
                      <div className="email-success-header">
                        <div className="email-success-title">Error</div>
                        <button className="email-success-close">×</button>
                      </div>
                      <div className="email-success-content">
                        Email not sent!
                      </div>
                      <button className="email-success-button">Continue</button>
                    </div>
                  </div>
                )}
                
                <div className="email-form-actions">
                  <button 
                    className="cancel-btn" 
                    onClick={() => setShowEmailModal(false)}
                    disabled={sending}
                  >
                    <span>Cancel</span>
                  </button>
                  <button 
                    className="send-btn" 
                    onClick={handleSendEmail} 
                    disabled={sending || !emailDetails.recipient}
                  >
                    <span>{sending ? 'Sending...' : 'Send Email'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* User Details Overlay */}
      {showUserOverlay && selectedUser && (
        <div className="user-overlay" onClick={closeUserOverlay}>
          <div className="user-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="user-details-header">
              <h3>User Attendance Details</h3>
              <button className="close-modal-btn" onClick={closeUserOverlay}>×</button>
            </div>
            
            {userDetailsLoading ? (
              <div className="user-details-loading">
                <div className="loading-spinner">Loading user details...</div>
              </div>
            ) : (
              <div className="user-details-content">
                <div className="user-avatar">
                  <div className="avatar-circle">
                    <UserOutlined style={{ fontSize: '32px' }} />
                  </div>
                </div>
                
                <div className="user-info-grid">
                  <div className="user-info-item">
                    <div className="info-label">Name</div>
                    <div className="info-value">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </div>
                  </div>
                  
                  <div className="user-info-item">
                    <div className="info-label">Email</div>
                    <div className="info-value">{selectedUser.email}</div>
                  </div>
                  
                  <div className="user-info-item">
                    <div className="info-label">Date</div>
                    <div className="info-value">{formatDate(selectedUser.date)}</div>
                  </div>
                  
                  <div className="user-info-item">
                    <div className="info-label">Time</div>
                    <div className="info-value">{formatTime(selectedUser.time)}</div>
                  </div>
                  
                  <div className="user-info-item">
                    <div className="info-label">Attendance Status</div>
                    <div className="info-value status-badge">
                      {getAttendanceIcon(selectedUser.attendance)}
                      <span>{selectedUser.attendance}</span>
                    </div>
                  </div>
                  
                  <div className="user-info-item">
                    <div className="info-label">Progress Status</div>
                    <div className="info-value progress-badge">
                      {getProgressIcon(selectedUser.progress)}
                      <span>{selectedUser.progress}</span>
                    </div>
                  </div>
                </div>
                
                <div className="user-details-actions">
                  <button className="view-all-btn" onClick={() => {
                    closeUserOverlay();
                    navigate(`/userall/${encodeURIComponent(selectedUser.email)}`);
                  }}>
                    View All Records
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceDetails;