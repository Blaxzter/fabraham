export const useTheme = () => {
  const colorMode = ref<"light" | "dark">("light");

  const setColorMode = (mode: "light" | "dark") => {
    colorMode.value = mode;

    if (import.meta.client) {
      if (mode === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("color-mode", mode);
    }
  };

  const toggleColorMode = () => {
    setColorMode(colorMode.value === "light" ? "dark" : "light");
  };

  const initializeTheme = () => {
    if (import.meta.client) {
      // Check for saved preference or default to system preference
      const saved = localStorage.getItem("color-mode") as
        | "light"
        | "dark"
        | null;

      if (saved) {
        setColorMode(saved);
      } else {
        // Check system preference
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        setColorMode(prefersDark ? "dark" : "light");
      }

      // Listen for system theme changes
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", (e) => {
          // Only auto-switch if user hasn't manually set a preference
          if (!localStorage.getItem("color-mode")) {
            setColorMode(e.matches ? "dark" : "light");
          }
        });
    }
  };

  return {
    colorMode: readonly(colorMode),
    setColorMode,
    toggleColorMode,
    initializeTheme,
  };
};
