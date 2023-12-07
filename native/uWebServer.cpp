#include <iostream>

#include "App.h"

#ifdef __cplusplus
extern "C" {
#endif

#ifdef _WIN32
#  define DLL_EXPORT __declspec(dllexport)
#else
#  define DLL_EXPORT
#endif

struct uws_app_t;

DLL_EXPORT uws_app_t *uws_create_app() {
  std::cout << "uws_create_app" << std::endl;

  auto a{reinterpret_cast<uws_app_t *>(new uWS::App())};

  if (a == nullptr) {
    std::cout << "uws_create_app: failed to create app" << std::endl;
  }
  return a;
}

#ifdef __cplusplus
}
#endif
