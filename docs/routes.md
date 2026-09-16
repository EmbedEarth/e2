# Routes

The route client uses `https://route.embed.earth` by default, or a compatible
service configured with `routeUrl`.

```ts
const route = await earth.route.route({
  locations: [{ lat: 40.748, lon: -73.985 }, { lat: 40.641, lon: -73.778 }],
  mode: "driving",
});
```

Matrix, isochrone, map matching, locate, and height operations are available
through the route client. Keep routing-service configuration out of normal
application code unless a custom origin is intentional.
