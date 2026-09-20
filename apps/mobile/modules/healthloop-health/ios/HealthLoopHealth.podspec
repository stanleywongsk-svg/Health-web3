Pod::Spec.new do |s|
  s.name = 'HealthLoopHealth'
  s.version = '0.1.0'
  s.summary = 'Read-only, source-aware HealthKit adapter for HealthLoop'
  s.description = 'Bounded read queries with cancellation; no HealthKit write APIs.'
  s.author = 'HealthLoop'
  s.homepage = 'https://docs.expo.dev/modules/'
  s.license = 'MIT'
  s.platforms = { :ios => '15.1' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit'
  s.swift_version = '5.9'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
