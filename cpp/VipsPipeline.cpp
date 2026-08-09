#include "VipsPipeline.hpp"

#include "VipsInit.hpp"

#include <algorithm>
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

void gravityOffset(GravityMode gravity, int baseW, int baseH, int overlayW,
                   int overlayH, int* left, int* top) {
  switch (gravity) {
    case GravityMode::North:
      *left = (baseW - overlayW) / 2;
      *top = 0;
      break;
    case GravityMode::NorthEast:
      *left = baseW - overlayW;
      *top = 0;
      break;
    case GravityMode::East:
      *left = baseW - overlayW;
      *top = (baseH - overlayH) / 2;
      break;
    case GravityMode::SouthEast:
      *left = baseW - overlayW;
      *top = baseH - overlayH;
      break;
    case GravityMode::South:
      *left = (baseW - overlayW) / 2;
      *top = baseH - overlayH;
      break;
    case GravityMode::SouthWest:
      *left = 0;
      *top = baseH - overlayH;
      break;
    case GravityMode::West:
      *left = 0;
      *top = (baseH - overlayH) / 2;
      break;
    case GravityMode::NorthWest:
      *left = 0;
      *top = 0;
      break;
    case GravityMode::Centre:
    default:
      *left = (baseW - overlayW) / 2;
      *top = (baseH - overlayH) / 2;
      break;
  }
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

VipsImage* ensureAlpha(VipsImage* image) {
  if (vips_image_hasalpha(image)) {
    g_object_ref(image);
    return image;
  }
  VipsImage* withAlpha = nullptr;
  if (vips_addalpha(image, &withAlpha, nullptr)) {
    throwVips("addalpha");
  }
  return withAlpha;
}

VipsImage* makeRoundedRectMask(int width, int height, int radius) {
  VipsImage* black = nullptr;
  if (vips_black(&black, width, height, "bands", 1, nullptr)) {
    throwVips("roundCorners mask black");
  }

  VipsImage* mask = vips_image_copy_memory(black);
  g_object_unref(black);
  if (mask == nullptr) {
    throw std::runtime_error("roundCorners: failed to copy mask to memory");
  }

  const int r = radius;
  const int innerW = std::max(0, width - 2 * r);
  const int innerH = std::max(0, height - 2 * r);

  auto drawFail = [&](const char* where) {
    g_object_unref(mask);
    throwVips(where);
  };

  // Cross of filled rects + four corner circles → rounded rectangle.
  if (innerW > 0) {
    if (vips_draw_rect1(mask, 255, r, 0, innerW, height, "fill", TRUE,
                        nullptr)) {
      drawFail("roundCorners h-rect");
    }
  }
  if (innerH > 0) {
    if (vips_draw_rect1(mask, 255, 0, r, width, innerH, "fill", TRUE,
                        nullptr)) {
      drawFail("roundCorners v-rect");
    }
  }
  if (vips_draw_circle1(mask, 255, r, r, r, "fill", TRUE, nullptr) ||
      vips_draw_circle1(mask, 255, width - r, r, r, "fill", TRUE, nullptr) ||
      vips_draw_circle1(mask, 255, r, height - r, r, "fill", TRUE, nullptr) ||
      vips_draw_circle1(mask, 255, width - r, height - r, r, "fill", TRUE,
                        nullptr)) {
    drawFail("roundCorners corners");
  }

  return mask;
}

VipsImage* applyRoundCorners(VipsImage* input, const RoundCornersOp& op) {
  const int width = input->Xsize;
  const int height = input->Ysize;
  int radius = static_cast<int>(std::lround(op.radius));
  radius = std::max(0, std::min(radius, std::min(width, height) / 2));
  if (radius <= 0) {
    g_object_ref(input);
    return input;
  }

  VipsImage* withAlpha = nullptr;
  VipsImage* mask = nullptr;
  VipsImage* colour = nullptr;
  VipsImage* alpha = nullptr;
  VipsImage* alphaF = nullptr;
  VipsImage* maskF = nullptr;
  VipsImage* multiplied = nullptr;
  VipsImage* scaled = nullptr;
  VipsImage* newAlpha = nullptr;
  VipsImage* out = nullptr;

  try {
    withAlpha = ensureAlpha(input);
    mask = makeRoundedRectMask(width, height, radius);

    const int bands = withAlpha->Bands;
    if (vips_extract_band(withAlpha, &colour, 0, "n", bands - 1, nullptr)) {
      throwVips("roundCorners extract colour");
    }
    if (vips_extract_band(withAlpha, &alpha, bands - 1, nullptr)) {
      throwVips("roundCorners extract alpha");
    }

    if (vips_cast(alpha, &alphaF, VIPS_FORMAT_FLOAT, nullptr) ||
        vips_cast(mask, &maskF, VIPS_FORMAT_FLOAT, nullptr)) {
      throwVips("roundCorners cast");
    }
    if (vips_multiply(alphaF, maskF, &multiplied, nullptr)) {
      throwVips("roundCorners multiply");
    }
    if (vips_linear1(multiplied, &scaled, 1.0 / 255.0, 0.0, nullptr)) {
      throwVips("roundCorners scale");
    }
    if (vips_cast_uchar(scaled, &newAlpha, nullptr)) {
      throwVips("roundCorners cast alpha");
    }
    if (vips_bandjoin2(colour, newAlpha, &out, nullptr)) {
      throwVips("roundCorners bandjoin");
    }

    g_object_unref(withAlpha);
    g_object_unref(mask);
    g_object_unref(colour);
    g_object_unref(alpha);
    g_object_unref(alphaF);
    g_object_unref(maskF);
    g_object_unref(multiplied);
    g_object_unref(scaled);
    g_object_unref(newAlpha);
    return out;
  } catch (...) {
    if (withAlpha != nullptr)
      g_object_unref(withAlpha);
    if (mask != nullptr)
      g_object_unref(mask);
    if (colour != nullptr)
      g_object_unref(colour);
    if (alpha != nullptr)
      g_object_unref(alpha);
    if (alphaF != nullptr)
      g_object_unref(alphaF);
    if (maskF != nullptr)
      g_object_unref(maskF);
    if (multiplied != nullptr)
      g_object_unref(multiplied);
    if (scaled != nullptr)
      g_object_unref(scaled);
    if (newAlpha != nullptr)
      g_object_unref(newAlpha);
    if (out != nullptr)
      g_object_unref(out);
    throw;
  }
}

VipsImage* applyBackgroundBlur(VipsImage* input, const BackgroundBlurOp& op) {
  if (op.width <= 0 || op.height <= 0) {
    throw std::runtime_error("backgroundBlur requires width and height");
  }

  const double sigma = op.sigma <= 0 ? 20.0 : op.sigma;
  VipsImage* cover = nullptr;
  VipsImage* blurred = nullptr;
  VipsImage* contain = nullptr;
  VipsImage* foreground = nullptr;
  VipsImage* out = nullptr;

  try {
    ResizeOp coverOp;
    coverOp.width = op.width;
    coverOp.height = op.height;
    coverOp.fit = FitMode::Cover;
    cover = resizeImage(input, coverOp);

    if (vips_gaussblur(cover, &blurred, sigma, nullptr)) {
      throwVips("backgroundBlur blur");
    }
    g_object_unref(cover);
    cover = nullptr;

    ResizeOp containOp;
    containOp.width = op.width;
    containOp.height = op.height;
    containOp.fit = FitMode::Contain;
    contain = resizeImage(input, containOp);
    foreground = ensureAlpha(contain);
    g_object_unref(contain);
    contain = nullptr;

    const int left = (op.width - foreground->Xsize) / 2;
    const int top = (op.height - foreground->Ysize) / 2;
    if (vips_composite2(blurred, foreground, &out, VIPS_BLEND_MODE_OVER, "x",
                        left, "y", top, nullptr)) {
      throwVips("backgroundBlur composite");
    }

    g_object_unref(blurred);
    g_object_unref(foreground);
    return out;
  } catch (...) {
    if (cover != nullptr)
      g_object_unref(cover);
    if (blurred != nullptr)
      g_object_unref(blurred);
    if (contain != nullptr)
      g_object_unref(contain);
    if (foreground != nullptr)
      g_object_unref(foreground);
    if (out != nullptr)
      g_object_unref(out);
    throw;
  }
}

VipsImage* applyComposite(VipsImage* base, const CompositeOp& op) {
  VipsImage* overlay = loadImage(op.input);
  VipsImage* baseAlpha = nullptr;
  VipsImage* overlayAlpha = nullptr;
  VipsImage* composited = nullptr;

  try {
    baseAlpha = ensureAlpha(base);
    overlayAlpha = ensureAlpha(overlay);
    g_object_unref(overlay);
    overlay = nullptr;

    int left = 0;
    int top = 0;
    if (op.left.has_value() || op.top.has_value()) {
      left = op.left.value_or(0);
      top = op.top.value_or(0);
    } else {
      gravityOffset(op.gravity, baseAlpha->Xsize, baseAlpha->Ysize,
                    overlayAlpha->Xsize, overlayAlpha->Ysize, &left, &top);
    }

    if (vips_composite2(baseAlpha, overlayAlpha, &composited,
                        VIPS_BLEND_MODE_OVER, "x", left, "y", top, nullptr)) {
      throwVips("composite");
    }

    g_object_unref(baseAlpha);
    g_object_unref(overlayAlpha);
    return composited;
  } catch (...) {
    if (overlay != nullptr) {
      g_object_unref(overlay);
    }
    if (baseAlpha != nullptr) {
      g_object_unref(baseAlpha);
    }
    if (overlayAlpha != nullptr) {
      g_object_unref(overlayAlpha);
    }
    if (composited != nullptr) {
      g_object_unref(composited);
    }
    throw;
  }
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

GravityMode parseGravity(const std::string& gravity) {
  if (gravity == "north")
    return GravityMode::North;
  if (gravity == "northeast")
    return GravityMode::NorthEast;
  if (gravity == "east")
    return GravityMode::East;
  if (gravity == "southeast")
    return GravityMode::SouthEast;
  if (gravity == "south")
    return GravityMode::South;
  if (gravity == "southwest")
    return GravityMode::SouthWest;
  if (gravity == "west")
    return GravityMode::West;
  if (gravity == "northwest")
    return GravityMode::NorthWest;
  // centre / center / unknown → centre
  return GravityMode::Centre;
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
    if (ops.rotate.has_value()) {
      if (ops.rotate->autorotate) {
        VipsImage* rotated = nullptr;
        if (vips_autorot(current, &rotated, nullptr)) {
          throwVips("autorotate");
        }
        replace(rotated);
      } else if (std::abs(ops.rotate->angle) > 0.0001) {
        VipsImage* rotated = nullptr;
        if (vips_rotate(current, &rotated, ops.rotate->angle, nullptr)) {
          throwVips("rotate");
        }
        replace(rotated);
      }
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

    if (ops.backgroundBlur.has_value()) {
      replace(applyBackgroundBlur(current, *ops.backgroundBlur));
    }

    if (ops.roundCorners.has_value() && ops.roundCorners->radius > 0.01) {
      replace(applyRoundCorners(current, *ops.roundCorners));
    }

    for (const auto& composite : ops.composites) {
      replace(applyComposite(current, composite));
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
      status = vips_jpegsave(image, path.c_str(), "Q", encode.quality,
                            "interlace", encode.progressive ? TRUE : FALSE,
                            nullptr);
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
                                    "interlace",
                                    encode.progressive ? TRUE : FALSE, nullptr);
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
