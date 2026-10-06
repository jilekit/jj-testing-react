import { useEffect, useRef } from "react";

import { Box } from "@mui/material";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type {
    Activity,
    ActivityType,
    TrackedActivity,
} from "../types/activity";

type Props = {
    activities: TrackedActivity[];
    selectedId?: string;
    onSelect?: (id: string) => void;
    following?: boolean;
    onFollowStop?: () => void;
};

// Roughly around Brno, where the server generates activities.
const INITIAL_CENTER: L.LatLngExpression = [49.2, 16.6];
const INITIAL_ZOOM = 11;

// Minimum zoom when centering the selected activity.
const SELECTED_ZOOM = 14;

const FIT_PADDING: L.PointExpression = [32, 32];

const TYPE_COLORS: Record<ActivityType, string> = {
    DRONE: "#d32f2f",
    ADSB: "#ed6c02",
    OTHER: "#9c27b0",
};

const INACTIVE_COLOR = "#9e9e9e";

// Own pane below the markers (overlayPane is 400),
// paths in a shared pane stack in the order they're added.
const TRAIL_PANE = "trail";
const TRAIL_PANE_Z_INDEX = "350";

// Segment styles from the newest to the oldest.
const TRAIL_STYLES: L.PolylineOptions[] = [
    { color: "#424242", opacity: 0.9 },
    { color: "#757575", opacity: 0.7 },
    { color: "#9e9e9e", opacity: 0.5 },
    { color: "#bdbdbd", opacity: 0.3 },
].map(style => ({
    ...style,
    weight: 3,
    interactive: false,
    pane: TRAIL_PANE,
}));

function markerStyle(
    activity: Activity,
    selected: boolean
): L.CircleMarkerOptions {
    const color = activity.active
        ? TYPE_COLORS[activity.type]
        : INACTIVE_COLOR;

    return {
        radius: selected ? 10 : 6,
        color: selected ? "#000" : color,
        weight: selected ? 3 : 1,
        fillColor: color,
        fillOpacity: activity.active ? 0.8 : 0.4,
    };
}

function tooltipContent(activity: Activity) {
    return `${activity.name} · ${activity.type} · ${activity.altitude} m`;
}

export function Map({
                        activities,
                        selectedId,
                        onSelect,
                        following = false,
                        onFollowStop,
                    }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layerRef = useRef<L.LayerGroup | null>(null);
    const trailLayerRef = useRef<L.LayerGroup | null>(null);

    // `Map` is shadowed by this component, hence globalThis.
    const markersRef = useRef(
        new globalThis.Map<string, L.CircleMarker>()
    );

    // Markers are created once, so the click handler reads
    // the latest callback from a ref.
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;

    const onFollowStopRef = useRef(onFollowStop);
    onFollowStopRef.current = onFollowStop;

    // Read by effects which must not rerun on every update.
    const activitiesRef = useRef(activities);
    activitiesRef.current = activities;

    // Distinguishes a cleared selection from no selection yet.
    const previousSelectedIdRef = useRef<string>(undefined);

    // Following is paused while flying to the activity,
    // otherwise panning would cancel the animation.
    const flyingRef = useRef(false);

    const selected = selectedId
        ? activities.find(a => a.id === selectedId)
        : undefined;
    const selectedLatitude = selected?.latitude;
    const selectedLongitude = selected?.longitude;
    const selectedTrail = selected?.trail;

    // Create the Leaflet map once.
    useEffect(() => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        const map = L.map(container).setView(
            INITIAL_CENTER,
            INITIAL_ZOOM
        );

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution:
                    "&copy; OpenStreetMap contributors",
            }
        ).addTo(map);

        map.createPane(TRAIL_PANE).style.zIndex =
            TRAIL_PANE_Z_INDEX;

        const trailLayer = L.layerGroup().addTo(map);
        const layer = L.layerGroup().addTo(map);

        // Fires only for user drags, so zooming keeps following.
        map.on("dragstart", () => {
            flyingRef.current = false;
            onFollowStopRef.current?.();
        });

        mapRef.current = map;
        layerRef.current = layer;
        trailLayerRef.current = trailLayer;

        // Leaflet doesn't notice size changes of its container.
        const resizeObserver = new ResizeObserver(() =>
            map.invalidateSize()
        );
        resizeObserver.observe(container);

        const markers = markersRef.current;

        return () => {
            resizeObserver.disconnect();
            map.remove();
            markers.clear();
            mapRef.current = null;
            layerRef.current = null;
            trailLayerRef.current = null;
        };
    }, []);

    // Sync markers with activities.
    useEffect(() => {
        const layer = layerRef.current;

        if (!layer) {
            return;
        }

        const markers = markersRef.current;
        const seen = new Set<string>();

        for (const activity of activities) {
            seen.add(activity.id);

            const selected = activity.id === selectedId;
            const style = markerStyle(activity, selected);
            const latLng: L.LatLngTuple = [
                activity.latitude,
                activity.longitude,
            ];

            let marker = markers.get(activity.id);

            if (marker) {
                marker.setLatLng(latLng);
                marker.setStyle(style);
                marker.setRadius(style.radius!);
                marker.setTooltipContent(
                    tooltipContent(activity)
                );
            } else {
                const id = activity.id;

                marker = L.circleMarker(latLng, style)
                    .bindTooltip(tooltipContent(activity))
                    .on("click", () =>
                        onSelectRef.current?.(id)
                    )
                    .addTo(layer);

                markers.set(id, marker);
            }

            if (selected) {
                marker.bringToFront();
            }
        }

        // Remove markers of activities which are gone.
        for (const [id, marker] of markers) {
            if (!seen.has(id)) {
                marker.remove();
                markers.delete(id);
            }
        }
    }, [activities, selectedId]);

    // Draw the trail of the selected activity, one polyline
    // per segment, since a polyline has a single style.
    useEffect(() => {
        const trailLayer = trailLayerRef.current;

        if (!trailLayer) {
            return;
        }

        trailLayer.clearLayers();

        if (!selectedTrail) {
            return;
        }

        for (let i = 1; i < selectedTrail.length; i++) {
            L.polyline(
                [selectedTrail[i - 1], selectedTrail[i]],
                TRAIL_STYLES[selectedTrail.length - 1 - i]
            ).addTo(trailLayer);
        }
    }, [selectedTrail]);

    // Fly to the selected activity when following starts.
    useEffect(() => {
        const map = mapRef.current;

        if (!map || !following || !selectedId) {
            return;
        }

        const activity = activitiesRef.current.find(
            a => a.id === selectedId
        );

        if (!activity) {
            return;
        }

        flyingRef.current = true;
        map.once("moveend", () => {
            flyingRef.current = false;
        });

        map.flyTo(
            [activity.latitude, activity.longitude],
            Math.max(map.getZoom(), SELECTED_ZOOM)
        );
    }, [following, selectedId]);

    // Keep the followed activity centered as it moves.
    useEffect(() => {
        const map = mapRef.current;

        if (
            !map ||
            !following ||
            flyingRef.current ||
            selectedLatitude === undefined ||
            selectedLongitude === undefined
        ) {
            return;
        }

        map.panTo([selectedLatitude, selectedLongitude], {
            animate: false,
        });
    }, [following, selectedLatitude, selectedLongitude]);

    // Fit all activities when the selection is cleared.
    useEffect(() => {
        const map = mapRef.current;
        const previousSelectedId = previousSelectedIdRef.current;

        previousSelectedIdRef.current = selectedId;

        if (!map || selectedId || !previousSelectedId) {
            return;
        }

        const bounds = L.latLngBounds(
            activitiesRef.current.map(
                (a): L.LatLngTuple => [a.latitude, a.longitude]
            )
        );

        if (bounds.isValid()) {
            map.flyToBounds(bounds, {
                padding: FIT_PADDING,
                maxZoom: SELECTED_ZOOM,
            });
        }
    }, [selectedId]);

    return (
        <Box
            ref={containerRef}
            sx={{
                width: "100%",
                height: "100%",
                minHeight: 0,
                bgcolor: "grey.100",
            }}
        />
    );
}
