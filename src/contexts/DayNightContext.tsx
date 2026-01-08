import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type TimeOfDay = 'day' | 'night' | 'dawn' | 'dusk';

interface DayNightContextType {
  timeOfDay: TimeOfDay;
  isNight: boolean;
  isDay: boolean;
  isDawn: boolean;
  isDusk: boolean;
  hour: number;
  skyGradient: string;
  starsOpacity: number;
  sunMoonPosition: number;
}

const DayNightContext = createContext<DayNightContextType | undefined>(undefined);

export const DayNightProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [hour, setHour] = useState(new Date().getHours());
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day');

  useEffect(() => {
    const updateTime = () => {
      const currentHour = new Date().getHours();
      setHour(currentHour);

      if (currentHour >= 6 && currentHour < 8) {
        setTimeOfDay('dawn');
      } else if (currentHour >= 8 && currentHour < 18) {
        setTimeOfDay('day');
      } else if (currentHour >= 18 && currentHour < 20) {
        setTimeOfDay('dusk');
      } else {
        setTimeOfDay('night');
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);

    return () => clearInterval(interval);
  }, []);

  const getSkyGradient = (): string => {
    switch (timeOfDay) {
      case 'dawn':
        return 'linear-gradient(180deg, #1a1a3e 0%, #4a3f6b 20%, #f4a460 50%, #87ceeb 100%)';
      case 'day':
        return 'linear-gradient(180deg, #1e90ff 0%, #87ceeb 30%, #b0e0e6 60%, #f0f8ff 100%)';
      case 'dusk':
        return 'linear-gradient(180deg, #2c1654 0%, #8b4513 30%, #ff6347 50%, #ffa07a 70%, #4682b4 100%)';
      case 'night':
      default:
        return 'linear-gradient(180deg, #000011 0%, #0a0a2e 30%, #1a1a3e 60%, #0d3b44 100%)';
    }
  };

  const getStarsOpacity = (): number => {
    switch (timeOfDay) {
      case 'night': return 1;
      case 'dusk': return 0.5;
      case 'dawn': return 0.3;
      case 'day': return 0;
      default: return 0;
    }
  };

  const getSunMoonPosition = (): number => {
    if (hour >= 6 && hour <= 18) {
      return ((hour - 6) / 12) * 100;
    } else {
      const nightHour = hour >= 18 ? hour - 18 : hour + 6;
      return (nightHour / 12) * 100;
    }
  };

  const value: DayNightContextType = {
    timeOfDay,
    isNight: timeOfDay === 'night',
    isDay: timeOfDay === 'day',
    isDawn: timeOfDay === 'dawn',
    isDusk: timeOfDay === 'dusk',
    hour,
    skyGradient: getSkyGradient(),
    starsOpacity: getStarsOpacity(),
    sunMoonPosition: getSunMoonPosition(),
  };

  return (
    <DayNightContext.Provider value={value}>
      {children}
    </DayNightContext.Provider>
  );
};

export const useDayNight = () => {
  const context = useContext(DayNightContext);
  if (!context) {
    throw new Error('useDayNight must be used within a DayNightProvider');
  }
  return context;
};
