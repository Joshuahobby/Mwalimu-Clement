import React, { useState, useEffect, useRef } from 'react';

interface TimerProps {
  startTime: string;
  duration: number; // in milliseconds
  onTimeUp?: () => void;
  isPaused?: boolean;
}

const Timer = ({ startTime, duration, onTimeUp, isPaused = false }: TimerProps) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [warningShown, setWarningShown] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Calculate initial time left with server time sync
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const start = new Date(startTime).getTime();
      const elapsed = now - start;
      return Math.max(0, duration - elapsed);
    };

    // Set initial time
    setTimeLeft(calculateTimeLeft());

    // Clear any existing interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (!isPaused) {
      // Set up new interval
      timerRef.current = setInterval(() => {
        const remaining = calculateTimeLeft();
        setTimeLeft(remaining);

        // Show warning when 5 minutes remaining
        if (!warningShown && remaining <= 5 * 60 * 1000) {
          setWarningShown(true);
        }

        // Handle time up
        if (remaining <= 0) {
          if (onTimeUp) {
            onTimeUp();
          }
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
        }
      }, 1000);
    }

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [startTime, duration, onTimeUp, isPaused, warningShown]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Different colors based on time remaining
  let colorClass = "text-green-500";
  if (timeLeft < 60000) colorClass = "text-red-500 animate-pulse";
  else if (timeLeft < 180000) colorClass = "text-amber-500";

  return (
    <div className="text-center">
      <div className={`text-2xl font-mono font-bold ${colorClass}`}>
        {formattedTime}
      </div>
    </div>
  );
};

export default Timer;