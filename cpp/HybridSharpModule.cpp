#include "HybridSharpModule.hpp"

#include "HybridSharpPipeline.hpp"
#include "VipsInit.hpp"

#include <stdexcept>
#include <vector>

namespace margelo::nitro::sharp {

std::string HybridSharpModule::getVipsVersion() {
  return currentVipsVersion();
}

std::shared_ptr<HybridSharpPipelineSpec>
HybridSharpModule::create(const std::string& inputPath) {
  ensureVipsInitialized();
  return std::make_shared<HybridSharpPipeline>(inputPath);
}

std::shared_ptr<HybridSharpPipelineSpec>
HybridSharpModule::createFromBuffer(
    const std::shared_ptr<ArrayBuffer>& buffer) {
  ensureVipsInitialized();
  if (buffer == nullptr || buffer->size() == 0 || buffer->data() == nullptr) {
    throw std::runtime_error("sharp.createFromBuffer: buffer is empty");
  }
  // Copy immediately — JS ArrayBuffers are not safe to keep across threads.
  auto bytes = std::make_shared<std::vector<uint8_t>>(
      buffer->data(), buffer->data() + buffer->size());
  return std::make_shared<HybridSharpPipeline>(std::move(bytes));
}

} // namespace margelo::nitro::sharp
