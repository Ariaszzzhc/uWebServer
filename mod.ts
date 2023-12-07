// export type ServeHandler = (request: Request) => Response | Promise<Response>;
// export type HttpServer

// export function serve(handler: ServeHandler): HttpServer;
const lib = Deno.dlopen("./native/build/uWebServer.so", {
  uws_create_app: {
    parameters: [],
    result: "pointer",
  },
});

const { uws_create_app } = lib.symbols;

const a = uws_create_app();

console.log(a);
