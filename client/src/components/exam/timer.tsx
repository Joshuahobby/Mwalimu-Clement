import React, { useState, useEffect } from 'react';

interface TimerProps {
  initialTime: number; // in seconds
  onTimeUp?: () => void;
  isPaused?: boolean;
}

const Timer = ({ initialTime, onTimeUp, isPaused = false }: TimerProps) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (onTimeUp) onTimeUp();
      return;
    }

    if (isPaused) return;

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onTimeUp, isPaused]);

  // Reset timer if initialTime changes
  useEffect(() => {
    setTimeLeft(initialTime);
  }, [initialTime]);

  // Format time as MM:SS
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Different colors based on time remaining
  let colorClass = "text-green-500";
  if (timeLeft < 60) colorClass = "text-red-500 animate-pulse";
  else if (timeLeft < 180) colorClass = "text-amber-500";

  return (
    <div className="text-center">
      <div className={`text-2xl font-mono font-bold ${colorClass}`}>
        {formattedTime}
      </div>
    </div>
  );
};

export default Timer;