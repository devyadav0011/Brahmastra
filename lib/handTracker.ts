import { Hands, Results, HAND_CONNECTIONS } from '@mediapipe/hands';

// Polyfill for Emscripten Module.arguments issue
if (typeof window !== 'undefined') {
  (window as any).arguments = (window as any).arguments || [];
}

let handsInstance: Hands | null = null;
let listeners: ((results: Results) => void)[] = [];
let isInitialized = false;

export const getHandTracker = () => {
  if (!handsInstance) {
    handsInstance = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    handsInstance.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    handsInstance.onResults((results) => {
      listeners.forEach(listener => listener(results));
    });
  }
  return handsInstance;
};

export const subscribeToHands = (callback: (results: Results) => void) => {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
};

export const startHandTracking = async (videoElement: HTMLVideoElement) => {
  const hands = getHandTracker();
  if (!isInitialized) {
    // We don't need to do much here, just ensure it's ready
    isInitialized = true;
  }
  
  const sendFrame = async () => {
    if (videoElement.readyState === 4) {
      await hands.send({ image: videoElement });
    }
    if (isInitialized) {
      requestAnimationFrame(sendFrame);
    }
  };
  
  sendFrame();
};

export const stopHandTracking = () => {
  isInitialized = false;
};

export { HAND_CONNECTIONS };
