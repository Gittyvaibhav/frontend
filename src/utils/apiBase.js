const getApiBase = () => {
  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }
  if (
    typeof window !== "undefined" &&
    window.location &&
    window.location.origin &&
    window.location.origin.includes("localhost")
  ) {
    return "http://localhost:5000";
  }
  return "";
};

export default getApiBase;
