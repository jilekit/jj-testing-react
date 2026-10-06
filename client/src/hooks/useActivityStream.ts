import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import type {
    Activity,
    ActivityPosition,
    ActivityType,
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

// A filter change doesn't move activities, so activities
// which stay keep their trails.
function mergeSnapshot(
    current: Map<string, TrackedActivity>,
    activities: Activity[]
) {
    return new Map(
        activities.map((a): [string, TrackedActivity] => {
            const position: ActivityPosition = [
                a.latitude,
                a.longitude,
            ];
            const trail = current.get(a.id)?.trail ?? [];
            const last = trail[trail.length - 1];
            const moved =
                !last ||
                last[0] !== position[0] ||
                last[1] !== position[1];

            return [
                a.id,
                {
                    ...a,
                    trail: moved
                        ? [...trail, position].slice(-TRAIL_LENGTH)
                        : trail,
                },
            ];
        })
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

    // Same for the activity type filter.
    // undefined = all types.
    const activityTypesRef = useRef<ActivityType[]>(undefined);

    // Set when (re)starting the stream, where positions may
    // have jumped. A filter change keeps the trails.
    const resetTrailsRef = useRef(false);

    const updateCountRef = useRef(0);

    const [connected, setConnected] = useState(false);
    const [streaming, setStreaming] = useState(false);
    const [activityTypes, setActivityTypesState] =
        useState<ActivityType[]>();
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

    const subscribe = useCallback(() => {
        const activityTypes = activityTypesRef.current;

        send(
            activityTypes
                ? { type: "subscribe", activityTypes }
                : { type: "subscribe" }
        );
    }, [send]);

    useEffect(() => {
        let disposed = false;
        let reconnectTimer: number | undefined;

        function connect() {
            const socket = new WebSocket(url);

            socketRef.current = socket;

            socket.onopen = () => {
                setConnected(true);

                if (streamingRef.current) {
                    resetTrailsRef.current = true;
                    subscribe();
                }
            };

            socket.onmessage = event => {
                const message: ServerMessage = JSON.parse(
                    event.data
                );

                if (message.type === "snapshot") {
                    const resetTrails = resetTrailsRef.current;

                    resetTrailsRef.current = false;

                    setActivities(current =>
                        resetTrails
                            ? trackSnapshot(message.activities)
                            : mergeSnapshot(
                                current,
                                message.activities
                            )
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
    }, [url, subscribe]);

    const toggleStreaming = useCallback(() => {
        const next = !streamingRef.current;

        streamingRef.current = next;
        setStreaming(next);

        if (next) {
            resetTrailsRef.current = true;
            subscribe();
        } else {
            send({ type: "unsubscribe" });
        }
    }, [send, subscribe]);

    // While stopped, the filter is only stored
    // and sent with the next subscribe.
    const setActivityTypes = useCallback(
        (types: ActivityType[] | undefined) => {
            activityTypesRef.current = types;
            setActivityTypesState(types);

            if (streamingRef.current) {
                subscribe();
            }
        },
        [subscribe]
    );

    return {
        connected,
        streaming,
        activities,
        updatesPerSecond,
        toggleStreaming,
        activityTypes,
        setActivityTypes,
    };
}
