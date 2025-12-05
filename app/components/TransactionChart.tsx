"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const data = [
    {name: "Paypal", value: 35, color: "#00d25b"},
    {name: "Stripe", value: 15, color: "#ffab00"},
    {name: "Empty", value: 30, color: "#0f1116"}
]

export default function TransactionChart(){
    return(
        <div className="bg-[#191C24] p-6 rounded-md h-full flex flex-col justify-between">
            <h2 className="text-xl font-semibold mb-4 text-white">Transaction History</h2>
            <div className="relative h-[200px] w-full flex justify-center items-center">
                <ResponsiveContainer className="w-full h-full">
                    <PieChart>
                        <Pie data={data}
                            innerRadius={60}
                            outerRadius={80}
                            startAngle={90}
                            endAngle={270}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color}/>
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col item-center justify-center pointer-events-none:">
                    <span className="text-2xl font-bold text-white">$1200</span>
                    <span className="text-sm text-[#676a86]">Total</span>
                </div>
            </div>

            <div className="flex flex-col gap-4 mt-4">
                <div>
                    <p className="text-white font-medium">Transfer to Paypal</p>
                    <p className="text-xs text-[#676a86] mt-1">07 Jan 2019, 09:12AM</p>
                </div>
                <span className="text-white font-bold">$236</span>
            </div>
            
        </div>
    )
}