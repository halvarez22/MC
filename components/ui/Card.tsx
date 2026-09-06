import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white dark:bg-gray-900 dark:border dark:border-gray-800 rounded-lg shadow-md dark:shadow-none p-4 sm:p-6 text-gray-900 dark:text-gray-100 ${className}`}>
      {children}
    </div>
  );
};

export default Card;
