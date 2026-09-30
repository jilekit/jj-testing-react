import {
    ListItemButton,
    ListItemText,
    Stack,
    Typography,
} from "@mui/material";

import type { Activity } from "../types/activity";

type Props = {
    activity: Activity;
    selected: boolean;
    onSelect: (id: string) => void;
};

export function ActivityListItem({
                                     activity,
                                     selected,
                                     onSelect,
                                 }: Props) {
    return (
        <ListItemButton
            selected={selected}
            onClick={() => onSelect(activity.id)}
        >
            <ListItemText
                primary={activity.name}
                secondary={
                    <Stack direction="row" spacing={1}>
                        <Typography variant="caption">
                            {activity.type}
                        </Typography>

                        <Typography variant="caption">
                            {activity.active ? "Active" : "Inactive"}
                        </Typography>
                    </Stack>
                }
            />
        </ListItemButton>
    );
}
