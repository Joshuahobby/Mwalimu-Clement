import React, { useState, useEffect, useRef } from 'react';

interface TimerProps {
  startTime: string;
  duration: number; // in milliseconds
  onTimeUp?: () => void;
  isPaused?: boolean;
}

const TWENTY_MINUTES = 20 * 60 * 1000; // 20 minutes in milliseconds

const Timer = ({ onTimeUp, isPaused = false }: TimerProps) => {
  const [timeLeft, setTimeLeft] = useState(TWENTY_MINUTES);
  const [warningShown, setWarningShown] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Clear any existing interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (!isPaused) {
      // Set up new interval
      timerRef.current = setInterval(() => {
        setTimeLeft((prevTime) => {
          const newTime = prevTime - 1000; // Decrease by 1 second (1000ms)

          // Show warning when 5 minutes remaining
          if (!warningShown && newTime <= 5 * 60 * 1000) {
            setWarningShown(true);
          }

          // Handle time up
          if (newTime <= 0) {
            if (onTimeUp) {
              onTimeUp();
            }
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            return 0;
          }

          return newTime;
        });
      }, 1000);
    }

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [onTimeUp, isPaused, warningShown]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Different colors based on time remaining
  let colorClass = "text-green-500";
  if (timeLeft < 60000) colorClass = "text-red-500 animate-pulse"; // Last minute
  else if (timeLeft < 300000) colorClass = "text-amber-500"; // Last 5 minutes

  return (
    <div className="text-center">
      <div className={`text-2xl font-mono font-bold ${colorClass}`}>
        {formattedTime}
      </div>
    </div>
  );
};

export default Timer;