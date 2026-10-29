import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useAppStore } from '../store/useAppStore';

interface AppContextType {
  isDarkMode: boolean;
}

const AppContext = createContext<AppContextType>({
  isDarkMode: false,
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const storeTheme = useAppStore((state) => state.theme);
  const resolvedTheme =
    storeTheme === 'light' ? false : storeTheme === 'dark' ? true : systemScheme === 'dark';

  const value = useMemo(() => ({ isDarkMode: resolvedTheme }), [resolvedTheme]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);
