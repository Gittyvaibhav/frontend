const getApiBase = () => {
  const envBase =
    process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL;
  if (envBase) {
    return envBase;
  }
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:5000";
  }
  return "";
};

export default getApiBase;
