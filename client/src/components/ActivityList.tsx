import {
    Box,
    Divider,
    List,
    Typography,
} from "@mui/material";

import type { Activity } from "../types/activity";
import { ActivityListItem } from "./ActivityListItem";

type Props = {
    activities: Activity[];
    selectedId?: string;
    onSelect: (id: string) => void;
};

export function ActivityList({
                                 activities,
                                 selectedId,
                                 onSelect,
                             }: Props) {
    return (
        <Box
            sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <Box sx={{ p: 2 }}>
                <Typography variant="h6">
                    Activities
                </Typography>

                <Typography
                    variant="body2"
                    color="text.secondary"
                >
                    {activities.length} activities
                </Typography>
            </Box>

            <Divider />

            <List
                disablePadding
                sx={{
                    overflow: "auto",
                    flex: 1,
                }}
            >
                {activities.map(activity => (
                    <ActivityListItem
                        key={activity.id}
                        activity={activity}
                        selected={activity.id === selectedId}
                        onSelect={onSelect}
                    />
                ))}
            </List>
        </Box>
    );
}
