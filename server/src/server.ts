import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { WebSocketServer, WebSocket } from "ws";

// Load constants from .env (variables already set in the environment take precedence).
if (existsSync(".env")) {
    process.loadEnvFile(".env");
}

type ActivityType = "DRONE" | "ADSB" | "OTHER";

type Activity = {
    id: string;
    name: string;
    type: ActivityType;

    latitude: number;
    longitude: number;
    altitude: number;

    active: boolean;
    updatedAt: number;
};

type ActivityUpdate = {
    id: string;
    updatedAt: number;

    latitude?: number;
    longitude?: number;
    altitude?: number;
    active?: boolean;
};

type SnapshotMessage = {
    type: "snapshot";
    activities: Activity[];
};

type UpdateMessage = {
    type: "update";
    activities: ActivityUpdate[];
};

type ClientMessage =
    | { type: "subscribe" }
    | { type: "unsubscribe" };

const PORT = Number(process.env.PORT ?? 8080);

const ACTIVITY_COUNT = Number(
    process.env.ACTIVITY_COUNT ?? 50
);

const UPDATES_PER_SECOND = Number(
    process.env.UPDATES_PER_SECOND ?? 5
);

const TICK_RATE = Number(
    process.env.TICK_RATE ?? 5
);

const TICK_INTERVAL = 1000 / TICK_RATE;

const UPDATES_PER_TICK =
    UPDATES_PER_SECOND / TICK_RATE;

/*
 * Every activity flies along its own circle.
 * Kept server-side only, clients get just the positions.
 */
type Orbit = {
    centerLatitude: number;
    centerLongitude: number;

    // Radius in degrees of latitude.
    radius: number;

    // Current angle and angle change per update (radians).
    // Negative step = clockwise.
    angle: number;
    angleStep: number;
};

const activities = new Map<string, Activity>();
const activityIds: string[] = [];
const orbits = new Map<string, Orbit>();

function randomBetween(min: number, max: number) {
    return min + Math.random() * (max - min);
}

function randomType(): ActivityType {
    const types: ActivityType[] = [
        "DRONE",
        "ADSB",
        "OTHER",
    ];

    return types[
        Math.floor(Math.random() * types.length)
        ];
}

function createOrbit(): Orbit {
    const direction = Math.random() < 0.5 ? -1 : 1;

    return {
        // Roughly around Brno
        centerLatitude: randomBetween(49.1, 49.3),
        centerLongitude: randomBetween(16.5, 16.7),

        // ~0.5 km to ~3 km
        radius: randomBetween(0.005, 0.03),

        angle: randomBetween(0, 2 * Math.PI),

        // One lap takes roughly 20-40 updates.
        angleStep:
            direction * randomBetween(0.15, 0.3),
    };
}

function orbitPosition(orbit: Orbit) {
    // Degrees of longitude are shorter than degrees of
    // latitude, scale them so the circle stays round.
    const longitudeScale = Math.cos(
        (orbit.centerLatitude * Math.PI) / 180
    );

    return {
        latitude:
            orbit.centerLatitude +
            orbit.radius * Math.sin(orbit.angle),
        longitude:
            orbit.centerLongitude +
            (orbit.radius * Math.cos(orbit.angle)) /
                longitudeScale,
    };
}

function createActivity(
    index: number,
    orbit: Orbit
): Activity {
    return {
        id: randomUUID(),
        name: `Activity ${index}`,
        type: randomType(),

        ...orbitPosition(orbit),

        altitude: Math.round(
            randomBetween(100, 2000)
        ),

        active: Math.random() > 0.2,
        updatedAt: Date.now(),
    };
}

function initializeActivities() {
    for (let i = 1; i <= ACTIVITY_COUNT; i++) {
        const orbit = createOrbit();
        const activity = createActivity(i, orbit);

        activities.set(activity.id, activity);
        orbits.set(activity.id, orbit);
        activityIds.push(activity.id);
    }
}

function createUpdate(
    activity: Activity
): ActivityUpdate {
    const now = Date.now();

    const update: ActivityUpdate = {
        id: activity.id,
        updatedAt: now,
    };

    // Position moves along the orbit every update.
    const orbit = orbits.get(activity.id);

    if (orbit) {
        orbit.angle += orbit.angleStep;

        const position = orbitPosition(orbit);

        update.latitude = position.latitude;
        update.longitude = position.longitude;
    }

    // Altitude doesn't have to change every time.
    if (Math.random() < 0.5) {
        update.altitude = Math.max(
            0,
            Math.round(
                activity.altitude +
                randomBetween(-10, 10)
            )
        );
    }

    // Active changes only occasionally.
    if (Math.random() < 0.01) {
        update.active = !activity.active;
    }

    return update;
}

function applyUpdate(
    activity: Activity,
    update: ActivityUpdate
) {
    if (update.latitude !== undefined) {
        activity.latitude = update.latitude;
    }

    if (update.longitude !== undefined) {
        activity.longitude = update.longitude;
    }

    if (update.altitude !== undefined) {
        activity.altitude = update.altitude;
    }

    if (update.active !== undefined) {
        activity.active = update.active;
    }

    activity.updatedAt = update.updatedAt;
}

function send(
    socket: WebSocket,
    message: SnapshotMessage | UpdateMessage
) {
    if (socket.readyState !== WebSocket.OPEN) {
        return;
    }

    socket.send(JSON.stringify(message));
}

function broadcast(
    message: UpdateMessage
) {
    const data = JSON.stringify(message);

    for (const client of subscribers) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    }
}

function parseClientMessage(
    data: string
): ClientMessage | undefined {
    try {
        const message = JSON.parse(data);

        if (
            message?.type === "subscribe" ||
            message?.type === "unsubscribe"
        ) {
            return message;
        }
    } catch {
        // Invalid JSON, ignored below.
    }

    return undefined;
}

// Clients which asked to receive the activity stream.
const subscribers = new Set<WebSocket>();

initializeActivities();

const wss = new WebSocketServer({
    port: PORT,
});

wss.on("connection", socket => {
    console.log(
        `Client connected. Clients: ${wss.clients.size}`
    );

    socket.on("message", raw => {
        const message = parseClientMessage(
            raw.toString()
        );

        if (!message) {
            console.warn(
                `Ignoring unknown client message: ${raw}`
            );
            return;
        }

        if (message.type === "subscribe") {
            // Snapshot first, so the client has the
            // full state before the first update.
            const snapshot: SnapshotMessage = {
                type: "snapshot",
                activities: Array.from(
                    activities.values()
                ),
            };

            send(socket, snapshot);

            subscribers.add(socket);
        } else {
            subscribers.delete(socket);
        }

        console.log(
            `Client ${message.type}d. Subscribers: ${subscribers.size}`
        );
    });

    socket.on("close", () => {
        subscribers.delete(socket);

        console.log(
            `Client disconnected. Clients: ${wss.clients.size}`
        );
    });
});

let updateAccumulator = 0;
let updatesSent = 0;
let messagesSent = 0;

setInterval(() => {
    /*
     * UPDATES_PER_SECOND doesn't have to be
     * divisible by TICK_RATE.
     *
     * Example:
     *
     * 10 updates/s
     * 20 ticks/s
     *
     * => 0.5 update per tick
     *
     * Accumulator makes this work without
     * losing updates.
     */

    updateAccumulator += UPDATES_PER_TICK;

    const count = Math.floor(updateAccumulator);

    updateAccumulator -= count;

    if (count === 0) {
        return;
    }

    const updates: ActivityUpdate[] = [];

    for (let i = 0; i < count; i++) {
        const id =
            activityIds[
                Math.floor(
                    Math.random() * activityIds.length
                )
            ];

        const activity = activities.get(id);

        if (!activity) {
            continue;
        }

        const update = createUpdate(activity);

        applyUpdate(activity, update);

        updates.push(update);
    }

    if (updates.length === 0) {
        return;
    }

    broadcast({
        type: "update",
        activities: updates,
    });

    updatesSent += updates.length;
    messagesSent++;
}, TICK_INTERVAL);

setInterval(() => {
    console.log(
        [
            `Clients: ${wss.clients.size}`,
            `Subscribers: ${subscribers.size}`,
            `Activities: ${activities.size}`,
            `Updates: ${updatesSent}/s`,
            `Messages: ${messagesSent}/s`,
        ].join(" | ")
    );

    updatesSent = 0;
    messagesSent = 0;
}, 1000);

console.log(`
Activity WebSocket server
-------------------------
Port:               ${PORT}
Activities:         ${ACTIVITY_COUNT}
Updates / second:   ${UPDATES_PER_SECOND}
Tick rate:          ${TICK_RATE} Hz
Tick interval:      ${TICK_INTERVAL} ms
Updates / tick:     ${UPDATES_PER_TICK}

WebSocket:
ws://localhost:${PORT}
`);
