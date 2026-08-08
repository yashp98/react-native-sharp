#include "HybridSharpModule.hpp"

#include "HybridSharpPipeline.hpp"
#include "VipsInit.hpp"

namespace margelo::nitro::sharp {

std::string HybridSharpModule::getVipsVersion() {
  return currentVipsVersion();
}

std::shared_ptr<HybridSharpPipelineSpec>
HybridSharpModule::create(const std::string& inputPath) {
  ensureVipsInitialized();
  return std::make_shared<HybridSharpPipeline>(inputPath);
}

} // namespace margelo::nitro::sharp
