import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { deleteUser, getLoggedIn, login, logout, register, updateUser } from "./requests";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  const bootstrapAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getLoggedIn();
      setIsLoggedIn(Boolean(response.loggedIn));
      setUser(response.user || null);
    } catch {
      setIsLoggedIn(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrapAuth();
  }, [bootstrapAuth]);

  const loginUser = useCallback(async (payload) => {
    const response = await login(payload);
    setIsLoggedIn(true);
    setUser(response.user || null);
    return response;
  }, []);

  const registerUser = useCallback(async (payload) => {
    const response = await register(payload);
    setIsLoggedIn(true);
    setUser(response.user || null);
    return response;
  }, []);

  const updateCurrentUser = useCallback(async (payload) => {
    const response = await updateUser(payload);
    setIsLoggedIn(true);
    setUser(response.user || null);
    return response;
  }, []);

  const deleteCurrentUser = useCallback(async () => {
    const response = await deleteUser();
    setIsLoggedIn(false);
    setUser(null);
    return response;
  }, []);

  const logoutUser = useCallback(async () => {
    await logout();
    setIsLoggedIn(false);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      isLoading,
      isLoggedIn,
      user,
      bootstrapAuth,
      loginUser,
      registerUser,
      updateCurrentUser,
      deleteCurrentUser,
      logoutUser,
    }),
    [
      isLoading,
      isLoggedIn,
      user,
      bootstrapAuth,
      loginUser,
      registerUser,
      updateCurrentUser,
      deleteCurrentUser,
      logoutUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
