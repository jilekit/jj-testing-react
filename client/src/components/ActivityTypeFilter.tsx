import { Box, Chip, Stack } from "@mui/material";

import {
    TYPE_COLORS,
    toggleActivityType,
} from "../constants/activityTypes";
import {
    ACTIVITY_TYPES,
    type ActivityType,
} from "../types/activity";

type Props = {
    // undefined = all types.
    value?: ActivityType[];
    onChange: (value: ActivityType[] | undefined) => void;
};

export function ActivityTypeFilter({
                                       value,
                                       onChange,
                                   }: Props) {
    return (
        <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            // Don't inherit the bold sidebar header.
            sx={{ fontWeight: "normal" }}
        >
            <Chip
                label="All"
                size="small"
                variant={value ? "outlined" : "filled"}
                aria-pressed={!value}
                onClick={() => onChange(undefined)}
            />

            {ACTIVITY_TYPES.map(type => {
                const selected = value?.includes(type) ?? false;

                return (
                    <Chip
                        key={type}
                        label={type}
                        size="small"
                        variant={selected ? "filled" : "outlined"}
                        aria-pressed={selected}
                        onClick={() =>
                            onChange(
                                toggleActivityType(value, type)
                            )
                        }
                        icon={
                            <Box
                                component="span"
                                sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    bgcolor: TYPE_COLORS[type],
                                }}
                            />
                        }
                    />
                );
            })}
        </Stack>
    );
}
