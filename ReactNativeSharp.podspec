require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "ReactNativeSharp"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported, :visionos => 1.0 }
  s.source       = { :git => "https://github.com/react-native-sharp/react-native-sharp.git", :tag => "#{s.version}" }

  # Include ios headers in source_files so CocoaPods copies them into the
  # module Headers dir. public_header_files alone still puts them in the
  # umbrella (#import "Bridge.h") but they won't resolve at compile time —
  # common failure with DEFINES_MODULE + static frameworks (RN 0.85+).
  s.source_files = [
    "ios/**/*.{h,m,mm,swift}",
    "cpp/**/*.{hpp,cpp}",
  ]

  # Keep implementation headers private. Exposing cpp headers that include
  # libvips/glib in the ObjC module umbrella breaks Xcode 26+ Clang modules
  # ("Import of C++ module ... appears within extern \"C\"").
  s.public_header_files = [
    "ios/**/*.h",
  ]
  s.private_header_files = [
    "cpp/**/*.{h,hpp}",
  ]

  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    "HEADER_SEARCH_PATHS" => "$(inherited) \"$(PODS_TARGET_SRCROOT)/cpp\" \"$(PODS_TARGET_SRCROOT)/third_party/libvips/ios/vips.xcframework/ios-arm64/Headers\" \"$(PODS_TARGET_SRCROOT)/third_party/libvips/ios/vips.xcframework/ios-arm64_x86_64-simulator/Headers\"",
  }

  vips_xcframework = File.join(__dir__, "third_party/libvips/ios/vips.xcframework")
  unless File.exist?(File.join(vips_xcframework, "Info.plist"))
    raise "libvips iOS prebuild missing. Run: npm run download-libvips (expected #{vips_xcframework})"
  end
  s.vendored_frameworks = "third_party/libvips/ios/vips.xcframework"
  # iconv/resolv are required by glib (bundled inside the vips xcframework).
  s.libraries = "c++", "z", "iconv", "resolv"

  load 'nitrogen/generated/ios/ReactNativeSharp+autolinking.rb'
  add_nitrogen_files(s)

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s)
end
