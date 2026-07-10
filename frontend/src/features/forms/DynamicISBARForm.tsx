// Dynamic ISBAR form wrapper - loads and renders template-based forms
import React from 'react';
import { DynamicFormSystem } from './DynamicFormSystem';

export const DynamicISBARForm = () => {
  const handleFormSubmit = (data: any) => {
    console.log('Form submitted:', data);
    // Additional handling if needed
  };

  return (
    <div>
      <DynamicFormSystem onFormSubmit={handleFormSubmit} />
    </div>
  );
};
