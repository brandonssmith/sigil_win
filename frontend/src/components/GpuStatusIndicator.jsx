import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../constants'; // Assuming constants.js defines the base URL

const GpuStatusIndicator = () => {
  const [isGpuActive, setIsGpuActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGpuStatus = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Ensure API_BASE_URL is correctly defined in constants.js or replace if needed
        // Example: const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const response = await fetch(`${API_BASE_URL}/api/v1/model/status`);
        if (!response.ok) {
          // Handle non-2xx responses appropriately
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText || 'No error message'}`);
        }
        const data = await response.json();
        // Check if model is loaded *and* device is cuda
        if (data.loaded && data.device === 'cuda') {
          setIsGpuActive(true);
        } else {
          setIsGpuActive(false); // GPU not active or model not loaded
        }
      } catch (e) {
        console.error("Error fetching GPU status:", e);
        setError(`Failed to fetch GPU status: ${e.message}`);
        setIsGpuActive(false); // Default to false on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchGpuStatus();
    // Optional: Set up polling if the status can change without a page reload
    // const intervalId = setInterval(fetchGpuStatus, 30000); // Poll every 30 seconds
    // return () => clearInterval(intervalId);
  }, []); // Empty dependency array ensures this runs once on mount

  // Optional: Display loading or error state more prominently if desired
  if (isLoading) {
    // Could return a subtle loading indicator or null
    // e.g., return <span style={{ fontSize: '0.9em', color: 'var(--text-placeholder)' }}>Checking GPU...</span>;
    return null;
  }

  if (error) {
     // Could return a subtle error indicator or null
     console.warn("GPU Status Indicator Error:", error);
     // e.g., return <span title={error} style={{ fontSize: '0.9em', color: 'var(--error)' }}>GPU Status Error</span>;
     return null;
  }

  const pulseStyle = {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: 'var(--success)', // Use theme variable
    boxShadow: '0 0 0 0 rgba(3, 218, 198, 1)', // Match --success color rgba(3, 218, 198)
    animation: 'pulse 2s infinite',
    display: 'inline-block', // To place it inline with text if needed
    marginLeft: '8px', // Add some space if next to text
    verticalAlign: 'middle',
  };

  // Define the keyframes animation globally or scoped (e.g., using styled-components or CSS Modules)
  // Injecting a style tag is simple but not ideal for large apps.
  const keyframes = `
    @keyframes pulse {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(3, 218, 198, 0.7); /* Start shadow from success color */
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 10px rgba(3, 218, 198, 0); /* Fade out shadow */
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(3, 218, 198, 0); /* Reset shadow */
      }
    }
  `;

  return (
    <>
      {/* Inject keyframes - consider moving to a global CSS file or using CSS-in-JS */}
      <style>{keyframes}</style>
      {isGpuActive ? (
        <span title="GPU acceleration active" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.9em', gap: '4px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--success)'}}>
              <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 9v6"/><path d="M12 9v6"/><path d="M17 9v6"/>
            </svg>
            GPU Active
            <span style={pulseStyle}></span>
        </span>
      ) : (
         <span title="GPU acceleration not active or model not loaded" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-disabled)', fontSize: '0.9em', gap: '4px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 9v6"/><path d="m12 9 5 6"/><path d="m17 9-5 6"/>
            </svg>
            GPU Inactive
         </span>
       )}
    </>
  );
};

export default GpuStatusIndicator; 