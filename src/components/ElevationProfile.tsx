import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface ElevationProfileProps {
  data: any[];
}

export function ElevationProfile({ data }: ElevationProfileProps) {
  if (!data || data.length === 0) return null;

  // Normalize data for chart
  // Elevation in feet
  const chartData = data.map((d, index) => ({
    index,
    elevation: Math.round(d.elevation * 3.28084),
    label: `${index}`
  }));

  const minElevation = Math.min(...chartData.map(d => d.elevation));
  const maxElevation = Math.max(...chartData.map(d => d.elevation));
  
  // Padding for the chart
  const domain = [Math.floor(minElevation * 0.95), Math.ceil(maxElevation * 1.05)];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Elevation Profile (ft)</span>
        <div className="flex gap-2">
           <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[10px] text-gray-500">Route Gradient</span>
           </div>
        </div>
      </div>
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorElevation" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
            <XAxis dataKey="label" hide />
            <YAxis 
               hide 
               domain={domain}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white border border-gray-100 p-2 rounded-lg shadow-xl text-[10px]">
                      <p className="font-bold text-gray-900">{payload[0].value} ft</p>
                      <p className="text-gray-400">elevation</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area 
              type="monotone" 
              dataKey="elevation" 
              stroke="#3b82f6" 
              fillOpacity={1} 
              fill="url(#colorElevation)" 
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
