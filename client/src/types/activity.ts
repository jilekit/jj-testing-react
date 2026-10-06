export type ActivityType = "DRONE" | "ADSB" | "OTHER";

export type Activity = {
    id: string;
    name: string;
    type: ActivityType;

    latitude: number;
    longitude: number;
    altitude: number;

    active: boolean;
    updatedAt: number;
};

export type ActivityPosition = [
    latitude: number,
    longitude: number,
];

// Client-side only: recent positions, oldest first.
// The last one is the current position.
export type TrackedActivity = Activity & {
    trail: ActivityPosition[];
};

export type ActivityUpdate = {
    id: string;
    updatedAt: number;

    latitude?: number;
    longitude?: number;
    altitude?: number;
    active?: boolean;
};

export type SnapshotMessage = {
    type: "snapshot";
    activities: Activity[];
};

export type UpdateMessage = {
    type: "update";
    activities: ActivityUpdate[];
};

export type ServerMessage =
    | SnapshotMessage
    | UpdateMessage;

export type ClientMessage =
    | { type: "subscribe" }
    | { type: "unsubscribe" };
