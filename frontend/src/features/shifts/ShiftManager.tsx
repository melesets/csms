// Shift manager - provides shift context and session management
import React from 'react';


export const ShiftManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // The ShiftManager was previously used to force users to select a ward.
    // In the new Department-first workflow, the Department is already the logged-in user.
    // Therefore, this component simply passes through.
    
    return (
        <>{children}</>
    );
};
