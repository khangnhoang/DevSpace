"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface ChartProps {
  data: { name: string; value: number; color: string; percentage?: string }[];
}

export default function TransactionChart({ data }: ChartProps) {
  const totalValue = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className="bg-[#191C24] p-6 rounded-md h-full flex flex-col justify-between">
      <h2 className="text-xl font-semibold mb-4 text-white">
        Tỷ lệ đăng ký
      </h2>
      <div className="relative h-[200px] w-full flex justify-center items-center">
        <ResponsiveContainer className="w-full h-full">
          <PieChart>
            <Pie
              data={data}
              innerRadius={60}
              outerRadius={80}
              startAngle={90}
              endAngle={450}
              dataKey="value"
              stroke="none"
              paddingAngle={5}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f1116', border: 'none', borderRadius: '8px'}} 
              itemStyle={{color: '#fff'}}
              formatter={(value: number) => [`${value} học viên`, 'Số lượng']}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-white">{totalValue}</span>
          <span className="text-sm text-[#676a86]">Lượt đăng ký</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 mt-4 overflow-y-auto max-h-[150px] pr-2 custom-scrollbar">
        {data.map((item, index) => (
            <div key={index} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></div>
                    <p className="text-white font-medium text-sm truncate max-w-[150px]" title={item.name}> {item.name}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-white font-bold text-sm">{item.value}</span>
                  <span className="text-xs text-gray-500">{item.percentage}%</span>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}