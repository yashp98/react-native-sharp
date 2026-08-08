#include "VipsPipeline.hpp"

#include "VipsInit.hpp"

#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <stdexcept>

namespace margelo::nitro::sharp {

namespace {

[[noreturn]] void throwVips(const std::string& context) {
  const char* err = vips_error_buffer();
  std::string message = context;
  if (err != nullptr && err[0] != '\0') {
    message += ": ";
    message += err;
  }
  vips_error_clear();
  throw std::runtime_error(message);
}

int freeGBytes(void* data, void* /*unused*/) {
  g_free(data);
  return 0;
}

EncodeFormat detectFormatFromPath(const std::string& path) {
  auto lower = path;
  for (auto& c : lower) {
    c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  }
  if (lower.size() >= 4 && lower.rfind(".png") == lower.size() - 4) {
    return EncodeFormat::Png;
  }
  if (lower.size() >= 5 && lower.rfind(".webp") == lower.size() - 5) {
    return EncodeFormat::Webp;
  }
  if ((lower.size() >= 4 && lower.rfind(".jpg") == lower.size() - 4) ||
      (lower.size() >= 5 && lower.rfind(".jpeg") == lower.size() - 5)) {
    return EncodeFormat::Jpeg;
  }
  return EncodeFormat::Jpeg;
}

std::string formatNameFromLoader(VipsImage* image) {
  const char* loader = nullptr;
  if (vips_image_get_string(image, "vips-loader", &loader) != 0 ||
      loader == nullptr) {
    return "unknown";
  }
  std::string name = loader;
  // File loaders: "jpegload" / "pngload" / "webpload"
  // Buffer / data-URI loaders: "jpegload_buffer" / "pngload_buffer" / ...
  constexpr const char* kBufferSuffix = "_buffer";
  constexpr const char* kLoadSuffix = "load";
  if (name.size() > 7 &&
      name.compare(name.size() - 7, 7, kBufferSuffix) == 0) {
    name.resize(name.size() - 7);
  }
  if (name.size() > 4 &&
      name.compare(name.size() - 4, 4, kLoadSuffix) == 0) {
    name.resize(name.size() - 4);
  }
  return name;
}

VipsImage* resizeImage(VipsImage* input, const ResizeOp& op) {
  if (op.width <= 0 && op.height <= 0) {
    throw std::runtime_error("resize requires width and/or height");
  }

  const double inW = static_cast<double>(input->Xsize);
  const double inH = static_cast<double>(input->Ysize);
  double targetW = op.width > 0 ? static_cast<double>(op.width) : 0;
  double targetH = op.height > 0 ? static_cast<double>(op.height) : 0;

  if (targetW <= 0) {
    targetW = inW * (targetH / inH);
  }
  if (targetH <= 0) {
    targetH = inH * (targetW / inW);
  }

  double scale = 1.0;
  switch (op.fit) {
    case FitMode::Fill:
      // Non-uniform scale handled below.
      break;
    case FitMode::Contain:
    case FitMode::Inside:
      scale = std::min(targetW / inW, targetH / inH);
      targetW = inW * scale;
      targetH = inH * scale;
      break;
    case FitMode::Outside:
      scale = std::max(targetW / inW, targetH / inH);
      targetW = inW * scale;
      targetH = inH * scale;
      break;
    case FitMode::Cover:
    default:
      scale = std::max(targetW / inW, targetH / inH);
      targetW = inW * scale;
      targetH = inH * scale;
      break;
  }

  VipsImage* resized = nullptr;
  if (op.fit == FitMode::Fill) {
    if (vips_resize(input, &resized, targetW / inW, "vscale", targetH / inH,
                    nullptr)) {
      throwVips("resize(fill)");
    }
  } else {
    if (vips_resize(input, &resized, targetW / inW, nullptr)) {
      throwVips("resize");
    }
  }

  if (op.fit == FitMode::Cover && op.width > 0 && op.height > 0) {
    const int outW = op.width;
    const int outH = op.height;
    const int left = std::max(0, (resized->Xsize - outW) / 2);
    const int top = std::max(0, (resized->Ysize - outH) / 2);
    VipsImage* cropped = nullptr;
    if (vips_extract_area(resized, &cropped, left, top,
                          std::min(outW, resized->Xsize),
                          std::min(outH, resized->Ysize), nullptr)) {
      g_object_unref(resized);
      throwVips("resize(cover crop)");
    }
    g_object_unref(resized);
    return cropped;
  }

  return resized;
}

} // namespace

FitMode parseFit(const std::string& fit) {
  if (fit == "contain")
    return FitMode::Contain;
  if (fit == "fill")
    return FitMode::Fill;
  if (fit == "inside")
    return FitMode::Inside;
  if (fit == "outside")
    return FitMode::Outside;
  return FitMode::Cover;
}

std::string stripFileUri(const std::string& path) {
  if (path.rfind("file://", 0) == 0) {
    return path.substr(7);
  }
  return path;
}

VipsImage* loadImage(const std::string& inputPath) {
  ensureVipsInitialized();

  // data:image/...;base64,....
  if (inputPath.rfind("data:", 0) == 0) {
    const auto comma = inputPath.find(',');
    if (comma == std::string::npos) {
      throw std::runtime_error("Invalid data URI (missing comma)");
    }
    const std::string meta = inputPath.substr(0, comma);
    if (meta.find(";base64") == std::string::npos) {
      throw std::runtime_error("Only base64 data URIs are supported");
    }
    const std::string b64 = inputPath.substr(comma + 1);
    gsize outLen = 0;
    guchar* decoded = g_base64_decode(b64.c_str(), &outLen);
    if (decoded == nullptr || outLen == 0) {
      throw std::runtime_error("Failed to decode base64 data URI");
    }
    // new_from_buffer keeps a pointer into this memory for lazy decode —
    // transfer ownership via image metadata so it lives until unref.
    VipsImage* image =
        vips_image_new_from_buffer(decoded, outLen, "", nullptr);
    if (image == nullptr) {
      g_free(decoded);
      throwVips("Failed to load image from data URI buffer");
    }
    vips_image_set_blob(image, "vips-sharp-input-buffer", freeGBytes, decoded,
                        outLen);
    return image;
  }

  const auto path = stripFileUri(inputPath);
  VipsImage* image = vips_image_new_from_file(path.c_str(), nullptr);
  if (image == nullptr) {
    throwVips("Failed to load image: " + path);
  }
  return image;
}

VipsImage* applyOps(VipsImage* input, const PipelineOps& ops) {
  VipsImage* current = input;
  g_object_ref(current);

  auto replace = [&](VipsImage* next) {
    g_object_unref(current);
    current = next;
  };

  try {
    if (ops.rotate.has_value() && std::abs(ops.rotate->angle) > 0.0001) {
      VipsImage* rotated = nullptr;
      if (vips_rotate(current, &rotated, ops.rotate->angle, nullptr)) {
        throwVips("rotate");
      }
      replace(rotated);
    }

    if (ops.resize.has_value()) {
      replace(resizeImage(current, *ops.resize));
    }

    if (ops.crop.has_value()) {
      const auto& c = *ops.crop;
      VipsImage* cropped = nullptr;
      if (vips_extract_area(current, &cropped, c.left, c.top, c.width, c.height,
                            nullptr)) {
        throwVips("crop");
      }
      replace(cropped);
    }

    if (ops.blur.has_value() && ops.blur->sigma > 0.01) {
      VipsImage* blurred = nullptr;
      if (vips_gaussblur(current, &blurred, ops.blur->sigma, nullptr)) {
        throwVips("blur");
      }
      replace(blurred);
    }

    if (ops.sharpen.has_value() && ops.sharpen->sigma > 0.01) {
      VipsImage* sharpened = nullptr;
      // mild unsharp: radius ~ sigma
      if (vips_sharpen(current, &sharpened, "sigma", ops.sharpen->sigma,
                       nullptr)) {
        throwVips("sharpen");
      }
      replace(sharpened);
    }
  } catch (...) {
    g_object_unref(current);
    throw;
  }

  return current;
}

void writeImage(VipsImage* image, const std::string& outputPath,
                const EncodeOptions& encode) {
  const auto path = stripFileUri(outputPath);
  EncodeFormat format = encode.format;
  if (format == EncodeFormat::Inherit) {
    format = detectFormatFromPath(path);
  }

  int status = 0;
  switch (format) {
    case EncodeFormat::Png:
      status = vips_pngsave(image, path.c_str(), "compression",
                            encode.pngCompressionLevel, nullptr);
      break;
    case EncodeFormat::Webp:
      status = vips_webpsave(image, path.c_str(), "Q", encode.quality, nullptr);
      break;
    case EncodeFormat::Jpeg:
    case EncodeFormat::Inherit:
    default:
      status = vips_jpegsave(image, path.c_str(), "Q", encode.quality, nullptr);
      break;
  }

  if (status != 0) {
    throwVips("Failed to write image: " + path);
  }
}

std::vector<uint8_t> writeImageToBuffer(VipsImage* image,
                                        const EncodeOptions& encode) {
  EncodeFormat format = encode.format;
  if (format == EncodeFormat::Inherit) {
    format = EncodeFormat::Jpeg;
  }

  void* buffer = nullptr;
  size_t length = 0;
  int status = 0;

  switch (format) {
    case EncodeFormat::Png:
      status = vips_pngsave_buffer(image, &buffer, &length, "compression",
                                   encode.pngCompressionLevel, nullptr);
      break;
    case EncodeFormat::Webp:
      status = vips_webpsave_buffer(image, &buffer, &length, "Q", encode.quality,
                                    nullptr);
      break;
    case EncodeFormat::Jpeg:
    case EncodeFormat::Inherit:
    default:
      status = vips_jpegsave_buffer(image, &buffer, &length, "Q", encode.quality,
                                    nullptr);
      break;
  }

  if (status != 0 || buffer == nullptr) {
    throwVips("Failed to encode image buffer");
  }

  std::vector<uint8_t> bytes(static_cast<uint8_t*>(buffer),
                             static_cast<uint8_t*>(buffer) + length);
  g_free(buffer);
  return bytes;
}

MetadataResult readMetadata(const std::string& inputPath) {
  VipsImage* image = loadImage(inputPath);
  MetadataResult meta;
  meta.width = image->Xsize;
  meta.height = image->Ysize;
  meta.channels = image->Bands;
  meta.hasAlpha = vips_image_hasalpha(image) != 0;
  meta.format = formatNameFromLoader(image);
  meta.size = 0;

  // data URI / buffer inputs: length of the owned decoded blob
  {
    const void* data = nullptr;
    size_t length = 0;
    if (vips_image_get_blob(image, "vips-sharp-input-buffer", &data, &length) ==
            0 &&
        length > 0) {
      meta.size = static_cast<double>(length);
    }
  }

  g_object_unref(image);

  // file inputs: byte length on disk
  if (meta.size <= 0) {
    FILE* file = fopen(stripFileUri(inputPath).c_str(), "rb");
    if (file != nullptr) {
      if (fseek(file, 0, SEEK_END) == 0) {
        const long end = ftell(file);
        if (end >= 0) {
          meta.size = static_cast<double>(end);
        }
      }
      fclose(file);
    }
  }

  return meta;
}

} // namespace margelo::nitro::sharp
