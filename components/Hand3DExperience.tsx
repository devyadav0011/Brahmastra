import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Webcam from 'react-webcam';
import * as drawingUtils from '@mediapipe/drawing_utils';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Float, Line } from '@react-three/drei';
import * as THREE from 'three';
import { cn } from '../lib/utils';
import { getHandTracker, subscribeToHands, HAND_CONNECTIONS } from '../lib/handTracker';
import { Results } from '@mediapipe/hands';

interface Point3D {
  x: number;
  y: number;
  z: number;
  color: string;
}

const HandSkeleton = ({ landmarks }: { landmarks: any[] }) => {
  const points = useMemo(() => {
    return landmarks.map(l => new THREE.Vector3((l.x - 0.5) * 10, (0.5 - l.y) * 10, l.z * -10));
  }, [landmarks]);

  return (
    <group>
      {/* Landmarks as spheres */}
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial 
            color={i === 8 ? "#00ffff" : "#ffffff"} 
            emissive={i === 8 ? "#00ffff" : "#ffffff"} 
            emissiveIntensity={i === 8 ? 2 : 0.5} 
          />
        </mesh>
      ))}

      {/* Connections as lines */}
      {HAND_CONNECTIONS.map(([start, end], i) => (
        <Line
          key={i}
          points={[points[start], points[end]]}
          color="#00ffff"
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      ))}
    </group>
  );
};

const Structure = ({ points }: { points: Point3D[] }) => {
  return (
    <>
      {points.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={0.2} />
        </mesh>
      ))}
    </>
  );
};
export const Hand3DExperience: React.FC<{ themeColors: any }> = ({ themeColors }) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [handLandmarks, setHandLandmarks] = useState<any[]>([]);
  const [points, setPoints] = useState<Point3D[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPointTime, setLastPointTime] = useState(0);

  const onResults = useCallback((results: Results) => {
    if (!canvasRef.current || !webcamRef.current?.video) return;

    const canvasCtx = canvasRef.current.getContext('2d');
    if (!canvasCtx) return;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      setHandLandmarks(landmarks);
      
      // Draw hand landmarks on 2D canvas for feedback
      drawingUtils.drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FFFF', lineWidth: 2 });
      drawingUtils.drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1 });

      // Detect pinch (thumb tip 4 and index tip 8)
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const distance = Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) +
        Math.pow(thumbTip.y - indexTip.y, 2) +
        Math.pow(thumbTip.z - indexTip.z, 2)
      );

      const pinching = distance < 0.05;
      setIsDrawing(pinching);

      if (pinching && Date.now() - lastPointTime > 100) {
        const x = (indexTip.x - 0.5) * 10;
        const y = (0.5 - indexTip.y) * 10;
        const z = indexTip.z * -10;
        setPoints(prev => [...prev, { x, y, z, color: '#06b6d4' }]);
        setLastPointTime(Date.now());
      }
    } else {
      setHandLandmarks([]);
      setIsDrawing(false);
    }
    canvasCtx.restore();
  }, [lastPointTime]);

  useEffect(() => {
    const hands = getHandTracker();
    const unsubscribe = subscribeToHands(onResults);

    let animationFrameId: number;
    const runDetection = async () => {
      if (webcamRef.current?.video && webcamRef.current.video.readyState === 4) {
        try {
          await hands.send({ image: webcamRef.current.video });
        } catch (e) {
          console.error("MediaPipe Send Error:", e);
        }
      }
      animationFrameId = requestAnimationFrame(runDetection);
    };

    runDetection();

    return () => {
      cancelAnimationFrame(animationFrameId);
      unsubscribe();
    };
  }, [onResults]);

  return (
    <div className="relative w-full h-full bg-slate-950 rounded-[32px] overflow-hidden border border-white/10">
      {/* 3D Canvas Layer */}
      <div className="absolute inset-0 z-10">
        <Canvas shadows camera={{ position: [0, 0, 15], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
          
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          
          {handLandmarks.length > 0 && <HandSkeleton landmarks={handLandmarks} />}
          <Structure points={points} />
          
          <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
             <mesh position={[0, -5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[20, 20]} />
                <meshStandardMaterial color="#0f172a" transparent opacity={0.5} />
             </mesh>
          </Float>

          <OrbitControls makeDefault enablePan={false} />
        </Canvas>
      </div>

      {/* Webcam Feed (Background/Overlay) */}
      <div className="absolute top-4 right-4 w-48 aspect-video bg-black/60 border border-white/20 rounded-2xl overflow-hidden z-20 opacity-60 hover:opacity-100 transition-opacity">
        <Webcam
          ref={webcamRef}
          mirrored
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
          className="absolute inset-0 w-full h-full object-cover"
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
      </div>

      {/* UI Controls */}
      <div className="absolute bottom-8 left-8 right-8 z-30 flex justify-between items-end">
        <div className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">Neural 3D Sculptor</div>
          <div className="text-white/60 text-xs max-w-xs">
            Pinch your thumb and index finger to place blocks in 3D space. Move your hand to navigate.
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setPoints([])}
            className="px-6 py-3 bg-red-500/20 border border-red-500/50 text-red-500 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/30 transition-all"
          >
            Clear Structure
          </button>
          <div className={cn(
            "px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
            isDrawing ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/50 animate-pulse" : "bg-white/5 text-white/40 border-white/10"
          )}>
            {isDrawing ? "Placing Blocks..." : "Ready to Sculpt"}
          </div>
        </div>
      </div>
    </div>
  );
};
