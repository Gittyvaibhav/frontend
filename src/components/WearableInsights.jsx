import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useGoogleLogin } from "@react-oauth/google";

const DAY_MS = 24 * 60 * 60 * 1000;
const FIT_AGGREGATE_URL =
  "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate";

const SCOPES = ["https://www.googleapis.com/auth/fitness.activity.read"];

const formatDate = (ms) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(ms));

const buildSparkline = (values, width = 240, height = 60) => {
  const safeValues = values.map((v) => (Number.isFinite(v) ? v : 0));
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);
  const range = Math.max(max - min, 1);
  const step = width / Math.max(safeValues.length - 1, 1);
  return safeValues.map((v, idx) => {
    const x = idx * step;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });
};

const DEFAULT_INSIGHTS = {
  heartPointsWeeklyGoal: 150,
  goodStepsPerDayMin: 8000,
  goodStepsPerDayMax: 10000,
  activeDayStepsThreshold: 5000,
  minActiveDays: 4,
  strongActiveDays: 5,
  highVarianceRatio: 0.6,
};

const safeNum = (n) => (Number.isFinite(n) ? n : 0);

const summarizeTrend = (values) => {
  if (values.length < 4) return "flat";
  const mid = Math.floor(values.length / 2);
  const avg = (arr) =>
    arr.reduce((sum, v) => sum + safeNum(v), 0) / Math.max(arr.length, 1);
  const delta = avg(values.slice(mid)) - avg(values.slice(0, mid));
  if (delta > 500) return "up";
  if (delta < -500) return "down";
  return "flat";
};

const calcStdDev = (values) => {
  if (!values.length) return 0;
  const mean = values.reduce((s, v) => s + safeNum(v), 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (safeNum(v) - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const countActiveDays = (steps, threshold) =>
  steps.filter((v) => safeNum(v) >= threshold).length;

const formatNumber = (n) => Math.round(safeNum(n)).toLocaleString();

const generateLifestyleInsights = (
  { totalSteps, totalCalories, totalHeartPoints, dailyBreakdown },
  overrides = {}
) => {
  const cfg = { ...DEFAULT_INSIGHTS, ...overrides };

  const stepsPerDay = (dailyBreakdown || []).map((d) => safeNum(d?.steps));
  const totalDays = Math.max(stepsPerDay.length, 1);
  const avgSteps = safeNum(totalSteps) / totalDays;
  const avgCalories = safeNum(totalCalories) / totalDays;
  const activeDays = countActiveDays(stepsPerDay, cfg.activeDayStepsThreshold);

  const stepTrend = summarizeTrend(stepsPerDay);
  const stepStdDev = calcStdDev(stepsPerDay);
  const stepVarianceRatio = avgSteps > 0 ? stepStdDev / avgSteps : 0;

  const belowHeartPoints =
    safeNum(totalHeartPoints) < cfg.heartPointsWeeklyGoal;
  const lowConsistency = activeDays < cfg.minActiveDays;
  const strongConsistency = activeDays >= cfg.strongActiveDays;
  const goodAvgSteps =
    avgSteps >= cfg.goodStepsPerDayMin &&
    avgSteps <= cfg.goodStepsPerDayMax;
  const highVariance = stepVarianceRatio >= cfg.highVarianceRatio;

  const summaryParts = [];
  summaryParts.push(
    `You logged ${formatNumber(totalSteps)} steps and ${formatNumber(
      totalCalories
    )} calories this week.`
  );
  summaryParts.push(
    `That averages ${formatNumber(avgSteps)} steps per day with ${activeDays} active days.`
  );
  if (belowHeartPoints) {
    summaryParts.push(
      `Heart Points are below the weekly goal (${formatNumber(
        totalHeartPoints
      )}/${cfg.heartPointsWeeklyGoal}).`
    );
  } else {
    summaryParts.push(
      `You hit the Heart Points target with ${formatNumber(
        totalHeartPoints
      )} points.`
    );
  }
  if (stepTrend === "down") {
    summaryParts.push("Activity trended downward later in the week.");
  } else if (stepTrend === "up") {
    summaryParts.push("Activity picked up as the week progressed.");
  } else {
    summaryParts.push("Activity was relatively steady across the week.");
  }

  const suggestions = [];
  if (belowHeartPoints) {
    suggestions.push(
      "Add a 20-minute brisk walk after dinner on 3 days to raise Heart Points."
    );
  }
  if (lowConsistency) {
    suggestions.push(
      `Aim for at least ${cfg.minActiveDays} active days by scheduling short 10-15 minute movement breaks on quieter days.`
    );
  }
  if (stepTrend === "down") {
    suggestions.push(
      "Front-load activity by planning a longer walk or workout earlier in the week to avoid drop-offs."
    );
  }
  if (highVariance) {
    suggestions.push(
      "Smooth out big day-to-day swings by adding a short walk on low-step days."
    );
  }
  if (goodAvgSteps && strongConsistency && !belowHeartPoints) {
    suggestions.push(
      "Great consistency - keep the routine and consider adding one longer session to push Heart Points even higher."
    );
  }
  if (!goodAvgSteps) {
    if (avgSteps < cfg.goodStepsPerDayMin) {
      suggestions.push(
        "Try adding 1,500-2,000 steps per day (roughly a 15-20 minute walk) to reach the 8k-10k range."
      );
    } else if (avgSteps > cfg.goodStepsPerDayMax) {
      suggestions.push(
        "Your step volume is high - balance it with recovery (light mobility or stretching) once or twice this week."
      );
    }
  }
  if (!suggestions.length && avgCalories > 0) {
    suggestions.push(
      "Keep the current routine and build in a short walk after meals to maintain momentum."
    );
  }

  return {
    summary: summaryParts.slice(0, 4).join(" "),
    suggestions: suggestions.slice(0, 5),
  };
};

const WearableInsights = ({ authReady = true, authError = "" }) => {
  const [accessToken, setAccessToken] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [fitnessData, setFitnessData] = useState([]);
  const [copyStatus, setCopyStatus] = useState("");
  const days = fitnessData;
  const setDays = setFitnessData;
  const loading = isLoading;

  // Memoize date range calculation
  const dateRange = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return {
      startTimeMillis: start.getTime(),
      endTimeMillis: end.getTime(),
    };
  }, []);

  // Memoize insights generation
  const insights = useMemo(() => {
    if (days.length === 0) return { summary: "", suggestions: [] };
    
    const totalSteps = days.reduce((sum, d) => sum + safeNum(d?.steps), 0);
    const totalCalories = days.reduce((sum, d) => sum + safeNum(d?.calories), 0);
    const totalHeartPoints = days.reduce(
      (sum, d) => sum + safeNum(d?.heartPoints),
      0
    );

    return generateLifestyleInsights({
      totalSteps,
      totalCalories,
      totalHeartPoints,
      dailyBreakdown: days,
    });
  }, [days]);

  // Memoize summary tone
  const summaryTone = useMemo(() => {
    if (days.length === 0) return "neutral";
    const totalHeartPoints = days.reduce(
      (sum, d) => sum + safeNum(d?.heartPoints),
      0
    );
    const totalSteps = days.reduce((sum, d) => sum + safeNum(d?.steps), 0);
    const avgSteps = totalSteps / Math.max(days.length, 1);
    const strongHeartPoints = totalHeartPoints >= DEFAULT_INSIGHTS.heartPointsWeeklyGoal;
    const strongSteps = avgSteps >= DEFAULT_INSIGHTS.goodStepsPerDayMin;
    if (strongHeartPoints && strongSteps) return "good";
    if (!strongHeartPoints && avgSteps < DEFAULT_INSIGHTS.goodStepsPerDayMin * 0.7)
      return "low";
    return "neutral";
  }, [days]);

  // Memoize totals
  const totals = useMemo(() => {
    const totalSteps = days.reduce((sum, d) => sum + safeNum(d?.steps), 0);
    const totalCalories = days.reduce((sum, d) => sum + safeNum(d?.calories), 0);
    const totalHeartPoints = days.reduce(
      (sum, d) => sum + safeNum(d?.heartPoints),
      0
    );
    return { totalSteps, totalCalories, totalHeartPoints };
  }, [days]);

  // Dynamic summary card styling
  const summaryStyle = useMemo(() => ({
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      summaryTone === "good"
        ? "linear-gradient(135deg, rgba(67, 233, 123, 0.12), rgba(56, 249, 215, 0.08))"
        : summaryTone === "low"
        ? "linear-gradient(135deg, rgba(245, 87, 108, 0.12), rgba(240, 147, 251, 0.08))"
        : "rgba(255,255,255,0.04)",
  }), [summaryTone]);

  // Copy to clipboard handler
  const handleCopy = useCallback(async () => {
    try {
      const suggestionsText = insights.suggestions.length
        ? `\n\nSuggestions:\n- ${insights.suggestions.join("\n- ")}`
        : "";
      const summaryText = `${insights.summary}${suggestionsText}`;
      await navigator.clipboard.writeText(summaryText);
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus(""), 2000);
    } catch (err) {
      setCopyStatus("Copy failed");
      setTimeout(() => setCopyStatus(""), 2000);
    }
  }, [insights]);

  // Surface provider load errors and keep auth state consistent
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  useEffect(() => {
    setIsConnected(Boolean(accessToken));
    if (!accessToken) {
      setDays([]);
    }
  }, [accessToken, setDays]);

  // Handle disconnect
  const handleDisconnect = useCallback(() => {
    setAccessToken("");
    setIsConnected(false);
    setDays([]);
    setError("");
    setCopyStatus("");
  }, [setDays]);

  // API fetch helpers with better error handling
  const fetchAggregate = async (token, body) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const res = await fetch(FIT_AGGREGATE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        let errorMsg = "Google Fit API error";
        try {
          const errorData = JSON.parse(text);
          errorMsg = errorData.error?.message || errorMsg;
        } catch {
          errorMsg = text || errorMsg;
        }
        throw new Error(errorMsg);
      }
      return res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error("Request timeout - Google Fit is taking too long to respond");
      }
      throw err;
    }
  };

  // Build day buckets
  const buildDayBuckets = useCallback(() => {
    const buckets = [];
    for (
      let ms = dateRange.startTimeMillis;
      ms <= dateRange.endTimeMillis;
      ms += DAY_MS
    ) {
      buckets.push({
        dayStartMs: ms,
        steps: 0,
        calories: 0,
        heartPoints: 0,
      });
    }
    return buckets;
  }, [dateRange]);

  // Data application helpers
  const applySteps = (dayBuckets, response) => {
    response.bucket?.forEach((bucket, idx) => {
      let total = 0;
      bucket.dataset?.forEach((dataset) => {
        dataset.point?.forEach((point) => {
          const val = point.value?.[0]?.intVal || 0;
          total += val;
        });
      });
      if (dayBuckets[idx]) {
        dayBuckets[idx].steps = total;
      }
    });
  };

  const applyCalories = (dayBuckets, response) => {
    response.bucket?.forEach((bucket, idx) => {
      let total = 0;
      bucket.dataset?.forEach((dataset) => {
        dataset.point?.forEach((point) => {
          const val = point.value?.[0]?.fpVal ?? point.value?.[0]?.intVal ?? 0;
          total += Number.isFinite(val) ? val : 0;
        });
      });
      if (dayBuckets[idx]) {
        dayBuckets[idx].calories = total;
      }
    });
  };

  const applyHeartPoints = (dayBuckets, response) => {
    response.bucket?.forEach((bucket, idx) => {
      let total = 0;
      bucket.dataset?.forEach((dataset) => {
        dataset.point?.forEach((point) => {
          const val = point.value?.[0]?.fpVal ?? point.value?.[0]?.intVal ?? 0;
          total += Number.isFinite(val) ? val : 0;
        });
      });
      if (dayBuckets[idx]) {
        dayBuckets[idx].heartPoints = total;
      }
    });
  };

  // Fetch all Google Fit data (only after OAuth succeeds)
  const fetchFitnessData = useCallback(
    async (token) => {
      if (!token) {
        setError("Not connected to Google Fit");
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const base = {
          startTimeMillis: dateRange.startTimeMillis,
          endTimeMillis: dateRange.endTimeMillis,
          bucketByTime: { durationMillis: DAY_MS },
        };

        const stepType = "com.google.step_count.delta";
        const calorieType = "com.google.calories.expended";
        const heartPointsType = "com.google.heart_minutes";

        const requests = [
          fetchAggregate(token, {
            ...base,
            aggregateBy: [{ dataTypeName: stepType }],
          }),
          fetchAggregate(token, {
            ...base,
            aggregateBy: [{ dataTypeName: calorieType }],
          }),
          fetchAggregate(token, {
            ...base,
            aggregateBy: [{ dataTypeName: heartPointsType }],
          }),
        ];

        const [stepsRes, caloriesRes, heartPointsRes] =
          await Promise.allSettled(requests);

        const dayBuckets = buildDayBuckets();

        if (stepsRes.status === "fulfilled" && stepsRes.value) {
          applySteps(dayBuckets, stepsRes.value);
        }
        if (caloriesRes.status === "fulfilled" && caloriesRes.value) {
          applyCalories(dayBuckets, caloriesRes.value);
        }
        if (heartPointsRes.status === "fulfilled" && heartPointsRes.value) {
          applyHeartPoints(dayBuckets, heartPointsRes.value);
        }

        const errors = [stepsRes, caloriesRes, heartPointsRes]
          .filter((res) => res.status === "rejected")
          .map((res) => res.reason?.message || String(res.reason));

        if (errors.length === 3) {
          setError("Failed to fetch any data from Google Fit. Please try disconnecting and reconnecting.");
        } else if (errors.length > 0) {
          setError(`Partial data loaded. Some metrics failed: ${errors.join(" | ")}`);
        }

        setDays(dayBuckets);
      } catch (err) {
        const errorMessage = err?.message || String(err);

        if (errorMessage.includes("401") || errorMessage.includes("unauthorized")) {
          setError("Authorization expired. Please disconnect and reconnect to Google Fit.");
        } else if (errorMessage.includes("403") || errorMessage.includes("forbidden")) {
          setError("Access denied. Please ensure you've granted the necessary permissions.");
        } else if (errorMessage.includes("timeout")) {
          setError("Request timed out. Please check your connection and try again.");
        } else {
          setError(errorMessage);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [dateRange, buildDayBuckets, setDays]
  );

  const login = useGoogleLogin({
    scope: SCOPES.join(" "),
    onSuccess: (tokenResponse) => {
      const token = tokenResponse?.access_token;
      if (!token) {
        setError("Google sign-in did not return an access token. Please try again.");
        return;
      }
      setAccessToken(token);
      setIsConnected(true);
      setError("");
      fetchFitnessData(token);
    },
    onError: () => {
      setError("Google sign-in failed. Please try again.");
    },
  });

  // Handle Google Fit connection
  const handleConnect = useCallback(() => {
    if (!authReady) {
      setError("Google Identity Services is still loading. Please wait a moment and try again.");
      return;
    }
    setError("");
    login();
  }, [authReady, login]);

  return (
    <div className="content-wrapper" style={{ maxWidth: 900, margin: "0 auto", padding: "20px" }}>
      {/* Header */}
      <div className="section-header" style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ 
          fontSize: 42, 
          marginBottom: 10,
          background: "linear-gradient(to right, #43e97b, #38f9d7)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          Wearable Insights
        </h1>
        <p className="section-subtitle" style={{ color: "#b8b8d1", fontSize: 16 }}>
          Daily steps, calories burned, and heart points from Google Fit
        </p>
      </div>

      {/* Connection Card */}
      <div
        className="nutrition-card"
        style={{
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(10px)",
          borderRadius: 24,
          padding: 30,
          border: isConnected 
            ? "1px solid rgba(67, 233, 123, 0.3)" 
            : "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>
            Connection Status
          </div>
          <div style={{ 
            fontSize: 20, 
            fontWeight: 700,
            color: isConnected ? "#43e97b" : "#fff",
            marginBottom: 6,
          }}>
            {isConnected ? "Connected" : "Not Connected"}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
            {isConnected ? "Syncing last 7 days of data" : "Connect to view your fitness data"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {!isConnected ? (
            <button 
              className="primary-button" 
              onClick={handleConnect}
              disabled={loading || !authReady}
              style={{
                padding: "14px 32px",
                background: "linear-gradient(135deg, #43e97b, #38f9d7)",
                border: "none",
                borderRadius: 14,
                color: "#000",
                fontSize: 15,
                fontWeight: 600,
                cursor: loading || !authReady ? "not-allowed" : "pointer",
                opacity: loading || !authReady ? 0.7 : 1,
                transition: "all 0.3s ease",
                boxShadow: "0 4px 15px rgba(67, 233, 123, 0.3)",
              }}
            >
              Connect Google Fit
            </button>
          ) : (
            <>
              <button 
                className="primary-button" 
                onClick={() => fetchFitnessData(accessToken)}
                disabled={loading}
                style={{
                  padding: "12px 28px",
                  background: loading 
                    ? "rgba(255,255,255,0.1)" 
                    : "linear-gradient(135deg, #43e97b, #38f9d7)",
                  border: "none",
                  borderRadius: 12,
                  color: loading ? "#fff" : "#000",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  transition: "all 0.3s ease",
                }}
              >
                {loading ? "Syncing..." : "Refresh"}
              </button>
              <button 
                className="secondary-button" 
                onClick={handleDisconnect}
                disabled={loading}
                style={{
                  padding: "12px 28px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: 12,
                  color: "white",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.5 : 1,
                  transition: "all 0.3s ease",
                }}
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div 
          className="nutrition-card" 
          style={{ 
            marginBottom: 20,
            background: "linear-gradient(135deg, rgba(245, 87, 108, 0.12), rgba(240, 147, 251, 0.08))",
            border: "1px solid rgba(245, 87, 108, 0.3)",
            borderRadius: 20,
            padding: 20,
          }}
        >
          <div style={{ color: "#ff6b6b", fontWeight: 600, fontSize: 15, lineHeight: 1.6 }}>
            {error}
          </div>
        </div>
      )}

      {/* Weekly Summary Card */}
      {days.length > 0 && insights.summary && (
        <div 
          className="nutrition-card" 
          style={{ 
            maxWidth: 900, 
            marginBottom: 20,
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(10px)",
            borderRadius: 24,
            padding: 30,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ 
            fontSize: 18, 
            fontWeight: 700, 
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <span>Weekly Summary</span>
          </div>
          <div style={{ ...summaryStyle, borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.9)", lineHeight: 1.7 }}>
              {insights.summary}
            </div>
            {insights.suggestions.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ 
                  fontSize: 14, 
                  color: "rgba(255,255,255,0.7)",
                  fontWeight: 600,
                  marginBottom: 12,
                }}>
                  Personalized Suggestions
                </div>
                <ul style={{ marginTop: 0, paddingLeft: 24, margin: 0 }}>
                  {insights.suggestions.map((item, idx) => (
                    <li 
                      key={`suggestion-${idx}`}
                      style={{ 
                        marginBottom: 10,
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: "rgba(255,255,255,0.85)",
                      }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center" }}>
              <button 
                className="secondary-button" 
                onClick={handleCopy}
                style={{
                  padding: "10px 24px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: 10,
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
              >
                Copy Summary
              </button>
              {copyStatus && (
                <div style={{ 
                  fontSize: 13, 
                  color: copyStatus === "Copied!" ? "#43e97b" : "#ff6b6b",
                  fontWeight: 600,
                }}>
                  {copyStatus}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Weekly Totals */}
      {days.length > 0 && (
        <div 
          className="nutrition-card" 
          style={{ 
            maxWidth: 900, 
            marginBottom: 20,
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(10px)",
            borderRadius: 24,
            padding: 30,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
            Weekly Totals
          </div>
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            {[
              {
                label: "Total Steps",
                value: totals.totalSteps,
                suffix: "",
                color: "#7aa6ff",
                gradient: "linear-gradient(135deg, rgba(122, 166, 255, 0.15), rgba(102, 126, 234, 0.08))",
                icon: "S",
              },
              {
                label: "Total Calories",
                value: totals.totalCalories,
                suffix: " kcal",
                color: "#ffb86b",
                gradient: "linear-gradient(135deg, rgba(255, 184, 107, 0.15), rgba(245, 87, 108, 0.08))",
                icon: "C",
              },
              {
                label: "Total Heart Points",
                value: totals.totalHeartPoints,
                suffix: " pts",
                color: "#ff8aa0",
                gradient: "linear-gradient(135deg, rgba(255, 138, 160, 0.15), rgba(240, 147, 251, 0.08))",
                icon: "HP",
              },
            ].map((metric) => (
              <div
                key={metric.label}
                style={{
                  background: metric.gradient,
                  borderRadius: 16,
                  padding: 24,
                  border: "1px solid rgba(255,255,255,0.1)",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 8,
                  marginBottom: 8,
                }}>
                  <span style={{ fontSize: 20 }}>{metric.icon}</span>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                    {metric.label}
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: metric.color }}>
                  {Number.isFinite(metric.value) ? formatNumber(metric.value) : "0"}
                  <span style={{ fontSize: 16, opacity: 0.8 }}>
                    {Number.isFinite(metric.value) && metric.value > 0 ? metric.suffix : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7-Day Trends with Sparklines */}
      {days.length > 0 && (
        <div 
          className="nutrition-card" 
          style={{ 
            maxWidth: 900, 
            marginBottom: 20,
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(10px)",
            borderRadius: 24,
            padding: 30,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
            7-Day Trends
          </div>
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            {[
              {
                label: "Steps",
                color: "#7aa6ff",
                values: days.map((d) => d.steps || 0),
                suffix: "",
                icon: "S",
              },
              {
                label: "Calories",
                color: "#ffb86b",
                values: days.map((d) => d.calories || 0),
                suffix: " kcal",
                icon: "C",
              },
              {
                label: "Heart Points",
                color: "#ff8aa0",
                values: days.map((d) => d.heartPoints || 0),
                suffix: " pts",
                icon: "HP",
              },
            ].map((metric) => {
              const points = buildSparkline(metric.values);
              const trend = summarizeTrend(metric.values);
              const trendIcon = trend === "up" ? "UP" : trend === "down" ? "DOWN" : "FLAT";
              const latestValue = metric.values[metric.values.length - 1];
              
              return (
                <div
                  key={metric.label}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 16,
                    padding: 20,
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 6,
                    }}>
                      <span style={{ fontSize: 16 }}>{metric.icon}</span>
                      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                        {metric.label}
                      </span>
                    </div>
                    <span style={{ fontSize: 16 }} title={`Trend: ${trend}`}>
                      {trendIcon}
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: metric.color }}>
                    {latestValue?.toLocaleString?.() || "0"}
                    <span style={{ fontSize: 14, opacity: 0.8 }}>
                      {latestValue > 0 ? metric.suffix : ""}
                    </span>
                  </div>
                  <svg width="100%" height="70" viewBox="0 0 240 60" style={{ marginTop: 4 }}>
                    <defs>
                      <linearGradient id={`gradient-${metric.label}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={metric.color} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={metric.color} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polyline
                      fill="none"
                      stroke={metric.color}
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={points.join(" ")}
                    />
                  </svg>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily Breakdown Cards */}
      {days.length > 0 && (
        <>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
            Daily Breakdown
          </div>
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            {days.map((day) => {
              const isActiveDay = safeNum(day.steps) >= DEFAULT_INSIGHTS.activeDayStepsThreshold;
              
              return (
                <div 
                  key={day.dayStartMs} 
                  className="nutrition-card" 
                  style={{ 
                    padding: 24,
                    background: isActiveDay 
                      ? "linear-gradient(135deg, rgba(67, 233, 123, 0.08), rgba(56, 249, 215, 0.05))"
                      : "rgba(255,255,255,0.03)",
                    backdropFilter: "blur(10px)",
                    borderRadius: 20,
                    border: isActiveDay 
                      ? "1px solid rgba(67, 233, 123, 0.2)"
                      : "1px solid rgba(255,255,255,0.08)",
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ 
                    fontSize: 17, 
                    fontWeight: 700,
                    marginBottom: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <span>{formatDate(day.dayStartMs)}</span>
                    {isActiveDay && (
                      <span style={{ fontSize: 12 }} title="Active day">OK</span>
                    )}
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <div style={{ 
                        fontSize: 12, 
                        color: "rgba(255,255,255,0.6)",
                        marginBottom: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}>
                        <span>S</span>
                        <span>Steps</span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#7aa6ff" }}>
                        {Number.isFinite(day.steps) ? day.steps.toLocaleString() : "0"}
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ 
                        fontSize: 12, 
                        color: "rgba(255,255,255,0.6)",
                        marginBottom: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}>
                        <span>C</span>
                        <span>Calories</span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#ffb86b" }}>
                        {Number.isFinite(day.calories)
                          ? `${Math.round(day.calories)}`
                          : "0"}
                        <span style={{ fontSize: 14, opacity: 0.8 }}>
                          {Number.isFinite(day.calories) && day.calories > 0 ? " kcal" : ""}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ 
                        fontSize: 12, 
                        color: "rgba(255,255,255,0.6)",
                        marginBottom: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}>
                        <span>HP</span>
                        <span>Heart Points</span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#ff8aa0" }}>
                        {Number.isFinite(day.heartPoints)
                          ? Math.round(day.heartPoints)
                          : "0"}
                        <span style={{ fontSize: 14, opacity: 0.8 }}>
                          {Number.isFinite(day.heartPoints) && day.heartPoints > 0 ? " pts" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Loading State */}
      {loading && days.length === 0 && (
        <div style={{ 
          marginTop: 40, 
          textAlign: "center",
          padding: 40,
          background: "rgba(255,255,255,0.03)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>Loading...</div>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.8)" }}>
            Fetching your Google Fit data...
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>
            This may take a few moments
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isConnected && !loading && !error && (
        <div style={{ 
          marginTop: 40, 
          textAlign: "center",
          padding: 60,
          background: "rgba(255,255,255,0.03)",
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ fontSize: 24, marginBottom: 20 }}>Wearable</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
            Connect Your Wearable
          </div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", maxWidth: 400, margin: "0 auto" }}>
            Sync your Google Fit data to get personalized insights on your activity, calories, and heart health
          </div>
        </div>
      )}
    </div>
  );
};

export default WearableInsights;
