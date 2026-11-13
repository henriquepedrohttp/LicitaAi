import { backendProxy } from "../../proxy";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f-]{36}$/i;
const proxy = backendProxy("companies", path => path.length === 0 || (path.length === 1 && path[0] === "demo") || (uuid.test(path[0]) && (
  path.length === 1 ||
  (path.length === 2 && path[1] === "evidence") ||
  (path.length === 3 && path[1] === "evidence" && path[2] === "upload") ||
  (path.length === 3 && ["comparison", "assessments"].includes(path[1]) && uuid.test(path[2])) ||
  (path.length === 4 && path[1] === "evidence" && uuid.test(path[2]) && path[3] === "file")
)));
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
