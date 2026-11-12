import { useEffect, useState } from "react";
import { CLASS_NAMES } from "./classes.js";

// Default values shown on the Settings page (same values as the backend DEFAULTS).
export const DEFAULT_SETTINGS = {
  apiBase: "http://localhost:8000",
  conf: 0.25,
  iou: 0.7,
  imgsz: 640,
  maxDet: 300,
  frameStride: 1,
  showLabels: true,
  showConf: true,
  saveHistory: true,
  classes: [...CLASS_NAMES],
};

const KEY = "roadvision.settings";

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event("roadvision-settings"));
}

export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);
  useEffect(() => {
    const onChange = () => setSettings(loadSettings());
    window.addEventListener("roadvision-settings", onChange);
    return () => window.removeEventListener("roadvision-settings", onChange);
  }, []);
  return settings;
}
