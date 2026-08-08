#pragma once

#include "HybridSharpPipelineSpec.hpp"
#include "VipsPipeline.hpp"

#include <cmath>
#include <mutex>

namespace margelo::nitro::sharp {

class HybridSharpPipeline final : public HybridSharpPipelineSpec {
public:
  explicit HybridSharpPipeline(std::string inputPath)
      : HybridObject(TAG), HybridSharpPipelineSpec(),
        inputPath_(std::move(inputPath)) {}

  void resize(double width, double height, const std::string& fit) override;
  void crop(double left, double top, double width, double height) override;
  void rotate(double angle) override;
  void blur(double sigma) override;
  void sharpen(double sigma) override;
  void jpeg(double quality) override;
  void png(double compressionLevel) override;
  void webp(double quality) override;

  std::shared_ptr<Promise<std::string>> toFile(const std::string& path) override;
  std::shared_ptr<Promise<std::shared_ptr<ArrayBuffer>>> toBuffer() override;
  std::shared_ptr<Promise<ImageMetadata>> metadata() override;

private:
  std::string inputPath_;
  PipelineOps ops_;
  std::mutex mutex_;
};

} // namespace margelo::nitro::sharp
