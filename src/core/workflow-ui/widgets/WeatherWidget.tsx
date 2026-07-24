import { memo } from 'react';
import { CloudRain, Sun, Wind, Droplets } from 'lucide-react';
import { WidgetInstance } from './types';

export const WeatherWidget = memo(function WeatherWidget({ instance }: { instance: WidgetInstance }) {
 const data = instance.state || {};

 return (
 <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-black/40 p-4">
 <div className="flex items-center gap-2 text-secondary font-medium text-white/80">
 <Sun className="h-4 w-4 text-blue-400" />
 Live Weather
 </div>
 
 {data.loading ? (
 <div className="animate-pulse text-secondary text-white/60">Fetching from Open-Meteo via Execution Fabric...</div>
 ) : (
 <div className="grid grid-cols-2 gap-4">
 <div className="flex flex-col">
 <span className="text-label text-white/50">Temperature</span>
 <span className="text-page font-light tracking-tight">{data.temperature || '--'}°C</span>
 </div>
 <div className="flex flex-col">
 <span className="text-label text-white/50">Wind Speed</span>
 <span className="text-page font-light tracking-tight">{data.wind_speed || '--'} km/h</span>
 </div>
 </div>
 )}
 </div>
 );
});
