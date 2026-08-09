#pragma once

#include "HybridSharpPipelineSpec.hpp"
#include "VipsPipeline.hpp"

#include <cmath>
#include <memory>
#include <mutex>
#include <vector>

namespace margelo::nitro::sharp {

class HybridSharpPipeline final : public HybridSharpPipelineSpec {
public:
  explicit HybridSharpPipeline(std::string inputPath)
      : HybridObject(TAG), HybridSharpPipelineSpec(),
        inputPath_(std::move(inputPath)) {}

  explicit HybridSharpPipeline(std::shared_ptr<std::vector<uint8_t>> inputBytes)
      : HybridObject(TAG), HybridSharpPipelineSpec(),
        inputBytes_(std::move(inputBytes)) {}

  void resize(double width, double height, const std::string& fit) override;
  void crop(double left, double top, double width, double height) override;
  void rotate(double angle) override;
  void autorotate() override;
  void blur(double sigma) override;
  void sharpen(double sigma) override;
  void backgroundBlur(double width, double height, double sigma) override;
  void roundCorners(double radius) override;
  void composite(const std::vector<CompositeImage>& images) override;
  void jpeg(double quality, bool progressive) override;
  void png(double compressionLevel) override;
  void webp(double quality) override;

  std::shared_ptr<Promise<std::string>> toFile(const std::string& path) override;
  std::shared_ptr<Promise<std::shared_ptr<ArrayBuffer>>> toBuffer() override;
  std::shared_ptr<Promise<ImageMetadata>> metadata() override;

private:
  std::string inputPath_;
  std::shared_ptr<std::vector<uint8_t>> inputBytes_;
  PipelineOps ops_;
  std::mutex mutex_;
};

} // namespace margelo::nitro::sharp
