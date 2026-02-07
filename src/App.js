import React, { useEffect, useState } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import Home from "./components/Home";
import Squat from "./components/Squat";
import Pushup from "./components/Pushup";
import WorkoutHistory from "./components/WorkoutHistory";
import Nutrition from "./components/Nutrition";
import FoodScanner from "./components/FoodScanner";
import WearableInsights from "./components/WearableInsights";
import WorkoutPlanner from "./components/WorkoutPlanner";
import Auth from "./components/Auth";
import "./App.css";

function App() {
  const [section, setSection] = useState("home");
  const [exercise, setExercise] = useState("squat");
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [googleLoadError, setGoogleLoadError] = useState("");

  // ✅ Safe environment variable usage
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
  const apiBase = process.env.REACT_APP_API_URL || "";

  const authErrorMessage = !clientId
    ? "Missing Google Client ID. Please configure REACT_APP_GOOGLE_CLIENT_ID in Vercel."
    : googleLoadError;

  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("auth_user");

    if (!storedToken) {
      setAuthLoading(false);
      return;
    }

    setAuthToken(storedToken);
    if (storedUser) {
      try {
        setAuthUser(JSON.parse(storedUser));
      } catch (err) {
        setAuthUser(null);
      }
    }

    fetch(`${apiBase}/api/users/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid token");
        return res.json();
      })
      .then((data) => {
        if (data.user) {
          setAuthUser(data.user);
          localStorage.setItem("auth_user", JSON.stringify(data.user));
        }
      })
      .catch(() => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        setAuthToken(null);
        setAuthUser(null);
      })
      .finally(() => setAuthLoading(false));
  }, [apiBase]);

  const exercises = [
    {
      id: "squat",
      name: "Squat",
      icon: "🏋️",
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      description: "Lower body strength",
    },
    {
      id: "pushup",
      name: "Push-Up",
      icon: "💪",
      gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      description: "Upper body power",
    },
  ];

  /* ---------------- FORM SECTION ---------------- */

  const renderFormSection = () => (
    <>
      <button onClick={() => setSection("home")} className="back-button">
        ⬅ Back
      </button>

      <div className="section-header">
        <h1>AI Form Analyzer</h1>
        <p className="section-subtitle">
          Perfect your form with real-time AI feedback
        </p>
      </div>

      <div className="exercise-selector">
        {exercises.map((ex) => (
          <div
            key={ex.id}
            onClick={() => setExercise(ex.id)}
            className="exercise-card"
            style={{
              background:
                exercise === ex.id
                  ? ex.gradient
                  : "rgba(255,255,255,0.05)",
            }}
          >
            <div className="exercise-icon">{ex.icon}</div>
            <h3>{ex.name}</h3>
            <p>{ex.description}</p>
          </div>
        ))}
      </div>

      <div className="analyzer-container">
        {exercise === "squat" && <Squat />}
        {exercise === "pushup" && <Pushup />}
      </div>

      <div className="history-container">
        <WorkoutHistory authToken={authToken} />
      </div>
    </>
  );

  /* ---------------- NUTRITION SECTION ---------------- */

  const renderNutritionSection = () => (
    <>
      <button onClick={() => setSection("home")} className="back-button">
        ⬅ Back
      </button>

      <div className="section-header">
        <h1>Calorie & Meal Planner</h1>
        <p className="section-subtitle">
          Calculate calories and generate smart meal plans
        </p>
      </div>

      <Nutrition />
    </>
  );

  /* ---------------- FOOD SCANNER SECTION ---------------- */

  const renderScannerSection = () => (
    <>
      <button onClick={() => setSection("home")} className="back-button">
        ⬅ Back
      </button>

      <div className="section-header">
        <h1>Food Calorie Scanner</h1>
        <p className="section-subtitle">
          Upload food image and estimate calories instantly
        </p>
      </div>

      <FoodScanner />
    </>
  );

  /* ---------------- ROUTER ---------------- */

  const renderSection = () => {
    if (authLoading) {
      return (
        <div className="auth-loading">
          <div className="loading" />
          <span>Loading your account...</span>
        </div>
      );
    }

    if (!authToken) {
      return (
        <Auth
          onAuthSuccess={({ token, user }) => {
            setAuthToken(token);
            setAuthUser(user || null);
            setAuthLoading(false);
            setSection("home");
          }}
        />
      );
    }
    switch (section) {
      case "form":
        return renderFormSection();

      case "nutrition":
        return renderNutritionSection();

      case "scanner":
        return renderScannerSection();

      case "wearable":
        return (
          <>
            <button
              onClick={() => setSection("home")}
              className="back-button"
            >
              ⬅ Back
            </button>
            <WearableInsights
              authReady={isGoogleReady}
              authError={authErrorMessage}
            />
          </>
        );

      case "planner":
        return (
          <>
            <button
              onClick={() => setSection("home")}
              className="back-button"
            >
              ⬅ Back
            </button>
            <WorkoutPlanner />
          </>
        );

      default:
        return <Home setSection={setSection} />;
    }
  };

  const appBody = (
    <div className="app-container">
      <div className="glow-top" />
      <div className="glow-bottom" />
      <div className="content-wrapper">
        {authToken && (
          <div className="auth-topbar">
            <div className="auth-user">
              <span className="auth-user-name">
                {authUser?.name || authUser?.email || "User"}
              </span>
            </div>
            <button
              className="secondary-button auth-logout"
              onClick={() => {
                localStorage.removeItem("auth_token");
                localStorage.removeItem("auth_user");
                setAuthToken(null);
                setAuthUser(null);
                setSection("home");
              }}
            >
              Log out
            </button>
          </div>
        )}
        {renderSection()}
      </div>
    </div>
  );

  if (!clientId) {
    return appBody;
  }

  return (
    <GoogleOAuthProvider
      clientId={clientId}
      onScriptLoadSuccess={() => setIsGoogleReady(true)}
      onScriptLoadError={() =>
        setGoogleLoadError(
          "Google Identity Services failed to load. Please refresh."
        )
      }
    >
      {appBody}
    </GoogleOAuthProvider>
  );
}

export default App;
