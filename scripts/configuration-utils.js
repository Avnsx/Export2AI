/** Helpers for contributes.configuration (single object or categorized array). */

function getConfigurationSections(contributes) {
  const config = contributes?.configuration;
  if (!config) {
    return [];
  }
  return Array.isArray(config) ? config : [config];
}

function allConfigurationProperties(manifest) {
  const merged = {};
  for (const section of getConfigurationSections(manifest?.contributes)) {
    Object.assign(merged, section.properties ?? {});
  }
  return merged;
}

function findConfigurationSetting(manifest, settingKey) {
  for (const section of getConfigurationSections(manifest?.contributes)) {
    const setting = section.properties?.[settingKey];
    if (setting) {
      return { section, properties: section.properties, setting };
    }
  }
  return undefined;
}

function getConfigurationProperty(manifest, settingKey) {
  return allConfigurationProperties(manifest)[settingKey];
}

module.exports = {
  getConfigurationSections,
  allConfigurationProperties,
  findConfigurationSetting,
  getConfigurationProperty
};
