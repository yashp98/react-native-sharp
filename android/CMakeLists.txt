project(ReactNativeSharp)
cmake_minimum_required(VERSION 3.9.0)

set(PACKAGE_NAME ReactNativeSharp)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

add_compile_options(-DRN_SERIALIZABLE_STATE=1)

set(LIBVIPS_ROOT "${CMAKE_SOURCE_DIR}/../third_party/libvips/android")
set(LIBVIPS_INCLUDE "${LIBVIPS_ROOT}/include")
set(LIBVIPS_JNI "${LIBVIPS_ROOT}/jniLibs/${ANDROID_ABI}")

if(NOT EXISTS "${LIBVIPS_INCLUDE}/vips/vips.h")
  message(FATAL_ERROR
    "libvips Android prebuild missing. Run: npm run download-libvips\n"
    "Expected: ${LIBVIPS_INCLUDE}/vips/vips.h")
endif()

add_library(${PACKAGE_NAME} SHARED
  src/main/cpp/cpp-adapter.cpp
  ../cpp/HybridSharpModule.cpp
  ../cpp/HybridSharpPipeline.cpp
  ../cpp/VipsPipeline.cpp
)

include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/ReactNativeSharp+autolinking.cmake)

include_directories(
  "src/main/cpp"
  "../cpp"
  "${LIBVIPS_INCLUDE}"
  "${LIBVIPS_INCLUDE}/glib-2.0"
)

# Import shared libvips + glib runtime deps for this ABI
foreach(LIB_NAME vips glib-2.0 gobject-2.0 gmodule-2.0 gio-2.0 gthread-2.0 girepository-2.0 intl z)
  set(LIB_PATH "${LIBVIPS_JNI}/lib${LIB_NAME}.so")
  if(EXISTS "${LIB_PATH}")
    add_library(vips_${LIB_NAME} SHARED IMPORTED)
    set_target_properties(vips_${LIB_NAME} PROPERTIES IMPORTED_LOCATION "${LIB_PATH}")
    list(APPEND VIPS_LIBS vips_${LIB_NAME})
  endif()
endforeach()

find_library(LOG_LIB log)

target_link_libraries(
  ${PACKAGE_NAME}
  ${LOG_LIB}
  android
  ${VIPS_LIBS}
)
