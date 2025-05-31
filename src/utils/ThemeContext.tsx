import React, {createContext, useContext, ReactNode} from 'react';

interface ThemeContextType {
  colors: {
    primary: string;
    background: string;
    text: string;
  };
}

const defaultTheme: ThemeContextType = {
  colors: {
    primary: '#0081FB',
    background: '#1a1a1a',
    text: '#FFFFFF',
  },
};

const ThemeContext = createContext<ThemeContextType>(defaultTheme);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({children}) => {
  return (
    <ThemeContext.Provider value={defaultTheme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  return useContext(ThemeContext);
};
