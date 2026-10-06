import {
    ACTIVITY_TYPES,
    type ActivityType,
} from "../types/activity";

export const TYPE_COLORS: Record<ActivityType, string> = {
    DRONE: "#d32f2f",
    ADSB: "#ed6c02",
    OTHER: "#9c27b0",
};

/*
 * Filter of activity types, undefined = all types.
 *
 * All     + DRONE => DRONE
 * DRONE   + ADSB  => DRONE, ADSB
 * DRONE   - DRONE => All (the server needs a non-empty list)
 * 2 types + 3rd   => All
 */
export function toggleActivityType(
    filter: ActivityType[] | undefined,
    type: ActivityType
): ActivityType[] | undefined {
    const selected = new Set(filter);

    if (!filter) {
        selected.clear();
        selected.add(type);
    } else if (selected.has(type)) {
        selected.delete(type);
    } else {
        selected.add(type);
    }

    if (
        selected.size === 0 ||
        selected.size === ACTIVITY_TYPES.length
    ) {
        return undefined;
    }

    // Stable order, regardless of the click order.
    return ACTIVITY_TYPES.filter(t => selected.has(t));
}
