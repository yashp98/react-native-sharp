#pragma once

#include <mutex>
#include <stdexcept>
#include <string>
#include <vips/vips.h>

namespace margelo::nitro::sharp {

/**
 * Process-wide libvips initialization (thread-safe, once).
 */
inline void ensureVipsInitialized() {
  static std::once_flag flag;
  std::call_once(flag, []() {
    if (VIPS_INIT("react-native-sharp")) {
      throw std::runtime_error(
          std::string("vips_init failed: ") +
          (vips_error_buffer() != nullptr ? vips_error_buffer() : "unknown"));
    }
    // Prefer fewer threads on mobile to avoid memory spikes.
    vips_concurrency_set(2);
  });
}

inline std::string currentVipsVersion() {
  ensureVipsInitialized();
  return std::string(vips_version_string());
}

} // namespace margelo::nitro::sharp
