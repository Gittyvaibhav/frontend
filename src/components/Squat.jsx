import React, { useRef, useEffect, useState, useCallback } from "react";
import { Pose } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { Camera } from "@mediapipe/camera_utils";
import { calculateAngle } from "../utils/angleCalculator";
import { RepCounter, startSession, updateSession, completeSession } from "../utils/workoutEngine";
import getApiBase from "../utils/apiBase";

const API_BASE = getApiBase();

const Squat = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const cameraRef = useRef(null);
  const poseRef = useRef(null);
  const activeRef = useRef(false);

  const [isActive, setIsActive] = useState(false);
  const [kneeAngle, setKneeAngle] = useState("-");
  const [hipAngle, setHipAngle] = useState("-");
  const [backAngle, setBackAngle] = useState("-");
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

  // 🔥 SAVE WORKOUT
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
          exercise: "squat",
          reps: 0,
          duration: 60,
        }),
      });
      console.log("Squat workout saved");
    } catch (error) {
      console.error("Error saving workout:", error);
    }
  };

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
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    poseRef.current.onResults((results) => {
      if (!activeRef.current) return;
      if (!canvasRef.current) return;

      const canvasCtx = canvasRef.current.getContext("2d");
      if (!canvasCtx) return;

      canvasCtx.save();
      const canvasWidth = canvasRef.current.width;
      const canvasHeight = canvasRef.current.height;

      canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      canvasCtx.drawImage(results.image, 0, 0, canvasWidth, canvasHeight);

      if (!results.poseLandmarks) {
        canvasCtx.restore();
        return;
      }

      const landmarks = results.poseLandmarks;

      const shoulder = landmarks[12];
      const hip = landmarks[24];
      const knee = landmarks[26];
      const ankle = landmarks[28];

      if (!shoulder || !hip || !knee || !ankle) {
        canvasCtx.restore();
        return;
      }

      const kneeVal = calculateAngle(hip, knee, ankle);
      const hipVal = calculateAngle(shoulder, hip, knee);

      const verticalPoint = {
        x: hip.x,
        y: hip.y - 0.1,
      };

      const backVal = calculateAngle(shoulder, hip, verticalPoint);

      if (!isNaN(kneeVal) && !isNaN(hipVal) && !isNaN(backVal)) {
        setKneeAngle(kneeVal.toFixed(1));
        setHipAngle(hipVal.toFixed(1));
        setBackAngle(backVal.toFixed(1));

        // 🔥 Real-time feedback
        if (kneeVal > 160) {
          setFeedback("Stand straight and begin squat");
        } else if (kneeVal > 120) {
          setFeedback("Go deeper");
        } else if (backVal > 35) {
          setFeedback("Keep your chest upright");
        } else if (kneeVal <= 110 && backVal <= 25) {
          setFeedback("Great form 🔥");
        } else {
          setFeedback("Control your movement");
        }
        // Update rep counter with knee angle (primary angle)
        if (repCounterRef.current) repCounterRef.current.update(kneeVal);
      }

      drawConnectors(canvasCtx, landmarks, Pose.POSE_CONNECTIONS);
      drawLandmarks(canvasCtx, landmarks);

      canvasCtx.restore();
    });
    return () => {
      window.removeEventListener("resize", updateCanvasSize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateCanvasSize);
      }
    };
  }, [updateCanvasSize]);

  const startCamera = () => {
    if (!videoRef.current) return;

    setIsActive(true);
    activeRef.current = true;
    setFeedback("Stand straight to begin");
    // create rep counter and start a session
    repCounterRef.current = new RepCounter({ onRep: async (count) => {
      setReps(count);
      // send incremental update to backend
      try {
        if (sessionIdRef.current) await updateSession(sessionIdRef.current, { reps: count });
      } catch (e) {
        console.error('Update session failed', e);
      }
    }});

    // start session on server
    startSession('squat').then((doc) => {
      sessionIdRef.current = doc.sessionId;
      // start duration timer
      durationRef.current = 0;
      durationTimerRef.current = setInterval(async () => {
        durationRef.current += 1;
        try {
          if (sessionIdRef.current) await updateSession(sessionIdRef.current, { duration: durationRef.current });
        } catch (e) { console.error('Duration update failed', e); }
      }, 1000);
    }).catch(e => console.error('Start session failed', e));

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

  const stopCamera = async () => {
    setIsActive(false);
    activeRef.current = false;

    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }

    setKneeAngle("-");
    setHipAngle("-");
    setBackAngle("-");
    setFeedback("Workout stopped");

    if (canvasRef.current) {
      const canvasCtx = canvasRef.current.getContext("2d");
      const canvasWidth = canvasRef.current.width;
      const canvasHeight = canvasRef.current.height;
      canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    }

    // complete session on server
    try {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      if (sessionIdRef.current) {
        await completeSession(sessionIdRef.current, { reps, duration: durationRef.current });
      } else {
        // fallback to saveWorkout if sessionId missing
        await saveWorkout();
      }
    } catch (e) {
      console.error('Complete session failed', e);
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
        <button onClick={startCamera} style={{ marginTop: "20px" }}>
          Start Squat
        </button>
      ) : (
        <button onClick={stopCamera} style={{ marginTop: "20px" }}>
          Stop
        </button>
      )}

      {isActive && (
        <div style={{ marginTop: "20px" }}>
          <h2>Knee Angle: {kneeAngle}°</h2>
          <h2>Hip Angle: {hipAngle}°</h2>
          <h2>Back Angle: {backAngle}°</h2>

          <h2>Reps: {reps}</h2>
          <h2>Duration: {durationRef.current}s</h2>

          <h3 style={{ color: "lime", marginTop: "15px" }}>
            {feedback}
          </h3>
        </div>
      )}
    </div>
  );
};

export default Squat;
