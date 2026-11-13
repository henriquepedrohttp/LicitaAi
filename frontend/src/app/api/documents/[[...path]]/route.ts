import { backendProxy } from "../../proxy";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f-]{36}$/i;
const proxy = backendProxy("documents", path => path.length === 0 || (uuid.test(path[0]) && (
  path.length === 1 ||
  (path.length === 2 && ["file", "requirements", "extract-requirements", "analysis"].includes(path[1])) ||
  (path.length === 3 && path[1] === "analysis" && path[2] === "approve") ||
  (path.length === 4 && path[1] === "requirements" && uuid.test(path[2]) && path[3] === "review")
)));
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
