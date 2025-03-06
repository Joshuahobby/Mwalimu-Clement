import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TimerProps {
  startTime: string;
  duration: number; // in milliseconds
  onTimeUp?: () => void;
  isPaused?: boolean;
  simulationId?: number;
  recoveryToken?: string;
  onRecoveryTokenUpdate?: (token: string) => void;
}

const TWENTY_MINUTES = 20 * 60 * 1000; // 20 minutes in milliseconds
const HEARTBEAT_INTERVAL = 30 * 1000; // Send heartbeat every 30 seconds

const Timer: React.FC<TimerProps> = ({ 
  startTime, 
  duration = TWENTY_MINUTES,
  onTimeUp, 
  isPaused = false, 
  simulationId, 
  recoveryToken, 
  onRecoveryTokenUpdate 
}) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [warningShown, setWarningShown] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();
  const heartbeatRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  useEffect(() => {
    // Calculate initial time left based on start time and duration
    const start = new Date(startTime).getTime();
    const now = new Date().getTime();
    const elapsed = now - start;
    const remaining = Math.max(0, duration - elapsed);
    setTimeLeft(remaining);
  }, [startTime, duration]);

  // Send heartbeat to server
  const sendHeartbeat = async () => {
    if (!simulationId) return;

    try {
      const response = await apiRequest("POST", `/api/simulations/${simulationId}/heartbeat`, {
        timeRemaining: timeLeft,
        recoveryToken,
      });

      if (!response.ok) {
        throw new Error('Failed to update session heartbeat');
      }

      const data = await response.json();
      if (onRecoveryTokenUpdate) {
        onRecoveryTokenUpdate(data.recoveryToken);
      }
    } catch (error) {
      console.error('Heartbeat error:', error);
      toast({
        title: "Warning",
        description: "Having trouble maintaining connection. Your progress is saved.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // Clear any existing interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    if (!isPaused && timeLeft > 0) {
      // Set up timer interval
      timerRef.current = setInterval(() => {
        setTimeLeft((prevTime) => {
          const newTime = prevTime - 1000; // Decrease by 1 second (1000ms)

          // Show warning when 5 minutes remaining
          if (!warningShown && newTime <= 5 * 60 * 1000) {
            setWarningShown(true);
            toast({
              title: "Time Warning",
              description: "5 minutes remaining!",
              variant: "destructive",
            });
          }

          // Handle time up
          if (newTime <= 0) {
            if (onTimeUp) {
              onTimeUp();
            }
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            if (heartbeatRef.current) {
              clearInterval(heartbeatRef.current);
            }
            return 0;
          }

          return newTime;
        });
      }, 1000);

      // Set up heartbeat interval if simulation mode
      if (simulationId) {
        sendHeartbeat(); // Initial heartbeat
        heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
      }
    }

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [onTimeUp, isPaused, timeLeft, warningShown, simulationId]);

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