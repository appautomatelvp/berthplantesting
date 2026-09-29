import React from 'react';

const OperationOverview = ({ iframeRef }) => {
  return (
    <div className="absolute inset-0 bg-gray-900 border-none m-0 p-0 overflow-hidden">
        <iframe 
            ref={iframeRef}
            src="/operation.html" 
            className="w-full h-full border-0 bg-gray-900"
            title="Operation Overview"
        />
    </div>
  );
};

export default OperationOverview;
