import React, { useMemo, useState } from "react";
import axios from "axios";
import getApiBase from "../utils/apiBase";

const API_BASE = getApiBase();

const FoodScanner = () => {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState("");
  const [error, setError] = useState("");

  // Cleanup preview URL to prevent memory leaks
  const cleanupPreview = React.useCallback(() => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
  }, [imagePreview]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Please upload a valid image file (JPEG, PNG, or WebP)");
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError("Image size should be less than 10MB");
      return;
    }

    // Cleanup previous preview
    cleanupPreview();

    setImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setResult(null);
    setError("");
  };

  const handleScan = async () => {
    if (!imageFile) {
      setError("Please upload an image first");
      return;
    }

    setLoading(true);
    setError("");
    setModelStatus("Uploading image...");
    
    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      setModelStatus("Analyzing image with AI...");
      
      const response = await axios.post(
        `${API_BASE}/api/food/scan`,
        formData,
        {
          // Let Axios set multipart headers with boundary
          timeout: 30000, // 30 second timeout
        }
      );

      const payload = response?.data || {};

      // Validate response data
      if (!payload.food) {
        throw new Error("No food detected in the image. Please try another image.");
      }

      setResult({
        food: payload.food || "Unknown food",
        calories: Number.isFinite(payload.calories) ? payload.calories : null,
        protein: Number.isFinite(payload.protein) ? payload.protein : null,
        carbs: Number.isFinite(payload.carbs) ? payload.carbs : null,
        fats: Number.isFinite(payload.fats) ? payload.fats : null,
        serving: payload.serving || null,
        calorieNote: payload.calorieNote || "Estimated per typical serving.",
        model: payload.model || "nateraw/food (Hugging Face)",
        highConfidence:
          typeof payload.highConfidence === "boolean"
            ? payload.highConfidence
            : true,
        confidence:
          typeof payload.confidence === "number" ? payload.confidence : null,
        warning: payload.warning || null,
      });
      
      setModelStatus("");
    } catch (err) {
      console.error("Food scan error:", err);
      let errorMessage = "Food scan failed. Please try again.";
      
      if (err.code === "ECONNABORTED") {
        errorMessage =
          "Request timeout. Please check your connection and try again.";
      } else if (err.response) {
        // Server responded with error
        const serverMessage =
          err.response.data?.message ||
          err.response.data?.error ||
          `Server error (${err.response.status}). Please try again.`;
        const serverDetails = err.response.data?.details;
        errorMessage =
          serverDetails && !serverMessage.includes(serverDetails)
            ? `${serverMessage} Details: ${serverDetails}`
            : serverMessage;
      } else if (err.request) {
        // Request made but no response
        errorMessage = "Cannot connect to server. Please ensure the backend is reachable.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
      setModelStatus("");
    }
  };

  const handleReset = () => {
    cleanupPreview();
    setResult(null);
    setImageFile(null);
    setImagePreview("");
    setError("");
    setModelStatus("");
  };

  const nutritionInfo = useMemo(() => {
    if (!result) return null;
    
    const hasNutrition = 
      Number.isFinite(result.protein) || 
      Number.isFinite(result.carbs) || 
      Number.isFinite(result.fats);
    
    if (!hasNutrition) return null;

    return {
      protein: result.protein,
      carbs: result.carbs,
      fats: result.fats,
    };
  }, [result]);

  const macroCalories = useMemo(() => {
    if (!nutritionInfo) return null;
    const protein = Math.round(nutritionInfo.protein * 4);
    const carbs = Math.round(nutritionInfo.carbs * 4);
    const fats = Math.round(nutritionInfo.fats * 9);
    const total = protein + carbs + fats;
    return { protein, carbs, fats, total };
  }, [nutritionInfo]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      cleanupPreview();
    };
  }, [cleanupPreview]);

  return (
    <div className="content-wrapper" style={{ maxWidth: 800, margin: "0 auto", padding: "20px" }}>
      <div className="section-header" style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ 
          fontSize: 42, 
          marginBottom: 10,
          background: "linear-gradient(to right, #4facfe, #00f2fe)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          📸 Food Calorie Scanner
        </h1>
        <p className="section-subtitle" style={{ color: "#b8b8d1", fontSize: 16 }}>
          Upload a food image and identify the dish with AI-powered analysis
        </p>
      </div>

      {/* Upload Section */}
      <div 
        className="nutrition-card" 
        style={{ 
          marginBottom: 24,
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(10px)",
          borderRadius: 24,
          padding: 35,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ marginBottom: 20, textAlign: "center" }}>
          <label
            htmlFor="file-upload"
            style={{
              display: "inline-block",
              padding: "14px 40px",
              background: imagePreview 
                ? "linear-gradient(135deg, #43e97b, #38f9d7)"
                : "linear-gradient(135deg, #4facfe, #00f2fe)",
              borderRadius: 14,
              cursor: "pointer",
              fontSize: 16,
              fontWeight: 600,
              border: "none",
              color: "white",
              transition: "all 0.3s ease",
              boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
            }}
          >
            {imagePreview ? "📷 Change Photo" : "📤 Upload Food Photo"}
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleImageUpload}
            style={{ display: "none" }}
          />
          <div style={{ marginTop: 10, fontSize: 13, color: "#999" }}>
            Supported: JPEG, PNG, WebP (Max 10MB)
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: 16,
              background: "rgba(245, 87, 108, 0.15)",
              border: "1px solid rgba(245, 87, 108, 0.3)",
              borderRadius: 12,
              color: "#ff6b6b",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Image Preview */}
        {imagePreview && (
          <div
            style={{
              marginBottom: 20,
              borderRadius: 16,
              overflow: "hidden",
              border: "2px solid rgba(79, 172, 254, 0.3)",
              position: "relative",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
          >
            <img
              src={imagePreview}
              alt="Food preview"
              style={{ 
                width: "100%", 
                maxHeight: 400, 
                objectFit: "contain",
                background: "#000",
              }}
            />
          </div>
        )}

        {/* Scan Button */}
        {imagePreview && !result && (
          <button
            onClick={handleScan}
            disabled={loading}
            style={{
              width: "100%",
              padding: 16,
              background: loading
                ? "rgba(255, 255, 255, 0.1)"
                : "linear-gradient(135deg, #f093fb, #f5576c)",
              border: "none",
              borderRadius: 14,
              color: "white",
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.3s ease",
              boxShadow: loading ? "none" : "0 4px 15px rgba(245, 87, 108, 0.4)",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(245, 87, 108, 0.5)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 15px rgba(245, 87, 108, 0.4)";
              }
            }}
          >
            {loading ? "🔄 Analyzing..." : "🔍 Scan Food"}
          </button>
        )}

        {/* Loading Status */}
        {modelStatus && (
          <div 
            style={{ 
              marginTop: 16, 
              fontSize: 14, 
              opacity: 0.8,
              textAlign: "center",
              color: "#4facfe",
            }}
          >
            <span style={{ display: "inline-block", marginRight: 8 }}>⏳</span>
            {modelStatus}
          </div>
        )}
      </div>

      {/* Results Section */}
      {result && (
        <div
          className="nutrition-card"
          style={{
            background: "linear-gradient(135deg, rgba(79, 172, 254, 0.08), rgba(0, 242, 254, 0.08))",
            border: "1px solid rgba(79, 172, 254, 0.2)",
            borderRadius: 24,
            padding: 35,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}
        >
          {/* Food Name */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h2 style={{ 
              margin: 0, 
              fontSize: 32, 
              marginBottom: 8,
              color: "#fff",
            }}>
              {result.food}
            </h2>
            {result.warning && (
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 16px",
                  background: "rgba(255, 193, 7, 0.15)",
                  border: "1px solid rgba(255, 193, 7, 0.35)",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#ffe08a",
                  marginBottom: 8,
                }}
              >
                {result.warning}
              </div>
            )}
            <div
              style={{
                display: "inline-block",
                padding: "6px 16px",
                background:
                  result.highConfidence === false
                    ? "rgba(255, 193, 7, 0.2)"
                    : "rgba(67, 233, 123, 0.2)",
                border:
                  result.highConfidence === false
                    ? "1px solid rgba(255, 193, 7, 0.4)"
                    : "1px solid rgba(67, 233, 123, 0.4)",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                color:
                  result.highConfidence === false ? "#ffe08a" : "#c9ffd8",
              }}
            >
              {result.highConfidence === false
                ? "Low confidence match"
                : "High confidence match"}
            </div>
          </div>

          {/* Calories Display */}
          {Number.isFinite(result.calories) && (
            <div
              style={{
                background: "linear-gradient(135deg, rgba(245, 87, 108, 0.15), rgba(240, 147, 251, 0.15))",
                padding: 24,
                borderRadius: 16,
                textAlign: "center",
                border: "1px solid rgba(245, 87, 108, 0.3)",
                marginBottom: 24,
              }}
            >
              <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 4 }}>
                Estimated Calories
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#fff" }}>
                {result.calories} <span style={{ fontSize: 18 }}>kcal</span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                {result.serving ? `per ${result.serving}` : "per serving"}
              </div>
              {result.calorieNote && (
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
                  {result.calorieNote}
                </div>
              )}
            </div>
          )}

          {/* Macros Display */}
          {nutritionInfo && (
            <div 
              style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(3, 1fr)", 
                gap: 16,
                marginBottom: 24,
              }}
            >
              {nutritionInfo.protein !== null && (
                <div style={{
                  background: "rgba(67, 233, 123, 0.1)",
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid rgba(67, 233, 123, 0.2)",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Protein</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{nutritionInfo.protein}g</div>
                </div>
              )}
              {nutritionInfo.carbs !== null && (
                <div style={{
                  background: "rgba(255, 193, 7, 0.1)",
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid rgba(255, 193, 7, 0.2)",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Carbs</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{nutritionInfo.carbs}g</div>
                </div>
              )}
              {nutritionInfo.fats !== null && (
                <div style={{
                  background: "rgba(240, 147, 251, 0.1)",
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid rgba(240, 147, 251, 0.2)",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Fats</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{nutritionInfo.fats}g</div>
                </div>
              )}
            </div>
          )}

          {/* Calorie Details */}
          {nutritionInfo && macroCalories && (
            <div
              style={{
                marginBottom: 20,
                padding: 16,
                background: "rgba(255,255,255,0.03)",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "rgba(255,255,255,0.8)" }}>
                Calorie Breakdown
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>Protein calories</span>
                <span>{macroCalories.protein} kcal</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>Carb calories</span>
                <span>{macroCalories.carbs} kcal</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>Fat calories</span>
                <span>{macroCalories.fats} kcal</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                <span>Total from macros</span>
                <span>{macroCalories.total} kcal</span>
              </div>
            </div>
          )}

          {/* Model Info */}
          <div style={{ 
            marginBottom: 20, 
            fontSize: 12, 
            opacity: 0.5,
            textAlign: "center",
            padding: 12,
            background: "rgba(0,0,0,0.2)",
            borderRadius: 8,
          }}>
            🤖 Powered by: {result.model}
            {Number.isFinite(result.confidence) && (
              <span> • Confidence: {Math.round(result.confidence * 100)}%</span>
            )}
          </div>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            style={{
              width: "100%",
              padding: 14,
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 12,
              color: "white",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            🔄 Scan Another Food
          </button>
        </div>
      )}
    </div>
  );
};

export default FoodScanner;
