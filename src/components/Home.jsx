import React from "react";

const Home = ({ setSection }) => {
  const features = [
    {
      id: "form",
      title: "AI Form Analyzer",
      icon: "🏋️",
      desc: "Real-time posture correction using AI pose detection",
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    {
      id: "nutrition",
      title: "Daily Calorie Guide",
      icon: "🍎",
      desc: "Track daily intake & get smart calorie suggestions",
      gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    },
    {
      id: "scanner",
      title: "Food Calorie Scanner",
      icon: "📸",
      desc: "Capture food image & estimate calories instantly",
      gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    },
    {
      id: "wearable",
      title: "Wearable Insights",
      icon: "⌚",
      desc: "Analyze sleep, steps & activity to optimize recovery",
      gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    },
    {
      id: "planner",
      title: "Workout Planner",
      icon: "📅",
      desc: "AI-generated workout plan for your next session",
      gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    },
  ];

  return (
    <div className="home-page">
      {/* Header */}
      <div className="home-header">
        <div className="brain-emoji">🧠</div>
        <h1 className="main-title">AI Gym Trainer</h1>
        <p className="main-subtitle">
          Your complete intelligent fitness companion
        </p>
      </div>

      {/* Feature Cards */}
      <div className="features-grid">
        {features.map((feature, index) => (
          <div
            key={feature.id}
            onClick={() => setSection(feature.id)}
            className="feature-card"
            style={{
              animationDelay: `${index * 0.1}s`,
            }}
          >
            {/* Gradient accent bar */}
            <div
              className="card-gradient-bar"
              style={{ background: feature.gradient }}
            />

            {/* Icon */}
            <div className="feature-icon">{feature.icon}</div>

            {/* Title */}
            <h3 className="feature-title">{feature.title}</h3>

            {/* Description */}
            <p className="feature-desc">{feature.desc}</p>

            {/* Hover arrow indicator */}
            <div className="feature-arrow">Get Started →</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;