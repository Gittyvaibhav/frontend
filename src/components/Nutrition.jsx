import React, { useState } from "react";
import getApiBase from "../utils/apiBase";

const API_BASE = getApiBase();

const Nutrition = () => {
  const [form, setForm] = useState({
    weight: "",
    height: "",
    age: "",
    gender: "male",
    activityLevel: "moderate",
    goal: "maintain",
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);


  const handleGenerate = async () => {
    const weight = Number(form.weight);
    const height = Number(form.height);
    const age = Number(form.age);

    if (!weight || !height || !age) {
      alert("Please fill all fields");
      return;
    }

    setLoading(true);

    try {
      // 🤖 USE HUGGING FACE LLAMA 3.1 8B INSTRUCT
      console.log("🤖 Generating AI diet plan from Hugging Face (meta-llama/Llama-3.1-8B-Instruct:cheapest)...");
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE}/api/nutrition/generate-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          provider: "huggingface",
          model: "meta-llama/Llama-3.1-8B-Instruct:cheapest",
          weight,
          height,
          age,
          gender: form.gender,
          activityLevel: form.activityLevel,
          goal: form.goal,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || "Failed to generate diet plan");
      }

      const aiResult = await response.json();
      console.log("✅ AI Diet Plan Generated:", aiResult);

      setResult({
        summary: aiResult.summary,
        calories: aiResult.dailyCalories,
        macros: aiResult.macroTargets,
        meals: aiResult.meals,
        tips: aiResult.tips,
      });
    } catch (error) {
      console.error("❌ Error generating diet plan:", error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h1 style={{ fontSize: "42px", marginBottom: "10px" }}>🍎 Calorie & Meal Planner</h1>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "16px" }}>
          Get personalized nutrition recommendations based on your goals
        </p>
      </div>

      {/* FORM SECTION */}
      <div style={formCardStyle}>
        <h3 style={{ marginBottom: "25px", fontSize: "20px" }}>Your Information</h3>
        
        <div style={formGridStyle}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Weight (kg)</label>
            <input
              type="number"
              placeholder="e.g., 70"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Height (cm)</label>
            <input
              type="number"
              placeholder="e.g., 175"
              value={form.height}
              onChange={(e) => setForm({ ...form, height: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Age</label>
            <input
              type="number"
              placeholder="e.g., 25"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Gender</label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              style={selectStyle}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Activity Level</label>
            <select
              value={form.activityLevel}
              onChange={(e) => setForm({ ...form, activityLevel: e.target.value })}
              style={selectStyle}
            >
              <option value="sedentary">Sedentary (little/no exercise)</option>
              <option value="light">Light (1-3 days/week)</option>
              <option value="moderate">Moderate (3-5 days/week)</option>
              <option value="active">Active (6-7 days/week)</option>
              <option value="very_active">Very Active (athlete)</option>
            </select>
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Goal</label>
            <select
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              style={selectStyle}
            >
              <option value="cut">🔥 Cut (Lose Fat)</option>
              <option value="maintain">⚖️ Maintain (Stay Same)</option>
              <option value="bulk">💪 Bulk (Gain Muscle)</option>
            </select>
          </div>
        </div>

        <button onClick={handleGenerate} style={generateButtonStyle} disabled={loading}>
          {loading ? "⏳ Generating AI Plan..." : "Generate My Plan 🚀"}
        </button>
      </div>

      {/* RESULTS SECTION */}
      {result && (
        <div style={resultsContainerStyle}>
          {/* AI Badge */}
          <div style={aiBadgeStyle}>
            🤖 AI-Powered by Hugging Face (meta-llama/Llama-3.1-8B-Instruct:cheapest)
          </div>

          {/* Summary */}
          <div style={summaryCardStyle}>
            <p style={{ fontSize: "16px", lineHeight: "1.6" }}>
              {result.summary}
            </p>
          </div>

          {/* Calorie Target */}
          <div style={calorieCardStyle}>
            <div style={{ fontSize: "48px", marginBottom: "10px" }}>🎯</div>
            <h2 style={{ fontSize: "36px", margin: "10px 0" }}>
              {result.calories} <span style={{ fontSize: "20px", opacity: 0.7 }}>kcal/day</span>
            </h2>
            <p style={{ opacity: 0.7 }}>Your Daily Target</p>
          </div>

          {/* Macros Breakdown */}
          <div style={macrosCardStyle}>
            <h3 style={{ marginBottom: "25px", fontSize: "22px" }}>📊 Macro Breakdown</h3>
            
            <div style={macrosGridStyle}>
              <div style={macroItemStyle}>
                <div style={{ ...macroIconStyle, background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }}>
                  🥩
                </div>
                <div>
                  <div style={macroLabelStyle}>Protein</div>
                  <div style={macroValueStyle}>{result.macros.protein}g</div>
                  <div style={macroPercentStyle}>
                    {Math.round((result.macros.protein * 4 / result.calories) * 100)}% of calories
                  </div>
                </div>
              </div>

              <div style={macroItemStyle}>
                <div style={{ ...macroIconStyle, background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" }}>
                  🍞
                </div>
                <div>
                  <div style={macroLabelStyle}>Carbs</div>
                  <div style={macroValueStyle}>{result.macros.carbs}g</div>
                  <div style={macroPercentStyle}>
                    {Math.round((result.macros.carbs * 4 / result.calories) * 100)}% of calories
                  </div>
                </div>
              </div>

              <div style={macroItemStyle}>
                <div style={{ ...macroIconStyle, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
                  🥑
                </div>
                <div>
                  <div style={macroLabelStyle}>Fats</div>
                  <div style={macroValueStyle}>{result.macros.fats}g</div>
                  <div style={macroPercentStyle}>
                    {Math.round((result.macros.fats * 9 / result.calories) * 100)}% of calories
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Meal Plan */}
          <div style={mealsCardStyle}>
            <h3 style={{ marginBottom: "10px", fontSize: "22px" }}>🍽️ Your Daily Meal Plan</h3>
            <p style={{ opacity: 0.7, marginBottom: "30px" }}>
              Balanced meals that hit your macro targets
            </p>
            
            <div style={mealsGridStyle}>
              {result.meals.map((meal, index) => (
                <div key={index} style={mealCardStyle}>
                  {/* Meal Header */}
                  <div style={mealHeaderStyle}>
                    <h4 style={{ fontSize: "20px", margin: 0 }}>{meal.day}</h4>
                    <div style={mealTotalCaloriesStyle}>
                      {meal.daily_total} kcal
                    </div>
                  </div>

                  {/* Food Items */}
                  <div style={foodListStyle}>
                    <div style={foodItemStyle}>
                      <div style={foodNameStyle}>🌄 Breakfast: {meal.breakfast}</div>
                      <div style={foodCaloriesStyle}>{meal.breakfast_calories} kcal</div>
                    </div>
                    <div style={foodItemStyle}>
                      <div style={foodNameStyle}>🍽️ Lunch: {meal.lunch}</div>
                      <div style={foodCaloriesStyle}>{meal.lunch_calories} kcal</div>
                    </div>
                    <div style={foodItemStyle}>
                      <div style={foodNameStyle}>🌙 Dinner: {meal.dinner}</div>
                      <div style={foodCaloriesStyle}>{meal.dinner_calories} kcal</div>
                    </div>
                    <div style={foodItemStyle}>
                      <div style={foodNameStyle}>🍪 Snacks: {meal.snacks}</div>
                      <div style={foodCaloriesStyle}>{meal.snacks_calories} kcal</div>
                    </div>
                  </div>

                  {/* Meal Macros Summary */}
                  <div style={mealMacrosSummaryStyle}>
                    <div style={mealMacroItemStyle}>
                      <span style={mealMacroLabelStyle}>P:</span>
                      <span style={mealMacroValueStyle}>
                        {meal.totals?.protein || "0"}g
                      </span>
                    </div>
                    <div style={mealMacroDividerStyle}>|</div>
                    <div style={mealMacroItemStyle}>
                      <span style={mealMacroLabelStyle}>C:</span>
                      <span style={mealMacroValueStyle}>
                        {meal.totals?.carbs || "0"}g
                      </span>
                    </div>
                    <div style={mealMacroDividerStyle}>|</div>
                    <div style={mealMacroItemStyle}>
                      <span style={mealMacroLabelStyle}>F:</span>
                      <span style={mealMacroValueStyle}>
                        {meal.totals?.fats || "0"}g
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Tips */}
          {result.tips && (
            <div style={tipsCardStyle}>
              <h3 style={{ marginBottom: "25px", fontSize: "22px" }}>💡 AI Recommendations</h3>
              <div style={tipsGridStyle}>
                {result.tips.map((tip, index) => (
                  <div key={index} style={tipItemStyle}>
                    <div style={tipNumberStyle}>{index + 1}</div>
                    <p style={tipTextStyle}>{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ---------------- STYLES ---------------- */

const containerStyle = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "20px",
};

const formCardStyle = {
  background: "rgba(255,255,255,0.05)",
  padding: "40px",
  borderRadius: "20px",
  border: "1px solid rgba(255,255,255,0.1)",
  backdropFilter: "blur(10px)",
  marginBottom: "40px",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "25px",
  marginBottom: "30px",
};

const inputGroupStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const labelStyle = {
  fontSize: "14px",
  fontWeight: "500",
  opacity: 0.9,
  marginBottom: "5px",
};

const inputStyle = {
  padding: "14px 18px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "12px",
  color: "white",
  fontSize: "16px",
  outline: "none",
  transition: "all 0.3s ease",
};

const selectStyle = {
  padding: "14px 18px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "12px",
  color: "white",
  fontSize: "16px",
  outline: "none",
  cursor: "pointer",
  transition: "all 0.3s ease",
};

const generateButtonStyle = {
  width: "100%",
  padding: "18px",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  border: "none",
  borderRadius: "12px",
  color: "white",
  fontSize: "18px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
  boxShadow: "0 8px 20px rgba(102, 126, 234, 0.3)",
};

const resultsContainerStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "30px",
};

const calorieCardStyle = {
  background: "linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.15) 100%)",
  padding: "40px",
  borderRadius: "20px",
  border: "1px solid rgba(102,126,234,0.3)",
  textAlign: "center",
  backdropFilter: "blur(10px)",
};

const macrosCardStyle = {
  background: "rgba(255,255,255,0.05)",
  padding: "40px",
  borderRadius: "20px",
  border: "1px solid rgba(255,255,255,0.1)",
  backdropFilter: "blur(10px)",
};

const macrosGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "25px",
};

const macroItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "20px",
  padding: "20px",
  background: "rgba(255,255,255,0.03)",
  borderRadius: "15px",
  border: "1px solid rgba(255,255,255,0.08)",
};

const macroIconStyle = {
  width: "60px",
  height: "60px",
  borderRadius: "15px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "28px",
  flexShrink: 0,
};

const macroLabelStyle = {
  fontSize: "14px",
  opacity: 0.7,
  marginBottom: "5px",
};

const macroValueStyle = {
  fontSize: "28px",
  fontWeight: "700",
  marginBottom: "5px",
};

const macroPercentStyle = {
  fontSize: "12px",
  opacity: 0.6,
};

const mealsCardStyle = {
  background: "rgba(255,255,255,0.05)",
  padding: "40px",
  borderRadius: "20px",
  border: "1px solid rgba(255,255,255,0.1)",
  backdropFilter: "blur(10px)",
};

const mealsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "25px",
};

const mealCardStyle = {
  background: "rgba(255,255,255,0.03)",
  borderRadius: "15px",
  border: "1px solid rgba(255,255,255,0.08)",
  overflow: "hidden",
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
};

const mealHeaderStyle = {
  background: "linear-gradient(135deg, rgba(102,126,234,0.2) 0%, rgba(118,75,162,0.2) 100%)",
  padding: "20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
};

const mealTotalCaloriesStyle = {
  background: "rgba(255,255,255,0.15)",
  padding: "6px 14px",
  borderRadius: "20px",
  fontSize: "14px",
  fontWeight: "600",
};

const foodListStyle = {
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const foodItemStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 15px",
  background: "rgba(255,255,255,0.03)",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.05)",
};

const foodNameStyle = {
  fontSize: "15px",
  flex: 1,
};

const foodCaloriesStyle = {
  fontSize: "14px",
  opacity: 0.7,
  fontWeight: "500",
};

const mealMacrosSummaryStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "15px",
  padding: "20px",
  borderTop: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)",
};

const mealMacroItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const mealMacroLabelStyle = {
  fontSize: "13px",
  opacity: 0.7,
};

const mealMacroValueStyle = {
  fontSize: "15px",
  fontWeight: "600",
};

const mealMacroDividerStyle = {
  opacity: 0.3,
  fontSize: "14px",
};

// 🤖 AI FEATURE STYLES
const aiBadgeStyle = {
  display: "inline-block",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  padding: "12px 24px",
  borderRadius: "25px",
  fontSize: "16px",
  fontWeight: "600",
  marginBottom: "25px",
  boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
};

const summaryCardStyle = {
  background: "linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.15) 100%)",
  padding: "30px",
  borderRadius: "20px",
  border: "1px solid rgba(102,126,234,0.3)",
  backdropFilter: "blur(10px)",
  marginBottom: "30px",
};

const tipsCardStyle = {
  background: "rgba(255,255,255,0.05)",
  padding: "40px",
  borderRadius: "20px",
  border: "1px solid rgba(255,255,255,0.1)",
  backdropFilter: "blur(10px)",
  marginTop: "30px",
};

const tipsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "20px",
};

const tipItemStyle = {
  display: "flex",
  gap: "15px",
  padding: "20px",
  background: "rgba(255,255,255,0.03)",
  borderRadius: "15px",
  border: "1px solid rgba(255,255,255,0.08)",
};

const tipNumberStyle = {
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "18px",
  fontWeight: "700",
  flexShrink: 0,
};

const tipTextStyle = {
  fontSize: "15px",
  lineHeight: "1.5",
  margin: 0,
};

export default Nutrition;
