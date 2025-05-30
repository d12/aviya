import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/soundId", "routes/soundId.tsx"),
  route("*", "routes/notFound.tsx"),

] satisfies RouteConfig;
