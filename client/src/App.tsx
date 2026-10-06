import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import { Box, Button } from "@mui/material";

import { ActivityDetail } from "./components/ActivityDetail";
import { ActivityList } from "./components/ActivityList";
import { Map } from "./components/Map";
import { StatusBar } from "./components/StatusBar";
import { useActivityStream } from "./hooks/useActivityStream";

import "./App.css";

const WS_URL = "ws://localhost:8080";

export default function App() {
    const {
        connected,
        streaming,
        activities,
        updatesPerSecond,
        toggleStreaming,
    } = useActivityStream(WS_URL);

    const [selectedId, setSelectedId] = useState<string>();
    const [following, setFollowing] = useState(false);

    // Selecting the selected activity again deselects it.
    const select = useCallback((id: string) => {
        setSelectedId(current =>
            current === id ? undefined : id
        );
        setFollowing(false);
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedId(undefined);
        setFollowing(false);
    }, []);

    const toggleFollowing = useCallback(
        () => setFollowing(current => !current),
        []
    );

    const stopFollowing = useCallback(
        () => setFollowing(false),
        []
    );

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                clearSelection();
            }
        }

        window.addEventListener("keydown", onKeyDown);

        return () =>
            window.removeEventListener("keydown", onKeyDown);
    }, [clearSelection]);

    const activityList = useMemo(
        () => Array.from(activities.values()),
        [activities]
    );

    const selectedActivity = selectedId
        ? activities.get(selectedId)
        : undefined;

    return (
        <div className="app">
            <header className="header">
                Activity Monitor

                <Button
                    color="inherit"
                    variant="outlined"
                    disabled={!connected}
                    onClick={toggleStreaming}
                    sx={{ ml: "auto" }}
                >
                    {streaming
                        ? "Stop stream"
                        : "Start stream"}
                </Button>
            </header>

            <main className="content">
                <section className="map">
                    <Map
                        activities={activityList}
                        selectedId={selectedId}
                        onSelect={select}
                        following={following}
                        onFollowStop={stopFollowing}
                    />
                </section>

                <aside className="sidebar">
                    <div className="sidebarHeader">
                        Activities ({activities.size})
                    </div>

                    <div className="activityList">
                        <ActivityList
                            activities={activityList}
                            selectedId={selectedId}
                            onSelect={select}
                        />
                    </div>

                    <Box
                        sx={{
                            flexShrink: 0,
                            borderTop: "1px solid #ccc",
                        }}
                    >
                        <ActivityDetail
                            activity={selectedActivity}
                            following={following}
                            onClose={clearSelection}
                            onToggleFollow={toggleFollowing}
                        />
                    </Box>
                </aside>
            </main>

            <footer className="status">
                <StatusBar
                    connected={connected}
                    activityCount={activities.size}
                    updatesPerSecond={updatesPerSecond}
                />
            </footer>
        </div>
    );
}
