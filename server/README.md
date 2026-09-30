# Activity WebSocket API

Server poskytuje aktuální informace o aktivitách prostřednictvím WebSocket spojení.

## Connection

```text
ws://localhost:8080
```

Po navázání spojení server nic neposílá. Klient si stream aktivit vyžádá zprávou `subscribe` a zastaví ho zprávou `unsubscribe`.

## Subscribe / Unsubscribe

Klient posílá serveru tyto zprávy:

```ts
type ClientMessage =
  | { type: "subscribe" }
  | { type: "unsubscribe" };
```

- `subscribe` – server odešle `snapshot` a poté průběžně posílá `update` zprávy
- `unsubscribe` – server přestane klientovi posílat `update` zprávy

Neznámé zprávy server ignoruje.

## Activity

Aktivita má následující strukturu:

```ts
type Activity = {
  id: string;
  name: string;
  type: "DRONE" | "ADSB" | "OTHER";

  latitude: number;
  longitude: number;
  altitude: number;

  active: boolean;
  updatedAt: number;
};
```

- `id` – unikátní identifikátor aktivity (UUID v4)
- `updatedAt` – čas poslední změny jako Unix timestamp v milisekundách

## Snapshot

Po zprávě `subscribe` server odešle kompletní aktuální seznam aktivit.

```ts
type SnapshotMessage = {
  type: "snapshot";
  activities: Activity[];
};
```

Příklad:

```json
{
  "type": "snapshot",
  "activities": [
    {
      "id": "3f2b8c1e-7a4d-4e9b-9c52-1d6e8f0a2b47",
      "name": "Activity 1",
      "type": "DRONE",
      "latitude": 49.195,
      "longitude": 16.608,
      "altitude": 350,
      "active": true,
      "updatedAt": 1790755200000
    }
  ]
}
```

## Updates

Po odeslání snapshotu server průběžně posílá změny aktivit.

Jedna WebSocket zpráva může obsahovat změny více aktivit.

```ts
type UpdateMessage = {
  type: "update";
  activities: ActivityUpdate[];
};
```

Update obsahuje pouze hodnoty, které jsou součástí dané změny.

```ts
type ActivityUpdate = {
  id: string;
  updatedAt: number;

  latitude?: number;
  longitude?: number;
  altitude?: number;
  active?: boolean;
};
```

Příklad:

```json
{
  "type": "update",
  "activities": [
    {
      "id": "3f2b8c1e-7a4d-4e9b-9c52-1d6e8f0a2b47",
      "latitude": 49.1951,
      "longitude": 16.6082,
      "altitude": 354,
      "updatedAt": 1790755200100
    },
    {
      "id": "a91c4d02-5e6f-4b3a-8d17-6c2e9f4b0d85",
      "latitude": 49.2012,
      "longitude": 16.5981,
      "updatedAt": 1790755200100
    }
  ]
}
```

Pole, která v `ActivityUpdate` nejsou uvedena, se nezměnila.

Například:

```json
{
  "id": "3f2b8c1e-7a4d-4e9b-9c52-1d6e8f0a2b47",
  "altitude": 420,
  "updatedAt": 1790755200200
}
```

znamená, že se změnila pouze hodnota `altitude`. Ostatní hodnoty aktivity zůstávají beze změny.

## Connection lifecycle

1. Klient se připojí – server zatím nic neposílá.
2. Klient pošle `subscribe` – server odešle `snapshot` a pak posílá `update` zprávy.
3. Klient pošle `unsubscribe` – server přestane posílat `update` zprávy.

Každý další `subscribe` znovu odešle aktuální `snapshot`. Po odpojení klienta se odběr automaticky zruší.
