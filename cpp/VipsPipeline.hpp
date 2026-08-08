#pragma once

#include <memory>
#include <optional>
#include <string>
#include <vector>

#include <vips/vips.h>

namespace margelo::nitro::sharp {

enum class FitMode { Cover, Contain, Fill, Inside, Outside };

struct ResizeOp {
  int width = 0;
  int height = 0;
  FitMode fit = FitMode::Cover;
};

struct CropOp {
  int left = 0;
  int top = 0;
  int width = 0;
  int height = 0;
};

struct RotateOp {
  double angle = 0;
};

struct BlurOp {
  double sigma = 0.3;
};

struct SharpenOp {
  double sigma = 1.0;
};

enum class EncodeFormat { Inherit, Jpeg, Png, Webp };

struct EncodeOptions {
  EncodeFormat format = EncodeFormat::Inherit;
  int quality = 80;
  int pngCompressionLevel = 6;
};

struct PipelineOps {
  std::optional<ResizeOp> resize;
  std::optional<CropOp> crop;
  std::optional<RotateOp> rotate;
  std::optional<BlurOp> blur;
  std::optional<SharpenOp> sharpen;
  EncodeOptions encode;
};

struct MetadataResult {
  int width = 0;
  int height = 0;
  std::string format;
  int channels = 0;
  bool hasAlpha = false;
  double size = 0;
};

FitMode parseFit(const std::string& fit);
std::string stripFileUri(const std::string& path);

VipsImage* loadImage(const std::string& inputPath);
VipsImage* applyOps(VipsImage* input, const PipelineOps& ops);
void writeImage(VipsImage* image, const std::string& outputPath,
                const EncodeOptions& encode);
std::vector<uint8_t> writeImageToBuffer(VipsImage* image,
                                        const EncodeOptions& encode);
MetadataResult readMetadata(const std::string& inputPath);

} // namespace margelo::nitro::sharp
