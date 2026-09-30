import {
    Stack,
    Typography,
} from "@mui/material";

type Props = {
    connected: boolean;
    activityCount: number;
    updatesPerSecond: number;
};

export function StatusBar({
                              connected,
                              activityCount,
                              updatesPerSecond,
                          }: Props) {
    return (
        <Stack
            direction="row"
            spacing={4}
        >
            <Typography variant="caption">
                {connected
                    ? "● Connected"
                    : "○ Disconnected"}
            </Typography>

            <Typography variant="caption">
                Activities: {activityCount}
            </Typography>

            <Typography variant="caption">
                Updates: {updatesPerSecond}/s
            </Typography>
        </Stack>
    );
}
