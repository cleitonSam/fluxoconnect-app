import React, { useEffect } from 'react';

const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg text-white font-medium transition-transform duration-300 transform ${
      type === 'success' ? 'bg-success' : 'bg-danger'
    }`}>
      <div className="flex items-center">
        <i className={`fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-3`}></i>
        <span>{message}</span>
        <button onClick={onClose} className="ml-4">
          <i className="fas fa-times"></i>
        </button>
      </div>
    </div>
  );
};

export default Notification;