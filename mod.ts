// export type ServeHandler = (request: Request) => Response | Promise<Response>;
// export type HttpServer

// export function serve(handler: ServeHandler): HttpServer;
const lib = Deno.dlopen("./build/uWebServer.so", {
  uws_create_app: {
    parameters: [],
    result: "pointer",
  },
  uws_app_serve: {
    parameters: ["pointer"],
    result: "void",
    nonblocking: true,
  },
});

const { uws_create_app, uws_app_serve } = lib.symbols;

const a = uws_create_app();

await uws_app_serve(a);
