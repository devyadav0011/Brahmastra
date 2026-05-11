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
  
  // Virtual Cursor State
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const smoothedPos = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    if (!isActive) return;

    const hands = getHandTracker();
    
    const unsubscribe = subscribeToHands((results) => {
      if (!canvasRef.current || !webcamRef.current?.video) return;

      const canvasCtx = canvasRef.current.getContext('2d');
      if (!canvasCtx) return;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        drawingUtils.drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FFFF', lineWidth: 2 });
        drawingUtils.drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1 });
        
        // --- Virtual Cursor Logic ---
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];
        
        // Smooth positioning (inverted X because of webcam mirroring)
        const targetX = 1 - indexTip.x;
        const targetY = indexTip.y;
        
        smoothedPos.current.x += (targetX - smoothedPos.current.x) * 0.3;
        smoothedPos.current.y += (targetY - smoothedPos.current.y) * 0.3;
        
        setCursorPos({ 
          x: smoothedPos.current.x * window.innerWidth, 
          y: smoothedPos.current.y * window.innerHeight 
        });

        // Pinch Detection (Click)
        const distance = Math.sqrt(
          Math.pow(thumbTip.x - indexTip.x, 2) +
          Math.pow(thumbTip.y - indexTip.y, 2)
        );
        
        const pinching = distance < 0.05;
        if (pinching && !isPinching) {
            // Click Event
            const element = document.elementFromPoint(
                smoothedPos.current.x * window.innerWidth,
                smoothedPos.current.y * window.innerHeight
            );
            if (element instanceof HTMLElement) {
                element.click();
                setLastGesture('Click (Pinch)');
            }
        }
        setIsPinching(pinching);

        if (!pinching) {
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
  }, [isActive, isPinching]);

  const detectGesture = (landmarks: any[]) => {
    if (cooldown) return;

    // Finger landmarks
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const indexUp = indexTip.y < landmarks[6].y;
    const middleUp = middleTip.y < landmarks[10].y;
    const ringUp = ringTip.y < landmarks[14].y;
    const pinkyUp = pinkyTip.y < landmarks[18].y;

    const fingersUp = [indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;

    let gesture = 'None';
    if (fingersUp === 4) {
      gesture = 'Open Hand (Scroll Up)';
      window.scrollBy({ top: -400, behavior: 'smooth' });
      triggerCooldown();
    } else if (fingersUp === 0) {
      gesture = 'Fist (Scroll Down)';
      window.scrollBy({ top: 400, behavior: 'smooth' });
      triggerCooldown();
    } else if (fingersUp === 2 && indexUp && middleUp) {
      gesture = 'Peace (Search)';
      onCommand('search manual control bypass');
      triggerCooldown();
    }

    if (gesture !== 'None') {
        setLastGesture(gesture);
    }
  };

  const triggerCooldown = () => {
    setCooldown(true);
    setTimeout(() => setCooldown(false), 1000);
  };

  return (
    <div className="relative group">
      <button
        onClick={() => setIsActive(!isActive)}
        className={cn(
          "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
          isActive 
            ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]" 
            : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
        )}
      >
        {isActive ? 'Hand Control: ACTIVE' : 'Hand Control: OFF'}
      </button>

      {isActive && (
        <>
          {/* Virtual Cursor */}
          <div 
            className={cn(
                "fixed pointer-events-none z-[9999] rounded-full border-2 transition-transform duration-75",
                isPinching ? "scale-50 bg-cyan-500 shadow-[0_0_20px_#06b6d4]" : "scale-100 bg-cyan-400/20 border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
            )}
            style={{ 
                left: `${cursorPos.x}px`, 
                top: `${cursorPos.y}px`,
                width: '16px',
                height: '16px',
                transform: `translate(-50%, -50%) ${isPinching ? 'scale(0.8)' : 'scale(1)'}`
            }}
          >
            <div className="absolute inset-0 animate-ping rounded-full bg-cyan-400/30"></div>
          </div>

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
            <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-md rounded-[12px] p-3 z-20 border border-white/10">
              <div className="flex justify-between items-center mb-1">
                <div className="text-[8px] text-white/40 uppercase font-black tracking-widest">Neural Input</div>
                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isPinching ? "bg-cyan-400" : "bg-white/20")}></div>
              </div>
              <div className="text-[10px] text-cyan-400 font-mono font-bold truncate">{lastGesture}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
