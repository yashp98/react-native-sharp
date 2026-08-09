#include "HybridSharpPipeline.hpp"

#include "VipsInit.hpp"

#include <NitroModules/ArrayBuffer.hpp>

namespace margelo::nitro::sharp {

void HybridSharpPipeline::resize(double width, double height,
                                 const std::string& fit) {
  std::lock_guard<std::mutex> lock(mutex_);
  ResizeOp op;
  op.width = static_cast<int>(std::lround(width));
  op.height = static_cast<int>(std::lround(height));
  op.fit = parseFit(fit);
  ops_.resize = op;
}

void HybridSharpPipeline::crop(double left, double top, double width,
                               double height) {
  std::lock_guard<std::mutex> lock(mutex_);
  CropOp op;
  op.left = static_cast<int>(std::lround(left));
  op.top = static_cast<int>(std::lround(top));
  op.width = static_cast<int>(std::lround(width));
  op.height = static_cast<int>(std::lround(height));
  ops_.crop = op;
}

void HybridSharpPipeline::rotate(double angle) {
  std::lock_guard<std::mutex> lock(mutex_);
  RotateOp op;
  op.autorotate = false;
  op.angle = angle;
  ops_.rotate = op;
}

void HybridSharpPipeline::autorotate() {
  std::lock_guard<std::mutex> lock(mutex_);
  RotateOp op;
  op.autorotate = true;
  op.angle = 0;
  ops_.rotate = op;
}

void HybridSharpPipeline::blur(double sigma) {
  std::lock_guard<std::mutex> lock(mutex_);
  ops_.blur = BlurOp{sigma <= 0 ? 0.3 : sigma};
}

void HybridSharpPipeline::sharpen(double sigma) {
  std::lock_guard<std::mutex> lock(mutex_);
  ops_.sharpen = SharpenOp{sigma <= 0 ? 1.0 : sigma};
}

void HybridSharpPipeline::backgroundBlur(double width, double height,
                                         double sigma) {
  std::lock_guard<std::mutex> lock(mutex_);
  BackgroundBlurOp op;
  op.width = static_cast<int>(std::lround(width));
  op.height = static_cast<int>(std::lround(height));
  op.sigma = sigma <= 0 ? 20.0 : sigma;
  ops_.backgroundBlur = op;
}

void HybridSharpPipeline::roundCorners(double radius) {
  std::lock_guard<std::mutex> lock(mutex_);
  ops_.roundCorners = RoundCornersOp{radius < 0 ? 0 : radius};
}

void HybridSharpPipeline::composite(const std::vector<CompositeImage>& images) {
  std::lock_guard<std::mutex> lock(mutex_);
  ops_.composites.reserve(ops_.composites.size() + images.size());
  for (const auto& image : images) {
    CompositeOp op;
    op.input = image.input;
    if (image.left.has_value()) {
      op.left = static_cast<int>(std::lround(*image.left));
    }
    if (image.top.has_value()) {
      op.top = static_cast<int>(std::lround(*image.top));
    }
    if (image.gravity.has_value()) {
      op.gravity = parseGravity(*image.gravity);
    }
    ops_.composites.push_back(std::move(op));
  }
}

void HybridSharpPipeline::jpeg(double quality, bool progressive) {
  std::lock_guard<std::mutex> lock(mutex_);
  ops_.encode.format = EncodeFormat::Jpeg;
  ops_.encode.quality = static_cast<int>(std::lround(quality));
  ops_.encode.progressive = progressive;
}

void HybridSharpPipeline::png(double compressionLevel) {
  std::lock_guard<std::mutex> lock(mutex_);
  ops_.encode.format = EncodeFormat::Png;
  ops_.encode.pngCompressionLevel =
      static_cast<int>(std::lround(compressionLevel));
}

void HybridSharpPipeline::webp(double quality) {
  std::lock_guard<std::mutex> lock(mutex_);
  ops_.encode.format = EncodeFormat::Webp;
  ops_.encode.quality = static_cast<int>(std::lround(quality));
}

std::shared_ptr<Promise<std::string>>
HybridSharpPipeline::toFile(const std::string& path) {
  const auto input = inputPath_;
  PipelineOps opsCopy;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    opsCopy = ops_;
  }

  return Promise<std::string>::async([input, path, opsCopy]() {
    VipsImage* loaded = loadImage(input);
    VipsImage* processed = nullptr;
    try {
      processed = applyOps(loaded, opsCopy);
      g_object_unref(loaded);
      loaded = nullptr;
      writeImage(processed, path, opsCopy.encode);
      g_object_unref(processed);
      return stripFileUri(path);
    } catch (...) {
      if (loaded != nullptr) {
        g_object_unref(loaded);
      }
      if (processed != nullptr) {
        g_object_unref(processed);
      }
      throw;
    }
  });
}

std::shared_ptr<Promise<std::shared_ptr<ArrayBuffer>>>
HybridSharpPipeline::toBuffer() {
  const auto input = inputPath_;
  PipelineOps opsCopy;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    opsCopy = ops_;
  }

  return Promise<std::shared_ptr<ArrayBuffer>>::async([input, opsCopy]() {
    VipsImage* loaded = loadImage(input);
    VipsImage* processed = nullptr;
    try {
      processed = applyOps(loaded, opsCopy);
      g_object_unref(loaded);
      loaded = nullptr;
      auto bytes = writeImageToBuffer(processed, opsCopy.encode);
      g_object_unref(processed);
      return ArrayBuffer::copy(bytes);
    } catch (...) {
      if (loaded != nullptr) {
        g_object_unref(loaded);
      }
      if (processed != nullptr) {
        g_object_unref(processed);
      }
      throw;
    }
  });
}

std::shared_ptr<Promise<ImageMetadata>> HybridSharpPipeline::metadata() {
  const auto input = inputPath_;
  return Promise<ImageMetadata>::async([input]() {
    auto meta = readMetadata(input);
    return ImageMetadata(static_cast<double>(meta.width),
                         static_cast<double>(meta.height), meta.format,
                         static_cast<double>(meta.channels), meta.hasAlpha,
                         meta.size);
  });
}

} // namespace margelo::nitro::sharp
