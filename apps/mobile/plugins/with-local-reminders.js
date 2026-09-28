const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

// Expo's automatic notifications plugin adds push entitlements by default. This
// application only schedules local generic reminders; it never registers APNs.
module.exports = (config) => {
  config = withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });
  return withInfoPlist(config, (c) => {
    if (Array.isArray(c.modResults.UIBackgroundModes)) {
      c.modResults.UIBackgroundModes = c.modResults.UIBackgroundModes.filter(mode => mode !== 'remote-notification');
      if (c.modResults.UIBackgroundModes.length === 0) delete c.modResults.UIBackgroundModes;
    }
    return c;
  });
};
