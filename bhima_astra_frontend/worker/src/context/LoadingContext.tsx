import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import LoadingScreen from '../components/LoadingScreen';

interface LoadingContextType {
  loading: boolean;
  setLoading: (value: boolean) => void;
}

const LoadingContext = createContext<LoadingContextType>({
  loading: false,
  setLoading: () => {},
});

export const useLoader = () => useContext(LoadingContext);

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const isFirstRender = useRef(true);

  // Auto trigger on route change
  useEffect(() => {
    if (isFirstRender.current) {
       isFirstRender.current = false;
       return;
    }
    // Only trigger if user navigates to a new page
    setLoading(true);
  }, [location.pathname, location.search]);

  return (
    <LoadingContext.Provider value={{ loading, setLoading }}>
      {children}
      {loading && <LoadingScreen onFinish={() => setLoading(false)} />}
    </LoadingContext.Provider>
  );
};
