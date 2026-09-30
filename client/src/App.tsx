import { useMemo, useState } from "react";

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
                        onSelect={setSelectedId}
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
                            onSelect={setSelectedId}
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
