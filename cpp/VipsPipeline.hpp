#pragma once

#include <memory>
#include <optional>
#include <string>
#include <vector>

#include <vips/vips.h>

namespace margelo::nitro::sharp {

enum class FitMode { Cover, Contain, Fill, Inside, Outside };

enum class GravityMode {
  Centre,
  North,
  NorthEast,
  East,
  SouthEast,
  South,
  SouthWest,
  West,
  NorthWest
};

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
  bool autorotate = false;
  double angle = 0;
};

struct BlurOp {
  double sigma = 0.3;
};

struct SharpenOp {
  double sigma = 1.0;
};

struct CompositeOp {
  std::string input;
  std::optional<int> left;
  std::optional<int> top;
  GravityMode gravity = GravityMode::Centre;
};

struct RoundCornersOp {
  double radius = 0;
};

struct BackgroundBlurOp {
  int width = 0;
  int height = 0;
  double sigma = 20;
};

enum class EncodeFormat { Inherit, Jpeg, Png, Webp };

struct EncodeOptions {
  EncodeFormat format = EncodeFormat::Inherit;
  int quality = 80;
  int pngCompressionLevel = 6;
  bool progressive = false;
};

struct PipelineOps {
  std::optional<ResizeOp> resize;
  std::optional<CropOp> crop;
  std::optional<RotateOp> rotate;
  std::optional<BlurOp> blur;
  std::optional<SharpenOp> sharpen;
  std::optional<BackgroundBlurOp> backgroundBlur;
  std::optional<RoundCornersOp> roundCorners;
  std::vector<CompositeOp> composites;
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
GravityMode parseGravity(const std::string& gravity);
std::string stripFileUri(const std::string& path);

VipsImage* loadImage(const std::string& inputPath);
/** Load from raw encoded bytes (JPEG/PNG/WebP/…). Caller keeps `data` alive only
 *  until this returns — bytes are copied into image-owned memory. */
VipsImage* loadImageFromBuffer(const uint8_t* data, size_t length);
VipsImage* applyOps(VipsImage* input, const PipelineOps& ops);
void writeImage(VipsImage* image, const std::string& outputPath,
                const EncodeOptions& encode);
std::vector<uint8_t> writeImageToBuffer(VipsImage* image,
                                        const EncodeOptions& encode);
MetadataResult readMetadata(const std::string& inputPath);
MetadataResult readMetadataFromBuffer(const uint8_t* data, size_t length);

} // namespace margelo::nitro::sharp
