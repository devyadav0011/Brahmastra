
import cv2
import mediapipe as mp
import webview
import threading
import time
import sys
import os


mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.8,
    min_tracking_confidence=0.5
)

class BRAHMASTRACore:
    def __init__(self):
        self.window = None
        self.running = True
        self.last_gesture_time = 0
        self.camera_index = 0
        self.gesture_active = False

    def detect_stop_gesture(self, hand_landmarks):
        """
        Detects a 'Stop' gesture (Open Palm).
        Logic: All fingertips must be significantly higher than their MCP joints.
        """
        # Finger tip indices: Index=8, Middle=12, Ring=16, Pinky=20
        # Finger MCP indices: Index=5, Middle=9, Ring=13, Pinky=17
        tips = [8, 12, 16, 20]
        mcps = [5, 9, 13, 17]
        
        is_stop = True
        for tip, mcp in zip(tips, mcps):
            # In MediaPipe, Y decreases upwards. So tip.y < mcp.y means tip is above.
            if hand_landmarks.landmark[tip].y > hand_landmarks.landmark[mcp].y:
                is_stop = False
                break
        
        # Also check thumb (roughly)
        if hand_landmarks.landmark[4].x < hand_landmarks.landmark[3].x: # Right hand open
            pass # Simplified for generic stop
            
        return is_stop

    def camera_worker(self):
        """
        Background thread for computer vision.
        Handles camera errors by attempting multiple indices if the primary fails.
        """
        cap = None
        # Attempt to find an available camera
        for i in [0, 1, -1, 2]:
            try:
                # Use CAP_DSHOW on Windows for faster startup if possible
                backend = cv2.CAP_ANY
                if sys.platform == "win32":
                    backend = cv2.CAP_DSHOW
                
                temp_cap = cv2.VideoCapture(i, backend)
                if temp_cap.isOpened():
                    cap = temp_cap
                    self.camera_index = i
                    print(f"BRAHMASTRA: Optical sensor online on index {i}")
                    break
            except Exception:
                continue

        if not cap or not cap.isOpened():
            print("CRITICAL: Optical sensors could not be initialized. Device occupied or missing.")
            if self.window:
                self.window.evaluate_js("if(window.brahmastra_uplink) window.brahmastra_uplink.addLog('CRITICAL: External Camera Error. Gesture recognition disabled.');")
            return

        while self.running:
            success, frame = cap.read()
            if not success:
                print("BRAHMASTRA: Frame drop detected. Re-initializing link...")
                time.sleep(1)
                continue

            # Performance optimization: Resize for processing
            small_frame = cv2.resize(frame, (320, 240))
            rgb_frame = cv2.cvtColor(cv2.flip(small_frame, 1), cv2.COLOR_BGR2RGB)
            results = hands.process(rgb_frame)

            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    if self.detect_stop_gesture(hand_landmarks):
                        current_time = time.time()
                        # Throttle detections to avoid rapid flickering (2s cooldown)
                        if current_time - self.last_gesture_time > 2:
                            print("BRAHMASTRA: [GESTURE] STOP PROTOCOL DETECTED")
                            self.trigger_ui_mute()
                            self.last_gesture_time = current_time

            time.sleep(0.05)
        
        cap.release()

    def trigger_ui_mute(self):
        if self.window:
            # Injecting JS directly into the Webview context
            js_code = """
            if (window.brahmastra_uplink) {
                window.brahmastra_uplink.toggleMute();
                window.brahmastra_uplink.addLog('[GESTURE DETECTED: STOP PROTOCOL]');
            }
            """
            self.window.evaluate_js(js_code)

def start_brahmastra():
    core = BRAHMASTRACore()
    
    # Launch optical tracking in a separate daemon thread
    vision_thread = threading.Thread(target=core.camera_worker, daemon=True)
    vision_thread.start()

    # Create the high-tech desktop window
    # In a real environment, you'd serve the build/index.html
    # Here we assume index.html is in the same directory
    window = webview.create_window(
        'BRAHMASTRA CORE', 
        'index.html', 
        width=480, 
        height=850, 
        resizable=True,
        frameless=False, # Set to True for a real widget feel
        background_color='#020617'
    )
    core.window = window
    
    # Start webview loop
    webview.start(debug=False)
    core.running = False

if __name__ == '__main__':
    print("BRAHMASTRA OS [Initialization Sequence] ...")
    start_brahmastra()
