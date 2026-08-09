#pragma once

#include "HybridSharpModuleSpec.hpp"

#include <NitroModules/ArrayBuffer.hpp>

namespace margelo::nitro::sharp {

class HybridSharpModule final : public HybridSharpModuleSpec {
public:
  HybridSharpModule() : HybridObject(TAG), HybridSharpModuleSpec() {}

  std::string getVipsVersion() override;
  std::shared_ptr<HybridSharpPipelineSpec>
  create(const std::string& inputPath) override;
  std::shared_ptr<HybridSharpPipelineSpec>
  createFromBuffer(const std::shared_ptr<ArrayBuffer>& buffer) override;
};

} // namespace margelo::nitro::sharp
