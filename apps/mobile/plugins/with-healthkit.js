const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');
module.exports = (config) => {
  config = withEntitlementsPlist(config, (c) => {
    c.modResults['com.apple.developer.healthkit'] = true;
    return c;
  });
  return withInfoPlist(config, (c) => {
    c.modResults.NSHealthShareUsageDescription = '健康循环只读取您选择的步数；睡眠和心率需另行开启。最少化步数摘要仅在您同意云端同步后上传，用于任务核实。';
    // No NSHealthUpdateUsageDescription: this module never requests write authorization.
    return c;
  });
};
