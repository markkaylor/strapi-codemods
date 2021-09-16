/**
 * Migrate API folder structure to v4
 */

const { resolve, join } = require("path");
const fs = require("fs-extra");
const _ = require("lodash");
var pluralize = require("pluralize");
const j = require("jscodeshift");
const { inspect } = require("util");

const normalizeName = _.kebabCase;

const updateContentTypes = async (apiDirCopyPath, apiName) => {
  try {
    const schemaSettingsJson = join(
      apiDirCopyPath,
      apiName,
      "models",
      `${apiName}.settings.json`
    );
    const exists = await fs.exists(schemaSettingsJson);
    if (!exists) {
      console.error(`${apiName}.settings.json does not exist`);
    }

    // Read the settings.json file
    const settingsJson = await fs.readJson(schemaSettingsJson);
    // Create a copy
    const schemaJson = { ...settingsJson };
    const infoUpdate = {
      singularName: apiName,
      pluralName: pluralize(apiName),
      displayName: apiName,
      name: apiName,
    };
    // Modify the JSON
    _.set(schemaJson, "info", infoUpdate);
    // Create the new content-types/api/schema.json file
    await fs.ensureFile(
      join(apiDirCopyPath, apiName, "content-types", apiName, "schema.json")
    );
    // Write modified JSON to schema.json
    await fs.writeJSON(
      join(apiDirCopyPath, apiName, "content-types", apiName, "schema.json"),
      schemaJson,
      {
        spaces: 2,
      }
    );

    // Delete the models folder
    await fs.remove(join(apiDirCopyPath, apiName, "models"));
  } catch (error) {
    console.error(error.message);
  }
};

const updateRoutes = async (apiDirCopyPath, apiName) => {
  try {
    // Create the js file
    await fs.ensureFile(
      join(apiDirCopyPath, apiName, "routes", `${apiName}.js`)
    );

    // Create write stream for new js file
    const file = fs.createWriteStream(
      join(apiDirCopyPath, apiName, "routes", `${apiName}.js`)
    );
    // Get the existing JSON routes file
    const routesJson = await fs.readJson(
      join(apiDirCopyPath, apiName, "config", "routes.json")
    );
    // Recursively transform objects to strings
    const routes = inspect(routesJson, { depth: Infinity });

    // Export routes from create js file
    file.write(`module.exports = ${routes}`);

    // Close the write stream
    file.end();

    // Delete config/routes.json
    await fs.remove(join(apiDirCopyPath, apiName, "config", "routes.json"));
  } catch (error) {
    console.error(error);
  }
};

const updatePolicies = async (apiDirCopyPath, apiName) => {
  const v3PoliciesPath = join(apiDirCopyPath, apiName, "config", "policies");
  const exists = await fs.exists(v3PoliciesPath);
  if (!exists) return;

  const v3Policies = await fs.readdir(v3PoliciesPath, { withFileTypes: true });
  const policyFiles = v3Policies.filter((fd) => fd.isFile());

  for (const policy of policyFiles) {
    try {
      await fs.copy(
        v3PoliciesPath,
        join(apiDirCopyPath, apiName, "policies", policy.name)
      );

      await fs.remove(join(v3PoliciesPath, policy.name));
    } catch (error) {
      console.error(error.message);
    }
  }
};

const clean = () => {
  console.log("just gotta check for empty dirs");
};

const updateApiFolderStructure = async () => {
  // Make a copy of the api folder => api-copy
  const strapiAppPath = resolve(process.cwd());
  const apiDirCopyPath = join(strapiAppPath, "api-copy");
  await fs.copy(join(strapiAppPath, "api"), apiDirCopyPath);

  // Get the apis
  const apis = await fs.readdir(apiDirCopyPath, { withFileTypes: true });
  const apiDirs = apis.filter((fd) => fd.isDirectory());

  for (const api of apiDirs) {
    const apiName = normalizeName(api.name);
    await updateContentTypes(apiDirCopyPath, apiName);
    await updateRoutes(apiDirCopyPath, apiName);
    await updatePolicies(apiDirCopyPath, apiName);
  }

  clean();
};

updateApiFolderStructure();
