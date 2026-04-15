import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import * as drawingUtils from '@mediapipe/drawing_utils';
import { cn } from '../lib/utils';
import { getHandTracker, subscribeToHands, HAND_CONNECTIONS } from '../lib/handTracker';

interface GestureControlProps {
  onCommand: (cmd: string) => void;
  themeColors: any;
}

export const GestureControl: React.FC<GestureControlProps> = ({ onCommand, themeColors }) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [lastGesture, setLastGesture] = useState<string>('None');
  const [cooldown, setCooldown] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    const hands = getHandTracker();
    
    const unsubscribe = subscribeToHands((results) => {
      if (!canvasRef.current || !webcamRef.current?.video) return;

      const canvasCtx = canvasRef.current.getContext('2d');
      if (!canvasCtx) return;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
          drawingUtils.drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FFFF', lineWidth: 2 });
          drawingUtils.drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1 });
          
          detectGesture(landmarks);
        }
      }
      canvasCtx.restore();
    });

    let animationFrameId: number;
    const runDetection = async () => {
      if (webcamRef.current?.video && webcamRef.current.video.readyState === 4) {
        try {
          await hands.send({ image: webcamRef.current.video });
        } catch (e) {
          console.error("MediaPipe Send Error:", e);
        }
      }
      if (isActive) {
        animationFrameId = requestAnimationFrame(runDetection);
      }
    };

    runDetection();

    return () => {
      cancelAnimationFrame(animationFrameId);
      unsubscribe();
    };
  }, [isActive]);

  const detectGesture = (landmarks: any[]) => {
    if (cooldown) return;

    // Simple finger counting logic
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const indexUp = indexTip.y < landmarks[6].y;
    const middleUp = middleTip.y < landmarks[10].y;
    const ringUp = ringTip.y < landmarks[14].y;
    const pinkyUp = pinkyTip.y < landmarks[18].y;
    const thumbUp = thumbTip.x < landmarks[3].x; // Simplified

    const fingersUp = [indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;

    let gesture = 'None';
    if (fingersUp === 4) {
      gesture = 'Open Hand (Scroll Up)';
      window.scrollBy({ top: -300, behavior: 'smooth' });
      triggerCooldown();
    } else if (fingersUp === 0) {
      gesture = 'Fist (Scroll Down)';
      window.scrollBy({ top: 300, behavior: 'smooth' });
      triggerCooldown();
    } else if (fingersUp === 1 && indexUp) {
      gesture = 'Pointing (Search)';
      onCommand('search latest tech news');
      triggerCooldown();
    } else if (fingersUp === 2 && indexUp && middleUp) {
      gesture = 'Peace (Reload)';
      onCommand('reload');
      triggerCooldown();
    }

    setLastGesture(gesture);
  };

  const triggerCooldown = () => {
    setCooldown(true);
    setTimeout(() => setCooldown(false), 1500);
  };

  return (
    <div className="relative group">
      <button
        onClick={() => setIsActive(!isActive)}
        className={cn(
          "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
          isActive 
            ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/50" 
            : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
        )}
      >
        {isActive ? 'Gesture: ON' : 'Gesture: OFF'}
      </button>

      {isActive && (
        <div className="fixed bottom-24 right-8 w-64 aspect-video bg-black/80 border border-white/20 rounded-2xl overflow-hidden shadow-2xl z-50">
          <Webcam
            ref={webcamRef}
            mirrored
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
            className="absolute inset-0 w-full h-full object-cover opacity-40"
            disablePictureInPicture={true}
            forceScreenshotSourceSize={false}
            imageSmoothing={true}
            onUserMedia={() => {}}
            onUserMediaError={() => {}}
            screenshotQuality={1}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full z-10"
            width={640}
            height={480}
          />
          <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-md rounded-lg p-2 z-20 border border-white/10">
            <div className="text-[8px] text-white/40 uppercase font-bold mb-1">Detected Gesture</div>
            <div className="text-xs text-cyan-400 font-mono font-bold truncate">{lastGesture}</div>
          </div>
        </div>
      )}
    </div>
  );
};
