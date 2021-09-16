/**
 * Migrate API folder structure to v4
 */

const { resolve, join } = require("path");
const fs = require("fs-extra");
const _ = require("lodash");
var pluralize = require("pluralize");
const { inspect } = require("util");
const execa = require("execa");
const jscodeshiftExecutable = require.resolve(".bin/jscodeshift");

const normalizeName = _.kebabCase;

const convertModelToContentType = async (apiPath, contentTypeName) => {
  const settingsJsonPath = join(
    apiPath,
    "models",
    `${contentTypeName}.settings.json`
  );
  const exists = await fs.exists(settingsJsonPath);
  if (!exists) {
    console.error(`${contentTypeName}.settings.json does not exist`);
  }

  // Read the settings.json file
  const settingsJson = await fs.readJson(settingsJsonPath);
  // Create a copy
  const schemaJson = { ...settingsJson };
  const infoUpdate = {
    singularName: contentTypeName,
    pluralName: pluralize(contentTypeName),
    displayName: contentTypeName,
    name: contentTypeName,
  };
  // Modify the JSON
  _.set(schemaJson, "info", infoUpdate);
  // Create the new content-types/api/schema.json file
  await fs.ensureFile(
    join(apiPath, "content-types", contentTypeName, "schema.json")
  );
  // Write modified JSON to schema.json
  await fs.writeJSON(
    join(apiPath, "content-types", contentTypeName, "schema.json"),
    schemaJson,
    {
      spaces: 2,
    }
  );
};

const updateContentTypes = async (apiPath) => {
  try {
    const allModels = await fs.readdir(join(apiPath, "models"), {
      withFileTypes: true,
    });
    const allModelFiles = allModels.filter(
      (f) => f.isFile() && f.name.includes("settings")
    );

    if (allModelFiles.length > 1) {
      // loop
      for (const model of allModelFiles) {
        const [contentTypeName] = model.name.split(".");
        await convertModelToContentType(apiPath, contentTypeName);
      }
    } else {
      // skip the loop
      const [contentTypeName] = allModelFiles[0].name.split(".");
      await convertModelToContentType(apiPath, contentTypeName);
    }

    // Delete the v3 models folder
    await fs.remove(join(apiPath, "models"));
  } catch (error) {
    console.error(error.message);
  }
};

const updateRoutes = async (apiPath, apiName) => {
  try {
    // Create the js file
    await fs.ensureFile(join(apiPath, "routes", `${apiName}.js`));

    // Create write stream for new js file
    const file = fs.createWriteStream(join(apiPath, "routes", `${apiName}.js`));
    // Get the existing JSON routes file
    const routesJson = await fs.readJson(
      join(apiPath, "config", "routes.json")
    );
    const { routes } = routesJson;

    // Remove count
    const updatedRoutes = routes.filter(
      (route) => !route.handler.includes("count")
    );

    // Recursively transform objects to strings
    const routesToString = inspect(
      { routes: updatedRoutes },
      { depth: Infinity }
    );

    // Export routes from create js file
    file.write(`module.exports = ${routesToString}`);

    // Close the write stream
    file.end();

    // Delete the v3 config/routes.json
    await fs.remove(join(apiPath, "config", "routes.json"));
  } catch (error) {
    console.error(error);
  }
};

const updatePolicies = async (apiPath) => {
  const v3PoliciesPath = join(apiPath, "config", "policies");
  const exists = await fs.exists(v3PoliciesPath);
  if (!exists) return;

  const v3Policies = await fs.readdir(v3PoliciesPath, { withFileTypes: true });
  const policyFiles = v3Policies.filter((fd) => fd.isFile());

  // The old policy folder is empty, delete it
  if (!policyFiles.length) {
    await fs.remove(v3PoliciesPath);
  }

  const v4PoliciesPath = join(apiPath, "policies");
  if (policyFiles.length > 1) {
    for (const policy of policyFiles) {
      try {
        await fs.copy(v3PoliciesPath, join(v4PoliciesPath, policy.name));
        // Remove the current v3 policy
        await fs.remove(join(v3PoliciesPath, policy.name));
      } catch (error) {
        console.error(error.message);
      }
    }
  } else {
    await fs.copy(v3PoliciesPath, join(v4PoliciesPath, policyFiles[0].name));
    // The last policy has been copied, delete the v3 policy folder
    await fs.remove(v3PoliciesPath);
  }
};

const updateServices = async (apiPath) => {
  const result = execa.sync(jscodeshiftExecutable, [
    "-t",
    join(__dirname, "..", "transforms", "use-named-exports-for-service.js"),
    join(apiPath, "services"),
  ]);

  if (result.error) {
    throw result.error;
  }
};

const clean = () => {
  console.log("done");
};

const renameApiFolder = async (apiDirCopyPath) => {
  try {
    fs.renameSync(apiDirCopyPath, "api");
  } catch (error) {
    console.error("error:", error.message);
  }
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
    const apiPath = join(apiDirCopyPath, apiName);
    await updateContentTypes(apiPath);
    await updateRoutes(apiPath, apiName);
    await updatePolicies(apiPath);
    await updateServices(apiPath);
  }

  clean();
  renameApiFolder(apiDirCopyPath);
};

updateApiFolderStructure();
