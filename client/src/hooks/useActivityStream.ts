import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import type {
    Activity,
    ActivityPosition,
    ActivityUpdate,
    ClientMessage,
    ServerMessage,
    TrackedActivity,
} from "../types/activity";

const RECONNECT_DELAY = 2000;

// Number of positions kept per activity, current one included.
const TRAIL_LENGTH = 5;

// A snapshot replaces positions, so trails start over.
function trackSnapshot(activities: Activity[]) {
    return new Map(
        activities.map((a): [string, TrackedActivity] => [
            a.id,
            { ...a, trail: [[a.latitude, a.longitude]] },
        ])
    );
}

function applyUpdates(
    current: Map<string, TrackedActivity>,
    updates: ActivityUpdate[]
) {
    const next = new Map(current);

    for (const update of updates) {
        const activity = next.get(update.id);

        // Update for an activity we don't know yet
        // (shouldn't happen after a snapshot).
        if (!activity) {
            continue;
        }

        const updated = { ...activity, ...update };

        // Keep the trail reference when the position
        // didn't change, so the trail isn't redrawn.
        if (
            update.latitude !== undefined ||
            update.longitude !== undefined
        ) {
            const position: ActivityPosition = [
                updated.latitude,
                updated.longitude,
            ];

            updated.trail = [
                ...activity.trail,
                position,
            ].slice(-TRAIL_LENGTH);
        }

        next.set(update.id, updated);
    }

    return next;
}

export function useActivityStream(url: string) {
    const socketRef = useRef<WebSocket | null>(null);

    // Whether the user wants the stream on. Kept in a ref too,
    // so a reconnect can resubscribe automatically.
    const streamingRef = useRef(false);

    const updateCountRef = useRef(0);

    const [connected, setConnected] = useState(false);
    const [streaming, setStreaming] = useState(false);
    const [activities, setActivities] = useState(
        () => new Map<string, TrackedActivity>()
    );
    const [updatesPerSecond, setUpdatesPerSecond] =
        useState(0);

    const send = useCallback((message: ClientMessage) => {
        const socket = socketRef.current;

        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        }
    }, []);

    useEffect(() => {
        let disposed = false;
        let reconnectTimer: number | undefined;

        function connect() {
            const socket = new WebSocket(url);

            socketRef.current = socket;

            socket.onopen = () => {
                setConnected(true);

                if (streamingRef.current) {
                    send({ type: "subscribe" });
                }
            };

            socket.onmessage = event => {
                const message: ServerMessage = JSON.parse(
                    event.data
                );

                if (message.type === "snapshot") {
                    setActivities(
                        trackSnapshot(message.activities)
                    );
                } else {
                    updateCountRef.current +=
                        message.activities.length;

                    setActivities(current =>
                        applyUpdates(
                            current,
                            message.activities
                        )
                    );
                }
            };

            socket.onclose = () => {
                setConnected(false);

                if (!disposed) {
                    reconnectTimer = window.setTimeout(
                        connect,
                        RECONNECT_DELAY
                    );
                }
            };
        }

        connect();

        const statsTimer = window.setInterval(() => {
            setUpdatesPerSecond(updateCountRef.current);
            updateCountRef.current = 0;
        }, 1000);

        return () => {
            disposed = true;
            window.clearTimeout(reconnectTimer);
            window.clearInterval(statsTimer);
            socketRef.current?.close();
            socketRef.current = null;
        };
    }, [url, send]);

    const toggleStreaming = useCallback(() => {
        const next = !streamingRef.current;

        streamingRef.current = next;
        setStreaming(next);

        send({
            type: next ? "subscribe" : "unsubscribe",
        });
    }, [send]);

    return {
        connected,
        streaming,
        activities,
        updatesPerSecond,
        toggleStreaming,
    };
}
