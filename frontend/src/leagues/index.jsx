import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/index.jsx";
import { getLeagues } from "../auth/requests";

const STORAGE_KEY = "draft-kit:selected-league-id";
const LeagueContext = createContext(null);

function getStoredLeagueId() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function LeagueProvider({ children }) {
  const { isLoggedIn } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState(() => getStoredLeagueId());
  const [isLoadingLeagues, setIsLoadingLeagues] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      setLeagues([]);
      setSelectedLeagueId("");
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage failures.
      }
      return;
    }

    let isMounted = true;

    async function loadLeagues() {
      setIsLoadingLeagues(true);
      try {
        const response = await getLeagues();
        if (!isMounted) return;
        const nextLeagues = Array.isArray(response.leagues) ? response.leagues : [];
        setLeagues(nextLeagues);
      } catch {
        if (!isMounted) return;
        setLeagues([]);
      } finally {
        if (isMounted) {
          setIsLoadingLeagues(false);
        }
      }
    }

    loadLeagues();
    return () => {
      isMounted = false;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!selectedLeagueId) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage failures.
      }
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, selectedLeagueId);
    } catch {
      // Ignore storage failures.
    }
  }, [selectedLeagueId]);

  useEffect(() => {
    if (leagues.length === 0) {
      if (selectedLeagueId) {
        setSelectedLeagueId("");
      }
      return;
    }

    const selectedStillExists = leagues.some((league) => league._id === selectedLeagueId);
    if (!selectedStillExists && selectedLeagueId) {
      setSelectedLeagueId("");
    }
  }, [leagues, selectedLeagueId]);

  const selectedLeague = useMemo(
    () => leagues.find((league) => league._id === selectedLeagueId) || null,
    [leagues, selectedLeagueId]
  );

  async function refreshLeagues() {
    const response = await getLeagues();
    const nextLeagues = Array.isArray(response.leagues) ? response.leagues : [];
    setLeagues(nextLeagues);
    return nextLeagues;
  }

  function selectLeague(leagueOrId) {
    const nextId = typeof leagueOrId === "string" ? leagueOrId : leagueOrId?._id || "";
    setSelectedLeagueId(nextId);
  }

  function clearSelectedLeague() {
    setSelectedLeagueId("");
  }

  const value = useMemo(
    () => ({
      leagues,
      selectedLeagueId,
      selectedLeague,
      hasSelectedLeague: Boolean(selectedLeagueId),
      isLoadingLeagues,
      refreshLeagues,
      selectLeague,
      clearSelectedLeague,
    }),
    [leagues, selectedLeagueId, selectedLeague, isLoadingLeagues]
  );

  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
}

export function useLeague() {
  const context = useContext(LeagueContext);
  if (!context) {
    throw new Error("useLeague must be used within LeagueProvider");
  }
  return context;
}
