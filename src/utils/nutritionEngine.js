export const calculateBMR = ({ weight, height, age, gender }) => {
  if (!weight || !height || !age) return 0;
  if (gender === "male") {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  }
  return 10 * weight + 6.25 * height - 5 * age - 161;
};

export const calculateTDEE = ({ bmr, activityLevel }) => {
  const factors = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  return Math.round((bmr || 0) * (factors[activityLevel] || 1.2));
};

export const adjustCaloriesForGoal = ({ tdee, goal }) => {
  if (!tdee) return 0;
  if (goal === "cut") return tdee - 500;
  if (goal === "bulk") return tdee + 400;
  return tdee;
};

export const calculateMacros = ({ calories }) => {
  if (!calories) return { protein: 0, carbs: 0, fats: 0 };
  const protein = Math.round((calories * 0.3) / 4);
  const carbs = Math.round((calories * 0.4) / 4);
  const fats = Math.round((calories * 0.3) / 9);
  return { protein, carbs, fats };
};

export const generateMealPlan = () => [];
