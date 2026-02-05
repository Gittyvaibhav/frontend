import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import getApiBase from "../utils/apiBase";

const GOALS = [
  "fat loss",
  "muscle gain",
  "strength",
  "general fitness",
  "endurance",
  "maintenance",
];

const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"];

const EQUIPMENT_OPTIONS = [
  "full gym",
  "home",
  "bodyweight",
  "dumbbells",
  "bands",
  "kettlebell",
  "barbell",
  "machines",
];

const MUSCLE_GROUPS = [
  "full body",
  "chest",
  "back",
  "legs",
  "glutes",
  "shoulders",
  "arms",
  "biceps",
  "triceps",
  "core",
  "calves",
];

const DEFAULT_FORM = {
  title: "",
  goal: "muscle gain",
  experienceLevel: "beginner",
  daysPerWeek: 4,
  equipment: "full gym",
  timePerSession: 60,
  targetMuscleGroups: ["chest", "back", "legs", "shoulders"],
  injuries: "",
};

const API_BASE = getApiBase();

const WorkoutPlanner = () => {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedPlans, setSavedPlans] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [filters, setFilters] = useState({
    goal: "",
    muscleGroups: [],
    favorite: false,
    search: "",
    sort: "favorites",
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [muscleTagSearch, setMuscleTagSearch] = useState("");
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState("");
  const [calendarStartDate, setCalendarStartDate] = useState("");
  const [calendarStartTime, setCalendarStartTime] = useState("07:00");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [filters, debouncedSearch]);

  useEffect(() => {
    const stored = localStorage.getItem("workoutPlannerPresets");
    if (stored) {
      try {
        setPresets(JSON.parse(stored));
      } catch (err) {
        setError("Failed to load saved presets.");
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("workoutPlannerPresets", JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(filters.search.trim());
    }, 350);
    return () => clearTimeout(handle);
  }, [filters.search]);

  const suggestTitle = useCallback(
    (nextForm) => {
      const base = nextForm || form;
      const goal = base.goal || "plan";
      const days = base.daysPerWeek || 0;
      const level = base.experienceLevel || "";
      return `${goal} • ${days} day • ${level}`.trim();
    },
    [form]
  );

  useEffect(() => {
    if (titleTouched || form.title) return;
    setForm((prev) => ({
      ...prev,
      title: suggestTitle(prev),
    }));
  }, [suggestTitle, titleTouched, form.title]);

  const fetchSavedPlans = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "8",
      });
      if (filters.goal) params.set("goal", filters.goal);
      if (filters.muscleGroups.length) {
        params.set("muscleGroup", filters.muscleGroups.join(","));
      }
      if (filters.favorite) params.set("favorite", "true");
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filters.sort) params.set("sort", filters.sort);

      const res = await axios.get(
        `${API_BASE}/api/workout/ai-plans?${params.toString()}`
      );
      const payload = res.data || {};
      setSavedPlans(payload.data || []);
      setTotalPages(payload.totalPages || 1);
    } catch (err) {
      setError("Failed to load saved plans.");
    } finally {
      setHistoryLoading(false);
    }
  }, [page, filters, debouncedSearch]);

  useEffect(() => {
    fetchSavedPlans();
  }, [fetchSavedPlans]);

  const updateField = (field, value) => {
    if (field === "title") {
      setTitleTouched(true);
    }
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const toggleMuscleGroup = (group) => {
    setForm((prev) => {
      const set = new Set(prev.targetMuscleGroups);
      if (set.has(group)) {
        set.delete(group);
      } else {
        set.add(group);
      }
      return { ...prev, targetMuscleGroups: Array.from(set) };
    });
  };

  const toggleFilterMuscle = (group) => {
    setFilters((prev) => {
      const set = new Set(prev.muscleGroups);
      if (set.has(group)) {
        set.delete(group);
      } else {
        set.add(group);
      }
      return { ...prev, muscleGroups: Array.from(set) };
    });
  };

  const clearFilters = () => {
    setFilters({
      goal: "",
      muscleGroups: [],
      favorite: false,
      search: "",
      sort: "favorites",
    });
    setMuscleTagSearch("");
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) {
      setError("Please enter a preset name.");
      return;
    }
    const next = presets.filter((p) => p.name !== name);
    next.push({ name, filters });
    setPresets(next);
    setPresetName("");
    setError("");
  };

  const loadPreset = (preset) => {
    if (!preset?.filters) return;
    setFilters(preset.filters);
  };

  const deletePreset = (name) => {
    setPresets((prev) => prev.filter((p) => p.name !== name));
  };

  const validateForm = () => {
    if (!form.goal || !form.experienceLevel || !form.equipment) {
      return "Please select goal, experience level, and equipment.";
    }
    if (!form.title || !form.title.trim()) {
      return "Please enter a plan title.";
    }
    const days = Number(form.daysPerWeek);
    if (!Number.isFinite(days) || days < 1 || days > 7) {
      return "Days per week must be between 1 and 7.";
    }
    const time = Number(form.timePerSession);
    if (!Number.isFinite(time) || time < 15 || time > 120) {
      return "Time per session must be between 15 and 120 minutes.";
    }
    if (!form.targetMuscleGroups || form.targetMuscleGroups.length === 0) {
      return "Pick at least one target muscle group.";
    }
    return "";
  };

  const submitPlan = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError("");
    setPlan(null);
    try {
      const payload = {
        ...form,
        daysPerWeek: Number(form.daysPerWeek),
        timePerSession: Number(form.timePerSession),
        targetMuscleGroups: form.targetMuscleGroups,
      };
      const res = await axios.post(`${API_BASE}/api/workout/ai-plan`, payload);
      setPlan(res.data);
      fetchSavedPlans();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to generate plan."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadSavedPlan = (saved) => {
    if (!saved?.plan) return;
    setPlan({
      ...saved.plan,
      savedPlanId: saved._id,
      savedAt: saved.createdAt,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startRename = (saved) => {
    setRenamingId(saved._id);
    setRenameValue(saved.title || "");
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const submitRename = async (id) => {
    if (!renameValue.trim()) {
      setError("Title cannot be empty.");
      return;
    }
    try {
      await axios.patch(`${API_BASE}/api/workout/ai-plans/${id}`, {
        title: renameValue.trim(),
      });
      cancelRename();
      fetchSavedPlans();
      setError("");
    } catch (err) {
      setError("Failed to rename plan.");
    }
  };

  const deletePlan = async (id) => {
    const ok = window.confirm("Delete this saved plan?");
    if (!ok) return;
    try {
      await axios.delete(`${API_BASE}/api/workout/ai-plans/${id}`);
      fetchSavedPlans();
    } catch (err) {
      setError("Failed to delete plan.");
    }
  };

  const toggleFavorite = async (saved) => {
    try {
      await axios.patch(
        `${API_BASE}/api/workout/ai-plans/${saved._id}/favorite`,
        { favorite: !saved.favorite }
      );
      fetchSavedPlans();
    } catch (err) {
      setError("Failed to update favorite.");
    }
  };

  const downloadIcs = () => {
    if (!plan?.weeklySchedule?.length) return;

    const baseDate = calendarStartDate
      ? new Date(`${calendarStartDate}T${calendarStartTime || "07:00"}`)
      : new Date();

    if (!calendarStartDate) {
      baseDate.setDate(baseDate.getDate() + 1);
      baseDate.setHours(7, 0, 0, 0);
    }

    const pad = (n) => String(n).padStart(2, "0");
    const toIcsDate = (date) =>
      `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(
        date.getUTCDate()
      )}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;

    let ics =
      "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//AI Gym Trainer//Workout Plan//EN\n";

    plan.weeklySchedule.forEach((day, index) => {
      const eventDate = new Date(baseDate);
      eventDate.setDate(baseDate.getDate() + index);

      const endDate = new Date(eventDate);
      endDate.setMinutes(eventDate.getMinutes() + 60);

      const summary = `${day.day}: ${day.muscleFocus || "Workout"}`;
      const description = [
        ...(day.warmup || []).map((w) => `Warmup: ${w}`),
        ...(day.exercises || []).map(
          (ex) =>
            `Exercise: ${ex.name} — ${ex.sets} sets x ${ex.reps} (rest ${ex.restSeconds}s)`
        ),
        ...(day.cardio || []).map(
          (c) =>
            `Cardio: ${c.type} ${c.durationMinutes} min (${c.intensity})`
        ),
        ...(day.cooldown || []).map((c) => `Cooldown: ${c}`),
      ]
        .join("\\n")
        .replace(/,/g, "\\,");

      ics +=
        "BEGIN:VEVENT\n" +
        `UID:${Date.now()}-${index}@ai-gym-trainer\n` +
        `DTSTAMP:${toIcsDate(new Date())}\n` +
        `DTSTART:${toIcsDate(eventDate)}\n` +
        `DTEND:${toIcsDate(endDate)}\n` +
        `SUMMARY:${summary}\n` +
        `DESCRIPTION:${description}\n` +
        "END:VEVENT\n";
    });

    ics += "END:VCALENDAR";

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "workout-plan.ics";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    if (!plan) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const styles = `
      body {
        font-family: 'Segoe UI', Arial, sans-serif;
        padding: 40px;
        color: #1f2937;
        max-width: 900px;
        margin: 0 auto;
      }
      h1 {
        color: #111827;
        font-size: 32px;
        margin-bottom: 12px;
        border-bottom: 3px solid #667eea;
        padding-bottom: 12px;
      }
      h2 {
        color: #374151;
        font-size: 24px;
        margin-top: 32px;
        margin-bottom: 16px;
      }
      h3 {
        color: #4b5563;
        font-size: 18px;
        margin-top: 20px;
        margin-bottom: 10px;
      }
      .muted {
        color: #6b7280;
        font-size: 14px;
      }
      ul {
        padding-left: 20px;
        margin: 8px 0;
      }
      li {
        margin: 6px 0;
        line-height: 1.6;
      }
      .day {
        margin-bottom: 28px;
        padding: 20px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #f9fafb;
        page-break-inside: avoid;
      }
      .day-header {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        padding: 12px 16px;
        border-radius: 6px;
        margin: -20px -20px 16px -20px;
      }
      @media print {
        body {
          padding: 20px;
        }
        .day {
          page-break-inside: avoid;
        }
      }
    `;

    const dayBlocks = (plan.weeklySchedule || [])
      .map(
        (day) => `
        <div class="day">
          <div class="day-header">
            <strong>${day.day}</strong><br>
            <span class="muted">${day.muscleFocus || ""}</span>
          </div>
          ${
            day.warmup?.length
              ? `<h3>🔥 Warmup</h3><ul>${day.warmup
                  .map((w) => `<li>${w}</li>`)
                  .join("")}</ul>`
              : ""
          }
          ${
            day.exercises?.length
              ? `<h3>💪 Exercises</h3><ul>${day.exercises
                  .map(
                    (ex) =>
                      `<li>${ex.name} — ${ex.sets} sets x ${
                        ex.reps
                      } (rest ${ex.restSeconds}s)${
                        ex.notes ? ` • ${ex.notes}` : ""
                      }</li>`
                  )
                  .join("")}</ul>`
              : ""
          }
          ${
            day.cardio?.length
              ? `<h3>🏃 Cardio</h3><ul>${day.cardio
                  .map(
                    (c) =>
                      `<li>${c.type} — ${c.durationMinutes} min (${c.intensity})</li>`
                  )
                  .join("")}</ul>`
              : ""
          }
          ${
            day.cooldown?.length
              ? `<h3>🧘 Cooldown</h3><ul>${day.cooldown
                  .map((c) => `<li>${c}</li>`)
                  .join("")}</ul>`
              : ""
          }
        </div>
      `
      )
      .join("");

    const tips = plan.progressionTips?.length
      ? `<h2>📈 Progression Tips</h2><ul>${plan.progressionTips
          .map((t) => `<li>${t}</li>`)
          .join("")}</ul>`
      : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Workout Plan</title>
          <style>${styles}</style>
        </head>
        <body>
          <h1>🏋️ Workout Plan</h1>
          <p>${plan.summary || ""}</p>
          <p class="muted"><strong>Training Split:</strong> ${
            plan.split || ""
          }</p>
          ${dayBlocks}
          ${tips}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const activeFilterCount =
    (filters.goal ? 1 : 0) +
    filters.muscleGroups.length +
    (filters.favorite ? 1 : 0) +
    (filters.search ? 1 : 0);

  return (
    <div style={styles.page}>
      {/* Background Glows */}
      <div style={styles.glowTop}></div>
      <div style={styles.glowBottom}></div>

      {/* Header */}
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>💪 Workout Planner</h1>
          <p style={styles.subtitle}>
            Get a personalized weekly workout plan tailored to your goals and
            available equipment
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div style={styles.errorBanner}>
            <span>⚠️ {error}</span>
            <button
              onClick={() => setError("")}
              style={styles.errorClose}
              aria-label="Close error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Plan Settings Card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>⚙️ Plan Settings</h2>
          <div style={styles.form}>
            {/* Plan Title */}
            <div style={styles.label}>
              <span style={styles.labelText}>Plan Title</span>
              <div style={styles.titleRow}>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  style={styles.input}
                />
                <button
                  onClick={() => {
                    setTitleTouched(true);
                    updateField("title", suggestTitle());
                  }}
                  style={styles.autoButton}
                >
                  ✨ Auto
                </button>
              </div>
            </div>

            {/* Goal and Experience */}
            <div style={styles.row}>
              <div style={{ ...styles.label, flex: 1 }}>
                <span style={styles.labelText}>Primary Goal</span>
                <select
                  value={form.goal}
                  onChange={(e) => updateField("goal", e.target.value)}
                  style={styles.select}
                >
                  {GOALS.map((g) => (
                    <option key={g} value={g} style={styles.option}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ ...styles.label, flex: 1 }}>
                <span style={styles.labelText}>Experience Level</span>
                <select
                  value={form.experienceLevel}
                  onChange={(e) =>
                    updateField("experienceLevel", e.target.value)
                  }
                  style={styles.select}
                >
                  {EXPERIENCE_LEVELS.map((level) => (
                    <option key={level} value={level} style={styles.option}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Days and Time */}
            <div style={styles.row}>
              <div style={{ ...styles.label, flex: 1 }}>
                <span style={styles.labelText}>Days Per Week</span>
                <input
                  type="number"
                  min="1"
                  max="7"
                  value={form.daysPerWeek}
                  onChange={(e) => updateField("daysPerWeek", e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={{ ...styles.label, flex: 1 }}>
                <span style={styles.labelText}>Time Per Session (minutes)</span>
                <input
                  type="number"
                  min="15"
                  max="120"
                  value={form.timePerSession}
                  onChange={(e) =>
                    updateField("timePerSession", e.target.value)
                  }
                  style={styles.input}
                />
              </div>
            </div>

            {/* Equipment */}
            <div style={styles.label}>
              <span style={styles.labelText}>Available Equipment</span>
              <select
                value={form.equipment}
                onChange={(e) => updateField("equipment", e.target.value)}
                style={styles.select}
              >
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <option key={eq} value={eq} style={styles.option}>
                    {eq}
                  </option>
                ))}
              </select>
            </div>

            {/* Injuries */}
            <div style={styles.label}>
              <span style={styles.labelText}>
                Injuries or Limitations (optional)
              </span>
              <input
                type="text"
                value={form.injuries}
                onChange={(e) => updateField("injuries", e.target.value)}
                style={styles.input}
              />
            </div>

            {/* Target Muscle Groups */}
            <div style={styles.muscleSection}>
              <div>
                <span style={styles.labelText}>Target Muscle Groups</span>
                <span style={styles.badge}>
                  {form.targetMuscleGroups.length} selected
                </span>
              </div>
              <div style={styles.muscleGrid}>
                {MUSCLE_GROUPS.map((group) => (
                  <button
                    key={group}
                    onClick={() => toggleMuscleGroup(group)}
                    style={{
                      ...styles.muscleButton,
                      ...(form.targetMuscleGroups.includes(group) &&
                        styles.muscleButtonActive),
                    }}
                  >
                    {form.targetMuscleGroups.includes(group) && "✓ "}
                    {group}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={submitPlan}
              disabled={loading}
              style={{
                ...styles.primaryButton,
                ...(loading && styles.buttonDisabled),
              }}
            >
              {loading ? (
                <div style={styles.buttonContent}>
                  <div style={styles.spinner}></div>
                  Generating Your Plan...
                </div>
              ) : (
                "🚀 Generate My Workout Plan"
              )}
            </button>
          </div>
        </div>

        {/* Your AI Plan Card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>📋 Your AI Plan</h2>

          {!plan && !loading && (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>📝</span>
              <p style={styles.emptyText}>
                Configure your settings and generate a plan to see your
                personalized weekly workout schedule
              </p>
            </div>
          )}

          {loading && (
            <div style={styles.loadingState}>
              <div style={styles.loadingSpinner}></div>
              <p style={styles.loadingText}>
                Creating your personalized plan...
              </p>
            </div>
          )}

          {plan && (
            <div style={styles.planResult}>
              {/* Plan Header */}
              <div style={styles.planHeader}>
                <div>
                  <p style={styles.planSummary}>{plan.summary}</p>
                  <p style={styles.planSplit}>
                    Training Split: {plan.split}
                  </p>
                </div>
                <div style={styles.planActions}>
                  <button onClick={downloadPdf} style={styles.actionButton}>
                    📄 PDF
                  </button>
                  <button onClick={downloadIcs} style={styles.actionButton}>
                    📅 Calendar
                  </button>
                </div>
              </div>

              {/* Calendar Settings */}
              <div style={styles.calendarSettings}>
                <div style={styles.calendarLabel}>
                  <span style={styles.calendarLabelText}>📅 Start Date</span>
                  <input
                    type="date"
                    value={calendarStartDate}
                    onChange={(e) => setCalendarStartDate(e.target.value)}
                    style={styles.input}
                  />
                </div>
                <div style={styles.calendarLabel}>
                  <span style={styles.calendarLabelText}>🕐 Start Time</span>
                  <input
                    type="time"
                    value={calendarStartTime}
                    onChange={(e) => setCalendarStartTime(e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>

              {/* Weekly Schedule */}
              <div style={styles.daysContainer}>
                {plan.weeklySchedule?.map((day, index) => (
                  <div key={index} style={styles.dayCard}>
                    <div style={styles.dayHeader}>
                      <h3 style={styles.dayTitle}>{day.day}</h3>
                      <p style={styles.dayFocus}>{day.muscleFocus}</p>
                    </div>
                    <div style={styles.dayContent}>
                      {day.warmup?.length > 0 && (
                        <div style={styles.section}>
                          <span style={styles.sectionTitle}>🔥 Warmup</span>
                          <ul style={styles.list}>
                            {day.warmup.map((item, i) => (
                              <li key={i} style={styles.listItem}>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {day.exercises?.length > 0 && (
                        <div style={styles.section}>
                          <span style={styles.sectionTitle}>💪 Exercises</span>
                          <div style={styles.exerciseList}>
                            {day.exercises.map((ex, i) => (
                              <div key={i} style={styles.exerciseCard}>
                                <div style={styles.exerciseName}>
                                  {ex.name}
                                </div>
                                <div style={styles.exerciseDetails}>
                                  {ex.sets} sets × {ex.reps} • Rest{" "}
                                  {ex.restSeconds}s
                                </div>
                                {ex.notes && (
                                  <div style={styles.exerciseNotes}>
                                    💡 {ex.notes}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {day.cardio?.length > 0 && (
                        <div style={styles.section}>
                          <span style={styles.sectionTitle}>🏃 Cardio</span>
                          <ul style={styles.list}>
                            {day.cardio.map((cardio, i) => (
                              <li key={i} style={styles.listItem}>
                                {cardio.type} — {cardio.durationMinutes} minutes (
                                <span style={styles.intensity}>
                                  {cardio.intensity}
                                </span>
                                )
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {day.cooldown?.length > 0 && (
                        <div style={styles.section}>
                          <span style={styles.sectionTitle}>🧘 Cooldown</span>
                          <ul style={styles.list}>
                            {day.cooldown.map((item, i) => (
                              <li key={i} style={styles.listItem}>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Progression Tips */}
              {plan.progressionTips?.length > 0 && (
                <div style={styles.tipsCard}>
                  <span style={styles.tipsTitle}>📈 Progression Tips</span>
                  <ul style={styles.tipsList}>
                    {plan.progressionTips.map((tip, i) => (
                      <li key={i} style={styles.tipItem}>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Saved Plans Card */}
        <div style={styles.card}>
          <div style={styles.savedHeader}>
            <h2 style={styles.cardTitle}>💾 Saved Plans</h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={styles.filterToggle}
            >
              🔍 Filters{" "}
              {activeFilterCount > 0 && (
                <span style={styles.filterBadge}>{activeFilterCount}</span>
              )}
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div style={styles.filterPanel}>
              <input
                type="text"
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                placeholder="🔍 Search by title..."
                style={styles.input}
              />

              <div style={styles.row}>
                <select
                  value={filters.goal}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, goal: e.target.value }))
                  }
                  style={{ ...styles.select, flex: 1 }}
                >
                  <option value="">All Goals</option>
                  {GOALS.map((g) => (
                    <option key={g} value={g} style={styles.option}>
                      {g}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.sort}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, sort: e.target.value }))
                  }
                  style={{ ...styles.select, flex: 1 }}
                >
                  <option value="favorites">⭐ Favorites First</option>
                  <option value="recent">🕐 Most Recent</option>
                </select>
              </div>

              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={filters.favorite}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      favorite: e.target.checked,
                    }))
                  }
                  style={styles.checkbox}
                />
                ⭐ Favorites Only
              </label>

              {/* Muscle Group Filters */}
              <div style={styles.label}>
                <span style={styles.labelText}>Muscle Groups</span>
                <input
                  type="text"
                  value={muscleTagSearch}
                  onChange={(e) => setMuscleTagSearch(e.target.value)}
                  placeholder="Filter tags..."
                  style={{ ...styles.input, marginTop: "6px" }}
                />
                <div style={styles.tagContainer}>
                  {MUSCLE_GROUPS.filter((group) =>
                    group.includes(muscleTagSearch.trim().toLowerCase())
                  ).map((group) => (
                    <button
                      key={group}
                      onClick={() => toggleFilterMuscle(group)}
                      style={{
                        ...styles.tag,
                        ...(filters.muscleGroups.includes(group) &&
                          styles.tagActive),
                      }}
                    >
                      {group}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={clearFilters} style={styles.secondaryButton}>
                Clear All Filters
              </button>

              {/* Presets */}
              <div style={styles.presetSection}>
                <div style={styles.row}>
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset name"
                    style={{ ...styles.input, flex: 1 }}
                  />
                  <button onClick={savePreset} style={styles.secondaryButton}>
                    💾 Save
                  </button>
                </div>

                {presets.length > 0 && (
                  <div style={styles.presetList}>
                    {presets.map((preset) => (
                      <div key={preset.name} style={styles.presetItem}>
                        <button
                          onClick={() => loadPreset(preset)}
                          style={styles.presetButton}
                        >
                          📁 {preset.name}
                        </button>
                        <button
                          onClick={() => deletePreset(preset.name)}
                          style={styles.deleteButton}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Saved Plans List */}
          {historyLoading && (
            <div style={styles.loadingState}>
              <div style={styles.loadingSpinner}></div>
              <p style={styles.loadingText}>Loading saved plans...</p>
            </div>
          )}

          {!historyLoading && savedPlans.length === 0 && (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>📭</span>
              <p style={styles.emptyText}>
                {activeFilterCount > 0
                  ? "No plans match your filters"
                  : "No saved plans yet. Generate your first plan above!"}
              </p>
            </div>
          )}

          {!historyLoading && savedPlans.length > 0 && (
            <>
              <div style={styles.historyList}>
                {savedPlans.map((saved) => (
                  <div key={saved._id} style={styles.historyItem}>
                    <button
                      onClick={() => loadSavedPlan(saved)}
                      style={styles.historyMain}
                    >
                      <div style={styles.historyTitle}>
                        {saved.favorite && "⭐ "}
                        {saved.title || saved.plan?.split || "Plan"}
                      </div>
                      <div style={styles.historyMeta}>
                        {saved.goal} • {saved.daysPerWeek} days/week
                      </div>
                      <div style={styles.historyDate}>
                        {new Date(saved.createdAt).toLocaleDateString()}
                      </div>
                    </button>

                    {renamingId === saved._id ? (
                      <div style={styles.renameForm}>
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          placeholder="New title"
                          style={styles.input}
                        />
                        <button
                          onClick={() => submitRename(saved._id)}
                          style={styles.iconButton}
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelRename}
                          style={styles.iconButton}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={styles.historyActions}>
                        <button
                          onClick={() => toggleFavorite(saved)}
                          style={styles.iconButton}
                          title={
                            saved.favorite
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                        >
                          {saved.favorite ? "⭐" : "☆"}
                        </button>
                        <button
                          onClick={() => startRename(saved)}
                          style={styles.iconButton}
                          title="Rename"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deletePlan(saved._id)}
                          style={styles.iconButton}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={styles.pagination}>
                  <button
                    style={{
                      ...styles.paginationButton,
                      ...(page <= 1 && styles.buttonDisabled),
                    }}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    ← Prev
                  </button>
                  <span style={styles.paginationText}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    style={{
                      ...styles.paginationButton,
                      ...(page >= totalPages && styles.buttonDisabled),
                    }}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={page >= totalPages}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Styles object matching the original dark theme
const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
    color: "white",
    padding: "20px",
    position: "relative",
  },
  glowTop: {
    position: "absolute",
    top: "-10%",
    right: "-5%",
    width: "500px",
    height: "500px",
    background:
      "radial-gradient(circle, rgba(102, 126, 234, 0.15) 0%, transparent 70%)",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  glowBottom: {
    position: "absolute",
    bottom: "-10%",
    left: "-5%",
    width: "400px",
    height: "400px",
    background:
      "radial-gradient(circle, rgba(245, 87, 108, 0.15) 0%, transparent 70%)",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },
  header: {
    textAlign: "center",
    marginBottom: "40px",
  },
  title: {
    fontSize: "2.5rem",
    fontWeight: "bold",
    margin: "0 0 10px 0",
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: "1rem",
    margin: 0,
  },
  errorBanner: {
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "12px",
    padding: "12px 20px",
    marginBottom: "24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#fca5a5",
  },
  errorClose: {
    background: "none",
    border: "none",
    color: "#fca5a5",
    fontSize: "20px",
    cursor: "pointer",
    padding: "0 8px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
    gap: "24px",
  },
  card: {
    background: "rgba(255, 255, 255, 0.05)",
    backdropFilter: "blur(10px)",
    borderRadius: "20px",
    padding: "30px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
    marginBottom: "24px",
  },
  cardTitle: {
    fontSize: "1.5rem",
    fontWeight: "600",
    margin: "0 0 24px 0",
    color: "white",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  labelText: {
    fontSize: "0.875rem",
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.9)",
  },
  input: {
    padding: "12px 16px",
    borderRadius: "10px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    background: "rgba(255, 255, 255, 0.08)",
    color: "white",
    fontSize: "0.9375rem",
    outline: "none",
    transition: "all 0.3s ease",
  },
  select: {
    padding: "12px 16px",
    borderRadius: "10px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    background: "rgba(255, 255, 255, 0.08)",
    color: "white",
    fontSize: "0.9375rem",
    outline: "none",
    cursor: "pointer",
    textTransform: "capitalize",
  },
  option: {
    background: "#1a1a2e",
    color: "white",
    textTransform: "capitalize",
  },
  titleRow: {
    display: "flex",
    gap: "10px",
  },
  row: {
    display: "flex",
    gap: "16px",
  },
  muscleSection: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  badge: {
    background: "rgba(102, 126, 234, 0.2)",
    color: "#a5b4fc",
    padding: "4px 12px",
    borderRadius: "12px",
    fontSize: "0.75rem",
    fontWeight: "500",
    marginLeft: "8px",
  },
  muscleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: "10px",
  },
  muscleButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    background: "rgba(255, 255, 255, 0.08)",
    color: "white",
    fontSize: "0.875rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
    textTransform: "capitalize",
    fontWeight: "500",
  },
  muscleButtonActive: {
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    borderColor: "transparent",
    boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
  },
  primaryButton: {
    padding: "16px 32px",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    color: "white",
    fontSize: "1rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 10px 25px rgba(102, 126, 234, 0.4)",
  },
  secondaryButton: {
    padding: "10px 20px",
    borderRadius: "10px",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    background: "rgba(255, 255, 255, 0.08)",
    color: "white",
    fontSize: "0.875rem",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  autoButton: {
    padding: "12px 20px",
    borderRadius: "10px",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    background: "rgba(255, 255, 255, 0.08)",
    color: "white",
    fontSize: "0.875rem",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.3s ease",
    whiteSpace: "nowrap",
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  buttonContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
  },
  spinner: {
    width: "16px",
    height: "16px",
    border: "2px solid rgba(255, 255, 255, 0.3)",
    borderTop: "2px solid white",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    color: "rgba(255, 255, 255, 0.6)",
  },
  emptyIcon: {
    fontSize: "3rem",
    display: "block",
    marginBottom: "16px",
  },
  emptyText: {
    fontSize: "0.9375rem",
    margin: 0,
    lineHeight: 1.6,
  },
  loadingState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
    padding: "60px 20px",
  },
  loadingSpinner: {
    width: "48px",
    height: "48px",
    border: "4px solid rgba(255, 255, 255, 0.1)",
    borderTop: "4px solid #667eea",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: "0.9375rem",
  },
  planResult: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  planHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    padding: "20px",
    background: "rgba(102, 126, 234, 0.1)",
    borderRadius: "12px",
    border: "1px solid rgba(102, 126, 234, 0.2)",
  },
  planSummary: {
    margin: "0 0 8px 0",
    fontSize: "0.9375rem",
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 1.6,
  },
  planSplit: {
    margin: 0,
    fontSize: "0.875rem",
    color: "rgba(255, 255, 255, 0.7)",
  },
  planActions: {
    display: "flex",
    gap: "10px",
    flexShrink: 0,
  },
  actionButton: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    background: "rgba(255, 255, 255, 0.08)",
    color: "white",
    fontSize: "0.875rem",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.3s ease",
  },
  calendarSettings: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    padding: "16px",
    background: "rgba(255, 255, 255, 0.03)",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  calendarLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  calendarLabelText: {
    fontSize: "0.8125rem",
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "500",
  },
  daysContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  dayCard: {
    background: "rgba(255, 255, 255, 0.03)",
    borderRadius: "16px",
    overflow: "hidden",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    transition: "all 0.3s ease",
  },
  dayHeader: {
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    padding: "16px 20px",
  },
  dayTitle: {
    margin: "0 0 4px 0",
    fontSize: "1.25rem",
    fontWeight: "600",
    color: "white",
  },
  dayFocus: {
    fontSize: "0.875rem",
    color: "rgba(255, 255, 255, 0.9)",
    margin: 0,
  },
  dayContent: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  sectionTitle: {
    fontSize: "0.9375rem",
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "600",
  },
  list: {
    margin: 0,
    paddingLeft: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  listItem: {
    fontSize: "0.875rem",
    color: "rgba(255, 255, 255, 0.8)",
    lineHeight: 1.6,
  },
  exerciseList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  exerciseCard: {
    padding: "14px 16px",
    background: "rgba(255, 255, 255, 0.05)",
    borderRadius: "10px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  exerciseName: {
    fontSize: "0.9375rem",
    fontWeight: "600",
    color: "white",
    marginBottom: "6px",
  },
  exerciseDetails: {
    fontSize: "0.8125rem",
    color: "rgba(255, 255, 255, 0.7)",
  },
  exerciseNotes: {
    fontSize: "0.8125rem",
    color: "rgba(165, 180, 252, 0.9)",
    fontStyle: "italic",
    marginTop: "6px",
  },
  intensity: {
    color: "rgba(251, 191, 36, 0.9)",
  },
  tipsCard: {
    background: "rgba(34, 197, 94, 0.1)",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid rgba(34, 197, 94, 0.2)",
  },
  tipsTitle: {
    display: "block",
    fontSize: "1rem",
    fontWeight: "600",
    color: "rgba(134, 239, 172, 1)",
    marginBottom: "12px",
  },
  tipsList: {
    margin: 0,
    paddingLeft: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  tipItem: {
    fontSize: "0.875rem",
    color: "rgba(255, 255, 255, 0.85)",
    lineHeight: 1.6,
  },
  savedHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  filterToggle: {
    padding: "10px 20px",
    borderRadius: "10px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    background: "rgba(255, 255, 255, 0.08)",
    color: "white",
    fontSize: "0.875rem",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  filterBadge: {
    background: "rgba(102, 126, 234, 0.3)",
    padding: "2px 8px",
    borderRadius: "10px",
    fontSize: "0.75rem",
    marginLeft: "6px",
  },
  filterPanel: {
    background: "rgba(255, 255, 255, 0.03)",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "0.875rem",
    color: "rgba(255, 255, 255, 0.9)",
    cursor: "pointer",
  },
  checkbox: {
    width: "18px",
    height: "18px",
    cursor: "pointer",
  },
  tagContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "10px",
  },
  tag: {
    padding: "8px 14px",
    borderRadius: "20px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    background: "rgba(255, 255, 255, 0.08)",
    color: "white",
    fontSize: "0.8125rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
    textTransform: "capitalize",
  },
  tagActive: {
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    borderColor: "transparent",
  },
  presetSection: {
    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
    paddingTop: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  presetList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  presetItem: {
    display: "flex",
    gap: "8px",
  },
  presetButton: {
    flex: 1,
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    background: "rgba(255, 255, 255, 0.08)",
    color: "white",
    fontSize: "0.875rem",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.3s ease",
  },
  deleteButton: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    background: "rgba(239, 68, 68, 0.1)",
    color: "#fca5a5",
    fontSize: "0.875rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  historyList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  historyItem: {
    background: "rgba(255, 255, 255, 0.03)",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    transition: "all 0.3s ease",
  },
  historyMain: {
    background: "none",
    border: "none",
    padding: 0,
    textAlign: "left",
    cursor: "pointer",
    width: "100%",
    color: "white",
  },
  historyTitle: {
    fontSize: "1rem",
    fontWeight: "600",
    color: "white",
    marginBottom: "6px",
  },
  historyMeta: {
    fontSize: "0.875rem",
    color: "rgba(255, 255, 255, 0.7)",
    textTransform: "capitalize",
    marginBottom: "4px",
  },
  historyDate: {
    fontSize: "0.8125rem",
    color: "rgba(255, 255, 255, 0.5)",
  },
  historyActions: {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
  },
  renameForm: {
    display: "flex",
    gap: "8px",
  },
  iconButton: {
    padding: "8px 14px",
    borderRadius: "8px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    background: "rgba(255, 255, 255, 0.08)",
    color: "white",
    fontSize: "0.875rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  pagination: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "20px",
    paddingTop: "20px",
    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
  },
  paginationButton: {
    padding: "10px 20px",
    borderRadius: "10px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    background: "rgba(255, 255, 255, 0.08)",
    color: "white",
    fontSize: "0.875rem",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  paginationText: {
    fontSize: "0.875rem",
    color: "rgba(255, 255, 255, 0.7)",
  },
};

// Add CSS animation for spinner
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default WorkoutPlanner;
