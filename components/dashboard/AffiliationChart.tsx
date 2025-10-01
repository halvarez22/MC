import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AffiliationChartProps {
  data: { month: string; count: number }[];
}

const AffiliationChart: React.FC<AffiliationChartProps> = ({ data }) => {
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{
            top: 5,
            right: 20,
            left: -10,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 12 }} />
          <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '14px' }} />
          <Bar dataKey="count" fill="#ff5f00" name="Nuevos Afiliados" barSize={30} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AffiliationChart;