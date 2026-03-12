import React from 'react';

const UpdateModal = ({ onConfirm, onCancel }) => {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999, // Ensure it's above everything
      color: 'white',
      padding: '20px',
      textAlign: 'center'
    }}>
      <h2 style={{ marginBottom: '20px', fontSize: '24px', textShadow: '2px 2px 0 #000' }}>
        New Update Available!
      </h2>
      <p style={{ marginBottom: '30px', fontSize: '14px', lineHeight: '1.5' }}>
        A new version of Blood Honor is ready.<br/>
        Would you like to install it now?
      </p>
      <div style={{ display: 'flex', gap: '20px' }}>
        <button 
          onClick={onConfirm}
          className="menu-button"
          style={{
            padding: '15px 30px',
            fontSize: '16px',
            backgroundColor: '#d32f2f',
            color: 'white',
            border: '2px solid white',
            cursor: 'pointer',
            fontFamily: '"Press Start 2P", system-ui'
          }}
        >
          Update
        </button>
        <button 
          onClick={onCancel}
          className="menu-button"
          style={{
            padding: '15px 30px',
            fontSize: '16px',
            backgroundColor: '#555',
            color: 'white',
            border: '2px solid white',
            cursor: 'pointer',
            fontFamily: '"Press Start 2P", system-ui'
          }}
        >
          Later
        </button>
      </div>
    </div>
  );
};

export default UpdateModal;