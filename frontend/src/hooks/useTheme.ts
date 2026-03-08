import { useEffect, useState } from "react";
import type { Theme } from "../types";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("ideallinie-theme") as Theme) || "lava";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ideallinie-theme", theme);
  }, [theme]);

  return { theme, setTheme };
}
