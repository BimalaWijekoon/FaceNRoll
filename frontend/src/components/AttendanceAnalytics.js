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
  UserOutlined,
  CalendarOutlined,
  PieChartOutlined,
  BarChartOutlined,
  LineChartOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { DatePicker } from 'antd';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import './AttendanceAnalytics.css';

const { RangePicker } = DatePicker;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const STATUS_COLORS = {
  present: '#52c41a',
  leave: '#1890ff',
  warning: '#faad14',
  absent: '#ff4d4f'
};

const PROGRESS_COLORS = {
  'not late': '#52c41a',
  'late': '#faad14',
  'leave ontime': '#1890ff',
  'leave early': '#ff4d4f',
  'not marked as present on morning': '#ff4d4f'
};

const AttendanceAnalytics = () => {
  const navigate = useNavigate();
  
  // State for analytics data
  const [analyticsData, setAnalyticsData] = useState({
    statusDistribution: [],
    progressDistribution: [],
    dailyTrends: [],
    weeklyTrends: [],
    monthlyTrends: [],
    userAttendance: [],
    timeAnalysis: []
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for filters
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    email: '',
    viewType: 'daily' // daily, weekly, monthly, yearly
  });
  
  // State for filter panel visibility
  const [showFilters, setShowFilters] = useState(false);
  
  // State for export options
  const [showExportOptions, setShowExportOptions] = useState(false);
  
  // State for email modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailDetails, setEmailDetails] = useState({
    recipient: '',
    subject: 'Attendance Analytics Report',
    message: ''
  });
  
  // Email sending state
  const [sending, setSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  
  // Active section for responsive view
  const [activeSection, setActiveSection] = useState('overview');
  
  // Fetch individual analytics data
  const fetchStatusDistribution = async (params) => {
    try {
      const response = await axios.get('http://localhost:5000/analytics/status-distribution', { params });
      return response.data;
    } catch (err) {
      console.error('Error fetching status distribution:', err);
      throw err;
    }
  };
  
  const fetchProgressDistribution = async (params) => {
    try {
      const response = await axios.get('http://localhost:5000/analytics/progress-distribution', { params });
      return response.data;
    } catch (err) {
      console.error('Error fetching progress distribution:', err);
      throw err;
    }
  };
  
  const fetchDailyTrends = async (params) => {
    try {
      const response = await axios.get('http://localhost:5000/analytics/daily-trends', { params });
      return response.data;
    } catch (err) {
      console.error('Error fetching daily trends:', err);
      throw err;
    }
  };
  
  const fetchWeeklyTrends = async (params) => {
    try {
      const response = await axios.get('http://localhost:5000/analytics/weekly-trends', { params });
      return response.data;
    } catch (err) {
      console.error('Error fetching weekly trends:', err);
      throw err;
    }
  };
  
  const fetchMonthlyTrends = async (params) => {
    try {
      const response = await axios.get('http://localhost:5000/analytics/monthly-trends', { params });
      return response.data;
    } catch (err) {
      console.error('Error fetching monthly trends:', err);
      throw err;
    }
  };
    
  const fetchTimeAnalysis = async (params) => {
    try {
      const response = await axios.get('http://localhost:5000/analytics/time-analysis', { params });
      return response.data;
    } catch (err) {
      console.error('Error fetching time analysis:', err);
      throw err;
    }
  };
  
  // Fetch analytics data
  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    
    // Build query parameters
    const params = { ...filters };
    
    // Console log for debugging
    console.log('Fetching analytics with params:', params);
    
    try {
      // Create an object to store our successfully fetched data
      const newAnalyticsData = {
        statusDistribution: [],
        progressDistribution: [],
        dailyTrends: [],
        weeklyTrends: [],
        monthlyTrends: [],
        userAttendance: [],
        timeAnalysis: []
      };
      
      // Individual try/catch for each endpoint to avoid failing completely if one endpoint fails
      try {
        newAnalyticsData.statusDistribution = await fetchStatusDistribution(params);
      } catch (err) {
        console.error('Failed to fetch status distribution:', err);
      }
      
      try {
        newAnalyticsData.progressDistribution = await fetchProgressDistribution(params);
      } catch (err) {
        console.error('Failed to fetch progress distribution:', err);
      }
      
      try {
        newAnalyticsData.dailyTrends = await fetchDailyTrends(params);
      } catch (err) {
        console.error('Failed to fetch daily trends:', err);
      }
      
      try {
        newAnalyticsData.weeklyTrends = await fetchWeeklyTrends(params);
      } catch (err) {
        console.error('Failed to fetch weekly trends:', err);
        // Log more detailed error info for the MongoDB error
        if (err.response && err.response.data) {
          console.error('Weekly trends error details:', err.response.data);
        }
      }
      
      try {
        newAnalyticsData.monthlyTrends = await fetchMonthlyTrends(params);
      } catch (err) {
        console.error('Failed to fetch monthly trends:', err);
      }
            
      try {
        newAnalyticsData.timeAnalysis = await fetchTimeAnalysis(params);
      } catch (err) {
        console.error('Failed to fetch time analysis:', err);
      }
      
      // Update state with response data
      setAnalyticsData(newAnalyticsData);
      setLoading(false);
      
      // Check if we have any data at all
      const hasAnyData = Object.values(newAnalyticsData).some(data => data && data.length > 0);
      if (!hasAnyData) {
        setError('No data available for the selected filters.');
      }
      
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      
      // Detailed error handling
      if (err.response) {
        setError(`Server error: ${err.response.status} - ${err.response.data.error || 'Unknown error'}`);
      } else if (err.request) {
        setError('No response received from server. Please check if the server is running.');
      } else {
        setError(err.message || 'Failed to load analytics data');
      }
      
      setLoading(false);
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    fetchAnalyticsData();
  }, []);
  
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
    fetchAnalyticsData();
    setShowFilters(false);
  };
  
  // Reset filters
  const resetFilters = () => {
    setFilters({
      startDate: null,
      endDate: null,
      email: '',
      viewType: 'daily'
    });
    fetchAnalyticsData();
    setShowFilters(false);
  };
  
  // Handle export to CSV
  const handleExportCSV = async () => {
    try {
      const response = await axios.get('http://localhost:5000/export-attendanceanalyze', {
        params: {
          format: 'csv',
          ...filters
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_analytics_${new Date().toISOString().slice(0,10)}.csv`);
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
      const response = await axios.get('http://localhost:5000/export-attendanceanalyze', {
        params: {
          format: 'pdf',
          ...filters
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_analytics_${new Date().toISOString().slice(0,10)}.pdf`);
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
  
  // Send email with analytics report
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
            subject: 'Attendance Analytics Report',
            message: ''
          });
        }, 2000);
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
  
  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };
  
  // Get the appropriate trend data based on the filter
  const getTrendData = () => {
    switch (filters.viewType) {
      case 'weekly':
        return analyticsData.weeklyTrends;
      case 'monthly':
        return analyticsData.monthlyTrends;
      case 'yearly':
        return analyticsData.monthlyTrends; // We use monthly data for yearly view
      default:
        return analyticsData.dailyTrends;
    }
  };
  
  // Get the appropriate X axis key based on the filter
  const getXAxisKey = () => {
    switch (filters.viewType) {
      case 'weekly':
        return 'week';
      case 'monthly':
      case 'yearly':
        return 'month';
      default:
        return 'date';
    }
  };
  
  // Calculate summary metrics from actual data
  const calculateSummaryMetrics = () => {
    // Default values
    let totalUsers = 0;
    let averageAttendance = 0;
    let latePercentage = 0;
    let leavePercentage = 0;
    
    // Calculate from actual data
    if (analyticsData.userAttendance && analyticsData.userAttendance.length) {
      totalUsers = analyticsData.userAttendance.length;
    }
    
    if (analyticsData.statusDistribution && analyticsData.statusDistribution.length) {
      const presentItem = analyticsData.statusDistribution.find(item => 
        item.name.toLowerCase() === 'present');
      if (presentItem) {
        averageAttendance = presentItem.value;
      }
      
      const leaveItem = analyticsData.statusDistribution.find(item => 
        item.name.toLowerCase() === 'leave');
      if (leaveItem) {
        leavePercentage = leaveItem.value;
      }
    }
    
    if (analyticsData.progressDistribution && analyticsData.progressDistribution.length) {
      const lateItem = analyticsData.progressDistribution.find(item => 
        item.name.toLowerCase() === 'late');
      if (lateItem) {
        latePercentage = lateItem.value;
      }
    }
    
    return {
      totalUsers,
      averageAttendance,
      latePercentage,
      leavePercentage
    };
  };
  
  const summaryMetrics = calculateSummaryMetrics();
  
  // Check if we have any data to display
  const hasNoData = Object.values(analyticsData).every(data => !data || data.length === 0);
  
  // Render loading state
  if (loading) {
    return (
      <div className="attendance-analytics-main">
        <div className="attendance-analytics-container loading">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }
  
  // Render error state or no data state
  if (error || hasNoData) {
    return (
      <div className="attendance-analytics-main">
        <div className="back-button" onClick={handleBackToDashboard}>
          <ArrowLeftOutlined />
          <span>Back to Dashboard</span>
        </div>
        
        <div className="attendance-analytics-container error">
          <h1 className="page-title">Attendance Analytics</h1>
          
          <div className="error-message">
            {error || "No attendance data available. Please adjust your filters or try again later."}
          </div>
          
          {/* Show filter options even when no data */}
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
            </div>
          </div>
          
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
                <label><CalendarOutlined /> View Type</label>
                <select 
                  value={filters.viewType} 
                  onChange={(e) => handleFilterChange('viewType', e.target.value)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
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
          
          <button className="refresh-button" onClick={() => fetchAnalyticsData()}>
            <ReloadOutlined /> Try Again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="attendance-analytics-main">
      {/* Back button */}
      <div className="back-button" onClick={handleBackToDashboard}>
        <ArrowLeftOutlined />
        <span>Back to Dashboard</span>
      </div>
      
      <div className="attendance-analytics-container">
        <h1 className="page-title">Attendance Analytics</h1>
        
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
              <label><CalendarOutlined /> View Type</label>
              <select 
                value={filters.viewType} 
                onChange={(e) => handleFilterChange('viewType', e.target.value)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
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
        
        {/* Mobile Section Navigation */}
        <div className="mobile-section-nav">
          <button 
            className={`section-nav-button ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveSection('overview')}
          >
            <PieChartOutlined /> Overview
          </button>
          <button 
            className={`section-nav-button ${activeSection === 'trends' ? 'active' : ''}`}
            onClick={() => setActiveSection('trends')}
          >
            <LineChartOutlined /> Trends
          </button>
          <button 
            className={`section-nav-button ${activeSection === 'users' ? 'active' : ''}`}
            onClick={() => setActiveSection('users')}
          >
            <TeamOutlined /> Users
          </button>
          <button 
            className={`section-nav-button ${activeSection === 'time' ? 'active' : ''}`}
            onClick={() => setActiveSection('time')}
          >
            <ClockCircleOutlined /> Time
          </button>
        </div>
        
        {/* Summary Cards */}
        <div className={`summary-cards ${activeSection !== 'overview' ? 'section-hidden' : ''}`}>
          <div className="analytics-card">
            <div className="card-icon">
              <TeamOutlined />
            </div>
            <div className="card-content">
              <h3>Total Users</h3>
              <p className="card-value">{summaryMetrics.totalUsers}</p>
            </div>
          </div>
          
          <div className="analytics-card">
            <div className="card-icon">
              <CheckOutlined />
            </div>
            <div className="card-content">
              <h3>Avg. Attendance</h3>
              <p className="card-value">{summaryMetrics.averageAttendance}%</p>
            </div>
          </div>
          
          <div className="analytics-card">
            <div className="card-icon">
              <ClockCircleOutlined />
            </div>
            <div className="card-content">
              <h3>Late Arrival</h3>
              <p className="card-value">{summaryMetrics.latePercentage}%</p>
            </div>
          </div>
          
          <div className="analytics-card">
            <div className="card-icon">
              <CalendarOutlined />
            </div>
            <div className="card-content">
              <h3>On Leave</h3>
              <p className="card-value">{summaryMetrics.leavePercentage}%</p>
            </div>
          </div>
        </div>
        
        {/* Chart Sections */}
        <div className="analytics-sections">
          {/* Overview Section */}
          <div className={`analytics-section ${activeSection !== 'overview' ? 'section-hidden' : ''}`}>
            <div className="section-title">
              <h2><PieChartOutlined /> Attendance Overview</h2>
            </div>
            
            <div className="charts-container">
              {/* Status Distribution Chart */}
              <div className="chart-wrapper">
                <h3>Attendance Status Distribution</h3>
                <div className="chart-container">
                  {analyticsData.statusDistribution && analyticsData.statusDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analyticsData.statusDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          animationBegin={0}
                          animationDuration={1500}
                        >
                          {analyticsData.statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="no-data-message">No status distribution data available</div>
                  )}
                </div>
              </div>
              
              {/* Progress Distribution Chart */}
              <div className="chart-wrapper">
                <h3>Progress Status Distribution</h3>
                <div className="chart-container">
                  {analyticsData.progressDistribution && analyticsData.progressDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analyticsData.progressDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          animationBegin={0}
                          animationDuration={1500}
                        >
                          {analyticsData.progressDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="no-data-message">No progress distribution data available</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Trends Section */}
          <div className={`analytics-section ${activeSection !== 'trends' && activeSection !== 'overview' ? 'section-hidden' : ''}`}>
            <div className="section-title">
              <h2><LineChartOutlined /> Attendance Trends</h2>
              <div className="section-filter">
                <select 
                  value={filters.viewType} 
                  onChange={(e) => handleFilterChange('viewType', e.target.value)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
            
            <div className="chart-wrapper full-width">
              <div className="chart-container">
                {getTrendData() && getTrendData().length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart
                      data={getTrendData()}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey={getXAxisKey()} />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="present" 
                        stackId="1"
                        stroke={STATUS_COLORS.present} 
                        fill={STATUS_COLORS.present}
                        fillOpacity={0.8}
                        animationDuration={1500}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="leave" 
                        stackId="1"
                        stroke={STATUS_COLORS.leave} 
                        fill={STATUS_COLORS.leave}
                        fillOpacity={0.8}
                        animationDuration={1500}
                      />
                      <Area 
  type="monotone" 
  dataKey="absent" 
  stackId="1"
  stroke={STATUS_COLORS.absent} 
  fill={STATUS_COLORS.absent}
  fillOpacity={0.8}
  animationDuration={1500}
/>
<Area 
  type="monotone" 
  dataKey="warning" 
  stackId="1"
  stroke={STATUS_COLORS.warning} 
  fill={STATUS_COLORS.warning}
  fillOpacity={0.8}
  animationDuration={1500}
/>
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="no-data-message">No trend data available for the selected view type</div>
                  )}
                </div>
              </div>
            </div>
          
          {/* Time Analysis Section */}
          <div className={`analytics-section ${activeSection !== 'time' && activeSection !== 'overview' ? 'section-hidden' : ''}`}>
            <div className="section-title">
              <h2><ClockCircleOutlined /> Time Analysis</h2>
            </div>
            
            <div className="charts-container">
              {/* Arrival Time Analysis */}
              <div className="chart-wrapper">
                <h3>Arrival Time Distribution</h3>
                <div className="chart-container">
                  {analyticsData.timeAnalysis && analyticsData.timeAnalysis.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={analyticsData.timeAnalysis}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timeSlot" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar 
                          dataKey="arrivalCount" 
                          name="Arrival Count" 
                          fill="#0088FE"
                          animationDuration={1500} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="no-data-message">No time analysis data available</div>
                  )}
                </div>
              </div>
              
              {/* Departure Time Analysis */}
              <div className="chart-wrapper">
                <h3>Departure Time Distribution</h3>
                <div className="chart-container">
                  {analyticsData.timeAnalysis && analyticsData.timeAnalysis.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={analyticsData.timeAnalysis}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timeSlot" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar 
                          dataKey="departureCount" 
                          name="Departure Count" 
                          fill="#00C49F"
                          animationDuration={1500} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="no-data-message">No time analysis data available</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Email Modal */}
      {showEmailModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Email Attendance Report</h2>
            
            {emailStatus === 'success' ? (
              <div className="success-message">
                <CheckOutlined /> Email sent successfully!
              </div>
            ) : emailStatus === 'error' ? (
              <div className="error-message">
                <CloseOutlined /> Failed to send email. Please try again.
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); handleSendEmail(); }}>
                <div className="form-group">
                  <label>Recipient Email</label>
                  <input 
                    type="email" 
                    name="recipient" 
                    value={emailDetails.recipient}
                    onChange={handleEmailInputChange}
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
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Message</label>
                  <textarea 
                    name="message" 
                    value={emailDetails.message}
                    onChange={handleEmailInputChange}
                    rows="4"
                  ></textarea>
                </div>
                
                <div className="modal-actions">
                  <button 
                    type="button" 
                    className="cancel-button"
                    onClick={() => setShowEmailModal(false)}
                  >
                    Cancel
                  </button>
                  
                  <button 
                    type="submit" 
                    className="send-button"
                    disabled={sending}
                  >
                    {sending ? 'Sending...' : 'Send Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceAnalytics;