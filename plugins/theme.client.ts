export default defineNuxtPlugin(() => {
  const { initializeTheme } = useTheme();

  // Initialize theme on app start
  initializeTheme();
});
