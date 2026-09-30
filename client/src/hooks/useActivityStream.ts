import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import type {
    Activity,
    ActivityUpdate,
    ClientMessage,
    ServerMessage,
} from "../types/activity";

const RECONNECT_DELAY = 2000;

function applyUpdates(
    current: Map<string, Activity>,
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

        next.set(update.id, { ...activity, ...update });
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
        () => new Map<string, Activity>()
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
                        new Map(
                            message.activities.map(a => [
                                a.id,
                                a,
                            ])
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
