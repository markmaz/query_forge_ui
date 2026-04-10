import { setupServer } from "msw/node";
import { handlers } from "./handlers";

const server = setupServer(...handlers);
const originalListen = server.listen.bind(server);
const originalClose = server.close.bind(server);
let isListening = false;
let listenRefCount = 0;

server.listen = ((...args: Parameters<typeof originalListen>) => {
  listenRefCount += 1;
  if (isListening) return;
  originalListen(...args);
  isListening = true;
}) as typeof server.listen;

server.close = ((...args: Parameters<typeof originalClose>) => {
  if (listenRefCount > 0) {
    listenRefCount -= 1;
  }
  if (!isListening || listenRefCount > 0) return;
  originalClose(...args);
  isListening = false;
}) as typeof server.close;

export { server };
