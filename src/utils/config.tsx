import { useTheme } from "./ThemeContext";

export const IsDarkMode = () => {
  const {isDarkMode} = useTheme();
  return isDarkMode;
};
