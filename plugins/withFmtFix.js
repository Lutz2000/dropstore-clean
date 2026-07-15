const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withFmtFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');
      if (podfile.includes('FMT_USE_NONTYPE_TEMPLATE_ARGS')) return config;
      const patch = `
    installer.pods_project.targets.each do |target|
      if target.name == 'fmt'
        target.build_configurations.each do |config|
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
          config.build_settings['OTHER_CPLUSPLUSFLAGS'] = '$(inherited) -DFMT_USE_NONTYPE_TEMPLATE_ARGS=0'
        end
      end
      target.build_configurations.each do |config|
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
      end
    end
`;
      if (podfile.includes('post_install do |installer|')) {
        podfile = podfile.replace('post_install do |installer|', 'post_install do |installer|\n' + patch);
      } else {
        podfile += '\npost_install do |installer|\n' + patch + '\nend\n';
      }
      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
