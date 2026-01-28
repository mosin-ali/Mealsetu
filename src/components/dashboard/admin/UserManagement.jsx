import React, { useState, useMemo } from 'react';
import { Search, UserCheck, UserX, Users } from 'lucide-react';
import './userManagement.css';

const UserManagement = ({ newVendor }) => {
  const [users, setUsers] = useState([
    { id: 1, name: 'John Doe', email: 'john@example.com', phone: '+91 9876543210', status: true, joinDate: '2024-01-15', lastLogin: '2024-01-20' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', phone: '+91 9876543211', status: false, joinDate: '2024-01-10', lastLogin: '2024-01-18' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', phone: '+91 9876543212', status: true, joinDate: '2024-01-05', lastLogin: '2024-01-19' },
    { id: 4, name: 'Alice Brown', email: 'alice@example.com', phone: '+91 9876543213', status: true, joinDate: '2024-01-12', lastLogin: '2024-01-21' },
    { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', phone: '+91 9876543214', status: false, joinDate: '2024-01-08', lastLogin: '2024-01-17' },
  ]);

  // Add new vendor when approved
  React.useEffect(() => {
    if (newVendor) {
      setUsers(prevUsers => [...prevUsers, { ...newVendor, id: Date.now() }]);
    }
  }, [newVendor]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' ||
                           (statusFilter === 'active' && user.status) ||
                           (statusFilter === 'inactive' && !user.status);
      return matchesSearch && matchesStatus;
    });
  }, [users, searchTerm, statusFilter]);

  const handleToggleStatus = (userId) => {
    setUsers(users.map(user =>
      user.id === userId ? { ...user, status: !user.status } : user
    ));
  };

  const activeUsers = users.filter(u => u.status).length;
  const inactiveUsers = users.filter(u => !u.status).length;

  return (
    <div className="user-management">
      <div className="header">
        <h1>User Management</h1>
        <span>System Online</span>
      </div>

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
            All Users
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

      <div className="table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Join Date</th>
              <th>Last Login</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id}>
                <td>
                  <div className="user-info-cell">
                    <div className="user-avatar">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span>{user.name}</span>
                  </div>
                </td>
                <td>{user.email}</td>
                <td>{user.phone}</td>
                <td>{new Date(user.joinDate).toLocaleDateString()}</td>
                <td>{new Date(user.lastLogin).toLocaleDateString()}</td>
                <td>
                  <span className={`status-badge ${user.status ? 'active' : 'inactive'}`}>
                    {user.status ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <label className="status-toggle">
                    <input
                      type="checkbox"
                      checked={user.status}
                      onChange={() => handleToggleStatus(user.id)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="no-results">
            <p>No users found matching your search criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
