import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/index.jsx";
import {
  createLeague as createLeagueRequest,
  getLeagues,
  setMyTeam as setMyTeamRequest,
  updateLeague as updateLeagueRequest,
} from "./requests";

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
  const { isLoading: isLoadingAuth, isLoggedIn } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState(() => getStoredLeagueId());
  const [isLoadingLeagues, setIsLoadingLeagues] = useState(false);
  const [hasLoadedLeagues, setHasLoadedLeagues] = useState(false);

  useEffect(() => {
    if (isLoadingAuth) {
      return;
    }

    if (!isLoggedIn) {
      setLeagues([]);
      setHasLoadedLeagues(false);
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
          setHasLoadedLeagues(true);
          setIsLoadingLeagues(false);
        }
      }
    }

    loadLeagues();
    return () => {
      isMounted = false;
    };
  }, [isLoadingAuth, isLoggedIn]);

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
    if (!hasLoadedLeagues) {
      return;
    }

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
  }, [hasLoadedLeagues, leagues, selectedLeagueId]);

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

  async function createLeague(payload) {
    const response = await createLeagueRequest(payload);
    await refreshLeagues();
    return response;
  }

  async function setMyTeam(leagueId, myTeamId) {
    const response = await setMyTeamRequest(leagueId, myTeamId);
    await refreshLeagues();
    return response;
  }

  async function editLeague(leagueId, payload) {
    const response = await updateLeagueRequest(leagueId, payload);
    await refreshLeagues();
    return response;
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
      createLeague,
      setMyTeam,
      editLeague,
      refreshLeagues,
      selectLeague,
      clearSelectedLeague,
    }),
    [
      leagues,
      selectedLeagueId,
      selectedLeague,
      isLoadingLeagues,
      createLeague,
      setMyTeam,
      editLeague,
      refreshLeagues,
      selectLeague,
      clearSelectedLeague,
    ]
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
