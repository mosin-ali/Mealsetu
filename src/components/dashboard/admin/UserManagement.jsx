import React, { useState, useEffect, useMemo } from 'react';
import { Search, UserCheck, UserX, Users, Loader } from 'lucide-react';
import './userManagement.css';

const UserManagement = ({ newVendor }) => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch all users on mount
  useEffect(() => {
    fetchAllUsers();
  }, []);

  // Add new vendor when approved
  useEffect(() => {
    if (newVendor) {
      setUsers(prevUsers => [...prevUsers, { ...newVendor, id: newVendor._id || Date.now() }]);
    }
  }, [newVendor]);

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');

      const response = await fetch('/api/admin/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const isActive = user.isActive !== false; // Default to active if not specified
      const matchesStatus = statusFilter === 'all' ||
                           (statusFilter === 'active' && isActive) ||
                           (statusFilter === 'inactive' && !isActive);
      return matchesSearch && matchesStatus;
    });
  }, [users, searchTerm, statusFilter]);

  const handleToggleStatus = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const user = users.find(u => u._id === userId);
      const newStatus = !user.isActive;

      // Update in backend (you'll need to add this endpoint)
      // For now, just update locally
      setUsers(users.map(u =>
        u._id === userId ? { ...u, isActive: newStatus } : u
      ));
    } catch (err) {
      console.error('Error toggling user status:', err);
      alert('Failed to update user status');
    }
  };

  const activeUsers = users.filter(u => u.isActive !== false).length;
  const inactiveUsers = users.filter(u => u.isActive === false).length;

  if (loading) {
    return (
      <div className="user-management">
        <div className="loading-container">
          <Loader size={40} className="spinner" />
          <p>Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="header">
        <h1>User Management</h1>
        <span>{users.length} Total Users</span>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={fetchAllUsers}>Retry</button>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <UserCheck size={24} color="#10b981" />
          </div>
          <h3>{activeUsers}</h3>
          <p>Active Users</p>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <UserX size={24} color="#ef4444" />
          </div>
          <h3>{inactiveUsers}</h3>
          <p>Inactive Users</p>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Users size={24} color="#3b82f6" />
          </div>
          <h3>{users.length}</h3>
          <p>Total Users</p>
        </div>
      </div>

      <div className="filters-section">
        <div className="search-bar">
          <Search size={20} color="#6b7280" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          <button 
            className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
            onClick={() => setStatusFilter('active')}
          >
            Active
          </button>
          <button 
            className={`filter-btn ${statusFilter === 'inactive' ? 'active' : ''}`}
            onClick={() => setStatusFilter('inactive')}
          >
            Inactive
          </button>
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="no-data-message">
          <p>No users found matching your filters.</p>
        </div>
      ) : (
        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Join Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user._id || user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.phone || 'N/A'}</td>
                  <td><span className="badge">{user.role}</span></td>
                  <td>
                    <span className={`status-badge ${user.isActive !== false ? 'active' : 'inactive'}`}>
                      {user.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <button 
                      className={`status-toggle ${user.isActive !== false ? 'active' : 'inactive'}`}
                      onClick={() => handleToggleStatus(user._id || user.id)}
                    >
                      {user.isActive !== false ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
