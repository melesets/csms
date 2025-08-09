import React from 'react';
import { DynamicFormSystem } from './DynamicFormSystem';

export const DynamicISBARForm = () => {
  const handleFormSubmit = (data: any) => {
    console.log('Form submitted:', data);
    // Additional handling if needed
  };

  return (
    <div className="max-w-6xl mx-auto">
      <DynamicFormSystem onFormSubmit={handleFormSubmit} />
    </div>
  );
};