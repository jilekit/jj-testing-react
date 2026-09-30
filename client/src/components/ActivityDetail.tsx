import {
    Box,
    Divider,
    Stack,
    Typography,
} from "@mui/material";

import type { Activity } from "../types/activity";

type Props = {
    activity?: Activity;
};

export function ActivityDetail({
                                   activity,
                               }: Props) {
    if (!activity) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography
                    variant="body2"
                    color="text.secondary"
                >
                    Select an activity
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6">
                {activity.name}
            </Typography>

            <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2 }}
            >
                {activity.type}
            </Typography>

            <Divider sx={{ mb: 2 }} />

            <Stack spacing={1}>
                <Value
                    label="Latitude"
                    value={activity.latitude.toFixed(5)}
                />

                <Value
                    label="Longitude"
                    value={activity.longitude.toFixed(5)}
                />

                <Value
                    label="Altitude"
                    value={`${activity.altitude} m`}
                />

                <Value
                    label="Status"
                    value={
                        activity.active
                            ? "Active"
                            : "Inactive"
                    }
                />

                <Value
                    label="Updated"
                    value={new Date(
                        activity.updatedAt
                    ).toLocaleTimeString()}
                />
            </Stack>
        </Box>
    );
}

function Value({
                   label,
                   value,
               }: {
    label: string;
    value: string;
}) {
    return (
        <Stack
            direction="row"
            justifyContent="space-between"
            spacing={2}
        >
            <Typography
                variant="body2"
                color="text.secondary"
            >
                {label}
            </Typography>

            <Typography variant="body2">
                {value}
            </Typography>
        </Stack>
    );
}
