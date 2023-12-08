import { dirname, fromFileUrl, ensureDir } from "./deps.ts";

async function run(exec: string, args: string[], cwd?: string) {
  const cmd = new Deno.Command(exec, {
    args,
    cwd,
  });

  console.log([exec, ...args].join(" "));

  const process = cmd.spawn();

  const status = await process.status;

  if (!status.success) {
    console.error(`Failed to run cmd ${cmd}`);
    Deno.exit(1);
  }
}

async function buildBoringSsl() {
  const wd =
    dirname(fromFileUrl(import.meta.url)) + "/uWebSockets/uSockets/boringssl";

  switch (Deno.build.os) {
    case "linux":
      {
        await run(
          "cmake",
          [
            "-B",
            "build",
            "-DCMAKE_POSITION_INDEPENDENT_CODE=ON",
            "-DCMAKE_BUILD_TYPE=Release",
          ],
          wd
        );

        await run("make", ["crypto", "ssl"], wd + "/build");
      }

      break;

    case "darwin":
      {
        await run("cmake", ["-B", "build", "-DCMAKE_BUILD_TYPE=Release"], wd);

        await run("make", ["crypto", "ssl"], wd + "/build");
      }
      break;

    case "windows":
      {
        await run(
          "cmake",
          [
            "-B",
            "build",
            "-DCMAKE_C_COMPILER=clang",
            "-DCMAKE_CXX_COMPILER=clang++",
            "-DCMAKE_BUILD_TYPE=Release",
            "-GNinja",
          ],
          wd
        );

        await run("ninja", ["crypto", "ssl"], wd + "/build");
      }
      break;

    default:
      throw new Error("Unsupported OS");
  }
}

async function buildLsquic() {
  const wd =
    dirname(fromFileUrl(import.meta.url)) + "/uWebSockets/uSockets/lsquic";

  switch (Deno.build.os) {
    case "windows":
      {
        await run(
          "cmake",
          [
            "-B",
            "build",
            "-DCMAKE_POSITION_INDEPENDENT_CODE=ON",
            "-DBORINGSSL_DIR=../boringssl",
            "-DCMAKE_BUILD_TYPE=Release",
            "-DLSQUIC_BIN=Off",
          ],
          wd
        );

        await run("msbuild", ["ALL_BUILD.vcxproj"], wd + "/build");
      }
      break;

    case "darwin":
    case "linux":
      {
        await run(
          "cmake",
          [
            "-B",
            "build",
            "-DCMAKE_POSITION_INDEPENDENT_CODE=ON",
            "-DBORINGSSL_DIR=../boringssl",
            "-DCMAKE_BUILD_TYPE=Release",
            "-DLSQUIC_BIN=Off",
          ],
          wd
        );

        await run("make", ["lsquic"], wd + "/build");
      }
      break;

    default:
      throw new Error("Unsupported OS");
  }
}

async function buildUnix(cc: string, cxx: string, linker: string) {
  const CURRENT_DIR = dirname(fromFileUrl(import.meta.url));

  const lsquicDir = CURRENT_DIR + "/uWebSockets/uSockets/lsquic";
  const boringSslDir = CURRENT_DIR + "/uWebSockets/uSockets/boringssl";

  const uSocketsDir = CURRENT_DIR + "/uWebSockets/uSockets";

  const uWebSocketsDir = CURRENT_DIR + "/uWebSockets";

  const nativeDir = CURRENT_DIR + "/native";

  const cFlags = [
    "-DWIN32_LEAN_AND_MEAN",
    "-DLIBUS_USE_QUIC",
    "-DLIBUS_USE_ASIO",
    "-DLIBUS_USE_OPENSSL",
    "-I",
    `${lsquicDir}/include`,
    "-I",
    `${boringSslDir}/include`,
    "-pthread",
    "-flto",
    "-O3",
    "-c",
    "-fPIC",
    "-I",
    `${uSocketsDir}/src`,
  ];

  const cxxFlags = [
    "-DWIN32_LEAN_AND_MEAN",
    "-DUWS_WITH_PROXY",
    "-DLIBUS_USE_ASIO",
    "-DLIBUS_USE_QUIC",
    "-DLIBUS_USE_OPENSSL",
    "-I",
    `${boringSslDir}/include`,
    "-pthread",
    "-flto",
    "-O3",
    "-c",
    "-fPIC",
    "-I",
    `${uSocketsDir}/src`,
    "-I",
    `${uWebSocketsDir}/src`,
  ];

  const buildDir = `${CURRENT_DIR}/build`;
  await ensureDir(buildDir);

  const objects = [];

  // build uSockets
  {
    const baseDir = `${uSocketsDir}/src`;
    const eventingDir = `${baseDir}/eventing`;
    const cryptoDir = `${baseDir}/crypto`;

    // base
    for await (const dirEntry of Deno.readDir(baseDir)) {
      if (dirEntry.isFile) {
        if (dirEntry.name.endsWith(".c")) {
          const filename = dirEntry.name.split(".")[0];
          const outFile = `${buildDir}/${filename}.o`;
          const sourceFile = `${baseDir}/${dirEntry.name}`;

          objects.push(outFile);

          await run(cc, [...cFlags, "-o", outFile, sourceFile]);
        }
      }
    }

    // eventing
    for await (const dirEntry of Deno.readDir(eventingDir)) {
      if (dirEntry.isFile) {
        if (dirEntry.name.endsWith(".c")) {
          const filename = dirEntry.name.split(".")[0];
          const outFile = `${buildDir}/${filename}.o`;
          const sourceFile = `${eventingDir}/${dirEntry.name}`;

          objects.push(outFile);

          await run(cc, [...cFlags, "-o", outFile, sourceFile]);
        }
      }
    }

    // crypto
    for await (const dirEntry of Deno.readDir(cryptoDir)) {
      if (dirEntry.isFile) {
        if (dirEntry.name.endsWith(".c")) {
          const filename = dirEntry.name.split(".")[0];
          const outFile = `${buildDir}/${filename}.o`;
          const sourceFile = `${cryptoDir}/${dirEntry.name}`;

          objects.push(outFile);

          await run(cc, [...cFlags, "-o", outFile, sourceFile]);
        }
      }
    }

    // sni_tree
    objects.push(`${buildDir}/sni_tree.o`);
    await run(cxx, [
      ...cxxFlags,
      "-std=c++17",
      "-o",
      `${buildDir}/sni_tree.o`,
      `${cryptoDir}/sni_tree.cpp`,
    ]);

    // asio
    objects.push(`${buildDir}/asio.o`);
    await run(cxx, [
      ...cxxFlags,
      "-std=c++17",
      "-o",
      `${buildDir}/asio.o`,
      `${eventingDir}/asio.cpp`,
    ]);
  }

  // build uWebServer native
  {
    objects.push(`${buildDir}/uWebServer.o`);
    await run(cxx, [
      ...cxxFlags,
      "-std=c++20",
      "-o",
      `${buildDir}/uWebServer.o`,
      `${nativeDir}/uWebServer.cpp`,
    ]);

    // build dynamic library
    if (Deno.build.os === "darwin") {
      await run(linker, [
        "-shared",
        "-pthread",
        "-flto",
        "-O3",
        `${boringSslDir}/build/crypto/libcrypto.a`,
        `${boringSslDir}/build/ssl/libssl.a`,
        `${lsquicDir}/build/src/liblsquic/liblsquic.a`,
        ...objects,
        "-o",
        `${buildDir}/uWebServer.dylib`,
      ]);
    } else if (Deno.build.os === "linux") {
      await run(linker, [
        "-shared",
        "-pthread",
        "-flto",
        "-O3",
        `${boringSslDir}/build/crypto/libcrypto.a`,
        `${boringSslDir}/build/ssl/libssl.a`,
        `${lsquicDir}/build/src/liblsquic/liblsquic.a`,
        ...objects,
        "-o",
        `${buildDir}/uWebServer.so`,
      ]);
    }
  }
}

// deno-lint-ignore require-await
async function buildWindows() {
  // TODO
  throw new Error("Not implemented");
}

async function buildNative() {
  // build boringssl
  await buildBoringSsl();

  // build lsquic
  await buildLsquic();

  if (Deno.build.os === "windows") {
    await buildWindows();
  } else {
    await buildUnix("gcc", "g++", "g++");
  }
}

await buildNative();
