import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const socket = io(BACKEND_URL, {
  autoConnect: false,
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Export default socket instance
export default socket;

// Helper functions for common operations
export const connectSocket = (userId, role, vendorId = null) => {
  if (!socket.connected) {
    socket.connect();
  }
  
  // Join appropriate room based on role
  socket.emit('join', userId);
  
  if (role === 'vendor' && vendorId) {
    socket.emit('joinVendor', vendorId);
  }
  
  if (role === 'admin') {
    socket.emit('joinAdmin');
  }
  
  console.log('📡 Socket connected for', role, 'userId:', userId);
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
  console.log('📡 Socket disconnected');
};

// Listen to a specific event
export const onEvent = (event, callback) => {
  socket.on(event, callback);
};

// Remove listener from a specific event
export const offEvent = (event, callback) => {
  socket.off(event, callback);
};

// Remove all listeners
export const removeAllListeners = () => {
  socket.removeAllListeners();
};
