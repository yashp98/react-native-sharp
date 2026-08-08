#pragma once

#include "HybridSharpModuleSpec.hpp"

namespace margelo::nitro::sharp {

class HybridSharpModule final : public HybridSharpModuleSpec {
public:
  HybridSharpModule() : HybridObject(TAG), HybridSharpModuleSpec() {}

  std::string getVipsVersion() override;
  std::shared_ptr<HybridSharpPipelineSpec>
  create(const std::string& inputPath) override;
};

} // namespace margelo::nitro::sharp
