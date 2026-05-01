import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface UseNowReturn {
  now: Date;
  formattedTime: string;
  timezone: string;
}

export function useNow(updateIntervalMs: number = 30000): UseNowReturn {
  const [now, setNow] = useState<Date>(new Date());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, updateIntervalMs);
    
    return () => clearInterval(interval);
  }, [updateIntervalMs]);
  
  return {
    now,
    formattedTime: format(now, 'HH:mm'),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
