"use strict";

const fse = require("fs-extra");
const path = require("path");
const _ = require("lodash");
const axios = require("axios");
const { strapiPackages, toBeDeleted } = require("../utils/strapi-packages");

async function getLatestStrapiVersion() {
  const response = await axios.get(`https://api.npms.io/v2/package/${encodeURIComponent('@strapi/strapi')}`);
  return response.data.collected.metadata.version;
}

async function updatePackageDependencies(appPath) {
  // Import the app's package.json as an object
  const packageJSONPath = path.resolve(appPath, 'package.json');
  let packageJSON;
  try {
    packageJSON = require(packageJSONPath);
  } catch (error) {
    throw Error('Could not find a package.json. Are you sure this is a Strapi app?');
  }
  if (_.isEmpty(packageJSON.dependencies)) {
    throw Error(`${appPath} does not have dependencies`)
  }

  // Get the latest Strapi release version
  const latestStrapiVersion = await getLatestStrapiVersion(); 

  // Write all the package JSON changes in a new object
  const v4PackageJSON = _.cloneDeep(packageJSON);
  Object.keys(packageJSON.dependencies).forEach((depName) => {
    const newStrapiDependency = strapiPackages[depName];
    if (newStrapiDependency) {
      // The dependency is a v3 Strapi package, remove it
      delete v4PackageJSON.dependencies[depName];
      if (newStrapiDependency === toBeDeleted) {
        // Warn user if the dependency doesn't exist anymore
        console.warn(`warning: ${depName} does not exist anymore in Strapi v4`)
      } else {
        // Replace dependency if there's a matching v4 package
        v4PackageJSON.dependencies[newStrapiDependency] = latestStrapiVersion;
        
      }
    }
  })

  await fse.writeJSON(packageJSONPath, v4PackageJSON, { spaces: 2 });
}

const args = process.argv.slice(2);

try {
  if (args.length === 0) {
    throw Error(
      "No argument provided, please provide the path to your Strapi app"
    );
  }

  if (args.length > 1) {
    throw Error(
      "Too many arguments, please only provide the path to your Strapi app"
    );
  }

  const [appPath] = args;
  updatePackageDependencies(appPath);
} catch (error) {
  console.error(error.message);
}

module.exports = {
  updatePackageDependencies
}