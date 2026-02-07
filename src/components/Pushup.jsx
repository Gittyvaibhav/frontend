import React, { useRef, useEffect, useState, useCallback } from "react";
import { Pose } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { Camera } from "@mediapipe/camera_utils";
import { calculateAngle } from "../utils/angleCalculator";
import { RepCounter, startSession, updateSession, completeSession } from "../utils/workoutEngine";
import getApiBase from "../utils/apiBase";

const API_BASE = getApiBase();

const Pushup = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const cameraRef = useRef(null);
  const poseRef = useRef(null);

  const [isActive, setIsActive] = useState(false);
  const [elbowAngle, setElbowAngle] = useState("-");
  const [bodyAngle, setBodyAngle] = useState("-");
  const [feedback, setFeedback] = useState("Click Start to begin");
  const [reps, setReps] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 480 });
  const sessionIdRef = useRef(null);
  const repCounterRef = useRef(null);
  const durationRef = useRef(0);
  const durationTimerRef = useRef(null);

  const updateCanvasSize = useCallback(() => {
    const containerWidth = containerRef.current?.clientWidth || 640;
    const width = Math.max(240, Math.min(640, containerWidth));
    const height = Math.round(width * 0.75);

    setCanvasSize({ width, height });
    if (canvasRef.current) {
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    }
  }, []);

  const saveWorkout = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      await fetch(`${API_BASE}/api/workout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          exercise: "pushup",
          reps,
          duration: durationRef.current,
        }),
      });
      console.log("Workout saved");
    } catch (error) {
      console.error("Error saving workout:", error);
    }
  };

  const handleResults = useCallback(
    (results) => {
      if (!canvasRef.current) return;

      const canvasCtx = canvasRef.current.getContext("2d");
      if (!canvasCtx) return;

      canvasCtx.save();
      const canvasWidth = canvasRef.current.width;
      const canvasHeight = canvasRef.current.height;

      canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      canvasCtx.drawImage(results.image, 0, 0, canvasWidth, canvasHeight);

      if (!results.poseLandmarks || !isActive) {
        canvasCtx.restore();
        return;
      }

      const landmarks = results.poseLandmarks;

      const shoulder = landmarks[12];
      const elbow = landmarks[14];
      const wrist = landmarks[16];
      const hip = landmarks[24];
      const ankle = landmarks[28];

      if (!shoulder || !elbow || !wrist || !hip || !ankle) {
        canvasCtx.restore();
        return;
      }

      const elbowVal = calculateAngle(shoulder, elbow, wrist);
      const bodyVal = calculateAngle(shoulder, hip, ankle);

      if (!isNaN(elbowVal) && !isNaN(bodyVal)) {
        setElbowAngle(elbowVal.toFixed(1));
        setBodyAngle(bodyVal.toFixed(1));

        if (repCounterRef.current) {
          repCounterRef.current.update(elbowVal);
        }

        if (bodyVal < 150) {
          setFeedback("Keep your body straight");
        } else if (elbowVal > 160) {
          setFeedback("Lower your body");
        } else if (elbowVal > 90) {
          setFeedback("Going down...");
        } else {
          setFeedback("Push up! 🔥");
        }
      }

      drawConnectors(canvasCtx, landmarks, Pose.POSE_CONNECTIONS);
      drawLandmarks(canvasCtx, landmarks);

      canvasCtx.restore();
    },
    [isActive]
  );

  useEffect(() => {
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateCanvasSize);
    }

    poseRef.current = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    poseRef.current.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    poseRef.current.onResults(handleResults);

    return () => {
      window.removeEventListener("resize", updateCanvasSize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateCanvasSize);
      }
    };
  }, [handleResults, updateCanvasSize]);

  const startWorkout = async () => {
    if (!videoRef.current) return;

    setIsActive(true);
    setReps(0);
    durationRef.current = 0;
    setFeedback("Turn sideways and start pushups");

    repCounterRef.current = new RepCounter({
      upThreshold: 160,
      downThreshold: 90,
      onRep: async (count) => {
        setReps(count);
        if (sessionIdRef.current) {
          await updateSession(sessionIdRef.current, { reps: count });
        }
      },
    });

    try {
      const doc = await startSession("pushup");
      sessionIdRef.current = doc.sessionId;
      console.log("🎯 Session started:", doc.sessionId);
    } catch (error) {
      console.error("❌ Failed to start session:", error);
    }

    durationTimerRef.current = setInterval(async () => {
      durationRef.current += 1;
      if (sessionIdRef.current) {
        await updateSession(sessionIdRef.current, {
          duration: durationRef.current,
        });
      }
    }, 1000);

    const width = canvasRef.current?.width || canvasSize.width;
    const height = canvasRef.current?.height || canvasSize.height;

    cameraRef.current = new Camera(videoRef.current, {
      onFrame: async () => {
        if (poseRef.current && videoRef.current) {
          await poseRef.current.send({ image: videoRef.current });
        }
      },
      width,
      height,
    });

    cameraRef.current.start();
  };

  const stopWorkout = async () => {
    setIsActive(false);
    setFeedback("Workout stopped");
    setElbowAngle("-");
    setBodyAngle("-");

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }

    if (sessionIdRef.current) {
      try {
        await completeSession(sessionIdRef.current, {
          reps,
          duration: durationRef.current,
        });
        console.log("✅ Session completed:", sessionIdRef.current);
      } catch (error) {
        console.error("❌ Failed to complete session:", error);
        // Fallback save if session fails
        await saveWorkout();
      }
    } else {
      await saveWorkout();
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      <video ref={videoRef} style={{ display: "none" }} playsInline />
      <div ref={containerRef} className="pose-stage">
        <canvas ref={canvasRef} className="pose-canvas" width="640" height="480" />
      </div>

      {!isActive ? (
        <button onClick={startWorkout} style={{ marginTop: "20px" }}>
          Start Pushups
        </button>
      ) : (
        <button onClick={stopWorkout} style={{ marginTop: "20px" }}>
          Stop
        </button>
      )}

      {isActive && (
        <div style={{ marginTop: "20px" }}>
          <h2>🔥 Reps: {reps}</h2>
          <h2>⏱️ Duration: {durationRef.current}s</h2>
          <h2>Elbow Angle: {elbowAngle}°</h2>
          <h2>Body Alignment: {bodyAngle}°</h2>
          <h3 style={{ color: "lime" }}>{feedback}</h3>
        </div>
      )}
    </div>
  );
};

export default Pushup;
