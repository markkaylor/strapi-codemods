/**
 * Migrate API folder structure to v4
 */

const { join } = require("path");
const fs = require("fs-extra");
const _ = require("lodash");
_.mixin(require("lodash-inflection"));

/**
 * @description Migrates settings.json to schema.json
 *
 * @param {string} apiPath Path to the current api
 * @param {string} contentTypeName Name of the current contentType
 */
const convertModelToContentType = async (apiPath, contentTypeName) => {
  const settingsJsonPath = join(
    apiPath,
    "models",
    `${contentTypeName}.settings.json`
  );

  const exists = await fs.exists(settingsJsonPath);
  if (!exists) {
    console.error(`error: ${contentTypeName}.settings.json does not exist`);
    return;
  }

  const v4SchemaJsonPath = join(
    apiPath,
    "content-types",
    contentTypeName.toLowerCase(),
    "schema.json"
  );

  try {
    // Read the settings.json file
    const settingsJson = await fs.readJson(settingsJsonPath);
    // Create a copy
    const schemaJson = { ...settingsJson };
    const infoUpdate = {
      singularName: contentTypeName,
      pluralName: _.pluralize(contentTypeName),
      displayName: contentTypeName,
      name: contentTypeName,
    };
    // Modify the JSON
    _.set(schemaJson, "info", infoUpdate);
    // Create the new content-types/api/schema.json file
    await fs.ensureFile(v4SchemaJsonPath);
    // Write modified JSON to schema.json
    await fs.writeJSON(v4SchemaJsonPath, schemaJson, {
      spaces: 2,
    });
  } catch (error) {
    console.error(
      `error: an error occured when migrating the model at ${settingsJsonPath} to a contentType at ${v4SchemaJsonPath} `
    );
  }
};

const updateContentTypes = async (apiPath) => {
  const allModels = await fs.readdir(join(apiPath, "models"), {
    withFileTypes: true,
  });
  const allModelFiles = allModels.filter(
    (f) => f.isFile() && f.name.includes("settings")
  );

  if (!allModelFiles.length) {
    await fs.remove(join(apiPath, "models"));
  }

  for (const model of allModelFiles) {
    const [contentTypeName] = model.name.split(".");
    await convertModelToContentType(apiPath, contentTypeName);
  }

  // all models have been deleted, remove the directory
  await fs.remove(join(apiPath, "models"));
};

module.exports = updateContentTypes