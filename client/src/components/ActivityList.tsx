import { List } from "@mui/material";

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
        <List disablePadding>
            {activities.map(activity => (
                <ActivityListItem
                    key={activity.id}
                    activity={activity}
                    selected={activity.id === selectedId}
                    onSelect={onSelect}
                />
            ))}
        </List>
    );
}
