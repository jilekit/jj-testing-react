import { useMemo, useState } from "react";

import {
    AppBar,
    Box,
    Button,
    Paper,
    Toolbar,
    Typography,
} from "@mui/material";

import { ActivityDetail } from "./components/ActivityDetail";
import { ActivityList } from "./components/ActivityList";
import { Map } from "./components/Map";
import { StatusBar } from "./components/StatusBar";
import { useActivityStream } from "./hooks/useActivityStream";

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
        <Box
            sx={{
                height: "100vh",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <AppBar position="static">
                <Toolbar>
                    <Typography
                        variant="h6"
                        sx={{ flexGrow: 1 }}
                    >
                        Activity Monitor
                    </Typography>

                    <Button
                        color="inherit"
                        variant="outlined"
                        disabled={!connected}
                        onClick={toggleStreaming}
                    >
                        {streaming
                            ? "Stop stream"
                            : "Start stream"}
                    </Button>
                </Toolbar>
            </AppBar>

            <Box
                sx={{
                    flex: 1,
                    display: "grid",
                    gridTemplateColumns: "1fr 350px",
                    minHeight: 0,
                }}
            >
                <Map
                    activities={activityList}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                />

                <Box
                    sx={{
                        display: "grid",
                        gridTemplateRows: "1fr 280px",
                        minHeight: 0,
                        borderLeft: 1,
                        borderColor: "divider",
                    }}
                >
                    <Paper
                        square
                        elevation={0}
                        sx={{ minHeight: 0 }}
                    >
                        <ActivityList
                            activities={activityList}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                        />
                    </Paper>

                    <Paper
                        square
                        elevation={0}
                        sx={{
                            borderTop: 1,
                            borderColor: "divider",
                        }}
                    >
                        <ActivityDetail
                            activity={selectedActivity}
                        />
                    </Paper>
                </Box>
            </Box>

            <StatusBar
                connected={connected}
                activityCount={activities.size}
                updatesPerSecond={updatesPerSecond}
            />
        </Box>
    );
}
