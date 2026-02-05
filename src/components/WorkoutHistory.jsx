import React, { useEffect, useState } from "react";
import getApiBase from "../utils/apiBase";

const API_BASE = getApiBase();

const WorkoutHistory = () => {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWorkouts = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API_BASE}/api/workout`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("✅ Workouts fetched:", data);
        setWorkouts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("❌ Failed to fetch workouts:", err);
        setError(`Connection failed: ${err.message}`);
        setWorkouts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkouts();

    const interval = setInterval(fetchWorkouts, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ marginTop: "40px", padding: "20px" }}>
      <h2>💪 Workout History</h2>

      {loading && <p>⏳ Loading...</p>}

      {error && (
        <p style={{ color: "#ff6b6b" }}>
          ⚠️ {error}
        </p>
      )}

      {!loading && !error && workouts.length === 0 && (
        <p style={{ color: "#aaa" }}>
          No workouts yet. Start a workout to see history here!
        </p>
      )}

      {!loading && workouts.length > 0 && (
        <div>
          <p style={{ color: "#4CAF50", marginBottom: "15px" }}>
            Found {workouts.length} workout(s)
          </p>
          {workouts.map((workout) => (
            <div
              key={workout._id}
              style={{
                padding: "15px",
                margin: "10px 0",
                background: "rgba(255,255,255,0.05)",
                borderRadius: "8px",
                borderLeft: "4px solid #4CAF50",
              }}
            >
              <p>
                <strong>Exercise:</strong> {workout.exercise || "Unknown"}
              </p>
              <p>
                <strong>Reps:</strong> {workout.reps || 0}
              </p>
              <p>
                <strong>Duration:</strong> {workout.duration || 0}s
              </p>
              {workout.sessionId && (
                <p>
                  <strong>Session:</strong> {workout.sessionId}
                </p>
              )}
              <p style={{ fontSize: "0.9em", color: "#aaa" }}>
                <strong>Date:</strong> {new Date(workout.date).toLocaleString()}
              </p>
              {workout.status && (
                <p style={{ fontSize: "0.85em", color: "#4CAF50" }}>
                  <strong>Status:</strong> {workout.status}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkoutHistory;
