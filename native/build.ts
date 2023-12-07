// deno-lint-ignore-file no-deprecated-deno-api
import {
  dirname,
  fromFileUrl,
  basename,
} from "https://deno.land/std@0.208.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/mod.ts";

const CURRENT_DIR = dirname(fromFileUrl(import.meta.url));

const LIB_USOCKETS_INCLUDE_DIR = CURRENT_DIR + "/../deps/uSockets/src";
const LIB_UWEBSOCKETS_INCLUDE_DIR = CURRENT_DIR + "/../deps/uWebSockets/src";

const LIB_USOCKETS_C_FLAGS = [
  "-flto",
  "-DLIBUS_USE_OPENSSL",
  "-std=c11",
  `-I${LIB_USOCKETS_INCLUDE_DIR}`,
  "-O3",
  "-fPIC",
  "-c",
];

const LIB_USOCKETS_SOURCE_FILES = [
  "bsd.c",
  "context.c",
  "loop.c",
  "socket.c",
  "udp.c",
  "eventing/epoll_kqueue.c",
  "crypto/openssl.c",
  "crypto/sni_tree.cpp",
];

const CC = "gcc";
const CXX = "g++";
const AR = "ar";

const BUILD_DIR = `${CURRENT_DIR}/build`;

async function compileUSockets() {
  await ensureDir(BUILD_DIR);

  const objects = await Promise.all(
    LIB_USOCKETS_SOURCE_FILES.map(async (file) => {
      const sourceFile = `${LIB_USOCKETS_INCLUDE_DIR}/${file}`;

      const bn = basename(sourceFile).split(".")[0];

      const outFile = `${BUILD_DIR}/${bn}.o`;
      let result;
      if (file.endsWith(".c")) {
        const cmd = [CC, ...LIB_USOCKETS_C_FLAGS, "-o", outFile, sourceFile];
        console.log(cmd.join(" "));
        result = await Deno.run({
          cmd,
        }).status();
      } else {
        const cmd = [
          CXX,
          "-std=c++17",
          "-flto",
          "-O3",
          "-c",
          "-fPIC",
          "-o",
          outFile,
          sourceFile,
        ];
        console.log(cmd.join(" "));
        result = await Deno.run({
          cmd,
        }).status();
      }

      if (!result.success) {
        console.error(`Failed to compile ${sourceFile}`);
        Deno.exit(1);
      }

      return outFile;
    })
  );

  await Deno.run({
    cmd: [AR, "rvs", `${BUILD_DIR}/libuSockets.a`, ...objects],
  }).status();
}

async function compileNativeLibrary() {
  const objectCMD = [
    CXX,
    "-c",
    "-std=c++20",
    `-I${LIB_UWEBSOCKETS_INCLUDE_DIR}`,
    `-I${LIB_USOCKETS_INCLUDE_DIR}`,
    "-fPIC",
    `${CURRENT_DIR}/uWebServer.cpp`,
    "-o",
    `${BUILD_DIR}/uWebServer.o`,
  ];

  console.log(objectCMD.join(" "));

  await Deno.run({
    cmd: objectCMD,
  }).status();

  const linkerCMD = [
    CXX,
    "-shared",
    `${BUILD_DIR}/uWebServer.o`,
    `-L${BUILD_DIR}`,
    "-luSockets",
    "-o",
    `${BUILD_DIR}/uWebServer.so`,
  ];

  console.log(linkerCMD.join(" "));

  await Deno.run({
    cmd: linkerCMD,
  }).status();
}

await compileUSockets();
await compileNativeLibrary();
