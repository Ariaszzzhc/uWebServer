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

DLL_EXPORT struct uws_app_t;

DLL_EXPORT struct uws_req_t;

DLL_EXPORT struct uws_res_t;

DLL_EXPORT typedef void (*uws_method_handler)(uws_res_t *response, uws_req_t *request,
                                              void *user_data);

DLL_EXPORT uws_app_t *uws_create_app() { return reinterpret_cast<uws_app_t *>(new uWS::App()); }

DLL_EXPORT void uws_app_serve(uws_app_t *app) {
  auto exact_app{reinterpret_cast<uWS::App *>(app)};

  exact_app->any("/*", [=](auto *exact_res, auto *exact_req) {
    // auto res{reinterpret_cast<uws_res_t *>(exact_res)};
    // auto req{reinterpret_cast<uws_req_t *>(exact_req)};

    // handler(res, req, user_data);
    exact_res->end("Hello world!");
  });

  exact_app->listen(3000, [](auto *token) {
    if (token) {
      std::cout << "Listening on port " << 3000 << std::endl;
    }
  });

  exact_app->run();
}

#ifdef __cplusplus
}
#endif
