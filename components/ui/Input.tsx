import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, id, error, ...props }) => {
  const errorClasses =
    'border-red-500 text-red-900 dark:text-red-200 placeholder-red-300 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-950';
  const defaultClasses =
    'border-gray-300 dark:border-gray-600 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-primary focus:border-primary bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100';

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <div className="mt-1">
        <input
          id={id}
          {...props}
          className={`appearance-none block w-full px-3 py-3 border rounded-md shadow-sm text-base sm:text-sm min-h-[44px] ${error ? errorClasses : defaultClasses}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      {error && <p id={`${id}-error`} className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default Input;
