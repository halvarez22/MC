import React from 'react';
import Card from '../ui/Card';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactElement<{ className?: string }>;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon }) => {
  const colorClass =
    'bg-primary-lightest text-primary-dark dark:bg-primary/20 dark:text-primary-light';

  return (
    <Card>
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${colorClass}`}>
          {React.cloneElement(icon, { className: 'h-8 w-8' })}
        </div>
        <div className="ml-4 min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-300 truncate">
            {title}
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default StatCard;
